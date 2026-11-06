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


async def test_word_game_daily_practice_and_stats(client, auth):
    from app.services import words
    h = auth(7101)
    d = (await client.get("/api/games/word/daily", headers=h)).json()
    assert d["mode"] == "daily" and d["status"] == "playing" and d["answer"] is None and d["number"] >= 1
    same = (await client.get("/api/games/word/daily", headers=h)).json()
    assert same["id"] == d["id"]  # one daily game per day

    bad = await client.post(f"/api/games/word/{d['id']}/guess", json={"word": "abcde"}, headers=h)
    assert bad.status_code == 422
    answer = words.daily_word(words.today())
    wrong = "лампа" if answer != "лампа" else "песок"
    g1 = (await client.post(f"/api/games/word/{d['id']}/guess", json={"word": wrong.upper()}, headers=h)).json()
    assert g1["guesses"][0]["word"] == wrong and len(g1["guesses"][0]["marks"]) == 5 and g1["answer"] is None
    g2 = (await client.post(f"/api/games/word/{d['id']}/guess", json={"word": answer}, headers=h)).json()
    assert g2["status"] == "won" and g2["answer"] == answer and g2["guesses"][1]["marks"] == ["correct"] * 5
    assert (await client.post(f"/api/games/word/{d['id']}/guess", json={"word": answer}, headers=h)).status_code == 409

    # practice: as many as you like; an unfinished one is continued
    p = (await client.post("/api/games/word/practice", headers=h)).json()
    assert p["mode"] == "practice" and p["number"] is None
    assert (await client.post("/api/games/word/practice", headers=h)).json()["id"] == p["id"]
    for _ in range(6):
        last = (await client.post(f"/api/games/word/{p['id']}/guess", json={"word": "ъъъъъ"}, headers=h)).json()
    assert last["status"] == "lost" and last["answer"]
    assert (await client.post("/api/games/word/practice", headers=h)).json()["id"] != p["id"]

    st = (await client.get("/api/games/word/stats", headers=h)).json()
    assert st == {"played": 1, "won": 1, "streak": 1, "bestStreak": 1, "distribution": [0, 1, 0, 0, 0, 0], "practiceWon": 0}


def test_word_marks_handle_repeated_letters():
    from app.services.words import marks
    assert marks("лампа", "папка") == ["absent", "correct", "absent", "present", "correct"]
    assert marks("аааaa".replace("a", "а"), "мачта") == ["absent", "correct", "absent", "absent", "correct"]


async def test_stress_words_scores_and_weekly_board(client, auth):
    a, b = auth(7201, "Ali", "V"), auth(7202, "Madina", "R")
    words = (await client.get("/api/games/stress/words", headers=a)).json()
    assert len(words) > 100
    w = next(x for x in words if x["word"] == "звонит")
    assert w["stress"] == 4  # звонИт
    assert (await client.post("/api/games/stress/score", json={"score": 500, "answered": 500}, headers=a)).status_code == 422
    assert (await client.post("/api/games/stress/score", json={"score": 5, "answered": 3}, headers=a)).status_code == 422
    await client.post("/api/games/stress/score", json={"score": 18, "answered": 22}, headers=a)
    await client.post("/api/games/stress/score", json={"score": 12, "answered": 15}, headers=a)
    board = (await client.post("/api/games/stress/score", json={"score": 25, "answered": 27}, headers=b)).json()
    assert board["best"] == 25 and board["rounds"] == 1
    assert [(r["name"], r["score"], r["me"]) for r in board["week"][:2]] == [("Madina R.", 25, True), ("Ali V.", 18, False)]
    mine = (await client.get("/api/games/stress/board", headers=a)).json()
    assert mine["best"] == 18 and mine["bestWeek"] == 18 and mine["rounds"] == 2


