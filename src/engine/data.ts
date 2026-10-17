import type { BuildDef, CardDef, CharacterDef, CoastDef, CompanionBonusDef, CreatureTypeDef, FamilyDef, LevelDef, SpotDef, EncounterDef, EnemyDef, Effect, EquipmentDef, EventDef, GameData, ShopItemDef } from './types';

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
  families: FamilyDef[];
  spots: SpotDef[];
  /** In play order. */
  levels: LevelDef[];
  coast: CoastDef;
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
    families: Object.fromEntries(source.families.map((f) => [f.id, f])),
    spots: Object.fromEntries(source.spots.map((s) => [s.id, s])),
    levels: source.levels,
    coast: source.coast,
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
      if (e.type === 'slowCap' && !(e.amount > 0 && e.amount <= 100)) errors.push(`${where}: "slowCap" needs an amount between 1 and 100 (percent).`);
    }
  };

  for (const type of source.creatureTypes) checkDuplicate(typeIds, type.id, 'creature type');

  const equipmentIds = new Set<string>();
  for (const item of source.equipment) {
    checkDuplicate(equipmentIds, item.id, 'equipment');
    for (const effect of item.effects) {
      const value = 'percent' in effect ? effect.percent : effect.bonusPercent;
      if (!(value >= 0)) errors.push(`Equipment "${item.id}": effect "${effect.type}" needs a value ≥ 0.`);
      if (effect.type === 'extraCatch') {
        checkTags(`Equipment "${item.id}"`, effect.types);
        for (const spot of effect.spots ?? []) {
          if (!source.spots.some((s) => s.id === spot)) errors.push(`Equipment "${item.id}": unknown fishing spot "${spot}".`);
        }
      }
    }
  }

  for (const card of source.cards) {
    checkDuplicate(cardIds, card.id, 'card');
    const where = `Card "${card.id}"`;
    if (!Number.isInteger(card.cost) || card.cost < 0) errors.push(`${where}: cost must be a whole number ≥ 0.`);
    if (card.patienceCost !== undefined && !(Number.isInteger(card.patienceCost) && card.patienceCost > 0)) {
      errors.push(`${where}: patienceCost must be a whole number > 0.`);
    }
    checkEffects(where, card.effects);
    if (card.effects.some((e) => e.type === 'pull')) errors.push(`${where}: only creature moves can pull.`);
    const needsTarget = card.effects.some(
      (e) =>
        e.type === 'ifIntent' ||
        e.type === 'ifStatus' ||
        ((e.type === 'dealDamage' ||
          e.type === 'applyStatus' ||
          e.type === 'changeEscape' ||
          e.type === 'heal' ||
          e.type === 'multiplyStatus' ||
          e.type === 'flipIntent' ||
          e.type === 'rerollIntent' ||
          e.type === 'holdFromIntent' ||
          e.type === 'venomNow' ||
          e.type === 'swapHealthAndWill') &&
          (e.target ?? 'target') === 'target'),
    );
    if (needsTarget && card.target === 'none') {
      errors.push(`${where}: an effect hits the chosen target, so the card needs target: 'enemy' or 'random'.`);
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
      // Strikes deal damage and Pulls pull, and nothing else does.
      const effectType = move.tag === 'strike' ? 'dealDamage' : move.tag === 'pull' ? 'pull' : undefined;
      if (!effectType) errors.push(`${where} move "${move.id}": tag must be 'strike' or 'pull'.`);
      else if (!move.effects.some((e) => e.type === effectType)) errors.push(`${where} move "${move.id}": a ${move.tag} move needs a "${effectType}" effect.`);
      if (move.tag !== 'strike' && move.effects.some((e) => e.type === 'dealDamage')) errors.push(`${where} move "${move.id}": only Strikes deal damage.`);
      if (move.tag !== 'pull' && move.effects.some((e) => e.type === 'pull')) errors.push(`${where} move "${move.id}": only Pulls pull.`);
      if (!['light', 'normal', 'heavy'].includes(move.intensity)) errors.push(`${where} move "${move.id}": intensity must be light, normal or heavy.`);
      if (move.role === 'windUp' && !enemy.moves.some((m) => m.id === move.followUp)) errors.push(`${where} move "${move.id}": a Wind-up needs a \`followUp\` move.`);
      if (move.role === 'windUp' && !move.effects.some((e) => e.type === 'applyStatus' && e.status === 'windUp')) {
        errors.push(`${where} move "${move.id}": a Wind-up applies the windUp status to itself.`);
      }
    }
    for (const p of [enemy.pattern, ...(enemy.bossPattern ? [enemy.bossPattern] : [])]) {
      const referenced = p.type === 'sequence' ? p.moves : [...Object.keys(p.weights), ...(p.firstMove ? [p.firstMove] : [])];
      for (const id of referenced) {
        if (!moveIds.has(id)) errors.push(`${where}: pattern references unknown move "${id}".`);
      }
      const move = (id: string) => enemy.moves.find((m) => m.id === id);
      if (p.type === 'sequence') {
        if (p.moves.length === 0) errors.push(`${where}: sequence pattern has no moves.`);
        const loopFrom = p.loopFrom ?? 0;
        if (loopFrom < 0 || loopFrom >= p.moves.length) errors.push(`${where}: loopFrom is out of range.`);
        // Heavy moves come right after their Wind-up, and only then.
        p.moves.forEach((id, i) => {
          const prev = move(p.moves[(i + p.moves.length - 1) % p.moves.length]);
          if (prev?.role === 'windUp' && prev.followUp && prev.followUp !== id) errors.push(`${where}: "${prev.id}" must be followed by "${prev.followUp}".`);
          if (move(id)?.role === 'heavy' && prev?.role !== 'windUp') errors.push(`${where}: heavy move "${id}" only comes right after a Wind-up.`);
        });
      } else {
        if (!Object.values(p.weights).some((w) => w > 0)) errors.push(`${where}: weighted pattern needs at least one positive weight.`);
        for (const id of Object.keys(p.weights)) if (move(id)?.role === 'heavy') errors.push(`${where}: heavy move "${id}" can't have a weight (it follows its Wind-up).`);
      }
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
      if (effect.byStars?.some((n) => !(Number.isInteger(n) && n >= 0))) {
        errors.push(`${where}: effect "${effect.type}" needs whole numbers ≥ 0 in byStars.`);
      }
      if (effect.byStars && effect.type === 'trigger' && !('amount' in effect.effect)) {
        errors.push(`${where}: a trigger with byStars needs an effect with an amount.`);
      }
    }
    if (bonus.fullSchool.some((e) => e.byStars)) errors.push(`${where}: fullSchool effects aren't scaled, so they take no byStars.`);
  }
  for (const enemy of source.enemies) {
    if (enemy.temperament !== undefined && !bonusIds.has(enemy.temperament)) {
      errors.push(`Enemy "${enemy.id}": no companion bonus for temperament "${enemy.temperament}".`);
    }
  }

  const familyIds = new Set<string>();
  for (const family of source.families) {
    checkDuplicate(familyIds, family.id, 'family');
    for (const t of family.temperaments) {
      if (!bonusIds.has(t)) errors.push(`Family "${family.id}": unknown temperament "${t}".`);
    }
  }
  if (source.families.length) {
    const inAFamily = new Set(source.families.flatMap((f) => f.temperaments));
    for (const t of new Set(source.enemies.flatMap((e) => (e.temperament ? [e.temperament] : [])))) {
      if (!inAFamily.has(t)) errors.push(`Temperament "${t}" is in no family.`);
    }
  }
  for (const card of source.cards) {
    if (card.family !== undefined && !familyIds.has(card.family)) errors.push(`Card "${card.id}": unknown family "${card.family}".`);
  }

  validateLevels(source, typeIds, enemyIds, errors);

  const buildIds = new Set<string>();
  for (const build of source.builds) {
    checkDuplicate(buildIds, build.id, 'build');
    const where = `Build "${build.id}"`;
    if (build.starterDeck.length === 0) errors.push(`${where}: starter deck is empty.`);
    for (const id of build.starterDeck) {
      if (!cardIds.has(id)) errors.push(`${where}: starter deck references unknown card "${id}".`);
    }
    checkTags(where, build.strongAgainst);
    for (const id of build.startingItems ?? []) {
      if (!equipmentIds.has(id)) errors.push(`${where}: starting items reference unknown equipment "${id}".`);
    }
    if (build.level !== undefined && !source.levels.some((l) => l.id === build.level)) {
      errors.push(`${where}: unknown level "${build.level}".`);
    }
  }
  if (source.builds.length === 0) errors.push('There must be at least one build.');

  return errors;
}

