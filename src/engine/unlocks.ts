import { CATCH_SIZES, type CatchSize } from './sizes';
import { text } from './text';
import type { BuildDef, GameData, QuestCondition } from './types';

/**
 * Builds locked behind a fisherman's quest (`BuildDef.unlock`). The player meets the fisherman on
 * the map, then the build unlocks at the end of any successful run (heading home, ending the run
 * after a boss, or beating the last boss) once the quest is met: never mid-run, nor on a lost run.
 * A home quest (`speciesAtHome`) is checked then; a bucket quest (`inBucket`) when the player meets
 * the fisherman, kept in `RunState.questsShown`, so losing the creatures afterwards doesn't undo it.
 * The profile keeps the builds unlocked and the fishermen met.
 */

/** Builds that can start a run (`startingBuilds`) and are unlocked: no `unlock`, or listed in `unlocked`. */
export function unlockedBuilds(data: GameData, unlocked: readonly string[]): BuildDef[] {
  const first = data.levels[0]?.id;
  return Object.values(data.builds).filter((b) => (b.level ?? first) === first && (!b.unlock || unlocked.includes(b.id)));
}

/** Fishermen to place on this run's maps: those teaching a build still locked. */
export function fishermenToMeet(data: GameData, unlocked: readonly string[]): string[] {
  const ids = Object.values(data.builds)
    .filter((b) => b.unlock && !unlocked.includes(b.id))
    .map((b) => b.unlock!.fisherman);
  return [...new Set(ids)];
}

/** Creatures as a quest counts them: the home aquarium's, or a bucket's. */
type Creatures = readonly { id: string; size?: CatchSize }[];

/** Whether one creature counts towards a quest. */
function counts(quest: QuestCondition, creature: Creatures[number], data: GameData): boolean {
  const def = data.enemies[creature.id];
  switch (quest.type) {
    case 'speciesAtHome':
      return !!def?.tags?.some((tag) => quest.creatureTypes.includes(tag));
    case 'inBucket':
      return (
        !!def &&
        (quest.temperament === undefined || def.temperament === quest.temperament) &&
        (quest.water === undefined || def.water === quest.water) &&
        (quest.size === undefined || CATCH_SIZES.indexOf(creature.size ?? 'small') >= CATCH_SIZES.indexOf(quest.size))
      );
  }
}

/** How far `creatures` (the home aquarium, or the bucket for `inBucket`) are towards a quest, capped at what it needs. */
export function questProgress(quest: QuestCondition, creatures: Creatures, data: GameData): { have: number; need: number } {
  const species = new Set(creatures.filter((c) => counts(quest, c, data)).map((c) => c.id));
  return { have: Math.min(species.size, quest.count), need: quest.count };
}

export function isQuestMet(quest: QuestCondition, creatures: Creatures, data: GameData): boolean {
  const { have, need } = questProgress(quest, creatures, data);
  return have >= need;
}

/** Builds `fisherman` teaches whose bucket quest `bucket` meets: shown to him when the player meets him. */
export function questsShownTo(data: GameData, fisherman: string, bucket: Creatures): string[] {
  return Object.values(data.builds)
    .filter((b) => b.unlock?.fisherman === fisherman && b.unlock.quest.type === 'inBucket' && isQuestMet(b.unlock.quest, bucket, data))
    .map((b) => b.id);
}

/** The quests open right now: locked builds whose fisherman has been met. */
export function openQuests(data: GameData, unlocked: readonly string[], met: readonly string[]): BuildDef[] {
  return Object.values(data.builds).filter((b) => b.unlock && !unlocked.includes(b.id) && met.includes(b.unlock.fisherman));
}

/**
 * Builds a successful run unlocks: open quests met by `home` (the home aquarium once the bucket has
 * joined it), or, for bucket quests, in `shown` (the run's `questsShown`).
 */
export function newUnlocks(data: GameData, unlocked: readonly string[], met: readonly string[], home: Creatures, shown: readonly string[] = []): string[] {
  return openQuests(data, unlocked, met)
    .filter((b) => (b.unlock!.quest.type === 'inBucket' ? shown.includes(b.id) : isQuestMet(b.unlock!.quest, home, data)))
    .map((b) => b.id);
}

/** What a quest asks for, in the player's words. */
export function describeQuest(quest: QuestCondition, data: GameData): string {
  switch (quest.type) {
    case 'speciesAtHome': {
      const types = quest.creatureTypes.map((id) => data.creatureTypes[id]?.name ?? id);
      const list = types.length > 1 ? `${types.slice(0, -1).join(', ')}${text('quest.or')}${types.at(-1)}` : types.join('');
      return text('quest.speciesAtHome', { n: quest.count, types: list });
    }
    case 'inBucket': {
      const kind = text('quest.kind', {
        size: quest.size ? text(`quest.size.${quest.size}`) : '',
        water: quest.water ? text(`quest.water.${quest.water}`) : '',
        temperament: quest.temperament ? (data.companionBonuses[quest.temperament]?.temperamentName ?? quest.temperament).toLowerCase() : '',
      })
        .replace(/\s+/g, ' ')
        .trim();
      return text(quest.count > 1 ? 'quest.inBucket' : 'quest.inBucketOne', { n: quest.count, kind });
    }
  }
}
