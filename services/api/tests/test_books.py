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
