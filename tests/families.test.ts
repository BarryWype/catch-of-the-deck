import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import { cardsOfferedBy, creatureFamilies, familiesOf, validateContent } from '../src/engine';
import { testData } from './fixtures';

describe('creature families', () => {
  it('a temperament can be in several families', () => {
    expect(familiesOf('clawed', gameData).map((f) => f.id)).toEqual(['shell', 'camo']);
    expect(familiesOf('predator', gameData).map((f) => f.id)).toEqual(['hunter', 'endurance']);
    expect(familiesOf(undefined, gameData)).toEqual([]);
  });

  it('a creature has its temperament’s families', () => {
    expect(creatureFamilies('blueCrab', gameData).map((f) => f.id)).toEqual(['shell', 'camo']);
    expect(creatureFamilies('portugueseManOWar', gameData).map((f) => f.id)).toEqual(['venom', 'slimy']);
  });

  it('every temperament of a creature is in at least one family', () => {
    for (const enemy of Object.values(gameData.enemies)) expect(creatureFamilies(enemy.id, gameData).length, enemy.id).toBeGreaterThan(0);
  });

  it('a creature offers the cards of its families, and only those', () => {
    const offered = cardsOfferedBy('shellA', testData);
    expect(offered.map((c) => c.id)).toContain('twin');
    expect(offered.every((c) => c.family === 'shells')).toBe(true);
    // The test dummy has no temperament, so no family.
    expect(cardsOfferedBy('dummy', testData)).toEqual([]);
  });

  it('catches unknown temperaments, temperaments in no family, and unknown card families', () => {
    const [first, ...rest] = contentSource.families;
    const errorsWith = (change: Partial<typeof contentSource>) => validateContent({ ...contentSource, ...change });
    expect(errorsWith({ families: [{ ...first, temperaments: [...first.temperaments, 'ghost'] }, ...rest] })).toEqual([
      expect.stringContaining('unknown temperament "ghost"'),
    ]);
    const withoutSlimy = contentSource.families.filter((f) => f.id !== 'slimy' && f.id !== 'hunter');
    expect(errorsWith({ families: withoutSlimy })).toEqual(expect.arrayContaining([expect.stringContaining('"eel" is in no family')]));
    const [card, ...cards] = contentSource.cards;
    expect(errorsWith({ cards: [{ ...card, family: 'nope' }, ...cards] })).toEqual([expect.stringContaining('unknown family "nope"')]);
  });

  it('catches an emblem that is not a creature of its family', () => {
    const [venom, ...rest] = contentSource.families;
    const errorsWith = (emblem: string) => validateContent({ ...contentSource, families: [{ ...venom, emblem }, ...rest] });
    expect(errorsWith('lionfish')).toEqual([]);
    expect(errorsWith('clownfish')).toEqual([expect.stringContaining('emblem "clownfish" is not a creature of the family')]);
    expect(errorsWith('ghost')).toEqual([expect.stringContaining('emblem "ghost"')]);
  });
});
