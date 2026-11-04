import time
from datetime import timedelta

from sqlalchemy import update

from app.db import SessionLocal
from app.models import Attempt, utcnow
from app.security import InitDataError, sign_init_data, validate_init_data

TOKEN = "123456:TEST-token"


def test_init_data_signature_and_expiry():
    good = sign_init_data({"auth_date": str(int(time.time())), "user": '{"id": 7, "first_name": "A"}'}, TOKEN)
    assert validate_init_data(good, TOKEN, 3600).id == 7
    for bad in (good.replace("first_name", "first_namX"), good + "0"):
        try:
            validate_init_data(bad, TOKEN, 3600)
            raise AssertionError("tampered initData accepted")
        except InitDataError:
            pass
    old = sign_init_data({"auth_date": str(int(time.time()) - 7200), "user": '{"id": 7}'}, TOKEN)
    try:
        validate_init_data(old, TOKEN, 3600)
        raise AssertionError("expired initData accepted")
    except InitDataError:
        pass
    try:
        validate_init_data(good, "999:other", 3600)
        raise AssertionError("foreign bot token accepted")
    except InitDataError:
        pass


async def test_requires_telegram_auth(client):
    r = await client.get("/api/home")
    assert r.status_code == 401


async def _start(client, h):
    home = (await client.get("/api/home", headers=h)).json()
    quiz_id = home["quickStart"]["quizId"]
    return quiz_id, (await client.post("/api/sessions", json={"quizId": quiz_id}, headers=h)).json()


async def test_full_run_answer_key_never_leaks(client, auth):
    h = auth(1001)
    home = (await client.get("/api/home", headers=h)).json()
    assert home["user"]["firstName"] == "Алексей"
    assert home["quickStart"]["questionsCount"] == 4
    assert home["popularTests"][0]["title"] == "Имя существительное"

    quiz_id, s = await _start(client, h)
    assert s["durationSec"] == 480 and s["remainingSec"] >= 479
    assert "correct" not in str(s).lower()  # no answer key in the payload
    q1, q2 = s["questions"][0], s["questions"][1]

    # wrong, then correct
    r1 = (await client.post(f"/api/sessions/{s['sessionId']}/answers",
                            json={"questionId": q1["id"], "optionId": q1["options"][0]["id"]}, headers=h)).json()
    assert r1["outcome"] == "wrong" and r1["correctOptionId"] == q1["options"][1]["id"]
    assert r1["explanation"].startswith("«Быстро»")
    # idempotent: a retry with another option keeps the first answer
    again = (await client.post(f"/api/sessions/{s['sessionId']}/answers",
                               json={"questionId": q1["id"], "optionId": q1["options"][1]["id"]}, headers=h)).json()
    assert again == r1
    r2 = (await client.post(f"/api/sessions/{s['sessionId']}/answers",
                            json={"questionId": q2["id"], "optionId": q2["options"][2]["id"]}, headers=h)).json()
    assert r2["outcome"] == "correct" and r2["pointsAwarded"] == 100

    # the timer stands still while an answer is shown, but only for as long as it is
    # really on screen: the second submit came right away, so the first pause was mostly refunded
    async with SessionLocal() as db:
        a = await db.get(Attempt, s["sessionId"])
        assert 5_000 <= a.paused_ms < 6_000
        assert a.feedback_until is not None
        assert 485 <= (a.deadline_at - a.started_at).total_seconds() < 486

    res = (await client.post(f"/api/sessions/{s['sessionId']}/finish", json={"timedOut": False}, headers=h)).json()
    assert (res["points"], res["maxPoints"], res["correct"], res["wrong"], res["unanswered"]) == (100, 500, 1, 1, 2)
    assert res["timedOut"] is False
    assert res["review"][0]["chosenText"] == "Быстрый" and res["review"][0]["correctText"] == "Быстро"
    assert res["review"][2]["outcome"] == "unanswered"
    # finish is idempotent
    again = (await client.post(f"/api/sessions/{s['sessionId']}/finish", json={"timedOut": True}, headers=h)).json()
    assert again["points"] == 100 and again["timedOut"] is False

    # another user cannot read it
    assert (await client.get(f"/api/sessions/{s['sessionId']}/result", headers=auth(2002))).status_code == 404

    # topic shows the test as done with best percent
    topic = (await client.get("/api/topics/morphology", headers=h)).json()
    assert topic["tests"][0]["status"] == {"kind": "done", "answered": None, "bestPercent": 20}
    # subtopic chips: only subtopics used by published tests, each test knows its subtopics
    chips = {s["title"]: s["id"] for s in topic["topic"]["subtopics"]}
    assert set(chips) == {"Имя существительное", "Наречие", "Глагол"}
    assert set(topic["tests"][0]["subtopicIds"]) == set(chips.values())


