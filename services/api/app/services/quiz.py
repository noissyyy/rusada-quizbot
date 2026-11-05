"""Individual / group test runs. The server owns the clock and the answer key."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import Attempt, AttemptAnswer, GroupAssignment, Question, Quiz, User, utcnow
from ..schemas import AnswerResult, OptionPublic, QuestionPublic, ReviewItem, SessionResult, SessionStart
from .settings_store import get_settings

LABELS = ("A", "B", "C", "D")


def snapshot_quiz(quiz: Quiz) -> list[dict[str, Any]]:
    """Freeze the test's questions as they are right now."""
    out = []
    for item in quiz.items:
        q = item.question
        if q.status == "archived":
            continue
        opts = sorted(q.options, key=lambda o: o.position)
        correct = next((o.id for o in opts if o.is_correct), None)
        if correct is None or len(opts) != 4:
            continue  # never serve a broken question
        out.append({"id": q.id, "text": q.text, "points": q.points, "image": q.image_url,
                    "explanation": q.explanation_ru, "explanation_uz": q.explanation_uz,
                    "options": [{"id": o.id, "text": o.text} for o in opts], "correct": correct})
    return out


def public_question(q: dict[str, Any]) -> QuestionPublic:
    return QuestionPublic(id=q["id"], text=q["text"], points=q["points"], image_url=q.get("image"),
                          options=[OptionPublic(id=o["id"], label=LABELS[i], text=o["text"])
                                   for i, o in enumerate(q["options"])])


def _answer_result(q: dict[str, Any], a: AttemptAnswer | None) -> AnswerResult:
    if a is None:
        return AnswerResult(question_id=q["id"], outcome="unanswered", chosen_option_id=None,
                            correct_option_id=q["correct"], points_awarded=0, explanation=q.get("explanation"))
    return AnswerResult(question_id=q["id"], outcome=a.outcome, chosen_option_id=a.option_id,  # type: ignore[arg-type]
                        correct_option_id=q["correct"], points_awarded=a.points, explanation=q.get("explanation"))


def remaining_sec(attempt: Attempt, now: datetime | None = None) -> int:
    left = (attempt.deadline_at - (now or utcnow())).total_seconds()
    return max(0, int(left))


def _settle_pause(attempt: Attempt, now: datetime) -> None:
    """The pause covers only the time the answer was really on screen: if the student
    tapped «Дальше» early, the unused part of the pause is taken back."""
    if attempt.feedback_until and now < attempt.feedback_until:
        unused = attempt.feedback_until - now
        attempt.deadline_at -= unused
        attempt.paused_ms = max(0, attempt.paused_ms - int(unused.total_seconds() * 1000))
    attempt.feedback_until = None


async def _finalize(db: AsyncSession, attempt: Attempt, timed_out: bool, now: datetime | None = None) -> None:
    now = now or utcnow()
    _settle_pause(attempt, now)
    by_q = {a.question_id: a for a in attempt.answers}
    correct = sum(1 for a in attempt.answers if a.outcome == "correct")
    wrong = sum(1 for a in attempt.answers if a.outcome == "wrong")
    attempt.correct, attempt.wrong = correct, wrong
    attempt.unanswered = len(attempt.snapshot) - correct - wrong
    attempt.points = sum(a.points for a in by_q.values())
    attempt.max_points = sum(q["points"] for q in attempt.snapshot)
    end = min(now, attempt.deadline_at)
    used = (end - attempt.started_at).total_seconds() - attempt.paused_ms / 1000
    attempt.used_sec = int(min(attempt.duration_sec, max(0, round(used))))
    attempt.finished_at = now
    attempt.status = "timed_out" if timed_out else "finished"


async def expire_overdue(db: AsyncSession, user: User | None = None) -> None:
    """Attempts whose clock ran out while the app was closed are closed as timed out."""
    grace = timedelta(seconds=settings.timer_grace_sec)
    q = select(Attempt).where(Attempt.status == "in_progress", Attempt.deadline_at < utcnow() - grace)
    if user is not None:
        q = q.where(Attempt.user_id == user.id)
    for a in (await db.execute(q)).scalars():
        await _finalize(db, a, timed_out=True, now=a.deadline_at)
    await db.commit()


