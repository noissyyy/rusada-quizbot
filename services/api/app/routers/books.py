"""Books of the centre: managed in the admin panel, listed in the Mini App «Книги» tab."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from ..db import get_db
from ..models import Book, User
from ..schemas import Camel
from ..security import current_user, require_role
from ..services import pdf_pages

router = APIRouter(tags=["books"])
admin = require_role("admin")

COVER_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_COVER = 3 * 1024 * 1024
MAX_PDF = 80 * 1024 * 1024


class BookIn(Camel):
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(default="", max_length=200)
    description: str = ""
    price: str = Field(default="", max_length=64)
    link: str = Field(default="", max_length=512)
    is_active: bool = True


class BookOut(Camel):
    id: str
    title: str
    author: str
    description: str
    price: str
    link: str
    cover_url: str | None
    pages: int = 0  # 0 → no PDF, nothing to read in the app


class BookAdminOut(BookOut):
    is_active: bool
    position: int


def _cover_url(b: Book) -> str | None:
    # the version parameter changes with every edit, so a new cover is never served from cache
    return f"/api/books/{b.id}/cover?v={int(b.updated_at.timestamp())}" if b.cover_type else None


def _out(b: Book) -> BookOut:
    return BookOut(id=b.id, title=b.title, author=b.author, description=b.description, price=b.price, link=b.link,
                   cover_url=_cover_url(b), pages=b.pages or 0)


def _admin_out(b: Book) -> BookAdminOut:
    return BookAdminOut(**_out(b).model_dump(), is_active=b.is_active, position=b.position)


# ---------------- mini app ----------------

@router.get("/api/books", response_model=list[BookOut])
async def list_books(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Book).where(Book.is_active.is_(True))
                             .order_by(Book.position, Book.created_at))).scalars().all()
    return [_out(b) for b in rows]


@router.get("/api/books/{bid}/cover")
async def book_cover(bid: str, db: AsyncSession = Depends(get_db)):
    """Public on purpose: <img> tags cannot send the Telegram auth header."""
    b = (await db.execute(select(Book).options(undefer(Book.cover)).where(Book.id == bid))).scalar_one_or_none()
    if b is None or not b.cover or not b.cover_type:
        raise HTTPException(404)
    return Response(b.cover, media_type=b.cover_type, headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/api/books/{bid}/pages/{n}")
async def book_page(bid: str, n: int, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """One page as a JPEG stamped with the reader's ID. Never cached by the client, never the PDF itself."""
    b = await db.get(Book, bid)
    if b is None or not b.is_active or not b.pages:
        raise HTTPException(404)
    if not 1 <= n <= b.pages:
        raise HTTPException(404, "page_out_of_range")
    key = f"{b.id}-{int(b.updated_at.timestamp())}"

    async def load() -> bytes:
        return (await db.execute(select(Book.pdf).where(Book.id == bid))).scalar_one()

    pdf: bytes | None = None
    if not (pdf_pages.CACHE_DIR / key / f"{n - 1}.jpg").exists() and key not in pdf_pages._docs:
        pdf = await load()  # 3–10 MB: only when the page is not rendered yet and the book is not open
    jpg = await run_in_threadpool(pdf_pages.page_image, key, n - 1, lambda: pdf)
    label = f"Rusada · ID {user.telegram_id}" + (f" · @{user.username}" if user.username else "")
    stamped = await run_in_threadpool(pdf_pages.watermark, jpg, label)
    return Response(stamped, media_type="image/jpeg",
                    headers={"Cache-Control": "no-store", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff"})


# ---------------- admin ----------------

@router.get("/api/admin/books", response_model=list[BookAdminOut])
async def admin_books(user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Book).order_by(Book.position, Book.created_at))).scalars().all()
    return [_admin_out(b) for b in rows]


@router.post("/api/admin/books", response_model=BookAdminOut)
async def create_book(body: BookIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    pos = (await db.execute(select(func.coalesce(func.max(Book.position), -1)))).scalar_one() + 1
    b = Book(**body.model_dump(), position=pos)
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return _admin_out(b)


@router.put("/api/admin/books/{bid}", response_model=BookAdminOut)
async def update_book(bid: str, body: BookIn, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    b = await db.get(Book, bid)
    if b is None:
        raise HTTPException(404)
    for k, v in body.model_dump().items():
        setattr(b, k, v)
    await db.commit()
    await db.refresh(b)
    return _admin_out(b)


@router.post("/api/admin/books/{bid}/cover", response_model=BookAdminOut)
async def upload_cover(bid: str, file: UploadFile = File(...), user: User = Depends(admin),
                       db: AsyncSession = Depends(get_db)):
    b = await db.get(Book, bid)
    if b is None:
        raise HTTPException(404)
    if file.content_type not in COVER_TYPES:
        raise HTTPException(422, "Обложка должна быть JPG, PNG или WebP")
    data = await file.read(MAX_COVER + 1)
    if len(data) > MAX_COVER:
        raise HTTPException(422, "Обложка больше 3 МБ — уменьшите картинку")
    b.cover, b.cover_type = data, file.content_type
    await db.commit()
    await db.refresh(b)
    return _admin_out(b)


@router.post("/api/admin/books/{bid}/pdf", response_model=BookAdminOut)
async def upload_pdf(bid: str, file: UploadFile = File(...), user: User = Depends(admin),
                     db: AsyncSession = Depends(get_db)):
    """Attach the book's PDF for in-app reading. Without a cover, page 1 becomes the cover."""
    b = await db.get(Book, bid)
    if b is None:
        raise HTTPException(404)
    data = await file.read(MAX_PDF + 1)
    if len(data) > MAX_PDF:
        raise HTTPException(422, "PDF больше 80 МБ")
    try:
        pages = await run_in_threadpool(pdf_pages.page_count, data)
    except ValueError:
        raise HTTPException(422, "Это не PDF или файл повреждён") from None
    b.pdf, b.pages = data, pages
    if not b.cover_type:
        b.cover, b.cover_type = await run_in_threadpool(pdf_pages.cover_from_pdf, data), "image/jpeg"
    await db.commit()
    await db.refresh(b)
    return _admin_out(b)


@router.delete("/api/admin/books/{bid}/pdf", response_model=BookAdminOut)
async def delete_pdf(bid: str, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    b = await db.get(Book, bid)
    if b is None:
        raise HTTPException(404)
    b.pdf, b.pages = None, 0
    await db.commit()
    await db.refresh(b)
    return _admin_out(b)


@router.post("/api/admin/books/reorder", status_code=204)
async def reorder_books(ids: list[str], user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    for i, bid in enumerate(ids):
        b = await db.get(Book, bid)
        if b:
            b.position = i
    await db.commit()


@router.delete("/api/admin/books/{bid}", status_code=204)
async def delete_book(bid: str, user: User = Depends(admin), db: AsyncSession = Depends(get_db)):
    b = await db.get(Book, bid)
    if b is None:
        raise HTTPException(404)
    await db.delete(b)
    await db.commit()
