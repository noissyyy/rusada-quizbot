/**
 * Uzbek Latin → Uzbek Cyrillic transliteration.
 * Cyrillic UI strings are generated from Latin ones, so nobody maintains a
 * third copy of the texts. Covers the official 1995 alphabet; loanword
 * spellings that differ by convention (e.g. "ts" → «ц») are not guessed.
 */
const APOS = "['‘’ʻʼ`]";
const MULTI: [RegExp, string][] = [
  [new RegExp(`o${APOS}`, 'g'), 'ў'], [new RegExp(`O${APOS}`, 'g'), 'Ў'],
  [new RegExp(`g${APOS}`, 'g'), 'ғ'], [new RegExp(`G${APOS}`, 'g'), 'Ғ'],
  [/sh/g, 'ш'], [/Sh/g, 'Ш'], [/SH/g, 'Ш'],
  [/ch/g, 'ч'], [/Ch/g, 'Ч'], [/CH/g, 'Ч'],
  [/yo/g, 'ё'], [/Yo/g, 'Ё'], [/YO/g, 'Ё'],
  [/yu/g, 'ю'], [/Yu/g, 'Ю'], [/YU/g, 'Ю'],
  [/ya/g, 'я'], [/Ya/g, 'Я'], [/YA/g, 'Я'],
  [/ye/g, 'е'], [/Ye/g, 'Е'], [/YE/g, 'Е'],
];
const SINGLE: Record<string, string> = {
  a: 'а', b: 'б', d: 'д', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м',
  n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з',
};

/** Translate text but keep {placeholders} and brand names (QuizBot, @handles) intact. */
export function latinToCyrillic(input: string): string {
  return input.split(/(\{[^}]+\}|QuizBot|@\w+)/).map((part, i) => (i % 2 ? part : convert(part))).join('');
}

function convert(input: string): string {
  let s = input;
  // word-initial e → э, otherwise е
  s = s.replace(/(^|[^A-Za-zʻ'‘’])([eE])/g, (_m, pre: string, e: string) => pre + (e === 'e' ? 'э' : 'Э'));
  for (const [re, to] of MULTI) s = s.replace(re, to);
  s = s.replace(/[A-Za-z]/g, (ch) => {
    const lower = ch.toLowerCase();
    if (lower === 'e') return ch === 'e' ? 'е' : 'Е';
    const cyr = SINGLE[lower] ?? ch;
    return ch === lower ? cyr : cyr.toUpperCase();
  });
  // remaining apostrophes (tutuq belgisi) → ъ
  return s.replace(/[’ʼ']/g, 'ъ');
}
