import type { BuildDef, CardDef, CharacterDef, CompanionBonusDef, CreatureTypeDef, EncounterDef, EnemyDef, Effect, EquipmentDef, EventDef, GameData, ShopItemDef } from './types';

/** Content as authored: plain arrays, easy to edit by hand. */
export interface ContentSource {
  character: CharacterDef;
  cards: CardDef[];
  enemies: EnemyDef[];
  encounters: EncounterDef[];
  builds: BuildDef[];
  creatureTypes: CreatureTypeDef[];
  equipment: EquipmentDef[];
  events: EventDef[];
  shop: ShopItemDef[];
  companionBonuses: CompanionBonusDef[];
}

/** Index content by id, throwing a readable error if anything is inconsistent. */
export function buildGameData(source: ContentSource): GameData {
  const errors = validateContent(source);
  if (errors.length) throw new Error(`Invalid game content:\n- ${errors.join('\n- ')}`);
  return {
    character: source.character,
    cards: Object.fromEntries(source.cards.map((c) => [c.id, c])),
    enemies: Object.fromEntries(source.enemies.map((e) => [e.id, e])),
    encounters: source.encounters,
    builds: Object.fromEntries(source.builds.map((b) => [b.id, b])),
    creatureTypes: Object.fromEntries(source.creatureTypes.map((t) => [t.id, t])),
    equipment: Object.fromEntries(source.equipment.map((e) => [e.id, e])),
    events: Object.fromEntries(source.events.map((e) => [e.id, e])),
    shop: source.shop,
    companionBonuses: Object.fromEntries(source.companionBonuses.map((b) => [b.id, b])),
  };
}

/** Creature type id → display name, for card text (`DescribeOptions.tagNames`). */
export function creatureTypeNames(data: GameData): Record<string, string> {
  return Object.fromEntries(Object.values(data.creatureTypes).map((t) => [t.id, t.name]));
}