async def start(db: AsyncSession, user: User, quiz: Quiz, assignment: GroupAssignment | None = None) -> SessionStart:
    await expire_overdue(db, user)
    cfg = await get_settings(db)
    mode = "group" if assignment else "individual"
    same_run = Attempt.assignment_id == assignment.id if assignment else Attempt.assignment_id.is_(None)
    q = select(Attempt).where(Attempt.user_id == user.id, Attempt.quiz_id == quiz.id, same_run)
    existing = (await db.execute(q.where(Attempt.status == "in_progress"))).scalars().first()
    if existing is not None:
        attempt = existing
    else:
        if assignment is not None:
            done = (await db.execute(select(func.count()).select_from(Attempt).where(
                Attempt.user_id == user.id, Attempt.assignment_id == assignment.id))).scalar_one()
            if done:
                raise HTTPException(status.HTTP_409_CONFLICT, "already_taken")
        snap = snapshot_quiz(quiz)
        if not snap:
            raise HTTPException(status.HTTP_409_CONFLICT, "test_has_no_questions")
        now = utcnow()
        attempt = Attempt(user_id=user.id, quiz_id=quiz.id, assignment_id=assignment.id if assignment else None,
                          mode=mode, quiz_title=quiz.title, topic_title=quiz.topic.title,
                          topic_color=quiz.topic.color, snapshot=snap, duration_sec=quiz.duration_sec,
                          started_at=now, deadline_at=now + timedelta(seconds=quiz.duration_sec))
        db.add(attempt)
        await db.commit()
        await db.refresh(attempt, ["answers"])
    by_q = {a.question_id: a for a in attempt.answers}
    return SessionStart(
        session_id=attempt.id, quiz_id=quiz.id, quiz_title=attempt.quiz_title, topic_title=attempt.topic_title,
        duration_sec=attempt.duration_sec, remaining_sec=remaining_sec(attempt),
        questions=[public_question(x) for x in attempt.snapshot],
        answered=[_answer_result(x, by_q[x["id"]]) for x in attempt.snapshot if x["id"] in by_q],
        feedback_ms=cfg.feedback_ms, feedback_explain_ms=cfg.feedback_explain_ms)


async def load_own(db: AsyncSession, user: User, session_id: str) -> Attempt:
    attempt = await db.get(Attempt, session_id)
    if attempt is None or attempt.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session_not_found")
    return attempt


async def submit(db: AsyncSession, attempt: Attempt, question_id: str, option_id: str | None) -> AnswerResult:
    q = next((x for x in attempt.snapshot if x["id"] == question_id), None)
    if q is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "question_not_in_session")
    prev = next((a for a in attempt.answers if a.question_id == question_id), None)
    if prev is not None:
        return _answer_result(q, prev)  # idempotent: a retried submit never scores twice
    if attempt.status != "in_progress":
        raise HTTPException(status.HTTP_409_CONFLICT, "session_finished")
    now = utcnow()
    _settle_pause(attempt, now)
    late = now > attempt.deadline_at + timedelta(seconds=settings.timer_grace_sec)
    if option_id is not None and option_id not in {o["id"] for o in q["options"]}:
        raise HTTPException(422, "unknown_option")
    if late or option_id is None:
        outcome, points, option_id = "unanswered", 0, None
    elif option_id == q["correct"]:
        outcome, points = "correct", q["points"]
    else:
        outcome, points = "wrong", 0
    ans = AttemptAnswer(attempt_id=attempt.id, question_id=question_id, option_id=option_id, outcome=outcome,
                        points=points, answered_at=now)
    attempt.answers.append(ans)
    if outcome == "wrong" and await db.get(Question, question_id) is not None:
        from .review import add_mistake  # «Xatolarim»: comes back for review
        await add_mistake(db, attempt.user_id, question_id)
    if not late:
        # the test timer stands still while the correct answer is shown
        cfg = await get_settings(db)
        pause = cfg.feedback_explain_ms if q.get("explanation") else cfg.feedback_ms
        attempt.deadline_at = attempt.deadline_at + timedelta(milliseconds=pause)
        attempt.paused_ms += pause
        attempt.feedback_until = now + timedelta(milliseconds=pause)
    await db.commit()
    return _answer_result(q, ans)


async def finish(db: AsyncSession, attempt: Attempt, timed_out: bool) -> SessionResult:
    if attempt.status == "in_progress":
        now = utcnow()
        # trust "time is up" only when the server clock agrees (± grace)
        server_timed_out = now >= attempt.deadline_at - timedelta(seconds=settings.timer_grace_sec)
        await _finalize(db, attempt, timed_out=timed_out and server_timed_out or now > attempt.deadline_at, now=now)
        await db.commit()
    return await result(db, attempt)


async def result(db: AsyncSession, attempt: Attempt) -> SessionResult:
    if attempt.status == "in_progress":
        raise HTTPException(status.HTTP_409_CONFLICT, "result_not_ready")
    by_q = {a.question_id: a for a in attempt.answers}
    review = []
    for q in attempt.snapshot:
        r = _answer_result(q, by_q.get(q["id"]))
        text = {o["id"]: o["text"] for o in q["options"]}
        review.append(ReviewItem(**r.model_dump(), question_text=q["text"],
                                 chosen_text=text.get(r.chosen_option_id or ""), correct_text=text[q["correct"]]))
    best = (await db.execute(select(func.max(Attempt.points)).where(
        Attempt.user_id == attempt.user_id, Attempt.quiz_id == attempt.quiz_id,
        Attempt.status.in_(("finished", "timed_out"))))).scalar_one() or 0
    return SessionResult(session_id=attempt.id, quiz_id=attempt.quiz_id, quiz_title=attempt.quiz_title,
                         mode=attempt.mode, assignment_id=attempt.assignment_id, max_points=attempt.max_points,
                         points=attempt.points, correct=attempt.correct, wrong=attempt.wrong,
                         unanswered=attempt.unanswered, used_sec=attempt.used_sec,
                         timed_out=attempt.status == "timed_out", best_points=max(best, attempt.points),
                         review=review)
