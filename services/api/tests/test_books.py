async def test_books_admin_and_app(client, auth, admin_headers):
    h = auth(51)
    assert (await client.get("/api/books", headers=h)).json() == []
    b = (await client.post("/api/admin/books", json={"title": "Тесты по литературе", "author": "Алиева, Торкунова",
                                                     "price": "85 000 сум", "link": "https://t.me/rusada"},
                           headers=admin_headers)).json()
    assert b["coverUrl"] is None and b["position"] == 0
    # cover upload: type and size are checked
    bad = await client.post(f"/api/admin/books/{b['id']}/cover", files={"file": ("x.txt", b"hi", "text/plain")},
                            headers=admin_headers)
    assert bad.status_code == 422
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    up = (await client.post(f"/api/admin/books/{b['id']}/cover", files={"file": ("c.png", png, "image/png")},
                            headers=admin_headers)).json()
    assert up["coverUrl"].startswith(f"/api/books/{b['id']}/cover?v=")
    books = (await client.get("/api/books", headers=h)).json()
    assert books[0]["title"] == "Тесты по литературе" and books[0]["price"] == "85 000 сум"
    cover = await client.get(up["coverUrl"])  # public, no auth
    assert cover.status_code == 200 and cover.content == png and cover.headers["content-type"] == "image/png"
    # hidden books are not listed; students cannot manage books
    await client.put(f"/api/admin/books/{b['id']}", json={"title": "Тесты по литературе", "isActive": False},
                     headers=admin_headers)
    assert (await client.get("/api/books", headers=h)).json() == []
    assert (await client.post("/api/admin/books", json={"title": "x"}, headers=h)).status_code == 401
    assert (await client.delete(f"/api/admin/books/{b['id']}", headers=admin_headers)).status_code == 204
    assert (await client.get("/api/admin/books", headers=admin_headers)).json() == []


def _tiny_pdf(pages: int) -> bytes:
    import io
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument.new()
    for _ in range(pages):
        doc.new_page(300, 400)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


async def test_book_pdf_reading_gives_stamped_pages_only(client, auth, admin_headers, tmp_path, monkeypatch):
    from app.services import pdf_pages
    monkeypatch.setattr(pdf_pages, "CACHE_DIR", tmp_path)
    b = (await client.post("/api/admin/books", json={"title": "Справочник"}, headers=admin_headers)).json()
    bad = await client.post(f"/api/admin/books/{b['id']}/pdf", files={"file": ("x.pdf", b"nope", "application/pdf")},
                            headers=admin_headers)
    assert bad.status_code == 422
    up = (await client.post(f"/api/admin/books/{b['id']}/pdf", files={"file": ("b.pdf", _tiny_pdf(3), "application/pdf")},
                            headers=admin_headers)).json()
    assert up["pages"] == 3 and up["coverUrl"]  # page 1 became the cover
    h = auth(61)
    book = (await client.get("/api/books", headers=h)).json()[0]
    assert book["pages"] == 3 and "pdf" not in book
    page = await client.get(f"/api/books/{b['id']}/pages/2", headers=h)
    assert page.status_code == 200 and page.headers["content-type"] == "image/jpeg"
    assert page.headers["cache-control"] == "no-store" and page.content[:2] == b"\xff\xd8"
    again = await client.get(f"/api/books/{b['id']}/pages/2", headers=h)  # from the disk cache
    assert again.status_code == 200
    assert (await client.get(f"/api/books/{b['id']}/pages/4", headers=h)).status_code == 404
    assert (await client.get(f"/api/books/{b['id']}/pages/1")).status_code == 401  # reading needs Telegram auth
