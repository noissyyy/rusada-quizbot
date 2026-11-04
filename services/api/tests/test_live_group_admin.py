import io
from datetime import timedelta

from openpyxl import Workbook, load_workbook
from sqlalchemy import select

from app.db import SessionLocal
from app.models import LiveSession, Quiz, utcnow
from app.services import live as live_svc

INTERNAL = {"X-Internal-Token": "test-internal"}


async def _quiz_id():
    async with SessionLocal() as db:
        return (await db.execute(select(Quiz.id))).scalar_one()


async def test_live_session_end_to_end(client, auth, admin_headers):
    quiz_id = await _quiz_id()
    st = (await client.post("/api/admin/live", json={"quizId": quiz_id}, headers=admin_headers)).json()
    assert st["state"] == "lobby" and len(st["code"]) == 4
    a, b = auth(11, "Тимур", "Алиев"), auth(12, "Ольга", "Смирнова")
    for h in (a, b):
        j = await client.post("/api/live/join", json={"code": st["code"]}, headers=h)
        assert j.status_code == 200, j.text
    r = (await client.post(f"/api/live/{st['id']}/ready", headers=a)).json()
    assert r["participantsCount"] == 2 and r["readyCount"] == 1 and r["question"] is None

    q = (await client.post(f"/api/admin/live/{st['id']}/next", headers=admin_headers)).json()
    assert q["state"] == "question" and q["index"] == 0
    opts = q["question"]["options"]
    # A answers correctly; answering twice does not score twice
    for _ in range(2):
        s1 = (await client.post(f"/api/live/{st['id']}/answer", json={"index": 0, "optionId": opts[1]["id"]},
                                headers=a)).json()
    assert s1["myAnswer"] == opts[1]["id"] and s1["state"] == "question" and s1["reveal"] is None
    # host sees the distribution while the question is open, players do not
    hv = (await client.get(f"/api/admin/live/{st['id']}", headers=admin_headers)).json()
    assert hv["reveal"]["distribution"][opts[1]["id"]] == 1
    # B answers wrong → everyone answered → revealed immediately
    s2 = (await client.post(f"/api/live/{st['id']}/answer", json={"index": 0, "optionId": opts[0]["id"]},
                            headers=b)).json()
    assert s2["state"] == "reveal"
    assert s2["reveal"]["myOutcome"] == "wrong" and s2["reveal"]["correctCount"] == 1
    assert s2["leaderboard"][0]["name"] == "Тимур А." and s2["leaderboard"][0]["points"] == 100
    late = await client.post(f"/api/live/{st['id']}/answer", json={"index": 0, "optionId": opts[1]["id"]}, headers=b)
    assert late.status_code == 409

    # time moves on by itself: reveal → next question → (nobody answers) → reveal
    async with SessionLocal() as db:
        await live_svc.tick(db, now=utcnow() + timedelta(seconds=6))
        live = await db.get(LiveSession, st["id"])
        assert live.state == "question" and live.current_index == 1
        await live_svc.tick(db, now=utcnow() + timedelta(seconds=live.question_sec + 1))
        await db.refresh(live)
        assert live.state == "reveal"

    fin = (await client.post(f"/api/admin/live/{st['id']}/finish", headers=admin_headers)).json()
    assert fin["state"] == "finished"
    me = (await client.get(f"/api/live/{st['id']}", headers=b)).json()
    assert me["final"] == {"rank": 2, "total": 2, "points": 0, "correct": 0}

    board = (await client.get("/api/rating?kind=live&period=week", headers=a)).json()
    assert board["entries"][0]["name"] == "Тимур А." and board["me"]["rank"] == 1
    prof = (await client.get("/api/profile", headers=a)).json()
    assert prof["history"][0]["kind"] == "live" and prof["history"][0]["rank"] == 1


async def test_live_pause_freezes_the_clock(client, auth, admin_headers):
    st = (await client.post("/api/admin/live", json={"quizId": await _quiz_id()}, headers=admin_headers)).json()
    await client.post("/api/live/join", json={"code": st["code"]}, headers=auth(11))
    await client.post(f"/api/admin/live/{st['id']}/next", headers=admin_headers)
    p = (await client.post(f"/api/admin/live/{st['id']}/pause", headers=admin_headers)).json()
    assert p["paused"] is True
    async with SessionLocal() as db:
        assert await live_svc.tick(db, now=utcnow() + timedelta(minutes=5)) == []
    r = (await client.post(f"/api/admin/live/{st['id']}/resume", headers=admin_headers)).json()
    assert r["paused"] is False and r["remainingMs"] > 15_000