async def test_resume_unfinished_attempt(client, auth):
    h = auth(1001)
    quiz_id, s = await _start(client, h)
    q1 = s["questions"][0]
    await client.post(f"/api/sessions/{s['sessionId']}/answers",
                      json={"questionId": q1["id"], "optionId": q1["options"][1]["id"]}, headers=h)
    home = (await client.get("/api/home", headers=h)).json()
    assert home["continueAttempt"]["sessionId"] == s["sessionId"]
    assert home["continueAttempt"]["answered"] == 1
    again = (await client.post("/api/sessions", json={"quizId": quiz_id}, headers=h)).json()
    assert again["sessionId"] == s["sessionId"]
    assert [a["questionId"] for a in again["answered"]] == [q1["id"]]


async def test_time_up_is_enforced_by_server(client, auth):
    h = auth(1001)
    _, s = await _start(client, h)
    async with SessionLocal() as db:
        await db.execute(update(Attempt).where(Attempt.id == s["sessionId"])
                         .values(deadline_at=utcnow() - timedelta(seconds=10)))
        await db.commit()
    q1 = s["questions"][0]
    late = (await client.post(f"/api/sessions/{s['sessionId']}/answers",
                              json={"questionId": q1["id"], "optionId": q1["options"][1]["id"]}, headers=h)).json()
    assert late["outcome"] == "unanswered" and late["pointsAwarded"] == 0
    res = (await client.post(f"/api/sessions/{s['sessionId']}/finish", json={"timedOut": True}, headers=h)).json()
    assert res["timedOut"] is True and res["points"] == 0 and res["unanswered"] == 4


async def test_client_cannot_fake_time_up_early(client, auth):
    h = auth(1001)
    _, s = await _start(client, h)
    res = (await client.post(f"/api/sessions/{s['sessionId']}/finish", json={"timedOut": True}, headers=h)).json()
    assert res["timedOut"] is False


async def test_editing_published_test_keeps_past_results(client, auth, admin_headers):
    """No versions: the test is edited in place, but a finished attempt keeps its snapshot."""
    h = auth(1001)
    quiz_id, s = await _start(client, h)
    q1 = s["questions"][0]
    await client.post(f"/api/sessions/{s['sessionId']}/answers",
                      json={"questionId": q1["id"], "optionId": q1["options"][1]["id"]}, headers=h)
    await client.post(f"/api/sessions/{s['sessionId']}/finish", json={}, headers=h)

    full = (await client.get(f"/api/admin/questions/{q1['id']}", headers=admin_headers)).json()
    body = {"topicId": full["topicId"], "subtopicId": full["subtopicId"], "text": "Новая формулировка",
            "difficulty": "easy", "points": 200, "status": "published",
            "options": [{"text": o["text"], "isCorrect": i == 0} for i, o in enumerate(full["options"])]}
    r = await client.put(f"/api/admin/questions/{q1['id']}", json=body, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["text"] == "Новая формулировка"

    old = (await client.get(f"/api/sessions/{s['sessionId']}/result", headers=h)).json()
    assert old["review"][0]["questionText"] == "Какое из слов является наречием?"
    assert old["review"][0]["outcome"] == "correct" and old["points"] == 100

    # a new attempt sees the edited question
    fresh = (await client.post("/api/sessions", json={"quizId": quiz_id}, headers=h)).json()
    assert fresh["questions"][0]["text"] == "Новая формулировка"
    assert fresh["questions"][0]["points"] == 200
