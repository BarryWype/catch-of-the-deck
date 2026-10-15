import { HOLD_PER_PATIENCE, MAX_PATIENCE, PATIENCE_ESCAPE_PERCENT, STATUS_META, statusDescription, statusName, type StatusId } from '../engine';
import { t, term, type TextKey } from './i18n';
import type { TipContent } from './tooltip';

/** A piece of text: plain, or a keyword with its explanation. */
export type TextPart = { text: string; tip?: Exclude<TipContent, string> };

const WORDS = ['drain', 'strike', 'pull', 'exhaust', 'block'] as const;

/** Every keyword's spellings and its tooltip, built once (the language is fixed until reload). */
function buildKeywords(): { forms: string[]; tip: Exclude<TipContent, string> }[] {
  const terms = (['grit', 'hold', 'will'] as const).map((name) => ({ forms: [term(name)], tip: { title: term(name), body: t(`keywords.${name}.text`) } }));
  const patience = {
    forms: [term('patience')],
    tip: { title: term('patience'), body: t('combat.patienceTip', { hold: HOLD_PER_PATIENCE, percent: PATIENCE_ESCAPE_PERCENT, max: MAX_PATIENCE }) },
  };
  const words = WORDS.map((name) => ({
    forms: t(`keywords.${name}.forms` as TextKey).split(',').map((f) => f.trim()),
    tip: { title: t(`keywords.${name}.forms` as TextKey).split(',')[0].trim(), body: t(`keywords.${name}.text` as TextKey) },
  }));
  const statuses = (Object.keys(STATUS_META) as StatusId[]).map((id) => ({ forms: [statusName(id)], tip: { title: statusName(id), body: statusDescription(id) } }));
  return [...terms, patience, ...words, ...statuses];
}

let cache: { pattern: RegExp; tips: Map<string, Exclude<TipContent, string>> } | undefined;

/** The keywords in `text`, each with its tooltip. Whole words only, longest spelling first. */
export function splitKeywords(text: string): TextPart[] {
  if (!cache) {
    const tips = new Map<string, Exclude<TipContent, string>>();
    for (const { forms, tip } of buildKeywords()) for (const form of forms) if (form && !tips.has(form)) tips.set(form, tip);
    const escaped = [...tips.keys()].sort((a, b) => b.length - a.length).map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    cache = { pattern: new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'gu'), tips };
  }
  const { pattern, tips } = cache;
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], tip: tips.get(match[0]) });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
