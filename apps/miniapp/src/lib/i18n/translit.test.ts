import { describe, expect, it } from 'vitest';
import { latinToCyrillic as t } from './translit';

describe('latinToCyrillic', () => {
  it.each([
    ['Salom', 'Салом'],
    ['O‘zbekcha', 'Ўзбекча'],
    ['Bosh sahifa', 'Бош саҳифа'],
    ['Testni boshlash', 'Тестни бошлаш'],
    ['g‘alaba', 'ғалаба'],
    ['Davom etish', 'Давом этиш'],
    ['yangi', 'янги'],
    ['ta’lim', 'таълим'],
    ['Shaxsiy', 'Шахсий'],
    ['15 ta savol', '15 та савол'],
  ])('%s → %s', (src, out) => expect(t(src)).toBe(out));

  it('leaves placeholders and Cyrillic untouched', () => {
    expect(t('Salom, {name}! Морфология')).toBe('Салом, {name}! Морфология');
  });
});
