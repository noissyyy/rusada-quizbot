"""Endpoints used by the Telegram Mini App. Auth: `Authorization: tma <initData>`."""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import SessionLocal, get_db
from ..models import (Attempt, GroupAssignment, GroupMember, LiveParticipant, LiveSession, Notification,
                      NotificationRead, Question, Quiz, QuizQuestion, Subtopic, Topic, User, utcnow)
from ..schemas import (AnswerBody, AnswerResult, FinishBody, GroupAssignmentView, GroupBoardEntry, GroupHubItem, GroupResultView,
                       HomeFeed, InProgressAttempt, LiveAnswerBody, LiveJoinBody, LiveListItem, LiveState,
                       NotificationOut, Profile, QuickStart, Rating, SessionResult, SessionStart, SettingsPatch,
                       StartBody, TestSummary, TopicSummary, TopicTest, UserProfile)
from ..security import InitDataError, current_user, telegram_user, upsert_user, validate_init_data, TgUser
from ..services import access as access_svc, catalog, live as live_svc, quiz as quiz_svc
from .. import telegram

router = APIRouter(prefix="/api", tags=["mini app"])


async def _quiz(db: AsyncSession, quiz_id: str) -> Quiz:
    quiz = await db.get(Quiz, quiz_id)
    if quiz is None or quiz.status != "published":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "test_not_found")
    return quiz


@router.get("/me", response_model=UserProfile)
async def me(user: User = Depends(telegram_user)):
    return catalog.user_profile(user)


@router.get("/home", response_model=HomeFeed)
async def home(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await quiz_svc.expire_overdue(db, user)
    quick = (await db.execute(select(Quiz).where(Quiz.status == "published", Quiz.is_quick.is_(True))
                              .order_by(Quiz.updated_at.desc()))).unique().scalars().first()
    pop = await catalog.popular(db)
    quick = quick or (pop[0] if pop else None)
    cont = (await db.execute(select(Attempt).where(Attempt.user_id == user.id, Attempt.status == "in_progress",
                                                   Attempt.mode == "individual")
                             .order_by(Attempt.started_at.desc()))).unique().scalars().first()
    live_now = (await db.execute(select(func.count()).select_from(LiveSession)
                                 .where(LiveSession.state.in_(live_svc.ACTIVE)))).scalar_one()
    return HomeFeed(
        user=catalog.user_profile(user), unread_notifications=await catalog.unread_count(db, user),
        quick_start=QuickStart(quiz_id=quick.id, questions_count=len(catalog.live_questions(quick)),
                               duration_minutes=max(1, round(quick.duration_sec / 60))) if quick else None,
        continue_attempt=InProgressAttempt(session_id=cont.id, quiz_id=cont.quiz_id or "", quiz_title=cont.quiz_title,
                                           answered=len(cont.answers), total=len(cont.snapshot),
                                           remaining_seconds=quiz_svc.remaining_sec(cont)) if cont else None,
        popular_tests=[catalog.summary(q) for q in pop], live_now=live_now,
        questions_total=(await db.execute(
            select(func.count(func.distinct(QuizQuestion.question_id)))
            .join(Quiz, Quiz.id == QuizQuestion.quiz_id).join(Question, Question.id == QuizQuestion.question_id)
            .where(Quiz.status == "published", Question.status != "archived"))).scalar_one())


@router.get("/topics", response_model=list[TopicSummary])
async def topics(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await catalog.topics(db, user)


@router.get("/topics/{slug}")
async def topic(slug: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(Topic).where(Topic.slug == slug, Topic.is_active.is_(True)))).scalar_one_or_none()
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "topic_not_found")
    summary = next(s for s in await catalog.topics(db, user) if s.id == t.id)
    quizzes = [q for q in await catalog.published_quizzes(db, t.id) if catalog.live_questions(q)]
    sts = await catalog.statuses(db, user, [q.id for q in quizzes])
    return {"topic": summary.model_dump(by_alias=True),
            "tests": [catalog.topic_test(q, sts.get(q.id)).model_dump(by_alias=True) for q in quizzes]}


