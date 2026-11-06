"""«Последнее слово»: name a noun that starts with the last letter of the previous one.

The player's words are checked with pymorphy3 (a common noun in the nominative singular,
or a plural-only noun such as «ножницы»). The bot answers from a fixed list of 3000
everyday nouns (generated once from wordfreq, filtered by pymorphy3) and gives up more
often the longer the game goes, so a game can be won.
"""
from __future__ import annotations

import random
import re
from functools import lru_cache
from pathlib import Path

SKIP = set("ьъы")
BAD = {"Name", "Surn", "Patr", "Geox", "Orgn", "Trad", "Abbr", "Erro", "Dist", "Infr", "Slng", "Obsc"}
_WORD = re.compile(r"^[а-я]+(-[а-я]+)?$")


@lru_cache(maxsize=1)
def nouns() -> tuple[str, ...]:
    return tuple((Path(__file__).parent.parent / "data" / "lastword_nouns.txt").read_text("utf-8").split())


@lru_cache(maxsize=1)
def _known() -> frozenset[str]:
    return frozenset(nouns())


@lru_cache(maxsize=1)
def _morph():
    import pymorphy3  # heavy: loaded on first use only

    return pymorphy3.MorphAnalyzer()


def norm(w: str) -> str:
    return w.strip().lower().replace("ё", "е")


def last_letter(w: str) -> str:
    for c in reversed(w):
        if c.isalpha() and c not in SKIP:
            return c
    return w[-1]


def is_noun(w: str) -> bool:
    if w in _known():
        return True
    m = _morph()
    if not m.word_is_known(w):
        return False
    for p in m.parse(w):
        g = set(p.tag.grammemes)
        if p.tag.POS != "NOUN" or g & BAD or "nomn" not in g:
            continue
        if norm(p.normal_form) == w and "sing" in g:
            return True
        if "Pltm" in g and "plur" in g:
            return True
    return False


def check(word: str, used: list[str]) -> tuple[str, str | None]:
    """Returns (normalized word, error) — error is None when the move is valid."""
    w = norm(word)
    if not _WORD.match(w) or len(w) < 2:
        return w, "not_word"
    if used:
        need = last_letter(used[-1])
        if w[0] != need:
            return w, "wrong_letter"
    if w in {norm(u) for u in used}:
        return w, "used"
    if not is_noun(w):
        return w, "not_noun"
    return w, None


def bot_move(used: list[str], turn: int, rng: random.Random | None = None) -> str | None:
    """The bot's word, or None when it gives up."""
    rng = rng or random.Random()
    if turn >= 3 and rng.random() < min(0.5, 0.05 * (turn - 2)):
        return None
    taken = {norm(u) for u in used}
    letter = last_letter(used[-1]) if used else None
    pool = [n for n in nouns() if (letter is None or n[0] == letter) and n not in taken]
    if not pool:
        return None
    # early in the game prefer frequent words; later dig deeper into the list
    return rng.choice(pool[: max(8, 40 + turn * 30)])
