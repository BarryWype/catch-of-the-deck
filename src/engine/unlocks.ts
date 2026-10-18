import { text } from './text';
import type { BuildDef, GameData, QuestCondition } from './types';

/**
 * Builds locked behind a fisherman's quest (`BuildDef.unlock`). The player meets the fisherman on
 * the map, then the build unlocks at the end of any successful run (heading home, ending the run
 * after a boss, or beating the last boss) once the quest is met: never mid-run, nor on a lost run.
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
type Creatures = readonly { id: string }[];

/** How far `home` is towards a quest, capped at what it needs. */
export function questProgress(quest: QuestCondition, home: Creatures, data: GameData): { have: number; need: number } {
  switch (quest.type) {
    case 'speciesAtHome': {
      const species = new Set(
        home.filter((c) => data.enemies[c.id]?.tags?.some((tag) => quest.creatureTypes.includes(tag))).map((c) => c.id),
      );
      return { have: Math.min(species.size, quest.count), need: quest.count };
    }
  }
}

export function isQuestMet(quest: QuestCondition, home: Creatures, data: GameData): boolean {
  const { have, need } = questProgress(quest, home, data);
  return have >= need;
}

/** The quests open right now: locked builds whose fisherman has been met. */
export function openQuests(data: GameData, unlocked: readonly string[], met: readonly string[]): BuildDef[] {
  return Object.values(data.builds).filter((b) => b.unlock && !unlocked.includes(b.id) && met.includes(b.unlock.fisherman));
}

/** Builds a successful run unlocks: open quests met by `home`, the home aquarium once the bucket has joined it. */
export function newUnlocks(data: GameData, unlocked: readonly string[], met: readonly string[], home: Creatures): string[] {
  return openQuests(data, unlocked, met)
    .filter((b) => isQuestMet(b.unlock!.quest, home, data))
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
  }
}
