"""Database schema.

Content rule: a published test is edited in place (no versions). To keep past
results truthful, every attempt / live session stores a *snapshot* of the
questions exactly as they were when it started (text, options, correct answer,
points, explanation). Results, reviews and ratings read the snapshot, never the
current question bank.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, LargeBinary, String, Text, text,
                        Index, func)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


TS = DateTime(timezone=True)

# roles, ordered by power
ROLES = ("student", "host", "admin", "superadmin")


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(128), default="")
    last_name: Mapped[str | None] = mapped_column(String(128))
    username: Mapped[str | None] = mapped_column(String(64), index=True)
    photo_url: Mapped[str | None] = mapped_column(Text)
    language_code: Mapped[str | None] = mapped_column(String(16))
    #: UI language chosen in the app: uz | uz-cyrl | ru
    lang: Mapped[str | None] = mapped_column(String(8))
    role: Mapped[str] = mapped_column(String(16), default="student")
    notify_live: Mapped[bool] = mapped_column(Boolean, default=True)
    haptics: Mapped[bool] = mapped_column(Boolean, default=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(TS, default=utcnow)

    @property
    def display_name(self) -> str:
        last = f" {self.last_name[0]}." if self.last_name else ""
        return f"{self.first_name}{last}".strip() or (self.username or "—")


class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    title: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(16), default="blue")
    illustration: Mapped[str] = mapped_column(String(256), default="/3d/rq-3d-T01.webp")
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    #: default — tests in a list with subtopic chips; works — a shelf of literary works (covers), tests inside each
    layout: Mapped[str] = mapped_column(String(12), default="default", server_default="default")
    subtopics: Mapped[list[Subtopic]] = relationship(back_populates="topic", order_by="Subtopic.position",
                                                     cascade="all, delete-orphan")


class Subtopic(Base):
    __tablename__ = "subtopics"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(128))
    position: Mapped[int] = mapped_column(Integer, default=0)
    #: «works» sections: a subtopic is a literary work with its author and a cover
    author: Mapped[str] = mapped_column(String(128), default="", server_default="")
    cover: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    cover_type: Mapped[str | None] = mapped_column(String(32))
    cover_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    topic: Mapped[Topic] = relationship(back_populates="subtopics")


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), index=True)
    subtopic_id: Mapped[str | None] = mapped_column(ForeignKey("subtopics.id", ondelete="SET NULL"))
    text: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(8), default="medium")
    points: Mapped[int] = mapped_column(Integer, default=100)
    explanation_ru: Mapped[str | None] = mapped_column(Text)
    explanation_uz: Mapped[str | None] = mapped_column(Text)
    #: draft | published | archived
    status: Mapped[str] = mapped_column(String(12), default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TS, default=utcnow, onupdate=utcnow)
    options: Mapped[list[QuestionOption]] = relationship(order_by="QuestionOption.position",
                                                         cascade="all, delete-orphan", lazy="selectin")
    topic: Mapped[Topic] = relationship(lazy="joined")
    subtopic: Mapped[Subtopic | None] = relationship(lazy="joined")


class QuestionOption(Base):
    __tablename__ = "question_options"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)  # 0..3 → A..D
    text: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)


class Quiz(Base):
    """A test. Edited in place; attempts keep their own snapshot."""
    __tablename__ = "quizzes"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[str] = mapped_column(String(8), default="medium")
    #: one timer for the whole test
    duration_sec: Mapped[int] = mapped_column(Integer, default=360)
    #: live mode only: same time for every question
    live_question_sec: Mapped[int] = mapped_column(Integer, default=20)
    mode_individual: Mapped[bool] = mapped_column(Boolean, default=True)
    mode_live: Mapped[bool] = mapped_column(Boolean, default=False)
    mode_group: Mapped[bool] = mapped_column(Boolean, default=True)
    #: shown as the one-tap "Начать тест" card on Home
    is_quick: Mapped[bool] = mapped_column(Boolean, default=False)
    #: in a «works» section: which work this test is about
    subtopic_id: Mapped[str | None] = mapped_column(ForeignKey("subtopics.id", ondelete="SET NULL"), index=True)
    #: draft | published | archived
    status: Mapped[str] = mapped_column(String(12), default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TS, default=utcnow, onupdate=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(TS)
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    topic: Mapped[Topic] = relationship(lazy="joined")
    items: Mapped[list[QuizQuestion]] = relationship(order_by="QuizQuestion.position", cascade="all, delete-orphan",
                                                     lazy="selectin")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    quiz_id: Mapped[str] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    question: Mapped[Question] = relationship(lazy="selectin")


class Group(Base):
    """A Telegram group where the bot was added."""
    __tablename__ = "groups"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    chat_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(256))
    username: Mapped[str | None] = mapped_column(String(64))
    invite_link: Mapped[str | None] = mapped_column(Text)
    bot_is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    members_count: Mapped[int] = mapped_column(Integer, default=0)
    host_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    added_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    host: Mapped[User | None] = relationship(lazy="joined")


class GroupMember(Base):
    """Users we have seen in a group (bot updates or a verified membership check)."""
    __tablename__ = "group_members"
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    verified_at: Mapped[datetime] = mapped_column(TS, default=utcnow)


class GroupAssignment(Base):
    """A test sent to a group: everyone takes it once, before the deadline."""
    __tablename__ = "group_assignments"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    quiz_id: Mapped[str] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"))
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    closes_at: Mapped[datetime | None] = mapped_column(TS)
    message_id: Mapped[int | None] = mapped_column(BigInteger)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    # shown to every student in the Mini App «Группа» section; anyone can take it, not only group members
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    group: Mapped[Group] = relationship(lazy="joined")
    quiz: Mapped[Quiz] = relationship(lazy="joined")
    author: Mapped[User | None] = relationship(lazy="joined")


class Attempt(Base):
    """One run of a test by one user (individual or group mode)."""
    __tablename__ = "attempts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    quiz_id: Mapped[str | None] = mapped_column(ForeignKey("quizzes.id", ondelete="SET NULL"), index=True)
    assignment_id: Mapped[str | None] = mapped_column(ForeignKey("group_assignments.id", ondelete="SET NULL"),
                                                      index=True)
    mode: Mapped[str] = mapped_column(String(12), default="individual")
    quiz_title: Mapped[str] = mapped_column(String(200))
    topic_title: Mapped[str] = mapped_column(String(128))
    topic_color: Mapped[str] = mapped_column(String(16), default="blue")
    #: frozen questions: [{id, text, points, explanation, options:[{id,text}], correct: option_id}]
    snapshot: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    duration_sec: Mapped[int] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    #: moves forward while the answer feedback is shown (timer pause)
    deadline_at: Mapped[datetime] = mapped_column(TS)
    paused_ms: Mapped[int] = mapped_column(Integer, default=0)
    #: end of the current answer-feedback pause; unused pause is given back on the next action
    feedback_until: Mapped[datetime | None] = mapped_column(TS)
    finished_at: Mapped[datetime | None] = mapped_column(TS, index=True)
    #: in_progress | finished | timed_out | abandoned
    status: Mapped[str] = mapped_column(String(12), default="in_progress", index=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
    max_points: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    wrong: Mapped[int] = mapped_column(Integer, default=0)
    unanswered: Mapped[int] = mapped_column(Integer, default=0)
    used_sec: Mapped[int] = mapped_column(Integer, default=0)
    answers: Mapped[list[AttemptAnswer]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    user: Mapped[User] = relationship(lazy="joined")

    __table_args__ = (Index("ix_attempts_user_quiz", "user_id", "quiz_id"),)


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"
    attempt_id: Mapped[str] = mapped_column(ForeignKey("attempts.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    option_id: Mapped[str | None] = mapped_column(String(32))
    #: correct | wrong | unanswered
    outcome: Mapped[str] = mapped_column(String(12))
    points: Mapped[int] = mapped_column(Integer, default=0)
    answered_at: Mapped[datetime] = mapped_column(TS, default=utcnow)


class LiveSession(Base):
    """Everyone answers the same question at the same time; the host drives it."""
    __tablename__ = "live_sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(8), index=True)
    quiz_id: Mapped[str | None] = mapped_column(ForeignKey("quizzes.id", ondelete="SET NULL"))
    group_id: Mapped[str | None] = mapped_column(ForeignKey("groups.id", ondelete="SET NULL"))
    host_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(200))
    snapshot: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    question_sec: Mapped[int] = mapped_column(Integer, default=20)
    #: lobby | question | reveal | finished
    state: Mapped[str] = mapped_column(String(12), default="lobby", index=True)
    current_index: Mapped[int] = mapped_column(Integer, default=-1)
    question_started_at: Mapped[datetime | None] = mapped_column(TS)
    revealed_at: Mapped[datetime | None] = mapped_column(TS)
    #: set while paused: remaining ms of the current question
    paused_remaining_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(TS)
    finished_at: Mapped[datetime | None] = mapped_column(TS)
    host: Mapped[User | None] = relationship(lazy="joined")


class LiveParticipant(Base):
    __tablename__ = "live_participants"
    live_id: Mapped[str] = mapped_column(ForeignKey("live_sessions.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    ready: Mapped[bool] = mapped_column(Boolean, default=False)
    points: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    joined_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    user: Mapped[User] = relationship(lazy="joined")


class LiveAnswer(Base):
    __tablename__ = "live_answers"
    live_id: Mapped[str] = mapped_column(ForeignKey("live_sessions.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    question_index: Mapped[int] = mapped_column(Integer, primary_key=True)
    option_id: Mapped[str | None] = mapped_column(String(32))
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    points: Mapped[int] = mapped_column(Integer, default=0)
    elapsed_ms: Mapped[int] = mapped_column(Integer, default=0)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    #: None = for everyone
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    #: live | group | rating | new_tests | system
    kind: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str | None] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, index=True)


class NotificationRead(Base):
    __tablename__ = "notification_reads"
    notification_id: Mapped[str] = mapped_column(ForeignKey("notifications.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Any] = mapped_column(JSONB)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(64))
    target: Mapped[str | None] = mapped_column(String(128))
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), index=True)
    actor: Mapped[User | None] = relationship(lazy="joined")


class AdminLoginToken(Base):
    """One-time admin-panel login link, issued by the bot to hosts/admins."""
    __tablename__ = "admin_login_tokens"
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(TS)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class Book(Base):
    """A book of the centre shown in the Mini App «Книги» tab. The cover is stored in the database."""
    __tablename__ = "books"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(200))
    author: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[str] = mapped_column(String(64), default="")
    link: Mapped[str] = mapped_column(String(512), default="")
    cover: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    cover_type: Mapped[str | None] = mapped_column(String(32))
    # the PDF is never sent to the app: readers get rendered page images only
    pdf: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    pages: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TS, default=utcnow, onupdate=utcnow)


class Member(Base):
    """A Rusada student: free access while the app is closed to the public. Added by @username or by
    Telegram ID; with a username the ID is remembered on first visit, so a later change does not lock them out."""
    __tablename__ = "members"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    username: Mapped[str | None] = mapped_column(String(64), unique=True)  # lower-case, without @
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    note: Mapped[str] = mapped_column(String(200), default="")
    added_at: Mapped[datetime] = mapped_column(TS, default=utcnow)


class PaymentRequest(Base):
    """A card transfer the student reports with a receipt screenshot; an admin approves or rejects it."""
    __tablename__ = "payment_requests"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending | approved | rejected
    amount: Mapped[int] = mapped_column(Integer, default=0)
    days: Mapped[int] = mapped_column(Integer, default=30)
    receipt: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    receipt_type: Mapped[str | None] = mapped_column(String(32))
    comment: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(TS)
    decided_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    user: Mapped[User] = relationship(lazy="joined", foreign_keys=[user_id])


class Subscription(Base):
    """Paid (or granted) access for a period."""
    __tablename__ = "subscriptions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    starts_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    ends_at: Mapped[datetime] = mapped_column(TS)
    source: Mapped[str] = mapped_column(String(12), default="payment")  # payment | manual
    payment_id: Mapped[str | None] = mapped_column(ForeignKey("payment_requests.id", ondelete="SET NULL"))
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    user: Mapped[User] = relationship(lazy="joined", foreign_keys=[user_id])


class ReviewItem(Base):
    """«Xatolarim»: a question the student got wrong, repeated at growing intervals until mastered."""
    __tablename__ = "review_items"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True)
    #: 0..4 learning steps; 5 = mastered
    box: Mapped[int] = mapped_column(Integer, default=0)
    due_at: Mapped[datetime] = mapped_column(TS, default=utcnow, index=True)
    last_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)


class ReviewState(Base):
    """Remembers that a student's past mistakes were already loaded into «Xatolarim» once."""
    __tablename__ = "review_state"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    seeded_at: Mapped[datetime] = mapped_column(TS, default=utcnow)


class WordGame(Base):
    """«So‘z topish»: one game — the daily word (one per day per person) or a practice word."""
    __tablename__ = "word_games"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mode: Mapped[str] = mapped_column(String(10))  # daily | practice
    day: Mapped[date | None] = mapped_column(Date)
    answer: Mapped[str] = mapped_column(String(16))
    guesses: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(10), default="playing")  # playing | won | lost
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(TS)

    __table_args__ = (Index("ux_word_games_daily", "user_id", "day", unique=True, postgresql_where=text("mode = 'daily'")),)