@router.get("/works/{sid}/cover")
async def work_cover(sid: str, db: AsyncSession = Depends(get_db)):
    """Public on purpose: <img> tags cannot send the Telegram auth header. The version in the URL busts caches."""
    from fastapi.responses import Response
    from sqlalchemy.orm import undefer
    s = (await db.execute(select(Subtopic).options(undefer(Subtopic.cover)).where(Subtopic.id == sid))).scalar_one_or_none()
    if s is None or not s.cover:
        raise HTTPException(404)
    return Response(s.cover, media_type=s.cover_type or "image/jpeg", headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/tests", response_model=list[TestSummary])
async def search_tests(q: str = Query("", max_length=100), user: User = Depends(current_user),
                       db: AsyncSession = Depends(get_db)):
    needle = q.strip().lower()
    quizzes = await catalog.published_quizzes(db)
    hits = [x for x in quizzes if catalog.live_questions(x) and
            (not needle or needle in x.title.lower() or needle in x.topic.title.lower())]
    return [catalog.summary(x) for x in hits[:50]]


@router.get("/tests/{quiz_id}", response_model=TopicTest)
async def test_details(quiz_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    quiz = await _quiz(db, quiz_id)
    sts = await catalog.statuses(db, user, [quiz.id])
    return catalog.topic_test(quiz, sts.get(quiz.id))


# ---------------- sessions ----------------

@router.post("/sessions", response_model=SessionStart)
async def start_session(body: StartBody, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    trial = await access_svc.trial_of(db, user)
    if body.assignment_id:
        if trial:
            raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "trial_locked")
        a = await _assignment_for(db, user, body.assignment_id, require_access=False)
        ongoing = (await db.execute(select(Attempt.id).where(Attempt.assignment_id == a.id, Attempt.user_id == user.id,
                                                             Attempt.status == "in_progress"))).first()
        if ongoing is None:  # a started attempt is always resumable; it keeps its own deadline
            access = await _access(db, user, a)
            if access != "ok":
                raise HTTPException(status.HTTP_403_FORBIDDEN, access)
        return await quiz_svc.start(db, user, a.quiz, a)
    if not body.quiz_id:
        raise HTTPException(422, "quiz_id required")
    quiz = await _quiz(db, body.quiz_id)
    if not quiz.mode_individual:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "mode_unavailable")
    if trial:
        ongoing = (await db.execute(select(Attempt.id).where(Attempt.user_id == user.id, Attempt.quiz_id == quiz.id,
                                                             Attempt.assignment_id.is_(None), Attempt.status == "in_progress"))).first()
        if ongoing is None and await access_svc.trial_tests_used(db, user) >= trial.trial_tests:
            raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "trial_tests_used")
    return await quiz_svc.start(db, user, quiz)


@router.post("/sessions/{sid}/answers", response_model=AnswerResult)
async def submit_answer(sid: str, body: AnswerBody, user: User = Depends(current_user),
                        db: AsyncSession = Depends(get_db)):
    attempt = await quiz_svc.load_own(db, user, sid)
    return await quiz_svc.submit(db, attempt, body.question_id, body.option_id)


@router.post("/sessions/{sid}/finish", response_model=SessionResult)
async def finish_session(sid: str, body: FinishBody, user: User = Depends(current_user),
                         db: AsyncSession = Depends(get_db)):
    attempt = await quiz_svc.load_own(db, user, sid)
    return await quiz_svc.finish(db, attempt, body.timed_out)


