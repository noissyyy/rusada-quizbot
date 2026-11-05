from datetime import timedelta

from app.db import SessionLocal
from app.models import ReviewItem


async def _wrong_answer_run(client, h):
    quiz_id = (await client.get("/api/tests", headers=h)).json()[0]["id"]
    s = (await client.post("/api/sessions", json={"quizId": quiz_id}, headers=h)).json()
    wrong = []
    for q in s["questions"][:2]:  # answer the first two wrong (option D is never correct in the seed)
        r = (await client.post(f"/api/sessions/{s['sessionId']}/answers",
                               json={"questionId": q["id"], "optionId": q["options"][3]["id"]}, headers=h)).json()
        if r["outcome"] == "wrong":
            wrong.append(q["id"])
    await client.post(f"/api/sessions/{s['sessionId']}/finish", json={}, headers=h)
    return wrong


async def test_mistakes_come_back_and_get_mastered(client, auth):
    h = auth(7001)
    wrong = await _wrong_answer_run(client, h)
    assert wrong
    home = (await client.get("/api/home", headers=h)).json()
    assert home["reviewDue"] == len(wrong)

    r = (await client.get("/api/review", headers=h)).json()
    assert r["due"] == len(wrong) and {q["id"] for q in r["questions"]} == set(wrong)
    assert "isCorrect" not in str(r)  # answers are never sent ahead

    qid = wrong[0]
    q = next(x for x in r["questions"] if x["id"] == qid)
    bad = (await client.post(f"/api/review/{qid}", json={"optionId": q["options"][3]["id"]}, headers=h)).json()
    assert bad["correct"] is False and bad["box"] == 0 and bad["correctOptionId"]
    good = (await client.post(f"/api/review/{qid}", json={"optionId": bad["correctOptionId"]}, headers=h)).json()
    assert good["correct"] is True and good["box"] == 1
    after = (await client.get("/api/review", headers=h)).json()
    assert qid not in [x["id"] for x in after["questions"]]  # not due until tomorrow
    assert qid in [x["id"] for x in (await client.get("/api/review?all=true", headers=h)).json()["questions"]]

    # walk it through the boxes (pretend the days have passed)
    for step in range(2, 6):
        async with SessionLocal() as db:
            item = await db.get(ReviewItem, (await _uid(client, h), qid))
            item.due_at = item.due_at - timedelta(days=30)
            await db.commit()
        res = (await client.post(f"/api/review/{qid}", json={"optionId": bad["correctOptionId"]}, headers=h)).json()
        assert res["box"] == step
    assert res["mastered"] is True
    assert (await client.get("/api/review", headers=h)).json()["mastered"] == 1


async def test_past_mistakes_are_loaded_once(client, auth):
    h = auth(7002)
    wrong = await _wrong_answer_run(client, h)
    async with SessionLocal() as db:  # simulate mistakes made before the feature: empty deck, no seed marker
        from sqlalchemy import delete
        from app.models import ReviewState
        uid = await _uid(client, h)
        await db.execute(delete(ReviewItem).where(ReviewItem.user_id == uid))
        await db.execute(delete(ReviewState).where(ReviewState.user_id == uid))
        await db.commit()
    assert (await client.get("/api/review", headers=h)).json()["due"] == len(wrong)


async def _uid(client, h) -> str:
    return (await client.get("/api/me", headers=h)).json()["id"]
