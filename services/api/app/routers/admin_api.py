"""Admin panel API. Auth: `Authorization: Bearer <jwt>` obtained via a bot login link.

Roles: host (live, groups, own results) < admin (content, all results) < superadmin (roles, settings).
"""
from __future__ import annotations

import csv
import difflib
import io
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.responses import Response
from sqlalchemy import Date, cast, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import SessionLocal, get_db
from ..models import (Attempt, AttemptAnswer, AuditLog, Group, GroupAssignment, LiveParticipant, LiveSession,
                      Notification, Question, QuestionOption, Quiz, QuizQuestion, Subtopic, Topic, User, new_id,
                      utcnow)
from ..schemas import (AdminSession, AdminUserOut, AssignmentIn, BlockIn, GroupPatch, ImportCommit, ImportPreview,
                       ImportRow, LiveCreate, LiveState, Page, QuestionAdminOut, QuestionIn, QuizAdminOut, QuizIn,
                       RoleIn, SettingsIn, TopicAdminOut, TopicIn)
from ..security import exchange_login_token, make_admin_jwt, require_role, role_at_least
from ..services import catalog, live as live_svc
from ..services.settings_store import get_settings, save_settings
from .. import telegram

router = APIRouter(prefix="/api/admin", tags=["admin"])
host = require_role("host")
admin = require_role("admin")
superadmin = require_role("superadmin")


async def audit(db: AsyncSession, actor: User, action: str, target: str | None = None, **details: Any) -> None:
    db.add(AuditLog(actor_id=actor.id, action=action, target=target, details=details or None))


def admin_user(u: User, tests: int = 0, accuracy: int | None = None) -> AdminUserOut:
    return AdminUserOut(id=u.id, telegram_id=u.telegram_id, name=f"{u.first_name} {u.last_name or ''}".strip(),
                        username=u.username, photo_url=u.photo_url, role=u.role, is_blocked=u.is_blocked,
                        tests=tests, accuracy=accuracy, last_seen_at=u.last_seen_at)


# ---------------- auth ----------------

@router.post("/auth/exchange", response_model=AdminSession)
async def exchange(body: dict, db: AsyncSession = Depends(get_db)):
    user = await exchange_login_token(db, str(body.get("token", "")))
    await audit(db, user, "login")
    await db.commit()
    return AdminSession(token=make_admin_jwt(user), user=admin_user(user))


@router.post("/auth/dev", response_model=AdminSession)
async def dev_login(body: dict, db: AsyncSession = Depends(get_db)):
    """Local development only (ALLOW_DEV_AUTH=1): log in as a Telegram id."""
    if not settings.allow_dev_auth:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    tid = int(body.get("telegramId", 0))
    user = (await db.execute(select(User).where(User.telegram_id == tid))).scalar_one_or_none()
    if user is None:
        user = User(telegram_id=tid, first_name="Dev", last_name="Admin", role="superadmin")
        db.add(user)
        await db.commit()
    return AdminSession(token=make_admin_jwt(user), user=admin_user(user))


@router.get("/me", response_model=AdminUserOut)
async def me(user: User = Depends(host)):
    return admin_user(user)


# ---------------- dashboard ----------------

@router.get("/dashboard")
async def dashboard(days: int = Query(7, ge=1, le=90), user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    now = utcnow()
    since = now - timedelta(days=days)
    week = now - timedelta(days=7)
    scalar = lambda q: db.execute(q)  # noqa: E731
    users_total = (await scalar(select(func.count()).select_from(User))).scalar_one()
    users_week = (await scalar(select(func.count()).select_from(User).where(User.created_at >= week))).scalar_one()
    q_total = (await scalar(select(func.count()).select_from(Question).where(Question.status != "archived"))).scalar_one()
    q_drafts = (await scalar(select(func.count()).select_from(Question).where(Question.status == "draft"))).scalar_one()
    quizzes_pub = (await scalar(select(func.count()).select_from(Quiz).where(Quiz.status == "published"))).scalar_one()
    topics_n = (await scalar(select(func.count()).select_from(Topic).where(Topic.is_active.is_(True)))).scalar_one()
    per_day_rows = (await scalar(select(cast(Attempt.started_at, Date), func.count()).where(Attempt.started_at >= since)
                                 .group_by(cast(Attempt.started_at, Date)))).all()
    per_day = {d.isoformat(): n for d, n in per_day_rows}
    series = []
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i)).date().isoformat()
        series.append({"date": d, "count": per_day.get(d, 0)})
    lives = (await scalar(select(LiveSession).where(LiveSession.state.in_(live_svc.ACTIVE)))).unique().scalars().all()
    active = []
    for s in lives:
        n = (await scalar(select(func.count()).select_from(LiveParticipant).where(LiveParticipant.live_id == s.id))).scalar_one()
        active.append({"kind": "live", "id": s.id, "title": s.title, "state": s.state, "index": s.current_index,
                       "total": len(s.snapshot), "participants": n})
    open_asg = (await scalar(select(GroupAssignment).where(GroupAssignment.is_closed.is_(False),
                                                           or_(GroupAssignment.closes_at.is_(None),
                                                               GroupAssignment.closes_at > now)))).unique().scalars().all()
    for a in open_asg:
        passed = (await scalar(select(func.count()).select_from(Attempt).where(
            Attempt.assignment_id == a.id, Attempt.status.in_(catalog.DONE)))).scalar_one()
        active.append({"kind": "group", "id": a.id, "title": f"{a.group.title} · {a.quiz.title}", "passed": passed,
                       "members": a.group.members_count})
    last = (await scalar(select(Attempt).where(Attempt.status.in_(catalog.DONE)).order_by(Attempt.finished_at.desc())
                         .limit(6))).unique().scalars().all()
    hard_rows = (await scalar(
        select(AttemptAnswer.question_id, func.count(), func.count().filter(AttemptAnswer.outcome == "correct"))
        .group_by(AttemptAnswer.question_id).having(func.count() >= 5))).all()
    hardest = sorted(((qid, round(100 * (c or 0) / n)) for qid, n, c in hard_rows), key=lambda r: r[1])[:5]
    qmap = {q.id: q for q in (await scalar(select(Question).where(Question.id.in_([h[0] for h in hardest]))))
            .unique().scalars()}
    return {
        "usersTotal": users_total, "usersWeek": users_week, "questionsTotal": q_total, "questionsDrafts": q_drafts,
        "testsPublished": quizzes_pub, "topics": topics_n, "attemptsTotal": sum(s["count"] for s in series),
        "series": series, "active": active,
        "lastResults": [_result_row(a) for a in last],
        "hardest": [{"id": qid, "text": qmap[qid].text, "topic": qmap[qid].topic.title, "rate": rate}
                    for qid, rate in hardest if qid in qmap],
    }


