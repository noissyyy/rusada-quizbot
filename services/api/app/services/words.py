"""«So‘z topish»: guess a 5-letter Russian word in 6 tries (green — right place, yellow — elsewhere in the word).

The daily word is the same for everybody (Tashkent date); practice words are random.
Answers are checked on the server, so the word is never sent to the phone before the game ends.
"""
from __future__ import annotations

import random
from datetime import date, datetime, timedelta, timezone

LENGTH = 5
TRIES = 6

#: common nouns, 5 letters, no «ё» (it is typed as «е»)
WORDS: list[str] = [
    "школа", "книга", "слово", "буква", "класс", "ручка", "парта", "доска", "мечта", "город", "улица", "дверь",
    "стена", "крыша", "берег", "поезд", "дождь", "ветер", "огонь", "земля", "песок", "трава", "лампа", "папка",
    "карта", "ответ", "песня", "танец", "театр", "поэма", "рифма", "роман", "автор", "герой", "образ", "сюжет",
    "падеж", "число", "точка", "пауза", "фраза", "текст", "абзац", "голос", "весна", "осень", "вечер", "месяц",
    "время", "жизнь", "место", "озеро", "волна", "туман", "гроза", "мороз", "птица", "кошка", "зебра", "белка",
    "ворон", "сокол", "акула", "пчела", "баран", "масло", "сахар", "груша", "слива", "вишня", "арбуз", "лимон",
    "банан", "тесто", "блюдо", "ложка", "вилка", "чашка", "кухня", "полка", "диван", "сумка", "шапка", "обувь",
    "ткань", "нитка", "пенал", "кисть", "холст", "рамка", "спорт", "гонка", "каток", "поход", "отдых", "билет",
    "метро", "такси", "лодка", "тропа", "семья", "гость", "сосед", "повар", "певец", "судья", "пилот", "народ",
    "район", "рынок", "почта", "завод", "склад", "музей", "замок", "башня", "сосна", "ветка", "ягода", "разум",
    "мысль", "смысл", "навык", "успех", "игрок", "выбор", "право", "закон", "налог", "сумма", "товар", "рубль",
    "выход", "порог", "бетон", "топор", "ведро", "шланг", "насос", "мотор", "экран", "пульт", "радио", "марка",
    "глава", "сцена", "афиша", "фильм", "шутка", "слеза", "страх", "тоска", "скука", "покой", "свеча", "маска",
    "орден", "кубок", "пирог", "салат", "перец", "томат", "горох", "крупа", "кефир", "пицца", "запах", "форма",
    "линия", "центр", "сфера", "масса", "длина", "грамм", "тонна", "сутки", "эпоха", "схема", "атлас", "север",
    "запад", "полюс", "пламя", "искра", "пепел", "уголь", "нефть", "олово", "сталь", "алмаз", "волос", "палец",
    "плечо", "спина", "живот", "кровь", "грудь", "пятка", "вирус", "халат", "шприц", "кукла", "дрова", "глина",
    "знамя", "жираф", "кобра", "скала",
]

_DAILY_ORDER = WORDS[:]
random.Random(20261106).shuffle(_DAILY_ORDER)  # fixed order, but not alphabetical
_EPOCH = date(2026, 11, 1)


def today() -> date:
    return (datetime.now(timezone.utc) + timedelta(hours=5)).date()


def daily_word(day: date) -> str:
    return _DAILY_ORDER[(day - _EPOCH).days % len(_DAILY_ORDER)]


def daily_number(day: date) -> int:
    return (day - _EPOCH).days + 1


def random_word(exclude: set[str] | None = None) -> str:
    pool = [w for w in WORDS if not exclude or w not in exclude] or WORDS
    return random.choice(pool)


def normalize(guess: str) -> str | None:
    """Lower-case, «ё» → «е»; None unless exactly 5 Russian letters."""
    g = guess.strip().lower().replace("ё", "е")
    if len(g) != LENGTH or not all("а" <= c <= "я" for c in g):
        return None
    return g


def marks(guess: str, answer: str) -> list[str]:
    """correct / present / absent for each letter, counting repeated letters like Wordle does."""
    out = ["absent"] * LENGTH
    left: dict[str, int] = {}
    for i, (g, a) in enumerate(zip(guess, answer)):
        if g == a:
            out[i] = "correct"
        else:
            left[a] = left.get(a, 0) + 1
    for i, g in enumerate(guess):
        if out[i] != "correct" and left.get(g, 0) > 0:
            out[i] = "present"
            left[g] -= 1
    return out