async def test_group_assignment_one_attempt_and_board(client, auth, admin_headers):
    g = (await client.post("/internal/groups", json={"chat_id": -100123, "title": "10-Б · Русский язык",
                                                     "bot_is_admin": True, "members_count": 27}, headers=INTERNAL)).json()
    assert (await client.post("/internal/groups", json={"chat_id": 1, "title": "x"})).status_code == 401
    r = await client.post("/api/admin/assignments", json={"groupId": g["id"], "quizId": await _quiz_id()},
                          headers=admin_headers)
    assert r.status_code == 200, r.text
    aid = r.json()["assignmentId"]
    h = auth(21, "Мадина", "Рахимова")
    view = (await client.get(f"/api/group/{aid}", headers=h)).json()
    assert view["access"] == "ok" and view["members"] == 27 and view["passed"] == 0
    s = (await client.post("/api/sessions", json={"assignmentId": aid}, headers=h)).json()
    q = s["questions"][0]
    await client.post(f"/api/sessions/{s['sessionId']}/answers", json={"questionId": q["id"],
                                                                         "optionId": q["options"][1]["id"]}, headers=h)
    res = (await client.post(f"/api/sessions/{s['sessionId']}/finish", json={}, headers=h)).json()
    assert res["mode"] == "group" and res["assignmentId"] == aid
    again = await client.post("/api/sessions", json={"assignmentId": aid}, headers=h)
    assert again.status_code == 409 and again.json()["detail"] == "already_taken"
    gr = (await client.get(f"/api/group/{aid}/result", headers=h)).json()
    assert gr["rank"] == 1 and gr["passed"] == 1 and gr["remainingMembers"] == 26
    assert (await client.get("/api/rating?kind=group&period=all", headers=h)).json()["me"]["points"] == 100

    # closed assignment refuses new attempts
    await client.post(f"/api/admin/assignments/{aid}/close", headers=admin_headers)
    other = auth(22)
    assert (await client.get(f"/api/group/{aid}", headers=other)).json()["access"] == "closed"
    assert (await client.post("/api/sessions", json={"assignmentId": aid}, headers=other)).status_code == 403


async def test_roles_and_login_link(client, auth, admin_headers):
    await client.get("/api/home", headers=auth(31, "Дилноза", "Ахмедова"))
    # a student cannot get an admin login link
    assert (await client.post("/internal/admin-login", json={"id": 31, "first_name": "Дилноза"},
                              headers=INTERNAL)).status_code == 403
    users = (await client.get("/api/admin/users?q=Дилноза", headers=admin_headers)).json()["items"]
    uid = users[0]["id"]
    assert (await client.put(f"/api/admin/users/{uid}/role", json={"role": "host"},
                             headers=admin_headers)).status_code == 204
    link = (await client.post("/internal/admin-login", json={"id": 31, "first_name": "Дилноза"},
                              headers=INTERNAL)).json()
    token = link["url"].split("t=")[1]
    sess = (await client.post("/api/admin/auth/exchange", json={"token": token})).json()
    assert sess["user"]["role"] == "host"
    hh = {"Authorization": "Bearer " + sess["token"]}
    # one-time
    assert (await client.post("/api/admin/auth/exchange", json={"token": token})).status_code == 401
    # a host can run lives but cannot edit content or settings
    assert (await client.get("/api/admin/dashboard", headers=hh)).status_code == 200
    assert (await client.post("/api/admin/topics", json={"title": "X"}, headers=hh)).status_code == 403
    assert (await client.put("/api/admin/settings", json={}, headers=hh)).status_code == 403
    # demotion takes effect immediately, even with a still-valid JWT
    await client.put(f"/api/admin/users/{uid}/role", json={"role": "student"}, headers=admin_headers)
    assert (await client.get("/api/admin/dashboard", headers=hh)).status_code == 403
    log = (await client.get("/api/admin/audit", headers=admin_headers)).json()
    assert [x["action"] for x in log][:2] == ["user.role", "login"]