def _result_row(a: Attempt) -> dict[str, Any]:
    total = a.correct + a.wrong + a.unanswered
    return {"id": a.id, "userName": a.user.display_name, "username": a.user.username, "quizTitle": a.quiz_title,
            "mode": a.mode, "points": a.points, "maxPoints": a.max_points,
            "accuracy": round(100 * a.correct / total) if total else None,
            "correct": a.correct, "wrong": a.wrong, "unanswered": a.unanswered, "status": a.status,
            "answered": len(a.answers), "startedAt": a.started_at.isoformat(),
            "finishedAt": a.finished_at.isoformat() if a.finished_at else None, "assignmentId": a.assignment_id}


# ---------------- topics ----------------

def _slugify(title: str) -> str:
    table = str.maketrans({"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z",
                           "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
                           "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh",
                           "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya"})
    s = re.sub(r"[^a-z0-9]+", "-", title.lower().translate(table)).strip("-")
    return s or new_id()[:8]


async def _topic_out(db: AsyncSession, t: Topic) -> TopicAdminOut:
    tests = (await db.execute(select(func.count()).select_from(Quiz).where(Quiz.topic_id == t.id,
                                                                           Quiz.status != "archived"))).scalar_one()
    qs = (await db.execute(select(func.count()).select_from(Question).where(Question.topic_id == t.id,
                                                                            Question.status != "archived"))).scalar_one()
    await db.refresh(t, ["subtopics"])
    return TopicAdminOut(id=t.id, slug=t.slug, title=t.title, description=t.description, color=t.color,
                         illustration=t.illustration, position=t.position, is_active=t.is_active,
                         subtopics=[{"id": s.id, "title": s.title} for s in t.subtopics], tests_count=tests,
                         questions_count=qs)


@router.get("/topics", response_model=list[TopicAdminOut])
async def list_topics(user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Topic).order_by(Topic.position))).scalars().all()
    return [await _topic_out(db, t) for t in rows]


async def _save_subtopics(db: AsyncSession, t: Topic, subs: list) -> None:
    await db.refresh(t, ["subtopics"])
    keep = {s.id for s in subs if s.id}
    for s in list(t.subtopics):
        if s.id not in keep:
            t.subtopics.remove(s)
    existing = {s.id: s for s in t.subtopics}
    for i, s in enumerate(subs):
        if s.id and s.id in existing:
            existing[s.id].title, existing[s.id].position = s.title, i
        else:
            t.subtopics.append(Subtopic(title=s.title, position=i))