/** Returns a list of human-readable problems; empty means the content is valid. */
export function validateContent(source: ContentSource): string[] {
  const errors: string[] = [];
  if (!(Number.isInteger(source.character.maxHp) && source.character.maxHp > 0)) {
    errors.push('Character: maxHp must be a whole number > 0.');
  }
  const cardIds = new Set<string>();
  const enemyIds = new Set<string>();
  const typeIds = new Set<string>();

  const checkDuplicate = (seen: Set<string>, id: string, kind: string) => {
    if (seen.has(id)) errors.push(`Duplicate ${kind} id "${id}".`);
    seen.add(id);
  };
  const checkTags = (where: string, tags: readonly string[]) => {
    for (const tag of tags) if (!typeIds.has(tag)) errors.push(`${where}: unknown creature type "${tag}".`);
  };
  const checkEffects = (where: string, effects: Effect[]) => {
    for (const e of effects) {
      if ('amount' in e && !Number.isFinite(e.amount)) errors.push(`${where}: effect "${e.type}" has a non-numeric amount.`);
      if (e.type === 'dealDamage' && e.hits !== undefined && (!Number.isInteger(e.hits) || e.hits < 1)) {
        errors.push(`${where}: "hits" must be a whole number ≥ 1.`);
      }
      if (e.type === 'dealDamage' && e.bonus) checkTags(`${where} damage bonus`, e.bonus.against);
    }
  };

  for (const type of source.creatureTypes) checkDuplicate(typeIds, type.id, 'creature type');

  const equipmentIds = new Set<string>();
  for (const item of source.equipment) {
    checkDuplicate(equipmentIds, item.id, 'equipment');
    for (const effect of item.effects) {
      const percent = effect.type === 'slowEscape' ? effect.percent : effect.bonusPercent;
      if (!(percent >= 0)) errors.push(`Equipment "${item.id}": effect "${effect.type}" needs a percentage ≥ 0.`);
    }
  }

  for (const card of source.cards) {
    checkDuplicate(cardIds, card.id, 'card');
    const where = `Card "${card.id}"`;
    if (!Number.isInteger(card.cost) || card.cost < 0) errors.push(`${where}: cost must be a whole number ≥ 0.`);
    checkEffects(where, card.effects);
    const needsTarget = card.effects.some(
      (e) =>
        (e.type === 'dealDamage' || e.type === 'applyStatus' || e.type === 'changeEscape' || e.type === 'changeEscapeRate') &&
        (e.target ?? 'target') === 'target',
    );
    if (needsTarget && card.target !== 'enemy') {
      errors.push(`${where}: an effect hits the chosen target, so the card needs target: 'enemy'.`);
    }
    if (card.build !== undefined && !source.builds.some((b) => b.id === card.build)) {
      errors.push(`${where}: unknown build "${card.build}".`);
    }
  }

  for (const enemy of source.enemies) {
    checkDuplicate(enemyIds, enemy.id, 'enemy');
    const where = `Enemy "${enemy.id}"`;
    const [min, max] = enemy.hp;
    if (!(min > 0 && max >= min)) errors.push(`${where}: hp must be [min, max] with 0 < min ≤ max.`);
    if (!(enemy.escapeStart > 0 && enemy.escapeAt >= enemy.escapeStart)) {
      errors.push(`${where}: escape bar must have 0 < escapeStart ≤ escapeAt.`);
    }
    if (!(enemy.escapeRate >= 0)) errors.push(`${where}: escapeRate must be ≥ 0.`);
    if (enemy.bondToFull !== undefined && !(Number.isInteger(enemy.bondToFull) && enemy.bondToFull > 0)) {
      errors.push(`${where}: bondToFull must be a whole number > 0.`);
    }
    if (!((enemy.breedChance ?? 0) >= 0 && (enemy.breedChance ?? 0) <= 1)) {
      errors.push(`${where}: breedChance must be between 0 and 1.`);
    }
    if (enemy.sprite && !(Number.isInteger(enemy.sprite.index) && enemy.sprite.index >= 1)) {
      errors.push(`${where}: sprite index must be a whole number ≥ 1.`);
    }
    checkTags(where, enemy.tags ?? []);
    const moveIds = new Set<string>();
    for (const move of enemy.moves) {
      if (moveIds.has(move.id)) errors.push(`${where}: duplicate move id "${move.id}".`);
      moveIds.add(move.id);
      checkEffects(`${where} move "${move.id}"`, move.effects);
    }
    const p = enemy.pattern;
    const referenced = p.type === 'sequence' ? p.moves : [...Object.keys(p.weights), ...(p.firstMove ? [p.firstMove] : [])];
    for (const id of referenced) {
      if (!moveIds.has(id)) errors.push(`${where}: pattern references unknown move "${id}".`);
    }
    if (p.type === 'sequence') {
      if (p.moves.length === 0) errors.push(`${where}: sequence pattern has no moves.`);
      const loopFrom = p.loopFrom ?? 0;
      if (loopFrom < 0 || loopFrom >= p.moves.length) errors.push(`${where}: loopFrom is out of range.`);
    } else if (!Object.values(p.weights).some((w) => w > 0)) {
      errors.push(`${where}: weighted pattern needs at least one positive weight.`);
    }
  }

  const encounterIds = new Set<string>();
  for (const encounter of source.encounters) {
    checkDuplicate(encounterIds, encounter.id, 'encounter');
    if (encounter.enemies.length === 0) errors.push(`Encounter "${encounter.id}" has no enemies.`);
    if (encounter.tier !== undefined && !(Number.isInteger(encounter.tier) && encounter.tier >= 1)) {
      errors.push(`Encounter "${encounter.id}": tier must be a whole number ≥ 1.`);
    }
    for (const id of encounter.enemies) {
      if (!enemyIds.has(id)) errors.push(`Encounter "${encounter.id}" references unknown enemy "${id}".`);
    }
  }
  if (source.encounters.length === 0) errors.push('There must be at least one encounter.');

  const eventIds = new Set<string>();
  for (const event of source.events) {
    checkDuplicate(eventIds, event.id, 'event');
    if (event.choices.length === 0) errors.push(`Event "${event.id}" has no choices.`);
  }

  const shopIds = new Set<string>();
  for (const item of source.shop) {
    checkDuplicate(shopIds, item.id, 'shop item');
    if (!(Number.isInteger(item.price) && item.price >= 0)) errors.push(`Shop item "${item.id}": price must be a whole number ≥ 0.`);
  }

  const bonusIds = new Set<string>();
  for (const bonus of source.companionBonuses) {
    checkDuplicate(bonusIds, bonus.id, 'companion bonus');
    const where = `Companion bonus "${bonus.id}"`;
    for (const effect of [...bonus.effects, ...bonus.fullSchool]) {
      if (effect.type === 'trigger') checkEffects(where, [effect.effect]);
      else if (!(effect.amount >= 0)) errors.push(`${where}: effect "${effect.type}" needs an amount ≥ 0.`);
    }
  }
  for (const enemy of source.enemies) {
    if (enemy.temperament !== undefined && !bonusIds.has(enemy.temperament)) {
      errors.push(`Enemy "${enemy.id}": no companion bonus for temperament "${enemy.temperament}".`);
    }
  }

  const buildIds = new Set<string>();
  for (const build of source.builds) {
    checkDuplicate(buildIds, build.id, 'build');
    const where = `Build "${build.id}"`;
    if (build.starterDeck.length === 0) errors.push(`${where}: starter deck is empty.`);
    for (const id of build.starterDeck) {
      if (!cardIds.has(id)) errors.push(`${where}: starter deck references unknown card "${id}".`);
    }
    checkTags(where, build.strongAgainst);
    for (const id of build.startingEquipment ?? []) {
      if (!equipmentIds.has(id)) errors.push(`${where}: starting equipment references unknown equipment "${id}".`);
    }
  }
  if (source.builds.length === 0) errors.push('There must be at least one build.');

  return errors;
}
