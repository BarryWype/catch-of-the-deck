import { HOLD_PER_PATIENCE, MAX_PATIENCE, PATIENCE_ESCAPE_PERCENT, STATUS_META, statusDescription, statusName, type StatusId } from '../engine';
import { t, term, type TextKey } from './i18n';
import type { TipContent } from './tooltip';

type Tip = Exclude<TipContent, string>;

/** A piece of text: plain, or a keyword with its explanation and, for some, an icon shown before it. */
export type TextPart = { text: string; tip?: Tip; icon?: string };

const WORDS = ['drain', 'strike', 'pull', 'exhaust', 'block', 'attack'] as const;

/** The icon (a file in assets/icons) shown before each keyword that has one. */
const ICONS: Partial<Record<string, string>> = {
  grit: 'muscle',
  hold: 'shield2',
  will: 'excape1',
  patience: 'coffee',
  drain: 'net-green',
  strike: 'bite1',
  pull: 'excape1',
  block: 'shield3',
  attack: 'hook-on-string',
  venom: 'venom1',
  strength: 'muscle-up',
  weak: 'muscle-down',
  slow: 'zzz',
};

/** Every keyword's spellings and its tooltip, built once (the language is fixed until reload). */
function buildKeywords(): { forms: string[]; tip: Tip; icon?: string }[] {
  const terms = (['grit', 'hold', 'will'] as const).map((name) => ({
    forms: [term(name)],
    tip: { title: term(name), body: t(`keywords.${name}.text`) },
    icon: ICONS[name],
  }));
  const patience = {
    forms: [term('patience')],
    tip: { title: term('patience'), body: t('combat.patienceTip', { hold: HOLD_PER_PATIENCE, percent: PATIENCE_ESCAPE_PERCENT, max: MAX_PATIENCE }) },
    icon: ICONS.patience,
  };
  const words = WORDS.map((name) => ({
    forms: t(`keywords.${name}.forms` as TextKey).split(',').map((f) => f.trim()),
    tip: { title: t(`keywords.${name}.forms` as TextKey).split(',')[0].trim(), body: t(`keywords.${name}.text` as TextKey) },
    icon: ICONS[name],
  }));
  const statuses = (Object.keys(STATUS_META) as StatusId[]).map((id) => ({
    forms: [statusName(id)],
    tip: { title: statusName(id), body: statusDescription(id) },
    icon: ICONS[id],
  }));
  return [...terms, patience, ...words, ...statuses];
}

let cache: { pattern: RegExp; tips: Map<string, { tip: Tip; icon?: string }> } | undefined;

/** The keywords in `text`, each with its tooltip. Whole words only, longest spelling first. */
export function splitKeywords(text: string): TextPart[] {
  if (!cache) {
    const tips = new Map<string, { tip: Tip; icon?: string }>();
    for (const { forms, tip, icon } of buildKeywords()) for (const form of forms) if (form && !tips.has(form)) tips.set(form, { tip, icon });
    const escaped = [...tips.keys()].sort((a, b) => b.length - a.length).map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    cache = { pattern: new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'gu'), tips };
  }
  const { pattern, tips } = cache;
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], ...tips.get(match[0]) });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