@router.get("/sessions/{sid}/result", response_model=SessionResult)
async def session_result(sid: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await quiz_svc.expire_overdue(db, user)
    attempt = await quiz_svc.load_own(db, user, sid)
    return await quiz_svc.result(db, attempt)


# ---------------- rating / profile / notifications ----------------

@router.get("/rating", response_model=Rating)
async def rating(kind: str = Query("individual", pattern="^(individual|live|group)$"),
                 period: str = Query("week", pattern="^(week|month|all)$"),
                 user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await catalog.rating(db, user, kind, period)


@router.get("/profile", response_model=Profile)
async def profile(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    done = (await db.execute(select(func.count(), func.coalesce(func.sum(Attempt.correct), 0),
                                    func.coalesce(func.sum(Attempt.correct + Attempt.wrong + Attempt.unanswered), 0))
                             .where(Attempt.user_id == user.id, Attempt.status.in_(catalog.DONE)))).one()
    tests, correct, total = done
    board = await catalog.rating(db, user, "individual", "all")
    return Profile(user=catalog.user_profile(user), member_since=user.created_at, tests=tests,
                   accuracy=round(100 * correct / total) if total else 0,
                   points=board.me.points if board.me else 0, history=await catalog.history(db, user),
                   notify_live=user.notify_live, haptics=user.haptics)


@router.patch("/profile/settings", response_model=UserProfile)
async def update_settings(body: SettingsPatch, user: User = Depends(telegram_user), db: AsyncSession = Depends(get_db)):
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    await db.commit()
    return catalog.user_profile(user)


@router.get("/notifications", response_model=list[NotificationOut])
async def notifications(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Notification).where(
        (Notification.user_id == user.id) |
        ((Notification.user_id.is_(None)) & (Notification.created_at >= user.created_at - timedelta(days=14))))
        .order_by(Notification.created_at.desc()).limit(50))).scalars().all()
    read = set((await db.execute(select(NotificationRead.notification_id)
                                 .where(NotificationRead.user_id == user.id))).scalars())
    return [NotificationOut(id=n.id, kind=n.kind, title=n.title, body=n.body, link=n.link, created_at=n.created_at,
                            read=n.id in read) for n in rows]


@router.post("/notifications/read-all", status_code=204)
async def read_all(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ids = [n.id for n in await notifications(user, db) if not n.read]
    for i in ids:
        db.add(NotificationRead(notification_id=i, user_id=user.id))
    await db.commit()


# ---------------- group mode ----------------

async def _assignment_for(db: AsyncSession, user: User, aid: str, require_access: bool) -> GroupAssignment:
    a = await db.get(GroupAssignment, aid)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "assignment_not_found")
    if require_access:
        access = await _access(db, user, a)
        if access != "ok":
            raise HTTPException(status.HTTP_403_FORBIDDEN, access)
    return a


async def _access(db: AsyncSession, user: User, a: GroupAssignment) -> str:
    if a.is_closed or (a.closes_at and a.closes_at < utcnow()) or a.quiz.status != "published":
        return "closed"
    if a.is_public:
        return "ok"  # the teacher opened it to everyone
    member = await db.get(GroupMember, (a.group_id, user.id))
    if member is not None and member.verified_at > utcnow() - timedelta(hours=6):
        return "ok"
    verdict = await telegram.is_member(a.group.chat_id, user.telegram_id)
    if verdict is True:
        if member is None:
            db.add(GroupMember(group_id=a.group_id, user_id=user.id))
        else:
            member.verified_at = utcnow()
        await db.commit()
        return "ok"
    if verdict is None and member is not None:
        return "ok"  # Telegram unreachable: trust a previous verification
    if verdict is None and not settings.telegram_enabled:
        return "ok"  # local development without Telegram
    return "not_member"


async def _group_board(db: AsyncSession, a: GroupAssignment, me: User, limit: int = 5) -> tuple[list[GroupBoardEntry], int]:
    rows = (await db.execute(select(Attempt).where(Attempt.assignment_id == a.id,
                                                   Attempt.status.in_(catalog.DONE))
                             .order_by(Attempt.points.desc(), Attempt.used_sec))).unique().scalars().all()
    board = [GroupBoardEntry(rank=i + 1, name=r.user.display_name + (" (вы)" if r.user_id == me.id else ""),
                             points=r.points, me=r.user_id == me.id) for i, r in enumerate(rows)]
    top = board[:limit]
    mine = next((b for b in board if b.me), None)
    if mine and mine not in top:
        top.append(mine)
    return top, len(rows)


@router.get("/group", response_model=list[GroupHubItem])
async def group_hub(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Open group tests the teacher made public, plus any group test this student has started."""
    await quiz_svc.expire_overdue(db, user)
    now = utcnow()
    mine = {r.assignment_id: r.status for r in (await db.execute(
        select(Attempt).where(Attempt.user_id == user.id, Attempt.assignment_id.is_not(None)))).unique().scalars()}
    rows = (await db.execute(select(GroupAssignment).where(
        GroupAssignment.is_closed.is_(False), GroupAssignment.is_public.is_(True))
        .order_by(GroupAssignment.created_at.desc()))).unique().scalars().all()
    out = []
    for a in rows:
        if (a.closes_at and a.closes_at < now) or a.quiz.status != "published":
            continue
        passed = (await db.execute(select(func.count()).select_from(Attempt).where(
            Attempt.assignment_id == a.id, Attempt.status.in_(catalog.DONE)))).scalar_one()
        out.append(GroupHubItem(id=a.id, group_title=a.group.title, quiz_title=a.quiz.title,
                                questions_count=len(catalog.live_questions(a.quiz)),
                                duration_minutes=max(1, round(a.quiz.duration_sec / 60)), closes_at=a.closes_at,
                                passed=passed, my_status=mine.get(a.id)))
    return out


@router.get("/group/{aid}", response_model=GroupAssignmentView)
async def group_assignment(aid: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await quiz_svc.expire_overdue(db, user)
    a = await _assignment_for(db, user, aid, require_access=False)
    access = await _access(db, user, a)
    board, passed = await _group_board(db, a, user, limit=3)
    mine = (await db.execute(select(Attempt).where(Attempt.assignment_id == a.id, Attempt.user_id == user.id)))\
        .unique().scalars().first()
    names = [b.name for b in board[:3]]
    return GroupAssignmentView(
        id=a.id, access=access, group_title=a.group.title,  # type: ignore[arg-type]
        group_link=a.group.invite_link or (f"https://t.me/{a.group.username}" if a.group.username else None),
        quiz_id=a.quiz_id, quiz_title=a.quiz.title, author_name=a.author.display_name if a.author else None,
        questions_count=len(catalog.live_questions(a.quiz)), duration_minutes=max(1, round(a.quiz.duration_sec / 60)),
        closes_at=a.closes_at, passed=passed, members=max(a.group.members_count, passed), preview_names=names,
        leaderboard=board, my_session_id=mine.id if mine else None, my_status=mine.status if mine else None)


@router.get("/group/{aid}/result", response_model=GroupResultView)
async def group_result(aid: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    a = await _assignment_for(db, user, aid, require_access=False)
    mine = (await db.execute(select(Attempt).where(Attempt.assignment_id == a.id, Attempt.user_id == user.id,
                                                   Attempt.status.in_(catalog.DONE)))).unique().scalars().first()
    if mine is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "result_not_ready")
    board, passed = await _group_board(db, a, user, limit=5)
    rank = next(b.rank for b in board if b.me)
    return GroupResultView(assignment_id=a.id, group_title=a.group.title, quiz_title=a.quiz.title, session_id=mine.id,
                           rank=rank, passed=passed, points=mine.points, closes_at=a.closes_at,
                           remaining_members=max(0, a.group.members_count - passed), leaderboard=board)


@router.post("/group/{aid}/share", status_code=204)
async def group_share(aid: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Bot posts the user's result into the group chat."""
    res = await group_result(aid, user, db)
    a = await _assignment_for(db, user, aid, require_access=False)
    await telegram.send_message(
        a.group.chat_id,
        f"🏁 <b>{user.display_name}</b> прошёл(ла) «{res.quiz_title}»: {res.points} баллов, {res.rank} место из {res.passed}.",
        ("Пройти тест", telegram.startapp_link(f"g_{a.id}")))


# ---------------- live mode ----------------

async def _live(db: AsyncSession, live_id: str) -> LiveSession:
    live = await db.get(LiveSession, live_id)
    if live is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "live_not_found")
    return live


@router.get("/live", response_model=list[LiveListItem])
async def live_list(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(LiveSession).where(LiveSession.state.in_(live_svc.ACTIVE))
                             .order_by(LiveSession.created_at.desc()))).unique().scalars().all()
    out = []
    for s in rows:
        n = (await db.execute(select(func.count()).select_from(LiveParticipant)
                              .where(LiveParticipant.live_id == s.id))).scalar_one()
        out.append(LiveListItem(id=s.id, code=s.code, title=s.title, host_name=s.host.display_name if s.host else None,
                                state=s.state, participants=n))
    return out


