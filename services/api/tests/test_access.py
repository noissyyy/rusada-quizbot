import io

from PIL import Image


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (300, 500), (240, 240, 240)).save(buf, "PNG")
    return buf.getvalue()


async def _close(client, admin_headers, **extra):
    body = {"mode": "closed", "priceUzs": 100000, "days": 30, "cardNumber": "8600 1234 5678 9012",
            "cardHolder": "RUSADA", "supportUsername": "@rusada_admin", **extra}
    r = await client.put("/api/admin/access", json=body, headers=admin_headers)
    assert r.status_code == 200, r.text
    return r.json()


async def test_open_mode_lets_everyone_in(client, auth):
    h = auth(70)
    a = (await client.get("/api/access", headers=h)).json()
    assert a["hasAccess"] is True and a["reason"] == "open"
    assert (await client.get("/api/home", headers=h)).status_code == 200


async def test_closed_mode_members_staff_and_paywall(client, auth, admin_headers):
    saved = await _close(client, admin_headers)
    assert saved["supportUsername"] == "rusada_admin"
    stranger = auth(71, username="stranger1")
    a = (await client.get("/api/access", headers=stranger)).json()
    assert a["hasAccess"] is False and a["priceUzs"] == 100000 and a["cardNumber"] == "8600 1234 5678 9012"
    assert a["questionsCount"] >= 4 and a["booksCount"] == 0  # real numbers from the database
    assert (await client.get("/api/home", headers=stranger)).status_code == 402
    assert (await client.get("/api/me", headers=stranger)).status_code == 200  # paywall still knows who you are

    # Rusada students by @username (any format), invalid ones reported
    r = (await client.post("/api/admin/members", json={"usernames": "@Student_One, https://t.me/student_two\nx"},
                           headers=admin_headers)).json()
    assert r == {"added": 2, "already": 0, "invalid": ["x"]}
    s1 = auth(72, username="student_one")
    assert (await client.get("/api/home", headers=s1)).status_code == 200
    members = (await client.get("/api/admin/members", headers=admin_headers)).json()
    one = next(m for m in members if m["username"] == "student_one")
    assert one["seen"] is True
    # changing the username later does not lock them out: the Telegram ID was remembered
    assert (await client.get("/api/home", headers=auth(72, username="renamed_one"))).status_code == 200
    # removed from the list → paywall
    await client.delete(f"/api/admin/members/{one['id']}", headers=admin_headers)
    assert (await client.get("/api/home", headers=s1)).status_code == 402

    # staff always gets in
    assert (await client.get("/api/home", headers=auth(1))).status_code == 200


async def test_receipt_approve_reject_and_manual_grant(client, auth, admin_headers):
    await _close(client, admin_headers)
    h = auth(80, username="payer80")
    bad = await client.post("/api/payments", files={"file": ("x.txt", b"hi", "text/plain")}, headers=h)
    assert bad.status_code == 422
    p = (await client.post("/api/payments", files={"file": ("c.png", _png(), "image/png")}, headers=h)).json()
    again = await client.post("/api/payments", files={"file": ("c.png", _png(), "image/png")}, headers=h)
    assert again.status_code == 409
    a = (await client.get("/api/access", headers=h)).json()
    assert a["hasAccess"] is False and a["pending"]["id"] == p["id"]

    pending = (await client.get("/api/admin/payments?status=pending", headers=admin_headers)).json()
    assert pending[0]["id"] == p["id"] and pending[0]["amount"] == 100000
    rc = await client.get(f"/api/admin/payments/{p['id']}/receipt", headers=admin_headers)
    assert rc.status_code == 200 and rc.headers["content-type"] == "image/jpeg"

    # reject → the student sees why and can send again
    await client.post(f"/api/admin/payments/{p['id']}/reject", json={"comment": "Сумма не та"}, headers=admin_headers)
    a = (await client.get("/api/access", headers=h)).json()
    assert a["rejectedComment"] == "Сумма не та" and a["pending"] is None
    p2 = (await client.post("/api/payments", files={"file": ("c.png", _png(), "image/png")}, headers=h)).json()

    # approve → 30 days of access
    ok = (await client.post(f"/api/admin/payments/{p2['id']}/approve", headers=admin_headers)).json()
    assert ok["status"] == "approved"
    a = (await client.get("/api/access", headers=h)).json()
    assert a["hasAccess"] is True and a["reason"] == "subscription" and a["subscriptionEndsAt"]
    assert (await client.get("/api/home", headers=h)).status_code == 200
    assert (await client.post(f"/api/admin/payments/{p2['id']}/approve", headers=admin_headers)).status_code == 409

    # a manual grant extends after the current end
    from datetime import datetime
    before = datetime.fromisoformat(a["subscriptionEndsAt"])
    g = (await client.post("/api/admin/subscriptions", json={"username": "@payer80", "days": 10}, headers=admin_headers)).json()
    assert (datetime.fromisoformat(g["endsAt"]) - before).days == 10
    subs = (await client.get("/api/admin/subscriptions", headers=admin_headers)).json()
    assert subs[0]["username"] == "payer80" and subs[0]["active"] is True
    unknown = await client.post("/api/admin/subscriptions", json={"username": "nobody_here"}, headers=admin_headers)
    assert unknown.status_code == 404

    # revoke → paywall again
    await client.delete(f"/api/admin/subscriptions/{g['userId']}", headers=admin_headers)
    assert (await client.get("/api/home", headers=h)).status_code == 402
    stats = (await client.get("/api/admin/access/stats", headers=admin_headers)).json()
    assert stats["pending"] == 0 and stats["activeSubscribers"] == 0


async def test_members_and_grants_by_telegram_id(client, auth, admin_headers):
    await _close(client, admin_headers)
    no_name = auth(987654321)  # a student without a @username
    a = (await client.get("/api/access", headers=no_name)).json()
    assert a["hasAccess"] is False and a["telegramId"] == 987654321 and a["username"] is None
    r = (await client.post("/api/admin/members", json={"usernames": "987654321, @mixed_user 12"}, headers=admin_headers)).json()
    assert r == {"added": 2, "already": 0, "invalid": ["12"]}
    assert (await client.get("/api/home", headers=no_name)).status_code == 200
    row = next(m for m in (await client.get("/api/admin/members", headers=admin_headers)).json() if m["telegramId"] == 987654321)
    assert row["username"] is None and row["seen"] is True
    again = (await client.post("/api/admin/members", json={"usernames": "987654321"}, headers=admin_headers)).json()
    assert again["already"] == 1 and again["added"] == 0

    # manual grant by ID
    other = auth(555000111)
    await client.get("/api/access", headers=other)  # opened the bot once
    g = await client.post("/api/admin/subscriptions", json={"username": "555000111", "days": 7}, headers=admin_headers)
    assert g.status_code == 200
    assert (await client.get("/api/home", headers=other)).status_code == 200
    missing = await client.post("/api/admin/subscriptions", json={"username": "111222333"}, headers=admin_headers)
    assert missing.status_code == 404 and "ID 111222333" in missing.json()["detail"]
