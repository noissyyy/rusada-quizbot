"""Read models for the Mini App: topics, tests, home feed, rating, profile."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (Attempt, LiveParticipant, LiveSession, Notification, NotificationRead, Quiz, Topic, User,
                      utcnow)
from ..schemas import (HistoryItem, Rating, RatingEntry, TestStatus, TestSummary, TopicSummary, TopicTest,
                       UserProfile)

DONE = ("finished", "timed_out")


def live_questions(quiz: Quiz) -> list:
    return [i for i in quiz.items if i.question.status != "archived"]


def summary(quiz: Quiz) -> TestSummary:
    return TestSummary(id=quiz.id, title=quiz.title, topic_title=quiz.topic.title, topic_color=quiz.topic.color,
                       illustration=quiz.topic.illustration, questions_count=len(live_questions(quiz)),
                       duration_minutes=max(1, round(quiz.duration_sec / 60)), difficulty=quiz.difficulty)  # type: ignore[arg-type]


def user_profile(u: User) -> UserProfile:
    return UserProfile.model_validate(u)


async def published_quizzes(db: AsyncSession, topic_id: str | None = None) -> list[Quiz]:
    q = select(Quiz).join(Topic).where(Quiz.status == "published", Quiz.mode_individual.is_(True),
                                       Topic.is_active.is_(True))
    if topic_id:
        q = q.where(Quiz.topic_id == topic_id)
    return list((await db.execute(q.order_by(Quiz.created_at))).unique().scalars())


async def statuses(db: AsyncSession, user: User, quiz_ids: list[str]) -> dict[str, TestStatus]:
    if not quiz_ids:
        return {}
    rows = (await db.execute(select(Attempt).where(Attempt.user_id == user.id, Attempt.quiz_id.in_(quiz_ids),
                                                   Attempt.assignment_id.is_(None)))).unique().scalars().all()
    out: dict[str, TestStatus] = {}
    for a in rows:
        if a.status == "in_progress":
            out[a.quiz_id] = TestStatus(kind="in_progress", answered=len(a.answers))  # type: ignore[index]
    for a in rows:
        if a.status in DONE and a.quiz_id not in out and a.max_points:
            pct = round(100 * a.points / a.max_points)
            prev = out.get(a.quiz_id)  # type: ignore[arg-type]
            if prev is None or (prev.best_percent or 0) < pct:
                out[a.quiz_id] = TestStatus(kind="done", best_percent=pct)  # type: ignore[index]
    return out


def topic_test(quiz: Quiz, st: TestStatus | None) -> TopicTest:
    qs = live_questions(quiz)
    return TopicTest(**summary(quiz).model_dump(), description=quiz.description,
                     max_points=sum(i.question.points for i in qs), status=st or TestStatus(kind="new"))


async def topics(db: AsyncSession, user: User) -> list[TopicSummary]:
    tps = (await db.execute(select(Topic).where(Topic.is_active.is_(True)).order_by(Topic.position))).scalars().all()
    quizzes = await published_quizzes(db)
    sts = await statuses(db, user, [q.id for q in quizzes])
    out = []
    for t in tps:
        mine = [q for q in quizzes if q.topic_id == t.id]
        done = sum(1 for q in mine if sts.get(q.id) and sts[q.id].kind == "done")
        diffs = [d for d in ("easy", "medium", "hard") if any(q.difficulty == d for q in mine)]
        out.append(TopicSummary(id=t.id, slug=t.slug, title=t.title, color=t.color, illustration=t.illustration,
                                tests_count=len(mine), questions_count=sum(len(live_questions(q)) for q in mine),
                                progress=round(100 * done / len(mine)) if mine else 0, difficulties=diffs))  # type: ignore[arg-type]
    return out


async def unread_count(db: AsyncSession, user: User) -> int:
    read = select(NotificationRead.notification_id).where(NotificationRead.user_id == user.id)
    return (await db.execute(select(func.count()).select_from(Notification).where(
        or_(Notification.user_id == user.id,
            and_(Notification.user_id.is_(None), Notification.created_at >= user.created_at - timedelta(days=14))),
        Notification.id.not_in(read)))).scalar_one()


async def popular(db: AsyncSession, limit: int = 6) -> list[Quiz]:
    quizzes = await published_quizzes(db)
    since = utcnow() - timedelta(days=30)
    counts = dict((await db.execute(select(Attempt.quiz_id, func.count()).where(Attempt.started_at >= since)
                                    .group_by(Attempt.quiz_id))).all())
    quizzes = [q for q in quizzes if live_questions(q)]
    return sorted(quizzes, key=lambda q: -counts.get(q.id, 0))[:limit]


def _period_start(period: str):
    return {"week": utcnow() - timedelta(days=7), "month": utcnow() - timedelta(days=30)}.get(period)


async def rating(db: AsyncSession, me: User, kind: str, period: str, limit: int = 50) -> Rating:
    since = _period_start(period)
    if kind == "live":
        q = (select(LiveParticipant.user_id, func.sum(LiveParticipant.points).label("pts"))
             .join(LiveSession, LiveSession.id == LiveParticipant.live_id)
             .where(LiveSession.state == "finished"))
        if since:
            q = q.where(LiveSession.finished_at >= since)
        q = q.group_by(LiveParticipant.user_id)
    else:
        mode = "group" if kind == "group" else "individual"
        best = (select(Attempt.user_id, Attempt.quiz_id, Attempt.assignment_id,
                       func.max(Attempt.points).label("best"))
                .where(Attempt.mode == mode, Attempt.status.in_(DONE)))
        if since:
            best = best.where(Attempt.finished_at >= since)
        best = best.group_by(Attempt.user_id, Attempt.quiz_id, Attempt.assignment_id).subquery()
        q = select(best.c.user_id, func.sum(best.c.best).label("pts")).group_by(best.c.user_id)
    rows = (await db.execute(q)).all()
    rows = sorted(((uid, int(p or 0)) for uid, p in rows if p), key=lambda r: -r[1])
    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_([r[0] for r in rows])))).scalars()}
    entries: list[RatingEntry] = []
    me_entry = None
    rank = 0
    last = None
    for i, (uid, pts) in enumerate(rows):
        if pts != last:
            rank, last = i + 1, pts
        u = users[uid]
        e = RatingEntry(rank=rank, user_id=uid, name=u.display_name, photo_url=u.photo_url, points=pts,
                        me=uid == me.id)
        if e.me:
            me_entry = e
        if i < limit:
            entries.append(e)
    return Rating(kind=kind, period=period, entries=entries, me=me_entry)


async def history(db: AsyncSession, user: User, limit: int = 20) -> list[HistoryItem]:
    out: list[HistoryItem] = []
    attempts = (await db.execute(select(Attempt).where(Attempt.user_id == user.id, Attempt.status.in_(DONE))
                                 .order_by(Attempt.finished_at.desc()).limit(limit))).unique().scalars()
    for a in attempts:
        out.append(HistoryItem(kind="group" if a.mode == "group" else "individual", id=a.id, title=a.quiz_title,
                               subtitle=a.topic_title, color=a.topic_color, points=a.points,
                               max_points=a.max_points, at=a.finished_at))  # type: ignore[arg-type]
    lives = (await db.execute(select(LiveParticipant, LiveSession).join(LiveSession)
                              .where(LiveParticipant.user_id == user.id, LiveSession.state == "finished")
                              .order_by(LiveSession.finished_at.desc()).limit(limit))).unique().all()
    for p, s in lives:
        board = (await db.execute(select(LiveParticipant.user_id, LiveParticipant.points)
                                  .where(LiveParticipant.live_id == s.id))).all()
        rank = 1 + sum(1 for _, pts in board if pts > p.points)
        out.append(HistoryItem(kind="live", id=s.id, title=s.title, subtitle="", color="ink", points=p.points,
                               rank=rank, participants=len(board), at=s.finished_at))  # type: ignore[arg-type]
    return sorted(out, key=lambda h: h.at, reverse=True)[:limit]
