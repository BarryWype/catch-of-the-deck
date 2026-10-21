import { afterAll, describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import { localizeContent, type ContentTranslations } from '../src/content/localize';
import { caught } from './fixtures';
import {
  buildGameData,
  describeCard,
  describeCompanionEffect,
  describeEffects,
  describeEventEffect,
  formatMessage,
  createRun,
  setText,
  statusDescription,
  statusName,
  STATUS_META,
  type StatusId,
} from '../src/engine';
import { en } from '../src/locales/en';
import { LANGUAGES, type Messages } from '../src/locales';

const codes = Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[];

/** Every string at the leaves of a message table. */
function leaves(table: object): string[] {
  return Object.values(table).flatMap((v) => (typeof v === 'string' ? [v] : leaves(v)));
}

// Text that leaked through untranslated: a message key, or a `{param}` that was never filled in.
const LEAK = /\{[\w@]+\}|\b(?:log|invalid|describe|status|companion|event|shop)\.[\w.]+/;

describe.each(codes)('the %s language', (code) => {
  const { messages } = LANGUAGES[code];
  afterAll(() => setText(en.engine, en.terms, 'en'));

  it('uses only terms it defines', () => {
    for (const text of [...leaves(messages.engine), ...leaves(messages.ui)]) {
      for (const [, name] of text.matchAll(/\{@(\w+)\}/g)) expect(messages.terms, text).toHaveProperty(name);
    }
  });

  it('writes every rule of the game without leaving a key or a blank', () => {
    setText(messages.engine, messages.terms, code);
    const run = { ...createRun(1, gameData, 'rod'), bucket: caught('clownfish') };
    const texts = [
      ...Object.values(gameData.cards).map((c) => describeCard(c)),
      ...Object.values(gameData.enemies).flatMap((e) => [...e.moves, ...(e.bossMoves?.moves ?? [])].map((m) => describeEffects(m.effects, { byCreature: true }))),
      ...Object.values(gameData.companionBonuses).flatMap((b) => [...b.effects, ...b.fullSchool].map(describeCompanionEffect)),
      ...Object.values(gameData.events).flatMap((e) => e.choices.flatMap((c) => c.effects.map((x) => describeEventEffect(x, run, gameData)))),
      ...(Object.keys(STATUS_META) as StatusId[]).flatMap((id) => [statusName(id), statusDescription(id)]),
    ];
    for (const text of texts) expect(text).not.toMatch(LEAK);
  });
});

describe('message templates', () => {
  const terms = { grit: 'Grit' };

  it('fill in params and terms', () => {
    expect(formatMessage('Lose {n} {@grit}.', { n: 3 }, terms)).toBe('Lose 3 Grit.');
  });

  it('pick the plural form by the language’s rules', () => {
    const forms = '{n} creature|{n} creatures';
    expect(formatMessage(forms, { n: 1 }, terms, new Intl.PluralRules('en'))).toBe('1 creature');
    expect(formatMessage(forms, { n: 0 }, terms, new Intl.PluralRules('en'))).toBe('0 creatures');
    // French uses the singular for 0.
    expect(formatMessage('{n} créature|{n} créatures', { n: 0 }, terms, new Intl.PluralRules('fr'))).toBe('0 créature');
  });
});

describe.each(codes)('the %s Logbook', (code) => {
  it('names every track', () => {
    const tracks = (LANGUAGES[code].messages as Messages).ui.logbook.track as Record<string, string>;
    expect(new Set(contentSource.progression.map((n) => n.track)).size).toBe(Object.keys(tracks).length);
    for (const node of contentSource.progression) expect(tracks[node.track], node.track).toBeTruthy();
  });
});

describe.each(codes.filter((code) => code !== 'en'))('the %s content', (code) => {
  const tr: ContentTranslations = LANGUAGES[code].content;
  const missing = (ids: string[], table: Record<string, unknown> | undefined) => ids.filter((id) => !table?.[id]);

  it('names every creature, card, spot, build, item, companion, event, shop item, level and Logbook node', () => {
    expect(missing(contentSource.enemies.map((e) => e.id), tr.creatures)).toEqual([]);
    expect(missing(contentSource.cards.map((c) => c.id), tr.cards)).toEqual([]);
    expect(missing(contentSource.spots.map((s) => s.id), tr.spots)).toEqual([]);
    expect(missing(contentSource.builds.map((b) => b.id), tr.builds)).toEqual([]);
    expect(missing(contentSource.equipment.map((e) => e.id), tr.equipment)).toEqual([]);
    expect(missing(contentSource.companionBonuses.map((b) => b.id), tr.companions)).toEqual([]);
    expect(missing(contentSource.shop.map((s) => s.id), tr.shop)).toEqual([]);
    expect(missing(contentSource.levels.map((l) => l.id), tr.levels)).toEqual([]);
    expect(missing(contentSource.families.map((f) => f.id), tr.families)).toEqual([]);
    expect(missing(contentSource.progression.map((n) => n.id), tr.progression)).toEqual([]);
    for (const event of contentSource.events) expect(tr.events?.[event.id]?.choices, event.id).toHaveLength(event.choices.length);
  });

  it('names every creature move', () => {
    const untranslated = contentSource.enemies.flatMap((e) =>
      [...e.moves, ...(e.bossMoves?.moves ?? [])].filter((m) => !tr.moves?.[`${e.id}.${m.id}`] && !tr.moves?.[`${e.temperament}.${m.id}`]).map((m) => `${e.id}.${m.id}`),
    );
    expect(untranslated).toEqual([]);
  });

  it('names every place on the map, and every reason a boss is let go', () => {
    const places = new Set<string>();
    const reasons = new Set<string>();
    for (const p of contentSource.coast.places) for (const v of p.visits) if (v) places.add(v.label);
    for (const level of contentSource.levels) {
      for (const boss of [level.miniBoss, level.boss]) if (boss) (places.add(boss.label), reasons.add(boss.releaseReason));
      for (const stop of level.firstColumn ?? []) places.add(stop.label);
    }
    expect(missing([...places], tr.places)).toEqual([]);
    expect(missing([...reasons], tr.releaseReasons)).toEqual([]);
  });

  it('still makes valid game data', () => {
    const data = buildGameData(localizeContent(contentSource, tr));
    expect(data.enemies.clownfish.name).toBe(tr.creatures?.clownfish);
  });
});

// Every language file has the same keys as English (TypeScript checks it too).
it.each(codes)('%s has every message English has', (code) => {
  const keys = (table: object, prefix = ''): string[] =>
    Object.entries(table).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : keys(v, `${prefix}${k}.`)));
  const messages: Messages = LANGUAGES[code].messages;
  expect(keys(messages).sort()).toEqual(keys(en).sort());
});
