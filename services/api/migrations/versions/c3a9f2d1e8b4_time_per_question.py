"""whole-test time = number of questions × 2 minutes

Revision ID: c3a9f2d1e8b4
Revises: 2fccf7c8252e
"""
from alembic import op

revision = "c3a9f2d1e8b4"
down_revision = "2fccf7c8252e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE quizzes q SET duration_sec = 120 * GREATEST(1, (
            SELECT count(*) FROM quiz_questions qq JOIN questions x ON x.id = qq.question_id
            WHERE qq.quiz_id = q.id AND x.status <> 'archived'))
    """)


def downgrade() -> None:
    pass  # previous per-test times are not kept
