"""sections shown as a shelf of literary works

Revision ID: c8d9e0f1a2b3
Revises: b7c1d2e3f4a5
"""
import sqlalchemy as sa
from alembic import op

revision = "c8d9e0f1a2b3"
down_revision = "b7c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("topics", sa.Column("layout", sa.String(12), server_default="default", nullable=False))
    op.add_column("subtopics", sa.Column("author", sa.String(128), server_default="", nullable=False))
    op.add_column("subtopics", sa.Column("cover", sa.LargeBinary(), nullable=True))
    op.add_column("subtopics", sa.Column("cover_type", sa.String(32), nullable=True))
    op.add_column("subtopics", sa.Column("cover_version", sa.Integer(), server_default="0", nullable=False))
    op.add_column("quizzes", sa.Column("subtopic_id", sa.String(32), nullable=True))
    op.create_foreign_key("quizzes_subtopic_id_fkey", "quizzes", "subtopics", ["subtopic_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_quizzes_subtopic_id", "quizzes", ["subtopic_id"])


def downgrade() -> None:
    op.drop_index("ix_quizzes_subtopic_id", "quizzes")
    op.drop_constraint("quizzes_subtopic_id_fkey", "quizzes", type_="foreignkey")
    op.drop_column("quizzes", "subtopic_id")
    for c in ("cover_version", "cover_type", "cover", "author"):
        op.drop_column("subtopics", c)
    op.drop_column("topics", "layout")