@router.post("/topics", response_model=TopicAdminOut)
async def create_topic(body: TopicIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    pos = (await db.execute(select(func.coalesce(func.max(Topic.position), -1)))).scalar_one() + 1
    slug = body.slug or _slugify(body.title)
    if (await db.execute(select(Topic).where(Topic.slug == slug))).scalar_one_or_none():
        slug = f"{slug}-{new_id()[:4]}"
    t = Topic(slug=slug, title=body.title, description=body.description, color=body.color,
              illustration=body.illustration, is_active=body.is_active, position=pos)
    db.add(t)
    await db.flush()
    await _save_subtopics(db, t, body.subtopics)
    await audit(db, user, "topic.create", t.id, title=t.title)
    await db.commit()
    return await _topic_out(db, t)


@router.put("/topics/{tid}", response_model=TopicAdminOut)
async def update_topic(tid: str, body: TopicIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    t = await db.get(Topic, tid)
    if t is None:
        raise HTTPException(404)
    for k in ("title", "description", "color", "illustration", "is_active"):
        setattr(t, k, getattr(body, k))
    await _save_subtopics(db, t, body.subtopics)
    await audit(db, user, "topic.update", t.id)
    await db.commit()
    return await _topic_out(db, t)


@router.post("/topics/reorder", status_code=204)
async def reorder_topics(ids: list[str], user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    for i, tid in enumerate(ids):
        t = await db.get(Topic, tid)
        if t:
            t.position = i
    await audit(db, user, "topic.reorder")
    await db.commit()


@router.delete("/topics/{tid}")
async def delete_topic(tid: str, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    """Deletes a section for good: its tests and all its questions.
    Students keep their past results — attempts store their own copy of the questions."""
    t = await db.get(Topic, tid)
    if t is None:
        raise HTTPException(404)
    quizzes = (await db.execute(select(Quiz).where(Quiz.topic_id == tid))).unique().scalars().all()
    if [q for q in quizzes if await _is_live(db, q.id)]:
        raise HTTPException(409, "В этом разделе сейчас идёт эфир — завершите его и удалите раздел")
    title = t.title
    tests_deleted = q_deleted = 0
    for quiz in quizzes:
        _reason, d, _k = await _delete_test(db, user, quiz)
        tests_deleted, q_deleted = tests_deleted + 1, q_deleted + d
    await db.flush()
    other = (await db.execute(select(Quiz.id).join(QuizQuestion, QuizQuestion.quiz_id == Quiz.id)
                              .join(Question, Question.id == QuizQuestion.question_id)
                              .where(Question.topic_id == tid))).scalars().all()
    for q in (await db.execute(select(Question).where(Question.topic_id == tid))).unique().scalars().all():
        await db.delete(q)  # also leaves other sections' tests that borrowed it
        q_deleted += 1
    await db.flush()
    await sync_durations(db, set(other))
    await db.delete(t)
    await audit(db, user, "topic.delete", tid, title=title, testsDeleted=tests_deleted, questionsDeleted=q_deleted)
    await db.commit()
    return {"removed": True, "testsDeleted": tests_deleted, "testsArchived": 0,
            "questionsDeleted": q_deleted, "questionsKept": 0}


# ---------------- questions ----------------

async def _correct_rates(db: AsyncSession, ids: list[str]) -> dict[str, int]:
    if not ids:
        return {}
    rows = (await db.execute(select(AttemptAnswer.question_id, func.count(),
                                    func.count().filter(AttemptAnswer.outcome == "correct"))
                             .where(AttemptAnswer.question_id.in_(ids)).group_by(AttemptAnswer.question_id))).all()
    return {qid: round(100 * c / n) for qid, n, c in rows if n}


def _question_out(q: Question, rate: int | None = None) -> QuestionAdminOut:
    return QuestionAdminOut(id=q.id, topic_id=q.topic_id, topic_title=q.topic.title, subtopic_id=q.subtopic_id,
                            subtopic_title=q.subtopic.title if q.subtopic else None, text=q.text, image_url=q.image_url,
                            difficulty=q.difficulty, points=q.points, explanation_ru=q.explanation_ru,
                            explanation_uz=q.explanation_uz, status=q.status,
                            options=[{"id": o.id, "text": o.text, "isCorrect": o.is_correct} for o in q.options],
                            correct_rate=rate, updated_at=q.updated_at)


def _validate_question(body: QuestionIn) -> None:
    errs = []
    if not body.text.strip():
        errs.append("Нет текста вопроса")
    if len(body.options) != 4 or any(not o.text.strip() for o in body.options):
        errs.append("Нужны все четыре варианта ответа")
    if sum(1 for o in body.options if o.is_correct) != 1:
        errs.append("Отметьте ровно один правильный ответ")
    if body.points < 10 or body.points % 10:
        errs.append("Баллы — целое число от 10, кратное 10")
    if errs:
        raise HTTPException(422, "; ".join(errs))


@router.get("/questions", response_model=Page)
async def list_questions(topic_id: str | None = None, difficulty: str | None = None, status_: str | None = Query(None, alias="status"),
                         q: str = "", page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=200),
                         user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    stmt = select(Question)
    if topic_id:
        stmt = stmt.where(Question.topic_id == topic_id)
    if difficulty:
        stmt = stmt.where(Question.difficulty == difficulty)
    if status_:
        stmt = stmt.where(Question.status == status_)
    if q.strip():
        stmt = stmt.where(Question.text.ilike(f"%{q.strip()}%"))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(Question.updated_at.desc()).offset((page - 1) * size).limit(size)))\
        .unique().scalars().all()
    rates = await _correct_rates(db, [r.id for r in rows])
    return Page(items=[_question_out(r, rates.get(r.id)).model_dump(by_alias=True, mode="json") for r in rows],
                total=total)


@router.get("/questions/{qid}", response_model=QuestionAdminOut)
async def get_question(qid: str, user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    q = await db.get(Question, qid)
    if q is None:
        raise HTTPException(404)
    return _question_out(q, (await _correct_rates(db, [qid])).get(qid))


@router.post("/questions", response_model=QuestionAdminOut)
async def create_question(body: QuestionIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    _validate_question(body)
    q = Question(**body.model_dump(exclude={"options"}),
                 options=[QuestionOption(position=i, text=o.text.strip(), is_correct=o.is_correct)
                          for i, o in enumerate(body.options)])
    db.add(q)
    await db.flush()
    await audit(db, user, "question.create", q.id)
    await db.commit()
    return _question_out(await db.get(Question, q.id, populate_existing=True))


@router.put("/questions/{qid}", response_model=QuestionAdminOut)
async def update_question(qid: str, body: QuestionIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    """Edited in place — past attempts keep their own snapshot, so results stay correct."""
    _validate_question(body)
    q = await db.get(Question, qid)
    if q is None:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude={"options"}).items():
        setattr(q, k, v)
    for o, new in zip(sorted(q.options, key=lambda x: x.position), body.options):
        o.text, o.is_correct = new.text.strip(), new.is_correct
    q.updated_at = utcnow()
    await audit(db, user, "question.update", q.id)
    affected = set((await db.execute(select(QuizQuestion.quiz_id).where(QuizQuestion.question_id == qid))).scalars())
    await sync_durations(db, affected)
    await db.commit()
    return _question_out(await db.get(Question, qid, populate_existing=True))


@router.post("/questions/bulk", status_code=204)
async def bulk_questions(body: dict, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    ids: list[str] = body.get("ids", [])
    action = body.get("action")
    affected = set((await db.execute(select(QuizQuestion.quiz_id).where(QuizQuestion.question_id.in_(ids)))).scalars())
    for qid in ids:
        q = await db.get(Question, qid)
        if q is None:
            continue
        if action in ("archive", "publish", "draft"):
            q.status = {"archive": "archived", "publish": "published", "draft": "draft"}[action]
        elif action == "delete":
            await db.delete(q)  # removed from its tests too; past results keep their own copy
        elif action == "duplicate":
            db.add(Question(topic_id=q.topic_id, subtopic_id=q.subtopic_id, text=q.text, image_url=q.image_url,
                            difficulty=q.difficulty, points=q.points, explanation_ru=q.explanation_ru,
                            explanation_uz=q.explanation_uz, status="draft",
                            options=[QuestionOption(position=o.position, text=o.text, is_correct=o.is_correct)
                                     for o in q.options]))
        else:
            raise HTTPException(422, "unknown action")
    await db.flush()
    await sync_durations(db, affected)
    await audit(db, user, f"question.{action}", None, count=len(ids))
    await db.commit()


# ---------------- tests (quizzes) ----------------

async def _quiz_out(db: AsyncSession, quiz: Quiz) -> QuizAdminOut:
    await db.refresh(quiz, ["items"])
    attempts = (await db.execute(select(func.count()).select_from(Attempt).where(Attempt.quiz_id == quiz.id))).scalar_one()
    qs = [i.question for i in quiz.items]
    rates = await _correct_rates(db, [q.id for q in qs])
    editor = await db.get(User, quiz.updated_by) if quiz.updated_by else None
    return QuizAdminOut(id=quiz.id, title=quiz.title, topic_id=quiz.topic_id, topic_title=quiz.topic.title,
                        description=quiz.description, difficulty=quiz.difficulty, duration_sec=quiz.duration_sec,
                        live_question_sec=quiz.live_question_sec, mode_individual=quiz.mode_individual,
                        mode_live=quiz.mode_live, mode_group=quiz.mode_group, is_quick=quiz.is_quick,
                        status=quiz.status, questions=[_question_out(q, rates.get(q.id)) for q in qs],
                        questions_count=len([q for q in qs if q.status != "archived"]),
                        max_points=sum(q.points for q in qs if q.status != "archived"), attempts=attempts,
                        published_at=quiz.published_at, updated_at=quiz.updated_at,
                        updated_by_name=editor.display_name if editor else None)


@router.get("/tests")
async def list_tests(status_: str | None = Query(None, alias="status"), user: User = Depends(host),
                     db: AsyncSession = Depends(get_db)):
    stmt = select(Quiz).order_by(Quiz.updated_at.desc())
    if status_:
        stmt = stmt.where(Quiz.status == status_)
    rows = (await db.execute(stmt)).unique().scalars().all()
    counts = dict((await db.execute(select(Attempt.quiz_id, func.count()).group_by(Attempt.quiz_id))).all())
    live_ids = set((await db.execute(select(LiveSession.quiz_id).where(LiveSession.state.in_(live_svc.ACTIVE)))).scalars())
    return [{"id": q.id, "title": q.title, "topicId": q.topic_id, "topicTitle": q.topic.title, "questionsCount": len(catalog.live_questions(q)),
             "durationSec": q.duration_sec, "liveQuestionSec": q.live_question_sec,
             "modes": [m for m, on in (("individual", q.mode_individual), ("live", q.mode_live),
                                       ("group", q.mode_group)) if on],
             "attempts": counts.get(q.id, 0), "status": q.status, "isLive": q.id in live_ids,
             "deletable": q.id not in live_ids,
             "updatedAt": q.updated_at.isoformat()} for q in rows]


@router.get("/tests/{qid}", response_model=QuizAdminOut)
async def get_test(qid: str, user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    quiz = await db.get(Quiz, qid)
    if quiz is None:
        raise HTTPException(404)
    return await _quiz_out(db, quiz)


async def sync_durations(db: AsyncSession, quiz_ids: set[str] | None = None) -> None:
    """Whole-test time = live (non-archived) questions × minutes per question (default 2)."""
    per = (await get_settings(db)).minutes_per_question * 60
    await db.flush()
    stmt = select(Quiz)
    if quiz_ids is not None:
        if not quiz_ids:
            return
        stmt = stmt.where(Quiz.id.in_(quiz_ids))
    for quiz in (await db.execute(stmt)).unique().scalars():
        await db.refresh(quiz, ["items"])
        n = len([i for i in quiz.items if i.question.status != "archived"])
        quiz.duration_sec = max(1, n) * per


async def _apply_quiz(db: AsyncSession, quiz: Quiz, body: QuizIn) -> None:
    for k, v in body.model_dump(exclude={"question_ids", "duration_sec"}).items():
        setattr(quiz, k, v)
    await db.execute(delete(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id))
    seen = set()
    for i, qid in enumerate(body.question_ids):
        if qid in seen:
            continue
        seen.add(qid)
        if await db.get(Question, qid) is None:
            raise HTTPException(422, f"question {qid} not found")
        db.add(QuizQuestion(quiz_id=quiz.id, question_id=qid, position=i))
    await sync_durations(db, {quiz.id})


@router.post("/tests", response_model=QuizAdminOut)
async def create_test(body: QuizIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    quiz = Quiz(id=new_id(), topic_id=body.topic_id, title=body.title, updated_by=user.id)
    db.add(quiz)
    await db.flush()
    await _apply_quiz(db, quiz, body)
    await audit(db, user, "test.create", quiz.id, title=quiz.title)
    await db.commit()
    return await _quiz_out(db, await db.get(Quiz, quiz.id, populate_existing=True))


@router.put("/tests/{qid}", response_model=QuizAdminOut)
async def update_test(qid: str, body: QuizIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    """In-place edit, also for published tests (no versions). Running attempts keep their snapshot."""
    quiz = await db.get(Quiz, qid)
    if quiz is None:
        raise HTTPException(404)
    await _apply_quiz(db, quiz, body)
    quiz.updated_by, quiz.updated_at = user.id, utcnow()
    await audit(db, user, "test.update", quiz.id)
    await db.commit()
    return await _quiz_out(db, await db.get(Quiz, qid, populate_existing=True))


async def _is_live(db: AsyncSession, quiz_id: str) -> bool:
    return bool((await db.execute(select(func.count()).select_from(LiveSession).where(
        LiveSession.quiz_id == quiz_id, LiveSession.state.in_(live_svc.ACTIVE)))).scalar_one())


async def _delete_test(db: AsyncSession, user: User, quiz: Quiz) -> tuple[str | None, int, int]:
    """Deletes a test for good, with its questions (unless another test still uses them).
    Students keep their results: attempts store their own copy of the questions.
    Returns (refusal reason | None, questions deleted, questions kept)."""
    if await _is_live(db, quiz.id):
        return "сейчас идёт эфир по этому тесту — сначала завершите его", 0, 0
    qids = [i.question_id for i in quiz.items]
    await audit(db, user, "test.delete", quiz.id, title=quiz.title)
    await db.delete(quiz)
    await db.flush()
    deleted = kept = 0
    for qid in qids:
        other = (await db.execute(select(func.count()).select_from(QuizQuestion)
                                  .where(QuizQuestion.question_id == qid))).scalar_one()
        q = await db.get(Question, qid)
        if q is None:
            continue
        if other:
            kept += 1
        else:
            await db.delete(q)
            deleted += 1
    return None, deleted, kept


@router.delete("/tests/{qid}")
async def delete_test(qid: str, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    """Deletes a test nobody has taken, with its questions; otherwise 409 (archive it instead)."""
    quiz = await db.get(Quiz, qid)
    if quiz is None:
        raise HTTPException(404)
    reason, deleted, kept = await _delete_test(db, user, quiz)
    if reason:
        raise HTTPException(409, f"Удалить нельзя: {reason}.")
    await db.commit()
    return {"questionsDeleted": deleted, "questionsKept": kept}


@router.post("/tests/bulk")
async def bulk_tests(body: dict, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    """Publish / archive / return to drafts many tests at once. Tests that cannot change are reported, not fatal."""
    action = body.get("action")
    new = {"publish": "published", "archive": "archived", "draft": "draft", "delete": "deleted"}.get(action)
    if new is None:
        raise HTTPException(422, "unknown action")
    done, failed, qdel, qkept = 0, [], 0, 0
    for qid in body.get("ids", []):
        quiz = await db.get(Quiz, qid)
        if quiz is None:
            continue
        if new == "deleted":
            reason, d, k = await _delete_test(db, user, quiz)
            if reason:
                failed.append({"title": quiz.title, "reason": reason})
            else:
                done, qdel, qkept = done + 1, qdel + d, qkept + k
            continue
        if new == "published":
            for i in quiz.items:  # publishing a test publishes its draft questions
                if i.question.status == "draft":
                    i.question.status = "published"
            if not catalog.live_questions(quiz):
                failed.append({"title": quiz.title, "reason": "В тесте нет вопросов"})
                continue
            quiz.published_at = quiz.published_at or utcnow()
        quiz.status = new
        done += 1
    await audit(db, user, f"test.bulk.{action}", None, count=done)
    await db.commit()
    return {"done": done, "failed": failed, "questionsDeleted": qdel, "questionsKept": qkept}


@router.post("/tests/{qid}/status", response_model=QuizAdminOut)
async def set_test_status(qid: str, body: dict, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    quiz = await db.get(Quiz, qid)
    if quiz is None:
        raise HTTPException(404)
    new = body.get("status")
    if new not in ("draft", "published", "archived"):
        raise HTTPException(422, "bad status")
    if new == "published":
        broken = [i.question for i in quiz.items if i.question.status == "draft"]
        for q in broken:  # publishing a test publishes its draft questions
            q.status = "published"
        if not catalog.live_questions(quiz):
            raise HTTPException(422, "В тесте нет вопросов")
        quiz.published_at = quiz.published_at or utcnow()
    quiz.status = new
    await audit(db, user, f"test.{new}", quiz.id)
    await db.commit()
    return await _quiz_out(db, quiz)


# ---------------- live control ----------------

@router.get("/live")
async def list_live(user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(LiveSession).order_by(LiveSession.created_at.desc()).limit(30))).unique().scalars()
    return [{"id": s.id, "code": s.code, "title": s.title, "state": s.state, "createdAt": s.created_at.isoformat(),
             "hostName": s.host.display_name if s.host else None} for s in rows]


@router.post("/live", response_model=LiveState)
async def create_live(body: LiveCreate, user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    quiz = await db.get(Quiz, body.quiz_id)
    if quiz is None or quiz.status != "published" or not quiz.mode_live:
        raise HTTPException(422, "Тест не опубликован или режим эфира выключен")
    live = await live_svc.create(db, user, quiz, body.group_id)
    await audit(db, user, "live.create", live.id, code=live.code)
    if body.announce:
        db.add(Notification(kind="live", title=f"Эфир «{live.title}» открыт", body=f"Код для входа: {live.code}",
                            link=f"/live/{live.id}"))
        if body.group_id:
            g = await db.get(Group, body.group_id)
            if g:
                await telegram.send_message(g.chat_id, f"🔴 <b>Прямой эфир</b>: «{live.title}»\nКод: <b>{live.code}</b>",
                                            ("Войти в эфир", telegram.startapp_link(f"l_{live.id}")))
    await db.commit()
    return await live_svc.build_state(db, live, user, host=True)


@router.get("/live/{lid}", response_model=LiveState)
async def get_live(lid: str, user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    live = await db.get(LiveSession, lid)
    if live is None:
        raise HTTPException(404)
    return await live_svc.build_state(db, live, user, host=True)


@router.post("/live/{lid}/{action}", response_model=LiveState)
async def control_live(lid: str, action: str, user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    live = await db.get(LiveSession, lid)
    if live is None:
        raise HTTPException(404)
    if live.host_id != user.id and not role_at_least(user.role, "admin"):
        raise HTTPException(403, "Эфиром управляет другой ведущий")
    fn = {"next": live_svc.next_question, "reveal": live_svc.reveal, "pause": live_svc.pause,
          "resume": live_svc.resume, "finish": live_svc.finish}.get(action)
    if fn is None:
        raise HTTPException(404)
    await fn(db, live)
    await audit(db, user, f"live.{action}", live.id)
    await db.commit()
    await live_svc.hub.broadcast(live.id)
    return await live_svc.build_state(db, live, user, host=True)


@router.websocket("/live/{lid}/ws")
async def live_host_ws(ws: WebSocket, lid: str):
    import jwt as pyjwt
    await ws.accept()
    try:
        token = await ws.receive_text()
        payload = pyjwt.decode(token.removeprefix("Bearer "), settings.jwt_secret, algorithms=["HS256"])
        async with SessionLocal() as db:
            user = await db.get(User, payload["sub"])
            live = await db.get(LiveSession, lid)
            if user is None or live is None or not role_at_least(user.role, "host"):
                raise PermissionError
    except (pyjwt.PyJWTError, PermissionError, KeyError):
        await ws.close(code=4401)
        return
    except WebSocketDisconnect:
        return
    entry = live_svc.hub.add(lid, ws, None, host=True)
    await live_svc.hub.broadcast(lid)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        live_svc.hub.remove(lid, entry)


# ---------------- groups ----------------

@router.get("/groups")
async def list_groups(user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    groups = (await db.execute(select(Group).where(Group.is_active.is_(True)).order_by(Group.added_at.desc())))\
        .unique().scalars().all()
    out = []
    for g in groups:
        asg = (await db.execute(select(GroupAssignment).where(GroupAssignment.group_id == g.id)
                                .order_by(GroupAssignment.created_at.desc()).limit(1))).unique().scalars().first()
        current = None
        if asg:
            passed = (await db.execute(select(func.count()).select_from(Attempt).where(
                Attempt.assignment_id == asg.id, Attempt.status.in_(catalog.DONE)))).scalar_one()
            current = {"id": asg.id, "quizTitle": asg.quiz.title, "passed": passed,
                       "closesAt": asg.closes_at.isoformat() if asg.closes_at else None,
                       "open": not asg.is_closed and (asg.closes_at is None or asg.closes_at > utcnow()),
                       "isPublic": asg.is_public}
        out.append({"id": g.id, "title": g.title, "chatId": g.chat_id, "botIsAdmin": g.bot_is_admin,
                    "membersCount": g.members_count, "hostId": g.host_id,
                    "hostName": g.host.display_name if g.host else None, "current": current})
    return out


@router.patch("/groups/{gid}", status_code=204)
async def patch_group(gid: str, body: GroupPatch, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    g = await db.get(Group, gid)
    if g is None:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(g, k, v)
    await audit(db, user, "group.update", gid)
    await db.commit()


UZ_TZ = timezone(timedelta(hours=5))  # Uzbekistan, no daylight saving


def _local(dt: datetime) -> datetime:
    """Times are stored in UTC; messages to people show Tashkent time."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(UZ_TZ)


@router.post("/assignments")
async def create_assignment(body: AssignmentIn, user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    g = await db.get(Group, body.group_id)
    quiz = await db.get(Quiz, body.quiz_id)
    if g is None or quiz is None or quiz.status != "published":
        raise HTTPException(422, "Группа или тест не найдены")
    if body.format == "live":
        if not quiz.mode_live:
            raise HTTPException(422, "Для этого теста режим эфира выключен")
        state = await create_live(LiveCreate(quiz_id=quiz.id, group_id=g.id, announce=True), user, db)
        return {"kind": "live", "liveId": state.id, "code": state.code}
    if not quiz.mode_group:
        raise HTTPException(422, "Для этого теста групповой режим выключен")
    a = GroupAssignment(group_id=g.id, quiz_id=quiz.id, created_by=user.id, closes_at=body.closes_at,
                        is_public=body.is_public)
    db.add(a)
    await db.flush()
    minutes = max(1, round(quiz.duration_sec / 60))
    deadline = f" · до {_local(body.closes_at).strftime('%d.%m %H:%M')}" if body.closes_at else ""
    try:
        a.message_id = await telegram.send_message(
            g.chat_id, f"📝 <b>Новый тест:</b> {quiz.title}\n{len(catalog.live_questions(quiz))} вопросов · "
                       f"{minutes} мин{deadline}",
            ("Пройти тест", telegram.startapp_link(f"g_{a.id}")))
    except telegram.TelegramError as e:
        raise HTTPException(502, f"Telegram: {e}") from e
    await audit(db, user, "group.assign", a.id, group=g.title, quiz=quiz.title)
    await db.commit()
    return {"kind": "group", "assignmentId": a.id}


@router.post("/assignments/{aid}/public", status_code=204)
async def set_assignment_public(aid: str, body: dict, user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    """Show / hide a group test for everyone in the Mini App «Группа» section."""
    a = await db.get(GroupAssignment, aid)
    if a is None:
        raise HTTPException(404)
    a.is_public = bool(body.get("isPublic"))
    await audit(db, user, "group.public" if a.is_public else "group.private", aid)
    await db.commit()


@router.post("/assignments/{aid}/close", status_code=204)
async def close_assignment(aid: str, user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    a = await db.get(GroupAssignment, aid)
    if a is None:
        raise HTTPException(404)
    a.is_closed = True
    await audit(db, user, "group.close", aid)
    await db.commit()


# ---------------- results ----------------

def _results_query(user: User, quiz_id: str | None, mode: str | None, group_id: str | None,
                   date_from: datetime | None, date_to: datetime | None):
    stmt = select(Attempt)
    if not role_at_least(user.role, "admin"):
        # hosts see results of the group tests they sent
        stmt = stmt.join(GroupAssignment, GroupAssignment.id == Attempt.assignment_id)\
            .where(GroupAssignment.created_by == user.id)
    elif group_id:
        stmt = stmt.join(GroupAssignment, GroupAssignment.id == Attempt.assignment_id)
    if group_id:
        stmt = stmt.where(GroupAssignment.group_id == group_id)
    if quiz_id:
        stmt = stmt.where(Attempt.quiz_id == quiz_id)
    if mode:
        stmt = stmt.where(Attempt.mode == mode)
    if date_from:
        stmt = stmt.where(Attempt.started_at >= date_from)
    if date_to:
        stmt = stmt.where(Attempt.started_at < date_to)
    return stmt


@router.get("/results")
async def results(quiz_id: str | None = None, mode: str | None = None, group_id: str | None = None,
                  date_from: datetime | None = Query(None, alias="from"), date_to: datetime | None = Query(None, alias="to"),
                  page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=500),
                  user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    stmt = _results_query(user, quiz_id, mode, group_id, date_from, date_to)
    sub = stmt.subquery()
    stats = (await db.execute(select(func.count(), func.count().filter(sub.c.status == "finished"),
                                     func.count().filter(sub.c.status == "timed_out"),
                                     func.count().filter(sub.c.status == "abandoned"),
                                     func.avg(100.0 * sub.c.points / func.nullif(sub.c.max_points, 0))
                                     .filter(sub.c.status.in_(catalog.DONE))))).one()
    rows = (await db.execute(stmt.order_by(Attempt.started_at.desc()).offset((page - 1) * size).limit(size)))\
        .unique().scalars().all()
    return {"total": stats[0], "finished": stats[1], "timedOut": stats[2], "abandoned": stats[3],
            "avgPercent": round(stats[4]) if stats[4] is not None else None, "items": [_result_row(a) for a in rows]}


RESULT_COLS = ["Пользователь", "Username", "Тест", "Режим", "Баллы", "Макс", "Точность %", "Верно", "Неверно",
               "Без ответа", "Статус", "Начало", "Конец"]


def _export_rows(rows: list[Attempt]) -> list[list[Any]]:
    out = []
    for a in rows:
        r = _result_row(a)
        out.append([r["userName"], r["username"] or "", r["quizTitle"], r["mode"], r["points"], r["maxPoints"],
                    r["accuracy"] if r["accuracy"] is not None else "", r["correct"], r["wrong"], r["unanswered"],
                    r["status"], r["startedAt"], r["finishedAt"] or ""])
    return out


@router.get("/results/export")
async def export_results(fmt: str = Query("xlsx", pattern="^(csv|xlsx)$"), quiz_id: str | None = None,
                         mode: str | None = None, group_id: str | None = None,
                         date_from: datetime | None = Query(None, alias="from"),
                         date_to: datetime | None = Query(None, alias="to"),
                         user: User = Depends(host), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(_results_query(user, quiz_id, mode, group_id, date_from, date_to)
                             .order_by(Attempt.started_at.desc()).limit(50000))).unique().scalars().all()
    data = _export_rows(list(rows))
    if fmt == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(RESULT_COLS)
        w.writerows(data)
        return Response("﻿" + buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=results.csv"})
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Результаты"
    ws.append(RESULT_COLS)
    for r in data:
        ws.append(r)
    out = io.BytesIO()
    wb.save(out)
    return Response(out.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=results.xlsx"})


# ---------------- users ----------------

@router.get("/users", response_model=Page)
async def list_users(q: str = "", role: str | None = None, page: int = Query(1, ge=1),
                     size: int = Query(50, ge=1, le=200), user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    stmt = select(User)
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.first_name.ilike(like), User.last_name.ilike(like), User.username.ilike(like)))
    if role:
        stmt = stmt.where(User.role == role)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(User.last_seen_at.desc()).offset((page - 1) * size).limit(size))).scalars().all()
    stats = dict(((uid, (n, c, t)) for uid, n, c, t in (await db.execute(
        select(Attempt.user_id, func.count(), func.sum(Attempt.correct),
               func.sum(Attempt.correct + Attempt.wrong + Attempt.unanswered))
        .where(Attempt.user_id.in_([r.id for r in rows]), Attempt.status.in_(catalog.DONE))
        .group_by(Attempt.user_id))).all()))
    items = []
    for r in rows:
        n, c, t = stats.get(r.id, (0, 0, 0))
        items.append(admin_user(r, n, round(100 * c / t) if t else None).model_dump(by_alias=True, mode="json"))
    return Page(items=items, total=total)


@router.put("/users/{uid}/role", status_code=204)
async def set_role(uid: str, body: RoleIn, user: User = Depends(superadmin), db: AsyncSession = Depends(get_db)):
    target = await db.get(User, uid)
    if target is None:
        raise HTTPException(404)
    if target.id == user.id and body.role != "superadmin":
        raise HTTPException(422, "Нельзя снять роль с самого себя")
    old = target.role
    target.role = body.role
    await audit(db, user, "user.role", uid, old=old, new=body.role)
    await db.commit()


@router.put("/users/{uid}/block", status_code=204)
async def block_user(uid: str, body: BlockIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    target = await db.get(User, uid)
    if target is None or target.id == user.id:
        raise HTTPException(422)
    target.is_blocked = body.blocked
    await audit(db, user, "user.block" if body.blocked else "user.unblock", uid)
    await db.commit()


# ---------------- settings & audit ----------------

@router.get("/settings")
async def read_settings(user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    s = await get_settings(db)
    return {**s.model_dump(by_alias=True), "botUsername": settings.bot_username, "miniappUrl": settings.miniapp_url,
            "botTokenSet": bool(settings.bot_token), "signatureCheck": not settings.allow_dev_auth}


@router.put("/settings", response_model=SettingsIn)
async def write_settings(body: SettingsIn, user: User = Depends(superadmin), db: AsyncSession = Depends(get_db)):
    await audit(db, user, "settings.update", None, **body.model_dump())
    saved = await save_settings(db, body)
    await sync_durations(db)
    await db.commit()
    return saved


@router.get("/audit")
async def audit_log(user: User = Depends(superadmin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AuditLog).order_by(AuditLog.id.desc()).limit(200))).unique().scalars()
    return [{"id": r.id, "actor": r.actor.display_name if r.actor else None, "action": r.action, "target": r.target,
             "details": r.details, "at": r.created_at.isoformat()} for r in rows]


# ---------------- excel import ----------------

HEADERS = {"раздел": "topic", "тема": "topic", "подраздел": "subtopic", "вопрос": "text", "a": "a", "b": "b",
           "c": "c", "d": "d", "правильный": "correct", "ответ": "correct", "сложность": "difficulty",
           "баллы": "points", "объяснение": "explanation", "тест": "test"}
DIFF = {"лёгкий": "easy", "легкий": "easy", "easy": "easy", "средний": "medium", "medium": "medium",
        "сложный": "hard", "hard": "hard", "": "medium"}


def _read_table(name: str, raw: bytes) -> list[list[str]]:
    if name.lower().endswith(".csv"):
        text = raw.decode("utf-8-sig", errors="replace")
        dialect = csv.Sniffer().sniff(text.splitlines()[0]) if text else csv.excel
        return [[c.strip() for c in r] for r in csv.reader(io.StringIO(text), dialect)]
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    ws = wb.active
    return [["" if c is None else str(c).strip() for c in row] for row in ws.iter_rows(values_only=True)]


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower().replace("ё", "е"))


async def _validate_rows(db: AsyncSession, rows: list[ImportRow]) -> list[ImportRow]:
    topics = (await db.execute(select(Topic))).scalars().all()
    by_title = {_norm(t.title): t for t in topics}
    existing = {_norm(t) for t in (await db.execute(select(Question.text).where(Question.status != "archived"))).scalars()}
    seen: set[str] = set()
    for r in rows:
        r.errors = []
        t = by_title.get(_norm(r.topic))
        if t is None:
            near = difflib.get_close_matches(_norm(r.topic), list(by_title), n=1, cutoff=0.6)
            r.suggestion = by_title[near[0]].title if near else None
            r.errors.append(f"Раздел не найден. Может быть, «{r.suggestion}»?" if near else "Раздел не найден")
        else:
            r.topic_id = t.id
        if not r.text.strip():
            r.errors.append("Нет текста вопроса")
        if len(r.options) != 4 or any(not o.strip() for o in r.options):
            r.errors.append("Нужны все четыре варианта A–D")
        if r.correct.upper() not in ("A", "B", "C", "D"):
            r.errors.append(f"Правильный ответ «{r.correct}» — допустимо A, B, C или D")
        if r.points is None or r.points < 10 or r.points % 10:
            r.errors.append(f"Баллы {r.points if r.points is not None else '—'} — нужно целое число от 10, кратное 10")
        if r.difficulty not in ("easy", "medium", "hard"):
            r.errors.append("Сложность: лёгкий, средний или сложный")
        key = _norm(r.text)
        r.duplicate = bool(key) and (key in existing or key in seen)
        seen.add(key)
    return rows


@router.post("/import/preview", response_model=ImportPreview)
async def import_preview(file: UploadFile = File(...), user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(413, "Файл больше 5 МБ")
    try:
        table = _read_table(file.filename or "", raw)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, "Не удалось прочитать файл. Нужен XLSX или CSV по шаблону.") from e
    if not table:
        raise HTTPException(422, "Файл пустой")
    cols = {HEADERS.get(_norm(h)): i for i, h in enumerate(table[0]) if HEADERS.get(_norm(h))}
    missing = {"topic", "text", "a", "b", "c", "d", "correct"} - set(cols)
    if missing:
        raise HTTPException(422, "Нет колонок: " + ", ".join(sorted(missing)) + ". Скачайте шаблон.")
    get = lambda row, k: row[cols[k]] if k in cols and cols[k] < len(row) else ""  # noqa: E731
    rows = []
    for n, row in enumerate(table[1:], start=2):
        if not any(row):
            continue
        pts_raw = get(row, "points") or "100"
        try:
            pts = int(float(pts_raw))
        except ValueError:
            pts = None
        rows.append(ImportRow(row=n, topic=get(row, "topic"), subtopic=get(row, "subtopic") or None, text=get(row, "text"),
                              options=[get(row, k) for k in "abcd"], correct=get(row, "correct").upper(),
                              difficulty=DIFF.get(_norm(get(row, "difficulty")), "?"), points=pts,
                              explanation=get(row, "explanation") or None, test=get(row, "test") or None))
    rows = await _validate_rows(db, rows)
    return ImportPreview(file_name=file.filename or "", rows=rows,
                         ready=sum(1 for r in rows if not r.errors and not r.duplicate),
                         with_errors=sum(1 for r in rows if r.errors),
                         duplicates=sum(1 for r in rows if r.duplicate and not r.errors))


@router.post("/import/commit")
async def import_commit(body: ImportCommit, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    rows = await _validate_rows(db, body.rows)  # never trust the client's validation
    cfg = await get_settings(db)
    created = 0
    tests: dict[tuple[str, str], Quiz] = {}
    positions: dict[str, int] = {}
    for r in rows:
        if r.errors or (r.duplicate and r.row not in body.include_duplicates):
            continue
        sub_id = None
        if r.subtopic:
            sub = (await db.execute(select(Subtopic).where(Subtopic.topic_id == r.topic_id,
                                                           func.lower(Subtopic.title) == r.subtopic.lower()))).scalar_one_or_none()
            if sub is None:
                sub = Subtopic(topic_id=r.topic_id, title=r.subtopic, position=99)
                db.add(sub)
                await db.flush()
            sub_id = sub.id
        correct = "ABCD".index(r.correct)
        q = Question(topic_id=r.topic_id, subtopic_id=sub_id, text=r.text.strip(), difficulty=r.difficulty,
                     points=r.points, explanation_ru=r.explanation, status="published" if body.publish else "draft",
                     options=[QuestionOption(position=i, text=o.strip(), is_correct=i == correct)
                              for i, o in enumerate(r.options)])
        db.add(q)
        created += 1
        if r.test and r.test.strip():
            key = (r.topic_id or "", r.test.strip())
            quiz = tests.get(key)
            if quiz is None:
                # re-importing into a test with the same name appends to it instead of duplicating it
                quiz = (await db.execute(select(Quiz).where(Quiz.topic_id == key[0], Quiz.title == key[1],
                                                            Quiz.status != "archived"))).unique().scalars().first()
                if quiz is None:
                    quiz = Quiz(id=new_id(), topic_id=key[0], title=key[1], difficulty=r.difficulty,
                                duration_sec=cfg.minutes_per_question * 60, live_question_sec=cfg.live_question_sec,
                                mode_individual=True, mode_live=True, mode_group=True, status="draft",
                                updated_by=user.id)
                    db.add(quiz)
                    await db.flush()
                    positions[quiz.id] = 0
                else:
                    positions[quiz.id] = (await db.execute(select(func.count()).select_from(QuizQuestion)
                                                           .where(QuizQuestion.quiz_id == quiz.id))).scalar_one()
                tests[key] = quiz
            await db.flush()
            db.add(QuizQuestion(quiz_id=quiz.id, question_id=q.id, position=positions[quiz.id]))
            positions[quiz.id] += 1
    # whole-test time follows the number of questions (2 min each by default)
    await sync_durations(db, {q.id for q in tests.values()})
    await audit(db, user, "import", None, created=created, tests=len(tests))
    await db.commit()
    return {"created": created, "skipped": len(rows) - created, "tests": len(tests)}


def _xlsx(header: list[str], rows: list[list[Any]], name: str) -> Response:
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.append(header)
    for r in rows:
        ws.append(r)
    out = io.BytesIO()
    wb.save(out)
    return Response(out.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f"attachment; filename={name}"})


TEMPLATE = ["Раздел", "Подраздел", "Вопрос", "A", "B", "C", "D", "Правильный", "Сложность", "Баллы", "Объяснение",
            "Тест"]


@router.get("/import/template")
async def import_template(user: User = Depends(admin)):
    return _xlsx(TEMPLATE, [["Морфология", "Наречие", "Какое из слов является наречием?", "Быстрый", "Быстро",
                             "Быстрота", "Ускорить", "B", "Лёгкий", 100,
                             "«Быстро» отвечает на вопрос «как?» и не изменяется.", "Наречие · I вариант"]],
                 "rusada-template.xlsx")


@router.post("/import/errors")
async def import_errors_file(body: ImportCommit, user: User = Depends(admin)):
    rows = [[r.topic, r.subtopic or "", r.text, *r.options, r.correct, r.difficulty, r.points, r.explanation or "",
             r.test or "", "; ".join(r.errors) or ("Дубликат" if r.duplicate else "")] for r in body.rows if r.errors or r.duplicate]
    return _xlsx(TEMPLATE + ["Что не так"], rows, "import-errors.xlsx")
