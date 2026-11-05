"""«Xatolarim» — wrong answers come back at growing intervals (simple Leitner boxes).

box 0 → due now; each correct answer moves one box up: 1 day, 3, 7, 14, then mastered.
A wrong answer sends the question back to box 0.
"""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Attempt, AttemptAnswer, Question, ReviewItem, ReviewState, User, utcnow

INTERVALS = {1: timedelta(days=1), 2: timedelta(days=3), 3: timedelta(days=7), 4: timedelta(days=14)}
MASTERED = 5


async def add_mistake(db: AsyncSession, user_id: str, question_id: str) -> None:
    """Called for every wrong answer in a test: (re)start the question at box 0."""
    now = utcnow()
    stmt = insert(ReviewItem).values(user_id=user_id, question_id=question_id, box=0, due_at=now, created_at=now)
    await db.execute(stmt.on_conflict_do_update(index_elements=["user_id", "question_id"],
                                                set_={"box": 0, "due_at": now}))


async def seed_from_history(db: AsyncSession, user: User) -> None:
    """Once per student: mistakes made before this feature existed go into the deck too."""
    if await db.get(ReviewState, user.id):
        return
    rows = (await db.execute(
        select(AttemptAnswer.question_id).join(Attempt, Attempt.id == AttemptAnswer.attempt_id)
        .join(Question, Question.id == AttemptAnswer.question_id)
        .where(Attempt.user_id == user.id, AttemptAnswer.outcome == "wrong", Question.status != "archived")
        .distinct())).scalars().all()
    for qid in rows:
        await add_mistake(db, user.id, qid)
    db.add(ReviewState(user_id=user.id))
    await db.flush()


async def counts(db: AsyncSession, user: User) -> dict[str, int]:
    now = utcnow()
    learning = ReviewItem.box < MASTERED
    q = select(func.count()).select_from(ReviewItem).where(ReviewItem.user_id == user.id)
    return {
        "due": (await db.execute(q.where(learning, ReviewItem.due_at <= now))).scalar_one(),
        "learning": (await db.execute(q.where(learning))).scalar_one(),
        "mastered": (await db.execute(q.where(ReviewItem.box >= MASTERED))).scalar_one(),
    }


def next_state(item: ReviewItem, correct: bool) -> None:
    now = utcnow()
    item.last_at = now
    if not correct:
        item.box, item.due_at = 0, now
        return
    if item.due_at > now:  # practising ahead of time: no promotion, nothing lost
        return
    item.box = min(MASTERED, item.box + 1)
    item.due_at = now + INTERVALS.get(item.box, timedelta(days=3650))
