"""Live mode: one question for everyone at the same time, driven by the host.

State lives in PostgreSQL, so a reconnecting player lands on the same question
and can never score twice (live_answers has a composite primary key). A single
ticker coroutine moves time forward (question → reveal → next question), which
also survives an API restart. Run the API as ONE process (uvicorn, 1 worker):
WebSocket fan-out is in-memory.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import secrets
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import HTTPException, WebSocket, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal
from ..models import LiveAnswer, LiveParticipant, LiveSession, Quiz, User, utcnow
from ..schemas import LiveBoardEntry, LiveFinalView, LivePlayer, LiveReveal, LiveState
from .quiz import public_question, snapshot_quiz

log = logging.getLogger(__name__)
REVEAL_MS = 5000
ACTIVE = ("lobby", "question", "reveal")


async def new_code(db: AsyncSession) -> str:
    for _ in range(50):
        code = f"{secrets.randbelow(9000) + 1000}"
        taken = (await db.execute(select(func.count()).select_from(LiveSession).where(
            LiveSession.code == code, LiveSession.state.in_(ACTIVE)))).scalar_one()
        if not taken:
            return code
    raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "no free codes")


async def create(db: AsyncSession, host: User, quiz: Quiz, group_id: str | None = None) -> LiveSession:
    snap = snapshot_quiz(quiz)
    if not snap:
        raise HTTPException(status.HTTP_409_CONFLICT, "test_has_no_questions")
    live = LiveSession(code=await new_code(db), quiz_id=quiz.id, group_id=group_id, host_id=host.id,
                       title=quiz.title, snapshot=snap, question_sec=quiz.live_question_sec)
    db.add(live)
    await db.commit()
    return live


def remaining_ms(live: LiveSession, now: datetime | None = None) -> int:
    if live.state != "question" or live.question_started_at is None:
        return 0
    if live.paused_remaining_ms is not None:
        return live.paused_remaining_ms
    elapsed = (now or utcnow()) - live.question_started_at
    return max(0, live.question_sec * 1000 - int(elapsed.total_seconds() * 1000))


async def _board(db: AsyncSession, live: LiveSession) -> list[tuple[LiveParticipant, int]]:
    parts = (await db.execute(select(LiveParticipant).where(LiveParticipant.live_id == live.id))).unique().scalars().all()
    last_points: dict[str, int] = {}
    if live.current_index >= 0:
        rows = (await db.execute(select(LiveAnswer.user_id, LiveAnswer.points).where(
            LiveAnswer.live_id == live.id, LiveAnswer.question_index == live.current_index))).all()
        last_points = {u: p for u, p in rows}
    ranked = sorted(parts, key=lambda p: (-p.points, p.joined_at))
    return [(p, last_points.get(p.user_id, 0)) for p in ranked]


async def build_state(db: AsyncSession, live: LiveSession, viewer: User | None, host: bool = False) -> LiveState:
    board = await _board(db, live)
    idx = live.current_index
    q = live.snapshot[idx] if 0 <= idx < len(live.snapshot) else None
    answers = []
    if q is not None:
        answers = (await db.execute(select(LiveAnswer).where(LiveAnswer.live_id == live.id,
                                                             LiveAnswer.question_index == idx))).scalars().all()
    mine = next((a for a in answers if viewer and a.user_id == viewer.id), None)

    # ranks with ties, previous rank (before this question) for the ↑ arrow
    entries: list[LiveBoardEntry] = []
    prev_sorted = sorted(board, key=lambda b: -(b[0].points - (b[1] if live.state != "question" else 0)))
    prev_rank = {b[0].user_id: i + 1 for i, b in enumerate(prev_sorted)}
    for i, (p, last) in enumerate(board):
        entries.append(LiveBoardEntry(rank=i + 1, user_id=p.user_id, name=p.user.display_name, points=p.points,
                                      delta=prev_rank[p.user_id] - (i + 1) if live.state == "reveal" else 0,
                                      me=bool(viewer and p.user_id == viewer.id)))
    me_entry = next((e for e in entries if e.me), None)

    reveal = None
    if q is not None and live.state in ("reveal", "finished") and live.revealed_at is not None:
        text = {o["id"]: o["text"] for o in q["options"]}
        dist = None
        if host:
            dist = {o["id"]: 0 for o in q["options"]}
            for a in answers:
                if a.option_id in dist:
                    dist[a.option_id] += 1
        reveal = LiveReveal(correct_option_id=q["correct"], correct_text=text[q["correct"]],
                            explanation=q.get("explanation"), correct_count=sum(1 for a in answers if a.is_correct),
                            my_outcome="unanswered" if mine is None or mine.option_id is None else
                            ("correct" if mine.is_correct else "wrong"),
                            my_points=mine.points if mine else 0, distribution=dist)
    elif q is not None and host and live.state == "question":
        dist = {o["id"]: 0 for o in q["options"]}
        for a in answers:
            if a.option_id in dist:
                dist[a.option_id] += 1
        reveal = LiveReveal(correct_option_id=q["correct"], correct_text="", explanation=None,
                            correct_count=sum(1 for a in answers if a.is_correct), my_outcome="unanswered",
                            my_points=0, distribution=dist)

    final = None
    if live.state == "finished" and me_entry is not None:
        mp = next(p for p, _ in board if p.user_id == me_entry.user_id)
        final = LiveFinalView(rank=me_entry.rank, total=len(board), points=mp.points, correct=mp.correct)

    players = [LivePlayer(user_id=p.user_id, name="Вы" if viewer and p.user_id == viewer.id else p.user.display_name,
                          photo_url=p.user.photo_url, ready=p.ready, me=bool(viewer and p.user_id == viewer.id))
               for p, _ in sorted(board, key=lambda b: (not (viewer and b[0].user_id == viewer.id), b[0].joined_at))]
    top = entries if host else entries[:5]
    return LiveState(
        id=live.id, code=live.code, title=live.title, host_name=live.host.display_name if live.host else None,
        state=live.state, index=idx, questions_count=len(live.snapshot), question_sec=live.question_sec,  # type: ignore[arg-type]
        remaining_ms=remaining_ms(live), paused=live.paused_remaining_ms is not None,
        question=public_question(q) if q is not None and live.state != "lobby" else None,
        my_answer=mine.option_id if mine else None, answered_count=len(answers),
        participants_count=len(board), ready_count=sum(1 for p, _ in board if p.ready),
        players=players if host else players[:12], reveal=reveal, leaderboard=top, me_entry=me_entry,
        final=final, reveal_ms=REVEAL_MS)


# ---------------- transitions ----------------

async def join(db: AsyncSession, live: LiveSession, user: User) -> None:
    if live.state == "finished":
        raise HTTPException(status.HTTP_410_GONE, "live_finished")
    if await db.get(LiveParticipant, (live.id, user.id)) is None:
        db.add(LiveParticipant(live_id=live.id, user_id=user.id))
        await db.commit()


async def set_ready(db: AsyncSession, live: LiveSession, user: User) -> None:
    p = await db.get(LiveParticipant, (live.id, user.id))
    if p is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not_joined")
    p.ready = True
    await db.commit()


async def answer(db: AsyncSession, live: LiveSession, user: User, index: int, option_id: str) -> None:
    if live.state != "question" or index != live.current_index:
        raise HTTPException(status.HTTP_409_CONFLICT, "question_closed")
    if live.paused_remaining_ms is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "paused")
    part = await db.get(LiveParticipant, (live.id, user.id))
    if part is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not_joined")
    if await db.get(LiveAnswer, (live.id, user.id, index)) is not None:
        return  # idempotent, first answer wins
    left = remaining_ms(live)
    if left <= 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "question_closed")
    q = live.snapshot[index]
    if option_id not in {o["id"] for o in q["options"]}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "unknown_option")
    ok = option_id == q["correct"]
    pts = q["points"] if ok else 0
    db.add(LiveAnswer(live_id=live.id, user_id=user.id, question_index=index, option_id=option_id, is_correct=ok,
                      points=pts, elapsed_ms=live.question_sec * 1000 - left))
    part.points += pts
    part.correct += int(ok)
    await db.commit()
    answered = (await db.execute(select(func.count()).select_from(LiveAnswer).where(
        LiveAnswer.live_id == live.id, LiveAnswer.question_index == index))).scalar_one()
    total = (await db.execute(select(func.count()).select_from(LiveParticipant).where(
        LiveParticipant.live_id == live.id))).scalar_one()
    if answered >= total:
        await reveal(db, live)  # everyone answered — no need to wait


async def next_question(db: AsyncSession, live: LiveSession) -> None:
    if live.state == "finished":
        return
    if live.state == "question":
        await reveal(db, live)
        return
    if live.current_index + 1 >= len(live.snapshot):
        await finish(db, live)
        return
    now = utcnow()
    live.started_at = live.started_at or now
    live.current_index += 1
    live.state = "question"
    live.question_started_at = now
    live.revealed_at = None
    live.paused_remaining_ms = None
    await db.commit()


async def reveal(db: AsyncSession, live: LiveSession) -> None:
    if live.state != "question":
        return
    live.state = "reveal"
    live.revealed_at = utcnow()
    live.paused_remaining_ms = None
    await db.commit()


async def pause(db: AsyncSession, live: LiveSession) -> None:
    if live.state == "question" and live.paused_remaining_ms is None:
        live.paused_remaining_ms = remaining_ms(live)
        await db.commit()


async def resume(db: AsyncSession, live: LiveSession) -> None:
    if live.state == "question" and live.paused_remaining_ms is not None:
        left = live.paused_remaining_ms
        live.paused_remaining_ms = None
        live.question_started_at = utcnow() - timedelta(milliseconds=live.question_sec * 1000 - left)
        await db.commit()


async def finish(db: AsyncSession, live: LiveSession) -> None:
    if live.state != "finished":
        live.state = "finished"
        live.finished_at = utcnow()
        live.paused_remaining_ms = None
        await db.commit()


async def tick(db: AsyncSession, now: datetime | None = None) -> list[str]:
    """Advance timed transitions. Returns ids of lives that changed."""
    now = now or utcnow()
    changed = []
    lives = (await db.execute(select(LiveSession).where(LiveSession.state.in_(("question", "reveal"))))).unique().scalars()
    for live in lives:
        if live.state == "question" and live.paused_remaining_ms is None and remaining_ms(live, now) <= 0:
            await reveal(db, live)
            changed.append(live.id)
        elif live.state == "reveal" and live.revealed_at and now - live.revealed_at >= timedelta(milliseconds=REVEAL_MS):
            await next_question(db, live)
            changed.append(live.id)
    return changed


# ---------------- realtime fan-out ----------------

class Hub:
    def __init__(self) -> None:
        self.clients: dict[str, set[tuple[WebSocket, str | None, bool]]] = defaultdict(set)

    def add(self, live_id: str, ws: WebSocket, user_id: str | None, host: bool) -> tuple:
        entry = (ws, user_id, host)
        self.clients[live_id].add(entry)
        return entry

    def remove(self, live_id: str, entry: tuple) -> None:
        self.clients[live_id].discard(entry)

    def online_ids(self, live_id: str) -> set[str]:
        return {u for _, u, _ in self.clients.get(live_id, ()) if u}

    async def broadcast(self, live_id: str) -> None:
        conns = list(self.clients.get(live_id, ()))
        if not conns:
            return
        async with SessionLocal() as db:
            live = await db.get(LiveSession, live_id)
            if live is None:
                return
            for entry in conns:
                ws, uid, host = entry
                viewer = await db.get(User, uid) if uid else None
                state = await build_state(db, live, viewer, host=host)
                payload = state.model_dump(mode="json", by_alias=True)
                if host:
                    payload["online"] = sorted(self.online_ids(live_id))
                try:
                    await ws.send_json(payload)
                except Exception:  # noqa: BLE001 — a dead socket must not break the others
                    self.remove(live_id, entry)


hub = Hub()


async def ticker(stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            async with SessionLocal() as db:
                changed = await tick(db)
            for live_id in changed:
                await hub.broadcast(live_id)
            # keep countdowns in sync for everyone once a second
            for live_id in list(hub.clients):
                if hub.clients[live_id]:
                    await hub.broadcast(live_id)
        except Exception:  # noqa: BLE001
            log.exception("live ticker")
        with contextlib.suppress(asyncio.TimeoutError):
            await asyncio.wait_for(stop.wait(), timeout=1.0)