async def test_duel_two_players_same_questions_and_result(client, auth):
    a, b, c = auth(7301, "Ali", "V"), auth(7302, "Madina", "R"), auth(7303, "Third", "P")
    d = (await client.post("/api/duels", json={}, headers=a)).json()
    assert d["role"] == "creator" and d["questionsCount"] == 4 and "startapp=d_" in d["link"]
    seen = (await client.get(f"/api/duels/{d['id']}", headers=b)).json()
    assert seen["role"] == "new" and seen["rival"]["name"] == "Ali V."

    async def play(h, right: int):
        s = (await client.post(f"/api/duels/{d['id']}/start", headers=h)).json()
        assert "correct" not in str(s["questions"])
        for i, q in enumerate(s["questions"]):
            r = (await client.post(f"/api/duels/{d['id']}/answer", json={"index": i, "optionId": q["options"][0]["id"]}, headers=h)).json()
            if i < right and not r["correct"]:
                await client.post(f"/api/duels/{d['id']}/answer", json={"index": i, "optionId": r["correctOptionId"]}, headers=h)
        return s["questions"]

    qa = await play(a, 0)
    mid = (await client.post(f"/api/duels/{d['id']}/finish", headers=a)).json()
    assert mid["outcome"] is None and mid["me"]["finished"] is True
    qb = await play(b, 0)
    assert [q["id"] for q in qa] == [q["id"] for q in qb]  # the same questions for both
    assert (await client.post(f"/api/duels/{d['id']}/start", headers=c)).status_code == 409  # taken
    done = (await client.post(f"/api/duels/{d['id']}/finish", headers=b)).json()
    assert done["outcome"] in ("win", "lose", "draw") and done["rival"]["correct"] is not None
    other = (await client.get(f"/api/duels/{d['id']}", headers=a)).json()
    assert {done["outcome"], other["outcome"]} in ({"win", "lose"}, {"draw"})
    assert (await client.post(f"/api/duels/{d['id']}/start", headers=a)).status_code == 409  # played already
    assert len((await client.get("/api/duels", headers=a)).json()) == 1


async def test_xp_levels_and_game_results(client, auth):
    from app.services.xp import level_of
    assert [level_of(x) for x in (0, 99, 100, 300, 600, 1000)] == [1, 1, 2, 3, 4, 5]
    h = auth(7401)
    hub = (await client.get("/api/games/hub", headers=h)).json()
    assert hub["xp"] == {"xp": 0, "level": 1, "levelStart": 0, "levelNext": 100}

    # a finished test gives points / 10
    quiz_id = (await client.get("/api/tests", headers=h)).json()[0]["id"]
    s = (await client.post("/api/sessions", json={"quizId": quiz_id}, headers=h)).json()
    q = s["questions"][0]
    r = (await client.post(f"/api/sessions/{s['sessionId']}/answers", json={"questionId": q["id"], "optionId": q["options"][0]["id"]}, headers=h)).json()
    if not r["outcome"] == "correct":
        pass
    res = (await client.post(f"/api/sessions/{s['sessionId']}/finish", json={}, headers=h)).json()
    after_test = (await client.get("/api/games/hub", headers=h)).json()["xp"]["xp"]
    assert after_test == round(res["points"] / 10)

    # a single-player game: capped XP, best score, popularity
    out = (await client.post("/api/games/memory/result", json={"score": 999}, headers=h)).json()
    assert out["xpEarned"] == 40 and out["best"] == 999
    out = (await client.post("/api/games/memory/result", json={"score": 12}, headers=h)).json()
    assert out["xpEarned"] == 12 and out["best"] == 999 and out["xp"]["xp"] == after_test + 52
    assert (await client.post("/api/games/nope/result", json={"score": 1}, headers=h)).status_code == 404
    await client.post("/api/games/stress/score", json={"score": 20, "answered": 25}, headers=h)
    hub = (await client.get("/api/games/hub", headers=h)).json()
    assert hub["plays"]["memory"] >= 2 and hub["plays"]["stress"] >= 1 and "test" not in hub["plays"]
    assert hub["xp"]["xp"] == after_test + 72


async def test_last_word_chain_and_bot(client, auth):
    import random

    from app.services import lastword

    h = auth(7501)
    start = (await client.get("/api/games/lastword/start", headers=h)).json()
    assert start["bot"] in lastword.nouns() and start["need"] == lastword.last_letter(start["bot"])

    # wrong letter / not a noun / a city / repeated word are refused
    r = (await client.post("/api/games/lastword/turn", json={"word": "слон", "used": ["кошка"]}, headers=h)).json()
    assert r == {**r, "ok": False, "error": "wrong_letter", "need": "а"}
    r = (await client.post("/api/games/lastword/turn", json={"word": "бежать", "used": []}, headers=h)).json()
    assert r["error"] == "not_noun"
    r = (await client.post("/api/games/lastword/turn", json={"word": "Москва", "used": []}, headers=h)).json()
    assert r["error"] == "not_noun"
    r = (await client.post("/api/games/lastword/turn", json={"word": "арбуз", "used": ["арбуз", "зонт", "танк", "кошка"]}, headers=h)).json()
    assert r["error"] == "used"

    # a valid move: ё is read as е and the bot answers on the right letter
    r = (await client.post("/api/games/lastword/turn", json={"word": "Ёлка", "used": ["море"]}, headers=h)).json()
    assert r["ok"] and r["word"] == "елка"
    if not r["botGaveUp"]:
        assert r["bot"][0] == "а" and r["need"] == lastword.last_letter(r["bot"])

    # the bot never gives up early and always gives up sometimes later
    rng = random.Random(1)
    assert all(lastword.bot_move(["кошка"], 1, rng) for _ in range(50))
    assert any(lastword.bot_move(["кошка"], 12, rng) is None for _ in range(50))


