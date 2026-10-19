import type { BlessingDef, GameData, RunState } from '../engine';
import { t, type TextKey } from './i18n';

/** A blessing's text, with its numbers: the amount given, or its bonus's (a trigger's is its effect's). */
export function blessingText(blessing: BlessingDef | undefined): string {
  if (!blessing) return '';
  const e = blessing.effect;
  const bonus = e.type === 'bonus' ? (e.bonus.type === 'trigger' ? e.bonus.effect : e.bonus) : e;
  const n = ('amount' in bonus ? bonus.amount : undefined) ?? 0;
  return t(`store.blessing.${blessing.id}` as TextKey, { n, fights: e.type === 'bonus' ? e.fights : 0 });
}

export interface StoreEffectChip {
  key: string;
  icon: string;
  /** Fights left, or how many spare hooks. */
  badge?: number;
  title: string;
  body: string;
}

/**
 * What the run bought that's still waiting or working: each boon (espresso, a blessing) with its
 * fights left, the lucky lure and the spare hooks for the next card reward.
 */
export function storeEffectChips(run: RunState, data: GameData): StoreEffectChip[] {
  const byEffect = (type: string) => data.shop.find((i) => i.effect.type === type);
  const chips: StoreEffectChip[] = run.boons.map((boon, i) => {
    const item = data.shop.find((s) => s.id === boon.item);
    const blessing = data.blessings.find((b) => b.id === boon.blessing);
    const effect = item?.effect;
    const text = blessing
      ? blessingText(blessing)
      : effect?.type === 'maxHpForFights'
        ? t('shop.effect.maxHpForFights', { n: effect.amount, fights: effect.fights })
        : '';
    return {
      key: `boon${i}`,
      icon: blessing?.icon ?? item?.icon ?? '✨',
      badge: boon.fightsLeft,
      title: item?.name ?? '',
      body: `${text} ${t('shop.fightsLeft', { n: boon.fightsLeft })}`,
    };
  });
  const lure = byEffect('rareReward');
  if (run.luckyLure && lure) chips.push({ key: 'lure', icon: lure.icon ?? '✨', title: lure.name, body: t('shop.effect.rareReward') });
  const hook = byEffect('extraRewardCard');
  if (run.spareHooks && hook) {
    chips.push({ key: 'hooks', icon: hook.icon ?? '✨', badge: run.spareHooks, title: hook.name, body: t('shop.spareHooks', { n: run.spareHooks }) });
  }
  return chips;
}