async def test_excel_import_preview_and_commit(client, admin_headers):
    wb = Workbook()
    ws = wb.active
    ws.append(["Раздел", "Подраздел", "Вопрос", "A", "B", "C", "D", "Правильный", "Сложность", "Баллы", "Объяснение",
               "Тест"])
    ws.append(["Морфология", "Наречие", "Найдите наречие", "Дом", "Вдали", "Синий", "Бежать", "B", "Лёгкий", 100, "",
               "Наречие · I вариант"])
    ws.append(["Морфология", "Наречие", "Найдите наречие-2", "Дом", "Вдали", "Синий", "Бежать", "B", "Лёгкий", 150, "",
               "Наречие · I вариант"])
    ws.append(["Морфология", "", "Найдите краткое прилагательное", "a", "b", "c", "d", "E", "Средний", 100, ""])
    ws.append(["Морфологя", "", "Какое слово — местоимение?", "Я", "Дом", "Кот", "Бег", "A", "Лёгкий", 100, ""])
    ws.append(["Морфология", "", "Укажите притяжательное", "a", "b", "c", "d", "B", "Сложный", -50, ""])
    ws.append(["Морфология", "", "Какое из слов является наречием?", "a", "b", "c", "d", "B", "Лёгкий", 100, ""])
    buf = io.BytesIO()
    wb.save(buf)
    files = {"file": ("morfologiya.xlsx", buf.getvalue(),
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    p = (await client.post("/api/admin/import/preview", files=files, headers=admin_headers)).json()
    assert (p["ready"], p["withErrors"], p["duplicates"]) == (2, 3, 1)
    errs = {r["row"]: r["errors"] for r in p["rows"]}
    assert "допустимо A, B, C или D" in errs[4][0]
    assert errs[5][0] == "Раздел не найден. Может быть, «Морфология»?"
    assert "Баллы -50" in errs[6][0]
    c = (await client.post("/api/admin/import/commit", json={"rows": p["rows"]}, headers=admin_headers)).json()
    assert c == {"created": 2, "skipped": 4, "tests": 1}
    bank = (await client.get("/api/admin/questions?status=draft", headers=admin_headers)).json()
    assert bank["total"] == 2 and bank["items"][0]["subtopicTitle"] == "Наречие"
    # rows with a test name became one draft test, in file order
    tests = [t for t in (await client.get("/api/admin/tests", headers=admin_headers)).json() if t["title"] == "Наречие · I вариант"]
    assert len(tests) == 1 and tests[0]["status"] == "draft" and tests[0]["questionsCount"] == 2
    full = (await client.get(f"/api/admin/tests/{tests[0]['id']}", headers=admin_headers)).json()
    assert [q["text"] for q in full["questions"]] == ["Найдите наречие", "Найдите наречие-2"] and full["maxPoints"] == 250
    # importing again appends to the same test instead of creating a second one
    again = [dict(r, text=r["text"] + " (2)") for r in p["rows"] if r.get("test")]
    c2 = (await client.post("/api/admin/import/commit", json={"rows": again}, headers=admin_headers)).json()
    assert c2["tests"] == 1
    full = (await client.get(f"/api/admin/tests/{tests[0]['id']}", headers=admin_headers)).json()
    assert full["questionsCount"] == 4
    err_file = await client.post("/api/admin/import/errors", json={"rows": p["rows"]}, headers=admin_headers)
    sheet = load_workbook(io.BytesIO(err_file.content)).active
    assert sheet.max_row == 5  # header + 4 flagged rows
    assert sheet.cell(1, 12).value == "Тест"


async def test_build_and_publish_test_then_export(client, auth, admin_headers):
    topics = (await client.get("/api/admin/topics", headers=admin_headers)).json()
    orth = next(t for t in topics if t["slug"] == "orthography")
    body = {"topicId": orth["id"], "text": "Пре- или при-: ___бежать (прийти бегом)", "difficulty": "medium",
            "points": 100, "status": "draft",
            "options": [{"text": "пре", "isCorrect": False}, {"text": "при", "isCorrect": True},
                        {"text": "пра", "isCorrect": False}, {"text": "про", "isCorrect": False}]}
    bad = await client.post("/api/admin/questions", json={**body, "options": body["options"][:3]}, headers=admin_headers)
    assert bad.status_code == 422
    q = (await client.post("/api/admin/questions", json=body, headers=admin_headers)).json()
    t = (await client.post("/api/admin/tests", json={"title": "Приставки ПРЕ- и ПРИ-", "topicId": orth["id"],
                                                     "durationSec": 300, "questionIds": [q["id"]]},
                           headers=admin_headers)).json()
    assert t["status"] == "draft" and t["maxPoints"] == 100
    h = auth(41)
    assert (await client.get(f"/api/tests/{t['id']}", headers=h)).status_code == 404  # drafts are hidden
    pub = (await client.post(f"/api/admin/tests/{t['id']}/status", json={"status": "published"},
                             headers=admin_headers)).json()
    assert pub["status"] == "published" and pub["questions"][0]["status"] == "published"
    found = (await client.get("/api/tests?q=приставки", headers=h)).json()
    assert [x["id"] for x in found] == [t["id"]]
    s = (await client.post("/api/sessions", json={"quizId": t["id"]}, headers=h)).json()
    await client.post(f"/api/sessions/{s['sessionId']}/finish", json={}, headers=h)
    res = (await client.get("/api/admin/results", headers=admin_headers)).json()
    assert res["total"] == 1 and res["items"][0]["status"] == "finished"
    x = await client.get("/api/admin/results/export?fmt=xlsx", headers=admin_headers)
    assert load_workbook(io.BytesIO(x.content)).active.max_row == 2
    dash = (await client.get("/api/admin/dashboard", headers=admin_headers)).json()
    assert dash["testsPublished"] == 2 and dash["attemptsTotal"] == 1


async def test_notifications_and_settings(client, auth, admin_headers):
    h = auth(51)
    await client.get("/api/home", headers=h)
    st = (await client.post("/api/admin/live", json={"quizId": await _quiz_id(), "announce": True},
                            headers=admin_headers)).json()
    home = (await client.get("/api/home", headers=h)).json()
    assert home["unreadNotifications"] == 1 and home["liveNow"] == 1
    n = (await client.get("/api/notifications", headers=h)).json()
    assert n[0]["link"] == f"/live/{st['id']}" and n[0]["read"] is False
    await client.post("/api/notifications/read-all", headers=h)
    assert (await client.get("/api/home", headers=h)).json()["unreadNotifications"] == 0
    u = (await client.patch("/api/profile/settings", json={"lang": "uz-cyrl", "notifyLive": False}, headers=h)).json()
    assert u["lang"] == "uz-cyrl"
    s = (await client.put("/api/admin/settings", json={"feedbackMs": 2000, "feedbackExplainMs": 4000},
                          headers=admin_headers)).json()
    assert s["feedbackMs"] == 2000
    sess = (await client.post("/api/sessions", json={"quizId": await _quiz_id()}, headers=h)).json()
    assert sess["feedbackMs"] == 2000 and sess["feedbackExplainMs"] == 4000


async def test_delete_only_untaken_tests_and_unused_questions(client, auth, admin_headers):
    topics = (await client.get("/api/admin/topics", headers=admin_headers)).json()
    tid = topics[0]["id"]
    q = (await client.post("/api/admin/questions", json={"topicId": tid, "text": "Удаляемый вопрос", "points": 100,
         "options": [{"text": "a", "isCorrect": True}, {"text": "b"}, {"text": "c"}, {"text": "d"}]}, headers=admin_headers)).json()
    t = (await client.post("/api/admin/tests", json={"title": "Черновик", "topicId": tid, "questionIds": [q["id"]]},
                           headers=admin_headers)).json()
    row = next(x for x in (await client.get("/api/admin/tests", headers=admin_headers)).json() if x["id"] == t["id"])
    assert row["deletable"] is True
    # the question is in a test → refused
    r = await client.post("/api/admin/questions/bulk", json={"ids": [q["id"]], "action": "delete"}, headers=admin_headers)
    assert r.status_code == 409
    assert (await client.delete(f"/api/admin/tests/{t['id']}", headers=admin_headers)).status_code == 204
    # now unused → can be deleted
    assert (await client.post("/api/admin/questions/bulk", json={"ids": [q["id"]], "action": "delete"},
                              headers=admin_headers)).status_code == 204
    assert (await client.get(f"/api/admin/questions/{q['id']}", headers=admin_headers)).status_code == 404

    # a test somebody took cannot be deleted
    seeded = (await client.get("/api/admin/tests", headers=admin_headers)).json()[-1]
    s = (await client.post("/api/sessions", json={"quizId": seeded["id"]}, headers=auth(61))).json()
    assert s["sessionId"]
    row = next(x for x in (await client.get("/api/admin/tests", headers=admin_headers)).json() if x["id"] == seeded["id"])
    assert row["deletable"] is False
    r = await client.delete(f"/api/admin/tests/{seeded['id']}", headers=admin_headers)
    assert r.status_code == 409 and "архив" in r.json()["detail"]