/**
 * Hand-made levels must be playable maps: columns 1..N with the boss alone in the last one, one
 * mini-boss followed by at least two choices including a leave node, every node reachable from
 * the start, every link going forward, and every fight able to find its creatures. Generated
 * levels need their mini-boss, boss and escape, and the coast features valid spots.
 */
function validateLevels(source: ContentSource, typeIds: Set<string>, enemyIds: Set<string>, errors: string[]): void {
  const spotIds = new Set<string>();
  for (const spot of source.spots) {
    if (spotIds.has(spot.id)) errors.push(`Duplicate fishing spot id "${spot.id}".`);
    spotIds.add(spot.id);
    if (!spot.waters.length) errors.push(`Fishing spot "${spot.id}" has no waters.`);
    for (const type of spot.types ?? []) if (!typeIds.has(type)) errors.push(`Fishing spot "${spot.id}": unknown creature type "${type}".`);
  }
  if (source.levels.length === 0) errors.push('There must be at least one level.');
  const hasEvents = source.events.some((e) => !e.treasure);
  const hasTreasures = source.events.some((e) => e.treasure);

  const placeIds = new Set<string>();
  for (const place of source.coast.places) {
    const at = `Coast place "${place.id}"`;
    if (placeIds.has(place.id)) errors.push(`Duplicate coast place id "${place.id}".`);
    placeIds.add(place.id);
    if (place.visits.length > source.levels.length) errors.push(`${at}: more visits than levels.`);
    for (const visit of place.visits) if (visit && !spotIds.has(visit.spot)) errors.push(`${at}: unknown fishing spot "${visit.spot}".`);
  }

  const nodeIds = new Set<string>();
  for (const level of source.levels) {
    const where = `Level "${level.id}"`;
    if (!(Number.isInteger(level.tier) && level.tier >= 1)) errors.push(`${where}: tier must be a whole number ≥ 1.`);
    if (!(level.height > 0)) errors.push(`${where}: height must be > 0.`);
    if (!level.nodes) {
      if (!level.miniBoss || !level.boss || !level.escape) errors.push(`${where}: needs either nodes, or a miniBoss, a boss and an escape.`);
      for (const stop of level.firstColumn ?? []) if (!spotIds.has(stop.spot)) errors.push(`${where}: unknown fishing spot "${stop.spot}".`);
      for (const fight of [level.miniBoss, level.boss]) {
        for (const id of fight?.enemies ?? []) if (!enemyIds.has(id)) errors.push(`${where}: unknown enemy "${id}".`);
      }
      if (!hasEvents || !hasTreasures || !source.shop.length) errors.push(`${where}: generated maps need events, treasure events and a shop.`);
      continue;
    }
    const nodes = level.nodes;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const node of nodes) {
      if (nodeIds.has(node.id)) errors.push(`Duplicate map node id "${node.id}".`);
      nodeIds.add(node.id);
    }

    const lastColumn = Math.max(...nodes.map((n) => n.column));
    for (let column = 1; column <= lastColumn; column++) {
      if (!nodes.some((n) => n.column === column)) errors.push(`${where}: column ${column} has no node.`);
    }
    const bosses = nodes.filter((n) => n.kind === 'boss');
    if (bosses.length !== 1) errors.push(`${where}: needs exactly one boss.`);
    else if (nodes.some((n) => n.column === lastColumn && n.kind !== 'boss')) {
      errors.push(`${where}: the boss must be alone in the last column.`);
    }
    const miniBosses = nodes.filter((n) => n.kind === 'miniBoss');
    if (miniBosses.length !== 1) errors.push(`${where}: needs exactly one mini-boss.`);
    for (const miniBoss of miniBosses) {
      const after = miniBoss.next.map((id) => byId.get(id));
      if (after.length < 2 || !after.some((n) => n?.kind === 'leave')) {
        errors.push(`${where}: the mini-boss must lead to at least 2 nodes, one of them a leave node.`);
      }
    }

    for (const node of nodes) {
      const at = `${where} node "${node.id}"`;
      const ends = node.kind === 'boss' || node.kind === 'leave';
      if (ends && node.next.length) errors.push(`${at}: a ${node.kind} node can't lead anywhere.`);
      if (!ends && !node.next.length) errors.push(`${at}: leads nowhere.`);
      for (const id of node.next) {
        const target = byId.get(id);
        if (!target) errors.push(`${at}: links to unknown node "${id}" (links stay within a level).`);
        else if (target.column <= node.column) errors.push(`${at}: links back or sideways to "${id}".`);
      }
      if (node.kind === 'fight' || node.kind === 'miniBoss' || node.kind === 'boss') {
        for (const id of node.enemies ?? []) if (!enemyIds.has(id)) errors.push(`${at}: unknown enemy "${id}".`);
        if (!node.enemies?.length && !node.spot) errors.push(`${at}: a fight needs a spot or enemies.`);
        if (node.spot && !spotIds.has(node.spot)) errors.push(`${at}: unknown fishing spot "${node.spot}".`);
        if (node.creatureType && !typeIds.has(node.creatureType)) errors.push(`${at}: unknown creature type "${node.creatureType}".`);
      }
      if (node.kind === 'event' && !hasEvents) errors.push(`${at}: there are no events to meet.`);
      if (node.kind === 'treasure' && !hasTreasures) errors.push(`${at}: there are no treasure events.`);
      if (node.kind === 'shop' && !source.shop.length) errors.push(`${at}: the shop has nothing to sell.`);
    }

    // Everything must be reachable from the start, which leads to the first column.
    const reached = new Set(nodes.filter((n) => n.column === 1).map((n) => n.id));
    for (const node of [...nodes].sort((a, b) => a.column - b.column)) {
      if (reached.has(node.id)) for (const id of node.next) reached.add(id);
    }
    for (const node of nodes) if (!reached.has(node.id)) errors.push(`${where} node "${node.id}": can't be reached.`);
  }
}
