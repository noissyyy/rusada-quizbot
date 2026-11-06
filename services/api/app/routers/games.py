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
from ..services import review, xp

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
    if ok:
        xp.award(db, user.id, 3, "review")
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
    if g.status != "playing":
        xp.award(db, user.id, (30 if g.mode == "daily" else 15) if g.status == "won" else 5, "word")
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


# ---------------- «Urg‘u» ----------------

from datetime import timedelta as _td  # noqa: E402

from sqlalchemy import func as _func  # noqa: E402

from ..models import StressScore  # noqa: E402
from ..services import stress  # noqa: E402

ROUND_SEC = 60


class StressWord(Camel):
    word: str
    stress: int  # index of the stressed vowel in the word


@router.get("/games/stress/words", response_model=list[StressWord])
async def stress_words(user: User = Depends(current_user)):
    """The whole list; the app shuffles it for each round. It is practice — knowing the answers is the point."""
    return [StressWord(word=w, stress=i) for w, i in stress.WORDS]


class StressScoreIn(Camel):
    score: int
    answered: int


class BoardRow(Camel):
    rank: int
    name: str
    score: int
    me: bool = False


class StressBoardOut(Camel):
    best: int
    best_week: int
    rounds: int
    week: list[BoardRow]


@router.post("/games/stress/score", response_model=StressBoardOut)
async def stress_score(body: StressScoreIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    # a 60-second round: anything beyond ~2 answers a second is not a real round
    if not 0 <= body.score <= body.answered <= ROUND_SEC * 2:
        raise HTTPException(422, "impossible_score")
    db.add(StressScore(user_id=user.id, score=body.score, answered=body.answered))
    xp.award(db, user.id, body.score, "stress")
    await db.commit()
    return await stress_board(user, db)


@router.get("/games/stress/board", response_model=StressBoardOut)
async def stress_board(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    week_ago = utcnow() - _td(days=7)
    mine = select(_func.coalesce(_func.max(StressScore.score), 0)).where(StressScore.user_id == user.id)
    best = (await db.execute(mine)).scalar_one()
    best_week = (await db.execute(mine.where(StressScore.created_at >= week_ago))).scalar_one()
    rounds = (await db.execute(select(_func.count()).select_from(StressScore).where(StressScore.user_id == user.id))).scalar_one()
    rows = (await db.execute(select(StressScore.user_id, _func.max(StressScore.score).label("s"))
                             .where(StressScore.created_at >= week_ago).group_by(StressScore.user_id)
                             .order_by(_func.max(StressScore.score).desc()).limit(10))).all()
    names = {u.id: u.display_name for u in (await db.execute(select(User).where(User.id.in_([r[0] for r in rows])))).scalars()} if rows else {}
    return StressBoardOut(best=best, best_week=best_week, rounds=rounds,
                          week=[BoardRow(rank=i + 1, name=names.get(uid, "—"), score=s, me=uid == user.id) for i, (uid, s) in enumerate(rows)])


# ---------------- Duel ----------------

import logging as _logging  # noqa: E402

from sqlalchemy import or_ as _or  # noqa: E402

from .. import telegram as _tg  # noqa: E402
from ..config import settings as _settings  # noqa: E402
from ..models import Duel, DuelPlay, Quiz, QuizQuestion  # noqa: E402
from ..services.quiz import public_question  # noqa: E402

_log = _logging.getLogger(__name__)
DUEL_QUESTIONS = 10
DUEL_DAYS = 3


class DuelCreateIn(Camel):
    topic_id: str | None = None


class DuelSide(Camel):
    name: str
    finished: bool
    correct: int | None  # hidden until you have finished yourself
    time_ms: int | None


class DuelOut(Camel):
    id: str
    role: str  # creator | opponent | new (you may accept) | full
    questions_count: int
    topic_title: str | None
    me: DuelSide | None
    rival: DuelSide | None
    #: win | lose | draw once both finished; otherwise None
    outcome: str | None
    expired: bool
    link: str
    created_at: datetime


async def _duel_out(db: AsyncSession, d: Duel, user: User) -> DuelOut:
    plays = {p.user_id: p for p in (await db.execute(select(DuelPlay).where(DuelPlay.duel_id == d.id))).scalars()}
    if user.id == d.creator_id:
        role, rival_id = "creator", d.opponent_id
    elif user.id == d.opponent_id:
        role, rival_id = "opponent", d.creator_id
    else:
        role, rival_id = ("new" if d.opponent_id is None else "full"), d.creator_id
    mine, theirs = plays.get(user.id), plays.get(rival_id) if rival_id else None
    me_done = bool(mine and mine.finished_at)
    rival_user = await db.get(User, rival_id) if rival_id else None

    def side(p: DuelPlay | None, name: str, reveal: bool) -> DuelSide:
        done = bool(p and p.finished_at)
        return DuelSide(name=name, finished=done, correct=p.correct if p and done and reveal else None,
                        time_ms=p.time_ms if p and done and reveal else None)

    outcome = None
    if mine and theirs and mine.finished_at and theirs.finished_at:
        a, b = (mine.correct, -(mine.time_ms or 0)), (theirs.correct, -(theirs.time_ms or 0))
        outcome = "win" if a > b else "lose" if a < b else "draw"
    topic = None
    if d.topic_id:
        from ..models import Topic
        t = await db.get(Topic, d.topic_id)
        topic = t.title if t else None
    return DuelOut(id=d.id, role=role, questions_count=len(d.snapshot), topic_title=topic,
                   me=side(mine, user.display_name, True) if role in ("creator", "opponent") else None,
                   rival=side(theirs, rival_user.display_name, me_done) if rival_user else None,
                   outcome=outcome, expired=d.expires_at < utcnow() and not outcome,
                   link=_tg.startapp_link(f"d_{d.id}"), created_at=d.created_at)


@router.post("/duels", response_model=DuelOut)
async def create_duel(body: DuelCreateIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """10 random questions from published tests (optionally one section), frozen for both players."""
    from sqlalchemy import func as f
    from ..services.quiz import snapshot_quiz
    stmt = (select(Question).options(selectinload(Question.options))
            .join(QuizQuestion, QuizQuestion.question_id == Question.id).join(Quiz, Quiz.id == QuizQuestion.quiz_id)
            .where(Quiz.status == "published", Question.status != "archived"))
    if body.topic_id:
        stmt = stmt.where(Quiz.topic_id == body.topic_id)
    qs = (await db.execute(stmt.distinct().order_by(f.random()).limit(DUEL_QUESTIONS * 3))).unique().scalars().all()

    class _Item:  # reuse the test snapshot format
        def __init__(self, q: Question): self.question = q

    class _Q:
        def __init__(self, items): self.items = items
    snap = snapshot_quiz(_Q([_Item(q) for q in qs]))[:DUEL_QUESTIONS]  # type: ignore[arg-type]
    if len(snap) < 3:
        raise HTTPException(409, "not_enough_questions")
    d = Duel(creator_id=user.id, topic_id=body.topic_id, snapshot=snap, expires_at=utcnow() + _td(days=DUEL_DAYS))
    db.add(d)
    await db.commit()
    return await _duel_out(db, d, user)


@router.get("/duels", response_model=list[DuelOut])
async def my_duels(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Duel).where(_or(Duel.creator_id == user.id, Duel.opponent_id == user.id))
                             .order_by(Duel.created_at.desc()).limit(20))).scalars().all()
    return [await _duel_out(db, d, user) for d in rows]


@router.get("/duels/{did}", response_model=DuelOut)
async def get_duel(did: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    d = await db.get(Duel, did)
    if d is None:
        raise HTTPException(404, "duel_not_found")
    return await _duel_out(db, d, user)


class DuelStartOut(Camel):
    questions: list[QuestionPublic]
    answered: dict[str, dict]  # index → {correct, correctOptionId, chosen}


@router.post("/duels/{did}/start", response_model=DuelStartOut)
async def start_duel(did: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    d = await db.get(Duel, did)
    if d is None:
        raise HTTPException(404, "duel_not_found")
    if user.id not in (d.creator_id, d.opponent_id):
        if d.opponent_id is not None:
            raise HTTPException(409, "duel_full")
        if d.expires_at < utcnow():
            raise HTTPException(409, "duel_expired")
        d.opponent_id = user.id  # the first person to open the link takes the challenge
    play = await db.get(DuelPlay, (d.id, user.id))
    if play is None:
        play = DuelPlay(duel_id=d.id, user_id=user.id, answers={}, started_at=utcnow())
        db.add(play)
    elif play.finished_at:
        raise HTTPException(409, "duel_played")
    await db.commit()
    return DuelStartOut(questions=[public_question(q) for q in d.snapshot],
                        answered={k: {"correct": v["ok"], "correctOptionId": d.snapshot[int(k)]["correct"], "chosen": v["o"]}
                                  for k, v in play.answers.items()})


class DuelAnswerIn(Camel):
    index: int
    option_id: str


class DuelAnswerOut(Camel):
    correct: bool
    correct_option_id: str


@router.post("/duels/{did}/answer", response_model=DuelAnswerOut)
async def answer_duel(did: str, body: DuelAnswerIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    d = await db.get(Duel, did)
    play = await db.get(DuelPlay, (did, user.id))
    if d is None or play is None:
        raise HTTPException(404)
    if play.finished_at:
        raise HTTPException(409, "duel_played")
    if not 0 <= body.index < len(d.snapshot):
        raise HTTPException(422, "bad_index")
    q = d.snapshot[body.index]
    key = str(body.index)
    if key not in play.answers:  # the first answer counts
        ok = body.option_id == q["correct"]
        play.answers = {**play.answers, key: {"o": body.option_id, "ok": ok}}
        play.correct = sum(1 for v in play.answers.values() if v["ok"])
        await db.commit()
    return DuelAnswerOut(correct=play.answers[key]["ok"], correct_option_id=q["correct"])


@router.post("/duels/{did}/finish", response_model=DuelOut)
async def finish_duel(did: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    d = await db.get(Duel, did)
    play = await db.get(DuelPlay, (did, user.id))
    if d is None or play is None:
        raise HTTPException(404)
    if not play.finished_at:
        play.finished_at = utcnow()
        play.time_ms = int((play.finished_at - play.started_at).total_seconds() * 1000)
        xp.award(db, user.id, 10 + 2 * play.correct, "duel")
        await db.commit()
        out = await _duel_out(db, d, user)
        if out.outcome and _settings.telegram_enabled:  # both have played: tell both
            for uid in (d.creator_id, d.opponent_id):
                u = await db.get(User, uid) if uid else None
                if not u:
                    continue
                o = await _duel_out(db, d, u)
                head = {"win": "🏆 Вы победили в дуэли! · Duelda yutdingiz!", "lose": "Дуэль проиграна · Duelda yutqazdingiz",
                        "draw": "Ничья в дуэли · Duelda durang"}[o.outcome or "draw"]
                try:
                    await _tg.send_message(u.telegram_id, f"⚔️ <b>{head}</b>\n{o.me.correct if o.me else 0} : {o.rival.correct if o.rival else 0} — {o.rival.name if o.rival else ''}",
                                           ("Открыть · Ochish", o.link))
                except Exception:  # noqa: BLE001
                    _log.warning("duel notify failed", exc_info=True)
        return out
    return await _duel_out(db, d, user)


# ---------------- hub, XP, results of single-player games ----------------

from ..models import GameResult, XpEvent  # noqa: E402


class XpOut(Camel):
    xp: int
    level: int
    level_start: int
    level_next: int


class GamesHubOut(Camel):
    xp: XpOut
    #: plays this week per game key (word, stress, duel, review, wordsearch, memory, …)
    plays: dict[str, int]
    review_due: int


@router.get("/games/hub", response_model=GamesHubOut)
async def games_hub(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    week = utcnow() - _td(days=7)
    rows = (await db.execute(select(XpEvent.source, _func.count()).where(XpEvent.created_at >= week)
                             .group_by(XpEvent.source))).all()
    await review.seed_from_history(db, user)
    due = (await review.counts(db, user))["due"]
    await db.commit()
    return GamesHubOut(xp=XpOut(**await xp.summary(db, user.id)),
                       plays={src: n for src, n in rows if src != "test"}, review_due=due)


class GameResultIn(Camel):
    score: int


class GameResultOut(Camel):
    best: int
    xp_earned: int
    xp: XpOut


@router.post("/games/{game}/result", response_model=GameResultOut)
async def game_result(game: str, body: GameResultIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """A finished round of a single-player game: stored for the best score and turned into XP (capped)."""
    cap = xp.GAME_XP_CAP.get(game)
    if cap is None:
        raise HTTPException(404, "unknown_game")
    if not 0 <= body.score <= 10_000:
        raise HTTPException(422, "impossible_score")
    db.add(GameResult(user_id=user.id, game=game, score=body.score))
    earned = min(cap, body.score)
    xp.award(db, user.id, earned, game)
    await db.commit()
    best = (await db.execute(select(_func.max(GameResult.score)).where(GameResult.user_id == user.id, GameResult.game == game))).scalar_one()
    return GameResultOut(best=best or 0, xp_earned=earned, xp=XpOut(**await xp.summary(db, user.id)))



# ---------------------------------------------------------------- «Последнее слово»

from ..services import lastword  # noqa: E402


class LastWordIn(Camel):
    word: str
    used: list[str] = []


class LastWordOut(Camel):
    ok: bool
    word: str
    error: str | None = None
    bot: str | None = None
    bot_gave_up: bool = False
    need: str | None = None


@router.get("/games/lastword/start", response_model=LastWordOut)
async def lastword_start(user: User = Depends(current_user)):
    """The bot opens the game with a common noun."""
    w = lastword.bot_move([], 0)
    assert w
    return LastWordOut(ok=True, word=w, bot=w, need=lastword.last_letter(w))


@router.post("/games/lastword/turn", response_model=LastWordOut)
async def lastword_turn(body: LastWordIn, user: User = Depends(current_user)):
    """Checks the player's word against the chain so far and returns the bot's answer."""
    if len(body.used) > 400:
        raise HTTPException(422, "too_long")
    word, err = lastword.check(body.word, body.used)
    if err:
        return LastWordOut(ok=False, word=word, error=err, need=lastword.last_letter(body.used[-1]) if body.used else None)
    chain = [*body.used, word]
    bot = lastword.bot_move(chain, len(chain) // 2)
    if bot is None:
        return LastWordOut(ok=True, word=word, bot_gave_up=True)
    return LastWordOut(ok=True, word=word, bot=bot, need=lastword.last_letter(bot))