def test_last_word_skips_soft_sign():
    from app.services import lastword
    assert lastword.last_letter("тетрадь") == "д" and lastword.last_letter("сыры") == "р"
    assert lastword.check("дом", ["тетрадь"]) == ("дом", None)


async def test_duel_with_difficulty(client, auth):
    h = auth(7601)
    d = (await client.post("/api/duels", json={"difficulty": "easy"}, headers=h)).json()
    assert d["difficulty"] == "easy" and d["questionsCount"] >= 3
    # the seeded questions are all easy: a hard duel cannot be made
    r = await client.post("/api/duels", json={"difficulty": "hard"}, headers=h)
    assert r.status_code == 409 and r.json()["detail"] == "not_enough_questions"
    r = await client.post("/api/duels", json={"difficulty": "extreme"}, headers=h)
    assert r.status_code == 422


async def test_last_word_match_between_two_people(client, auth):
    from datetime import timedelta

    from app.db import SessionLocal
    from app.models import LastWordMatch, utcnow
    from app.services import lastword

    a, b, c = auth(7701), auth(7702), auth(7703)
    m = (await client.post("/api/lastword/matches", headers=a)).json()
    assert m["role"] == "creator" and m["myTurn"] and m["status"] == "playing" and m["words"][0]["by"] == "start"
    mid = m["id"]

    # the friend cannot move before the creator; a wrong letter is refused
    assert (await client.post(f"/api/lastword/matches/{mid}/move", json={"word": "арбуз"}, headers=b)).status_code == 409
    need = m["need"]
    bad = "арбуз" if need != "а" else "банан"
    assert (await client.post(f"/api/lastword/matches/{mid}/move", json={"word": bad}, headers=a)).status_code == 422

    def word_for(letter, used):
        return next(n for n in lastword.nouns() if n[0] == letter and n not in used)

    used = [w["word"] for w in m["words"]]
    w1 = word_for(need, used)
    m = (await client.post(f"/api/lastword/matches/{mid}/move", json={"word": w1}, headers=a)).json()
    assert m["status"] == "waiting" and not m["myTurn"] and m["myWords"] == 1

    # the friend opens the link: may join by answering
    seen = (await client.get(f"/api/lastword/matches/{mid}", headers=b)).json()
    assert seen["role"] == "new" and seen["myTurn"]
    w2 = word_for(seen["need"], [w["word"] for w in seen["words"]])
    m_b = (await client.post(f"/api/lastword/matches/{mid}/move", json={"word": w2}, headers=b)).json()
    assert m_b["role"] == "opponent" and m_b["words"][-1] == {"by": "me", "word": w2}
    assert (await client.get(f"/api/lastword/matches/{mid}", headers=c)).json()["role"] == "full"
    assert (await client.post(f"/api/lastword/matches/{mid}/move", json={"word": w2}, headers=b)).status_code == 409  # not b's turn

    # the creator lets the clock run out → the friend wins
    async with SessionLocal() as db:
        row = await db.get(LastWordMatch, mid)
        row.move_deadline = utcnow() - timedelta(minutes=1)
        await db.commit()
    end_a = (await client.get(f"/api/lastword/matches/{mid}", headers=a)).json()
    end_b = (await client.get(f"/api/lastword/matches/{mid}", headers=b)).json()
    assert end_a["status"] == "lost" and end_b["status"] == "won" and end_a["endReason"] == "timeout"
    assert [x["id"] for x in (await client.get("/api/lastword/matches", headers=b)).json()] == [mid]

    # resigning
    m2 = (await client.post("/api/lastword/matches", headers=a)).json()
    r = (await client.post(f"/api/lastword/matches/{m2['id']}/resign", headers=a)).json()
    assert r["endReason"] == "resign"
