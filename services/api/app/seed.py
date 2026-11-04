"""Initial content: 6 topics with subtopics and one starter test.

    python -m app.seed          # only when the database has no topics yet
Real questions are added in the admin panel (or via Excel import).
"""
from __future__ import annotations

import asyncio

from sqlalchemy import func, select

from .db import SessionLocal
from .models import Question, QuestionOption, Quiz, QuizQuestion, Subtopic, Topic, utcnow

TOPICS = [
    ("morphology", "Морфология", "blue", "T01", ["Имя существительное", "Имя прилагательное", "Глагол", "Местоимение", "Наречие"]),
    ("orthography", "Орфография", "violet", "T02", ["Приставки", "Ь и Ъ", "Н и НН", "Безударные гласные"]),
    ("syntax", "Синтаксис", "mint", "T03", ["Словосочетание", "Простое предложение", "Сложное предложение"]),
    ("punctuation", "Пунктуация", "peach", "T04", ["Запятые", "Сравнительный оборот", "Прямая речь"]),
    ("lexicon", "Лексика", "pink", "T05", ["Синонимы", "Антонимы", "Фразеологизмы"]),
    ("phonetics", "Фонетика", "yellow", "T06", ["Ударение", "Звуки и буквы"]),
]

STARTER = [
    ("Какое из слов является наречием?", ["Быстрый", "Быстро", "Быстрота", "Ускорить"], 1, 100, "Наречие",
     "«Быстро» отвечает на вопрос «как?» и не изменяется — это признаки наречия."),
    ("Укажите имя существительное женского рода", ["Тюль", "Кофе", "Мозоль", "Шампунь"], 2, 100, "Имя существительное",
     "«Мозоль» — женского рода: «больная мозоль». Тюль, кофе и шампунь — мужского."),
    ("В каком слове пишется Ь после шипящей?", ["Луч…", "Ноч…", "Врач…", "Шалаш…"], 1, 150, "Имя существительное",
     "У существительных женского рода 3-го склонения после шипящих пишется Ь: ночь."),
    ("Какое слово — глагол совершенного вида?", ["Читать", "Решать", "Написать", "Писать"], 2, 150, "Глагол",
     "«Написать» отвечает на вопрос «что сделать?» — это совершенный вид."),
]


async def seed() -> bool:
    async with SessionLocal() as db:
        if (await db.execute(select(func.count()).select_from(Topic))).scalar_one():
            return False
        topics = {}
        for i, (slug, title, color, art, subs) in enumerate(TOPICS):
            t = Topic(slug=slug, title=title, color=color, illustration=f"/3d/rq-3d-{art}.webp", position=i,
                      subtopics=[Subtopic(title=s, position=j) for j, s in enumerate(subs)])
            db.add(t)
            topics[slug] = t
        await db.flush()
        morph = topics["morphology"]
        subs = {s.title: s.id for s in morph.subtopics}
        quiz = Quiz(topic_id=morph.id, title="Имя существительное", difficulty="easy", duration_sec=120,
                    description="Род, число и падеж существительных, мягкий знак после шипящих.",
                    mode_individual=True, mode_live=True, mode_group=True, is_quick=True, status="published",
                    published_at=utcnow())
        db.add(quiz)
        await db.flush()
        for pos, (text, opts, correct, pts, sub, expl) in enumerate(STARTER):
            q = Question(topic_id=morph.id, subtopic_id=subs[sub], text=text, difficulty="easy", points=pts,
                         explanation_ru=expl, status="published",
                         options=[QuestionOption(position=i, text=o, is_correct=i == correct) for i, o in enumerate(opts)])
            db.add(q)
            await db.flush()
            db.add(QuizQuestion(quiz_id=quiz.id, question_id=q.id, position=pos))
        await db.commit()
        return True


if __name__ == "__main__":
    print("seeded" if asyncio.run(seed()) else "already has data — skipped")
