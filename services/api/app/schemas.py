"""Pydantic wire models. JSON is camelCase to match packages/shared-types."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Difficulty = Literal["easy", "medium", "hard"]
Outcome = Literal["correct", "wrong", "unanswered"]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------- mini app ----------

class UserProfile(Camel):
    id: str
    telegram_id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    language_code: str | None = None
    lang: str | None = None
    role: str = "student"


class TestSummary(Camel):
    id: str
    title: str
    topic_title: str
    topic_color: str
    illustration: str
    questions_count: int
    duration_minutes: int
    difficulty: Difficulty


class TestStatus(Camel):
    kind: Literal["new", "in_progress", "done"]
    answered: int | None = None
    best_percent: int | None = None


class TopicTest(TestSummary):
    description: str
    max_points: int
    status: TestStatus


class TopicSummary(Camel):
    id: str
    slug: str
    title: str
    color: str
    illustration: str
    tests_count: int
    questions_count: int
    progress: int
    difficulties: list[Difficulty]


class QuickStart(Camel):
    quiz_id: str
    questions_count: int
    duration_minutes: int


class InProgressAttempt(Camel):
    session_id: str
    quiz_id: str
    quiz_title: str
    answered: int
    total: int
    remaining_seconds: int


class HomeFeed(Camel):
    user: UserProfile
    unread_notifications: int
    quick_start: QuickStart | None
    continue_attempt: InProgressAttempt | None
    popular_tests: list[TestSummary]
    live_now: int


class OptionPublic(Camel):
    id: str
    label: Literal["A", "B", "C", "D"]
    text: str


class QuestionPublic(Camel):
    id: str
    text: str
    points: int
    image_url: str | None = None
    options: list[OptionPublic]


class AnswerResult(Camel):
    question_id: str
    outcome: Outcome
    chosen_option_id: str | None
    correct_option_id: str
    points_awarded: int
    explanation: str | None = None


class SessionStart(Camel):
    session_id: str
    quiz_id: str
    quiz_title: str
    topic_title: str
    duration_sec: int
    #: seconds left on the server clock (== durationSec for a fresh start)
    remaining_sec: int
    questions: list[QuestionPublic]
    #: already answered questions when an unfinished attempt is resumed
    answered: list[AnswerResult] = []
    feedback_ms: int = 3000
    feedback_explain_ms: int = 5000


class StartBody(Camel):
    quiz_id: str | None = None
    assignment_id: str | None = None


class AnswerBody(Camel):
    question_id: str
    option_id: str | None = None


class FinishBody(Camel):
    timed_out: bool = False
    used_sec: int | None = None  # informational; the server measures time itself


class ReviewItem(AnswerResult):
    question_text: str
    chosen_text: str | None = None
    correct_text: str


class SessionResult(Camel):
    session_id: str
    quiz_id: str | None
    quiz_title: str
    mode: str
    assignment_id: str | None = None
    max_points: int
    points: int
    correct: int
    wrong: int
    unanswered: int
    used_sec: int
    timed_out: bool
    best_points: int
    review: list[ReviewItem]


class RatingEntry(Camel):
    rank: int
    user_id: str
    name: str
    photo_url: str | None = None
    points: int
    me: bool = False


class Rating(Camel):
    kind: str
    period: str
    entries: list[RatingEntry]
    me: RatingEntry | None


class HistoryItem(Camel):
    kind: Literal["individual", "group", "live"]
    id: str
    title: str
    subtitle: str
    color: str
    points: int
    max_points: int | None = None
    rank: int | None = None
    participants: int | None = None
    at: datetime


class Profile(Camel):
    user: UserProfile
    member_since: datetime
    tests: int
    accuracy: int
    points: int
    history: list[HistoryItem]
    notify_live: bool
    haptics: bool


class SettingsPatch(Camel):
    lang: Literal["uz", "uz-cyrl", "ru"] | None = None
    notify_live: bool | None = None
    haptics: bool | None = None


class NotificationOut(Camel):
    id: str
    kind: str
    title: str
    body: str
    link: str | None
    created_at: datetime
    read: bool


class GroupBoardEntry(Camel):
    rank: int
    name: str
    points: int
    me: bool = False


class GroupAssignmentView(Camel):
    id: str
    access: Literal["ok", "not_member", "closed", "unknown"]
    group_title: str
    group_link: str | None
    quiz_id: str
    quiz_title: str
    author_name: str | None
    questions_count: int
    duration_minutes: int
    closes_at: datetime | None
    passed: int
    members: int
    preview_names: list[str]
    leaderboard: list[GroupBoardEntry]
    my_session_id: str | None
    my_status: str | None


class GroupResultView(Camel):
    assignment_id: str
    group_title: str
    quiz_title: str
    session_id: str
    rank: int
    passed: int
    points: int
    closes_at: datetime | None
    remaining_members: int
    leaderboard: list[GroupBoardEntry]


# ---------- live ----------

class LivePlayer(Camel):
    user_id: str
    name: str
    photo_url: str | None = None
    ready: bool = False
    me: bool = False


class LiveBoardEntry(Camel):
    rank: int
    user_id: str
    name: str
    points: int
    delta: int = 0
    me: bool = False


class LiveReveal(Camel):
    correct_option_id: str
    correct_text: str
    explanation: str | None
    correct_count: int
    my_outcome: Outcome
    my_points: int
    distribution: dict[str, int] | None = None  # host only


class LiveFinalView(Camel):
    rank: int
    total: int
    points: int
    correct: int


class LiveState(Camel):
    id: str
    code: str
    title: str
    host_name: str | None
    state: Literal["lobby", "question", "reveal", "finished"]
    index: int
    questions_count: int
    question_sec: int
    remaining_ms: int
    paused: bool
    question: QuestionPublic | None
    my_answer: str | None
    answered_count: int
    participants_count: int
    ready_count: int
    players: list[LivePlayer]
    reveal: LiveReveal | None
    leaderboard: list[LiveBoardEntry]
    me_entry: LiveBoardEntry | None
    final: LiveFinalView | None
    reveal_ms: int = 5000


class LiveJoinBody(Camel):
    code: str


class LiveAnswerBody(Camel):
    index: int
    option_id: str


class LiveListItem(Camel):
    id: str
    code: str
    title: str
    host_name: str | None
    state: str
    participants: int


# ---------- admin ----------

class AdminUserOut(Camel):
    id: str
    telegram_id: int
    name: str
    username: str | None
    photo_url: str | None
    role: str
    is_blocked: bool
    tests: int = 0
    accuracy: int | None = None
    last_seen_at: datetime


class AdminSession(Camel):
    token: str
    user: AdminUserOut


class SubtopicIn(Camel):
    id: str | None = None
    title: str


class TopicIn(Camel):
    title: str = Field(min_length=1, max_length=128)
    slug: str | None = None
    description: str = ""
    color: Literal["blue", "violet", "mint", "peach", "pink", "yellow"] = "blue"
    illustration: str = "/3d/rq-3d-T01.webp"
    is_active: bool = True
    subtopics: list[SubtopicIn] = []


class TopicAdminOut(Camel):
    id: str
    slug: str
    title: str
    description: str
    color: str
    illustration: str
    position: int
    is_active: bool
    subtopics: list[SubtopicIn]
    tests_count: int
    questions_count: int


class OptionIn(Camel):
    text: str
    is_correct: bool = False


class QuestionIn(Camel):
    topic_id: str
    subtopic_id: str | None = None
    text: str
    image_url: str | None = None
    difficulty: Difficulty = "medium"
    points: int = 100
    explanation_ru: str | None = None
    explanation_uz: str | None = None
    status: Literal["draft", "published", "archived"] = "draft"
    options: list[OptionIn]


class QuestionAdminOut(Camel):
    id: str
    topic_id: str
    topic_title: str
    subtopic_id: str | None
    subtopic_title: str | None
    text: str
    image_url: str | None
    difficulty: str
    points: int
    explanation_ru: str | None
    explanation_uz: str | None
    status: str
    options: list[dict[str, Any]]
    correct_rate: int | None
    updated_at: datetime


class Page(Camel):
    items: list[Any]
    total: int


class QuizIn(Camel):
    title: str = Field(min_length=1, max_length=200)
    topic_id: str
    description: str = ""
    difficulty: Difficulty = "medium"
    duration_sec: int = Field(default=360, ge=30, le=3 * 3600)
    live_question_sec: int = Field(default=20, ge=5, le=300)
    mode_individual: bool = True
    mode_live: bool = False
    mode_group: bool = True
    is_quick: bool = False
    question_ids: list[str] = []


class QuizAdminOut(Camel):
    id: str
    title: str
    topic_id: str
    topic_title: str
    description: str
    difficulty: str
    duration_sec: int
    live_question_sec: int
    mode_individual: bool
    mode_live: bool
    mode_group: bool
    is_quick: bool
    status: str
    questions: list[QuestionAdminOut]
    questions_count: int
    max_points: int
    attempts: int
    published_at: datetime | None
    updated_at: datetime
    updated_by_name: str | None


class LiveCreate(Camel):
    quiz_id: str
    group_id: str | None = None
    announce: bool = False


class AssignmentIn(Camel):
    group_id: str
    quiz_id: str
    closes_at: datetime | None = None
    format: Literal["async", "live"] = "async"


class RoleIn(Camel):
    role: Literal["student", "host", "admin", "superadmin"]


class BlockIn(Camel):
    blocked: bool


class GroupPatch(Camel):
    host_id: str | None = None
    is_active: bool | None = None


class ImportRow(Camel):
    row: int
    topic: str
    subtopic: str | None = None
    text: str
    options: list[str]
    correct: str
    difficulty: str
    points: int | None
    explanation: str | None = None
    errors: list[str] = []
    duplicate: bool = False
    topic_id: str | None = None
    suggestion: str | None = None


class ImportPreview(Camel):
    file_name: str
    rows: list[ImportRow]
    ready: int
    with_errors: int
    duplicates: int


class ImportCommit(Camel):
    rows: list[ImportRow]
    include_duplicates: list[int] = []
    publish: bool = False


class SettingsIn(Camel):
    default_duration_min: int = Field(default=6, ge=1, le=180)
    live_question_sec: int = Field(default=20, ge=5, le=300)
    feedback_ms: int = Field(default=3000, ge=1000, le=10000)
    feedback_explain_ms: int = Field(default=5000, ge=1000, le=15000)
    langs: list[Literal["uz", "uz-cyrl", "ru"]] = ["uz", "uz-cyrl", "ru"]
    default_lang: Literal["telegram", "uz", "uz-cyrl", "ru"] = "telegram"
    rate_limit_per_min: int = Field(default=120, ge=10, le=10000)
