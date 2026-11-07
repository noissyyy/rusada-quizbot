"""Generates the big word pools for the games from wordfreq (how common a word is) and
pymorphy3 (its grammar). Run once when the lists need refreshing:

    pip install wordfreq pymorphy3 pymorphy3-dicts-ru
    python scripts/gen_game_content.py

Only unambiguous words are kept: if pymorphy3 reads a word in two ways (e.g. «быстро» —
adverb or short adjective), the word is left out rather than risk a wrong answer.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

import pymorphy3
import wordfreq

ROOT = Path(__file__).resolve().parent.parent
OUT_WEB = ROOT / "apps/miniapp/public/games"
OUT_API = ROOT / "services/api/app/data"
BAD = {"Name", "Surn", "Patr", "Geox", "Orgn", "Trad", "Abbr", "Erro", "Dist", "Infr", "Slng", "Arch", "Litr", "Obsc", "Init", "Fixd", "Ms-f", "Pltm", "Inmx"}
m = pymorphy3.MorphAnalyzer()
#: rarer words than this (less than once per million words of text) are left out: students would not know them
MIN_ZIPF = 3.0
#: rude, sexual, drug, violent or loaded words a school app should not show — checked by hand on samples
BLOCK = set("""
курва сука блядь хуй жопа задница дерьмо говно срань сучка шлюха проститутка проституция педик гей лесбиянка эрекция оргазм секс сексуальность
порно порнография презерватив вагина пенис член онанизм мастурбация изнасилование насильник любовница любовник стриптиз стриптизерша бордель
наркотик наркоман наркомания героин кокаин марихуана гашиш косяк травка водка пиво пойло самогон перегар похмелье алкоголик алкоголизм пьянка пьяница
бухло курение сигарета табак кальян вейп шахид террорист терроризм теракт джихад смертник убийца убийство самоубийство суицид труп мертвец казнь
палач расстрел пытка виселица бомба взрывчатка наган автомат пистолет винтовка дегенерат идиот дебил кретин урод ублюдок отродье подонок мразь
сволочь скотина тварь дура дурак брехня хрень фигня чушь ерунда выпендриваться ржать бомбить жрать нажраться трахать трахнуть масон фашист фашизм
нацист нацизм расист росс обком темпл пин вона морда рожа гомосексуалист гомосексуализм трансгендер аборт порка бандит гопник зэк зек тюрьма зона мент мусор шулер стукач педофил
убить убивать избить избивать задушить душить застрелить зарезать повесить пристрелить расстрелять казнить грабить ограбить украсть воровать
дьявол сатана бес черт ад демон колдун ведьма спиртное ром коньяк виски вино шампанское текила джин ликер бутылка рюмка закуска
""".split())


def candidates(n: int):
    seen = set()
    for w in wordfreq.top_n_list("ru", n):
        if "ё" in w or not w.isalpha() or not all("а" <= c <= "я" for c in w) or len(w) < 3 or w in seen:
            continue
        seen.add(w)
        if m.word_is_known(w):
            yield w


def parses(w: str):
    return [p for p in m.parse(w) if p.score >= 0.05]


def one_reading(w: str, pos: str):
    """The single parse of `w` as its dictionary form with part of speech `pos`, or None when ambiguous."""
    if w in BLOCK or wordfreq.zipf_frequency(w, "ru") < MIN_ZIPF:
        return None
    ps = parses(w)
    if not ps or any(p.tag.POS != pos for p in ps):
        return None
    # mostly a name or a place (Вера is fine: a word first; Мойра is not)
    if sum(q.score for q in m.parse(w) if set(q.tag.grammemes) & BAD) >= 0.35:
        return None
    p = ps[0]
    if p.normal_form != w or set(p.tag.grammemes) & BAD:
        return None
    return p


# words whose part of speech is argued about in school grammar
SKIP_ADV = {"так", "как", "где", "там", "тут", "уже", "еще", "много", "мало", "немного", "несколько", "более", "менее", "потому",
            "сколько", "столько", "почему", "зачем", "куда", "откуда", "когда", "тогда", "туда", "сюда", "оттуда", "отсюда", "весьма"}
nouns, gender, adj, verbs, adv, aspect, decl = [], [], [], [], [], [], []
for w in candidates(120000):
    p = one_reading(w, "NOUN")
    if p is not None and "nomn" in p.tag and "sing" in p.tag:
        gs = {q.tag.gender for q in parses(w)}
        if len(gs) == 1 and p.tag.gender in ("masc", "femn", "neut"):
            nouns.append(w)
            g = {"masc": "m", "femn": "f", "neut": "n"}[p.tag.gender]
            gender.append([w, g])
            # school declension: 1 — -а/-я (m, f); 2 — m with zero ending, n -о/-е; 3 — f -ь
            if w.endswith("мя") or w in ("путь", "дитя"):
                pass
            elif w[-1] in "ая" and g in "mf":
                decl.append([w, "1"])
            elif g == "n" and w[-1] in "ое":
                decl.append([w, "2"])
            elif g == "m" and w[-1] not in "аяоеиыуюэь":
                decl.append([w, "2"])
            elif g == "m" and w[-1] in "йь":
                decl.append([w, "2"])
            elif g == "f" and w[-1] == "ь":
                decl.append([w, "3"])
        continue
    p = one_reading(w, "ADJF")
    if p is not None and {"masc", "sing", "nomn"} <= set(p.tag.grammemes) and w[-2:] in ("ый", "ий", "ой"):
        adj.append(w)
        continue
    p = one_reading(w, "INFN")
    if p is not None:
        verbs.append(w)
        asp = {q.tag.aspect for q in parses(w)}
        if len(asp) == 1 and p.tag.aspect in ("perf", "impf"):
            aspect.append([w, "pf" if p.tag.aspect == "perf" else "ipf"])
        continue
    p = one_reading(w, "ADVB")
    if p is not None and w not in SKIP_ADV:
        adv.append(w)

# every ending test must use Cyrillic letters (a Latin «o» silently drops all -о nouns)
assert any(w.endswith("о") for w, d in decl if d == "2")
assert all(ch in "абвгдежзийклмнопрстуфхцчшщъыьэюя" for w, _ in decl for ch in w)

# tricky gender words pymorphy marks as indeclinable (Fixd) or common — checked by hand
TRICKY = [["кофе", "m"], ["тюль", "m"], ["шампунь", "m"], ["рояль", "m"], ["мозоль", "f"], ["вуаль", "f"], ["такси", "n"], ["метро", "n"],
          ["пальто", "n"], ["кафе", "n"], ["кино", "n"], ["радио", "n"], ["пианино", "n"], ["шоссе", "n"], ["кенгуру", "m"], ["пони", "m"],
          ["шимпанзе", "m"], ["какаду", "m"], ["сирокко", "m"], ["жалюзи", "n"], ["бигуди", "n"], ["цеце", "f"], ["авеню", "f"], ["кольраби", "f"],
          ["салями", "f"], ["иваси", "f"], ["тушь", "f"], ["толь", "m"], ["лебедь", "m"], ["картофель", "m"], ["гуашь", "f"], ["бандероль", "f"],
          ["фасоль", "f"], ["мышь", "f"], ["ночь", "f"], ["полдень", "m"], ["полночь", "f"], ["время", "n"], ["имя", "n"], ["знамя", "n"], ["пламя", "n"]]
have = {w for w, _ in gender}
gender = TRICKY + [x for x in gender if x[0] not in {t for t, _ in TRICKY}]

pos = [[w, "noun"] for w in nouns[:2500]] + [[w, "adj"] for w in adj[:2500]] + [[w, "verb"] for w in verbs[:2500]] + [[w, "adv"] for w in adv[:2500]]
random.Random(7).shuffle(pos)

OUT_WEB.mkdir(parents=True, exist_ok=True)
(OUT_WEB / "grammar.json").write_text(json.dumps({"gender": gender, "pos": pos, "aspect": aspect, "decl": decl}, ensure_ascii=False, separators=(",", ":")), "utf-8")
attack = [w for w in nouns if 3 <= len(w) <= 8][:6000]
(OUT_WEB / "nouns.json").write_text(json.dumps(attack, ensure_ascii=False, separators=(",", ":")), "utf-8")

# «So‘z topish»: common 5-letter nouns as answers; any known 5-letter word is a valid guess (checked on the server)
five = [w for w in nouns if len(w) == 5 and wordfreq.zipf_frequency(w, "ru") >= 3.4][:3000]
(OUT_API / "wordle_answers.txt").write_text("\n".join(five) + "\n", "utf-8")

print({"nouns": len(nouns), "gender": len(gender), "adj": len(adj), "verbs": len(verbs), "adv": len(adv), "aspect": len(aspect), "decl": len(decl), "attack": len(attack), "wordle": len(five)})
print("adv sample", adv[:40]); print("aspect sample", aspect[:20]); print("decl sample", decl[:30]); print("five sample", five[:40])

# the «Oxirgi harf» bot list was generated earlier: drop the same blocked and name-like words from it
lw_path = OUT_API / "lastword_nouns.txt"
lw = lw_path.read_text("utf-8").split()
lw_clean = [w for w in lw if w not in BLOCK]
lw_path.write_text("\n".join(lw_clean) + "\n", "utf-8")
print("lastword bot words", len(lw), "->", len(lw_clean), "removed:", sorted(set(lw) - set(lw_clean))[:80])
