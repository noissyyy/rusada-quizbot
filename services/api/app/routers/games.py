"""Games and practice in the Mini App: «Xatolarim» (spaced review of mistakes) — more games join here."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..db import get_db
from ..models import Question, ReviewItem, User, utcnow
from ..schemas import Camel, OptionPublic, QuestionPublic
from ..security import current_user
from ..services import review

router = APIRouter(prefix="/api", tags=["games"])
LABELS = ("A", "B", "C", "D")


class ReviewOut(Camel):
    due: int
    learning: int
    mastered: int
    questions: list[QuestionPublic]


def _public(q: Question) -> QuestionPublic:
    opts = sorted(q.options, key=lambda o: o.position)
    return QuestionPublic(id=q.id, text=q.text, points=q.points, image_url=q.image_url,
                          options=[OptionPublic(id=o.id, label=LABELS[i], text=o.text) for i, o in enumerate(opts[:4])])


@router.get("/review", response_model=ReviewOut)
async def get_review(all: bool = False, limit: int = 20, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Questions to repeat now (or every not-yet-mastered one with all=1), oldest first."""
    await review.seed_from_history(db, user)
    stmt = (select(ReviewItem).where(ReviewItem.user_id == user.id, ReviewItem.box < review.MASTERED)
            .order_by(ReviewItem.due_at).limit(max(1, min(limit, 50))))
    if not all:
        stmt = stmt.where(ReviewItem.due_at <= utcnow())
    items = (await db.execute(stmt)).scalars().all()
    qs = {q.id: q for q in (await db.execute(select(Question).options(selectinload(Question.options))
                                               .where(Question.id.in_([i.question_id for i in items])))).unique().scalars()}
    c = await review.counts(db, user)
    await db.commit()
    return ReviewOut(**c, questions=[_public(qs[i.question_id]) for i in items
                                     if i.question_id in qs and qs[i.question_id].status != "archived"])


class ReviewAnswerIn(Camel):
    option_id: str


class ReviewAnswerOut(Camel):
    correct: bool
    correct_option_id: str | None
    explanation: str | None
    box: int
    mastered: bool
    next_due_at: datetime


@router.post("/review/{qid}", response_model=ReviewAnswerOut)
async def answer_review(qid: str, body: ReviewAnswerIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    item = await db.get(ReviewItem, (user.id, qid))
    q = (await db.execute(select(Question).options(selectinload(Question.options)).where(Question.id == qid))).unique().scalar_one_or_none()
    if item is None or q is None:
        raise HTTPException(404, "not_in_review")
    correct_opt = next((o.id for o in q.options if o.is_correct), None)
    ok = body.option_id == correct_opt
    review.next_state(item, ok)
    await db.commit()
    return ReviewAnswerOut(correct=ok, correct_option_id=correct_opt, explanation=q.explanation_ru, box=item.box,
                           mastered=item.box >= review.MASTERED, next_due_at=item.due_at)
