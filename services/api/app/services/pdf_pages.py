"""Book PDFs → page images for the in-app reader.

The PDF itself never leaves the server. Each page is rendered to a JPEG once
(kept on local disk) and every response is stamped with the reader's
Telegram ID, so a leaked page can be traced back.
"""
from __future__ import annotations

import io
import os
import threading
from collections import OrderedDict
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont

PAGE_WIDTH = 1000
CACHE_DIR = Path(os.environ.get("PAGE_CACHE_DIR", "/tmp/rq-pages"))
_lock = threading.Lock()  # pdfium is not thread-safe
_docs: OrderedDict[str, pdfium.PdfDocument] = OrderedDict()


def page_count(data: bytes) -> int:
    """Raises ValueError when the file is not a readable PDF."""
    with _lock:
        try:
            doc = pdfium.PdfDocument(data)
        except pdfium.PdfiumError as e:
            raise ValueError("not a pdf") from e
        try:
            return len(doc)
        finally:
            doc.close()


def _doc(key: str, data_loader) -> pdfium.PdfDocument:
    doc = _docs.get(key)
    if doc is None:
        doc = pdfium.PdfDocument(data_loader())
        _docs[key] = doc
        while len(_docs) > 2:  # keep at most two open books in memory
            _docs.popitem(last=False)[1].close()
    _docs.move_to_end(key)
    return doc


def _render(doc: pdfium.PdfDocument, index: int, width: int, quality: int) -> bytes:
    page = doc[index]
    w, _h = page.get_size()
    img = page.render(scale=width / w).to_pil().convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def cover_from_pdf(data: bytes) -> bytes:
    with _lock:
        doc = pdfium.PdfDocument(data)
        try:
            return _render(doc, 0, 600, 85)
        finally:
            doc.close()


def page_image(key: str, index: int, data_loader) -> bytes:
    """Clean rendered page (cached on disk). `key` must change whenever the PDF changes."""
    path = CACHE_DIR / key / f"{index}.jpg"
    if path.exists():
        return path.read_bytes()
    with _lock:
        jpg = _render(_doc(key, data_loader), index, PAGE_WIDTH, 78)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(jpg)
    tmp.replace(path)
    return jpg


def watermark(jpg: bytes, label: str) -> bytes:
    """Faint diagonal stamp with the reader's ID across the page."""
    img = Image.open(io.BytesIO(jpg)).convert("RGBA")
    font = ImageFont.load_default(size=26)
    layer = Image.new("RGBA", (img.width * 2, img.height * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    step_x, step_y = 520, 260
    for row, y in enumerate(range(0, layer.height, step_y)):
        for x in range(-(row % 2) * step_x // 2, layer.width, step_x):
            d.text((x, y), label, font=font, fill=(110, 90, 160, 38))
    layer = layer.rotate(30, resample=Image.BICUBIC)
    left, top = (layer.width - img.width) // 2, (layer.height - img.height) // 2
    img.alpha_composite(layer.crop((left, top, left + img.width, top + img.height)))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "JPEG", quality=78)
    return buf.getvalue()
