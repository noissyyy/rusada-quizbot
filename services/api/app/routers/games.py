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


# ---------------- «So‘z topish» ----------------

from datetime import date as _date  # noqa: E402

from ..models import WordGame  # noqa: E402
from ..services import words  # noqa: E402


class WordGuessOut(Camel):
    word: str
    marks: list[str]


class WordGameOut(Camel):
    id: str
    mode: str
    number: int | None  # daily: «So‘z #12»
    length: int
    tries: int
    guesses: list[WordGuessOut]
    status: str
    answer: str | None  # only once the game is over


def _word_out(g: WordGame) -> WordGameOut:
    return WordGameOut(id=g.id, mode=g.mode, number=words.daily_number(g.day) if g.day else None, length=words.LENGTH,
                       tries=words.TRIES, guesses=[WordGuessOut(word=x, marks=words.marks(x, g.answer)) for x in g.guesses],
                       status=g.status, answer=g.answer if g.status != "playing" else None)


@router.get("/games/word/daily", response_model=WordGameOut)
async def word_daily(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    day = words.today()
    g = (await db.execute(select(WordGame).where(WordGame.user_id == user.id, WordGame.mode == "daily",
                                                 WordGame.day == day))).scalar_one_or_none()
    if g is None:
        g = WordGame(user_id=user.id, mode="daily", day=day, answer=words.daily_word(day), guesses=[])
        db.add(g)
        await db.commit()
    return _word_out(g)


@router.post("/games/word/practice", response_model=WordGameOut)
async def word_practice(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Continues an unfinished practice game, otherwise starts a new one with a word not played recently."""
    open_game = (await db.execute(select(WordGame).where(WordGame.user_id == user.id, WordGame.mode == "practice",
                                                         WordGame.status == "playing"))).scalars().first()
    if open_game:
        return _word_out(open_game)
    recent = set((await db.execute(select(WordGame.answer).where(WordGame.user_id == user.id)
                                   .order_by(WordGame.created_at.desc()).limit(100))).scalars())
    g = WordGame(user_id=user.id, mode="practice", answer=words.random_word(recent), guesses=[])
    db.add(g)
    await db.commit()
    return _word_out(g)


class GuessIn(Camel):
    word: str


@router.post("/games/word/{gid}/guess", response_model=WordGameOut)
async def word_guess(gid: str, body: GuessIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    g = await db.get(WordGame, gid)
    if g is None or g.user_id != user.id:
        raise HTTPException(404)
    if g.status != "playing":
        raise HTTPException(409, "game_over")
    guess = words.normalize(body.word)
    if guess is None:
        raise HTTPException(422, "need_5_letters")
    g.guesses = [*g.guesses, guess]
    if guess == g.answer:
        g.status, g.finished_at = "won", utcnow()
    elif len(g.guesses) >= words.TRIES:
        g.status, g.finished_at = "lost", utcnow()
    await db.commit()
    return _word_out(g)


class WordStatsOut(Camel):
    played: int
    won: int
    streak: int  # daily words solved on consecutive days up to today/yesterday
    best_streak: int
    distribution: list[int]  # wins in 1..6 tries (daily + practice)
    practice_won: int


@router.get("/games/word/stats", response_model=WordStatsOut)
async def word_stats(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    games = (await db.execute(select(WordGame).where(WordGame.user_id == user.id, WordGame.status != "playing"))).scalars().all()
    dist = [0] * words.TRIES
    for g in games:
        if g.status == "won":
            dist[min(len(g.guesses), words.TRIES) - 1] += 1
    won_days = sorted({g.day for g in games if g.mode == "daily" and g.status == "won" and g.day})
    best = run = 0
    prev: _date | None = None
    for d in won_days:
        run = run + 1 if prev and (d - prev).days == 1 else 1
        best, prev = max(best, run), d
    today = words.today()
    streak = run if prev and (today - prev).days <= 1 else 0
    daily = [g for g in games if g.mode == "daily"]
    return WordStatsOut(played=len(daily), won=sum(1 for g in daily if g.status == "won"), streak=streak, best_streak=best,
                        distribution=dist, practice_won=sum(1 for g in games if g.mode == "practice" and g.status == "won"))