@router.post("/live/join", response_model=LiveState)
async def live_join(body: LiveJoinBody, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if await access_svc.trial_of(db, user):
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "trial_locked")
    live = (await db.execute(select(LiveSession).where(LiveSession.code == body.code.strip(),
                                                       LiveSession.state.in_(live_svc.ACTIVE)))).unique().scalars().first()
    if live is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "live_not_found")
    await live_svc.join(db, live, user)
    await live_svc.hub.broadcast(live.id)
    return await live_svc.build_state(db, live, user)


@router.get("/live/{live_id}", response_model=LiveState)
async def live_state(live_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    live = await _live(db, live_id)
    if live.state != "finished":
        await live_svc.join(db, live, user)
    return await live_svc.build_state(db, live, user)


@router.post("/live/{live_id}/ready", response_model=LiveState)
async def live_ready(live_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    live = await _live(db, live_id)
    await live_svc.set_ready(db, live, user)
    await live_svc.hub.broadcast(live.id)
    return await live_svc.build_state(db, live, user)


@router.post("/live/{live_id}/answer", response_model=LiveState)
async def live_answer(live_id: str, body: LiveAnswerBody, user: User = Depends(current_user),
                      db: AsyncSession = Depends(get_db)):
    live = await _live(db, live_id)
    await live_svc.answer(db, live, user, body.index, body.option_id)
    await live_svc.hub.broadcast(live.id)
    return await live_svc.build_state(db, live, user)


@router.websocket("/live/{live_id}/ws")
async def live_ws(ws: WebSocket, live_id: str):
    """Pushes LiveState JSON on every change and once a second. Auth: first message = initData."""
    await ws.accept()
    try:
        init = await ws.receive_text()
        async with SessionLocal() as db:
            scheme, _, value = init.partition(" ")
            if scheme == "tma":
                tg = validate_init_data(value, settings.bot_token, settings.init_data_max_age)
            elif scheme == "dev" and settings.allow_dev_auth and value.isdigit():
                tg = TgUser(id=int(value), first_name="Dev")
            else:
                raise InitDataError("auth")
            user = await upsert_user(db, tg)
            live = await _live(db, live_id)
            await live_svc.join(db, live, user) if live.state != "finished" else None
            await ws.send_json((await live_svc.build_state(db, live, user)).model_dump(mode="json", by_alias=True))
    except (InitDataError, HTTPException):
        await ws.close(code=4401)
        return
    except WebSocketDisconnect:
        return
    entry = live_svc.hub.add(live_id, ws, user.id, host=False)
    await live_svc.hub.broadcast(live_id)
    try:
        while True:
            await ws.receive_text()  # keepalive pings from the client
    except WebSocketDisconnect:
        pass
    finally:
        live_svc.hub.remove(live_id, entry)
