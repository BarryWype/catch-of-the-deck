import type { ContentSource } from '../engine';

/**
 * A language's names and descriptions for the game content (creatures, cards, events…), by id.
 * English is the content files themselves; other languages give their own words here (see
 * src/locales/fr-content.ts). Anything left out stays in English.
 */
export interface ContentTranslations {
  character?: { name?: string; home?: string };
  /** Enemy (creature) id → name. */
  creatures?: Record<string, string>;
  /** Move names, keyed `<temperament>.<move id>` for shared move sets (behaviors.ts), or `<creature id>.<move id>` for a creature's own. */
  moves?: Record<string, string>;
  /** Card id → name. */
  cards?: Record<string, string>;
  /** Build id → its name, description, and the title of the quest that unlocks it. */
  builds?: Record<string, { name?: string; description?: string; quest?: string }>;
  /** Fisherman id → his name and what he says when met. */
  fishermen?: Record<string, { name?: string; greeting?: string }>;
  equipment?: Record<string, { name?: string; description?: string }>;
  /** Family id → its name, and its design notes. */
  families?: Record<string, { name?: string; identity?: string; focus?: string }>;
  /** Keyed by temperament id. */
  companions?: Record<string, { name?: string; temperamentName?: string; description?: string }>;
  /** Event id → its name, text and choice labels (in order). */
  events?: Record<string, { name?: string; description?: string; choices?: string[] }>;
  /** Shop item id → name. */
  shop?: Record<string, string>;
  /** Fishing spot id → name. */
  spots?: Record<string, string>;
  /** Place names on the map, keyed by their English text: coast visits (coast.ts), and the levels' mini-bosses, bosses and fixed first nodes (levels.ts). */
  places?: Record<string, string>;
  /** Level id → name. */
  levels?: Record<string, string>;
  /** Why mini-bosses and bosses are let go, keyed by their English text (levels.ts). */
  releaseReasons?: Record<string, string>;
}

/** The content with a language's words in place of the English ones. */
export function localizeContent(source: ContentSource, tr: ContentTranslations): ContentSource {
  const place = (label: string) => tr.places?.[label] ?? label;
  const reason = (text: string) => tr.releaseReasons?.[text] ?? text;
  return {
    ...source,
    character: {
      ...source.character,
      name: tr.character?.name ?? source.character.name,
      home: { ...source.character.home, name: tr.character?.home ?? source.character.home.name },
    },
    enemies: source.enemies.map((e) => ({
      ...e,
      name: tr.creatures?.[e.id] ?? e.name,
      moves: e.moves.map((m) => ({ ...m, name: tr.moves?.[`${e.id}.${m.id}`] ?? tr.moves?.[`${e.temperament}.${m.id}`] ?? m.name })),
    })),
    cards: source.cards.map((c) => ({ ...c, name: tr.cards?.[c.id] ?? c.name })),
    builds: source.builds.map((b) => {
      const { quest, ...t } = tr.builds?.[b.id] ?? {};
      return { ...b, ...t, unlock: b.unlock && { ...b.unlock, name: quest ?? b.unlock.name } };
    }),
    fishermen: source.fishermen.map((f) => ({ ...f, ...tr.fishermen?.[f.id] })),
    equipment: source.equipment.map((e) => ({ ...e, ...tr.equipment?.[e.id] })),
    companionBonuses: source.companionBonuses.map((b) => ({ ...b, ...tr.companions?.[b.id] })),
    families: source.families.map((f) => ({ ...f, ...tr.families?.[f.id] })),
    events: source.events.map((e) => {
      const t = tr.events?.[e.id];
      return {
        ...e,
        name: t?.name ?? e.name,
        description: t?.description ?? e.description,
        choices: e.choices.map((c, i) => ({ ...c, label: t?.choices?.[i] ?? c.label })),
      };
    }),
    shop: source.shop.map((s) => ({ ...s, name: tr.shop?.[s.id] ?? s.name })),
    spots: source.spots.map((s) => ({ ...s, name: tr.spots?.[s.id] ?? s.name })),
    coast: {
      places: source.coast.places.map((p) => ({ ...p, visits: p.visits.map((v) => v && { ...v, label: place(v.label) }) })),
    },
    levels: source.levels.map((l) => ({
      ...l,
      name: tr.levels?.[l.id] ?? l.name,
      miniBoss: l.miniBoss && { ...l.miniBoss, label: place(l.miniBoss.label), releaseReason: reason(l.miniBoss.releaseReason) },
      boss: l.boss && { ...l.boss, label: place(l.boss.label), releaseReason: reason(l.boss.releaseReason) },
      firstColumn: l.firstColumn?.map((s) => ({ ...s, label: place(s.label) })),
      nodes: l.nodes?.map((n) => ({ ...n, label: n.label && place(n.label), releaseReason: n.releaseReason && reason(n.releaseReason) })),
    })),
  };
}
