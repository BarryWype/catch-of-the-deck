import { buildGameData, formatMessage, lookupMessage, setText, type MessageParams } from '../engine';
import { contentSource, gameData as englishGameData } from '../content';
import { localizeContent } from '../content/localize';
import { LANGUAGES, type LanguageCode, type Messages } from '../locales';

/**
 * The language the game is shown in. It's picked once at startup: the player's choice
 * (Options, kept per device), else the system's language if the game has it, else English.
 * Changing it reloads the page, so every text (content names included) is rebuilt in it.
 */
const STORAGE_KEY = 'catch-of-the-deck:language';

const isLanguage = (code: string | null | undefined): code is LanguageCode => !!code && code in LANGUAGES;

function initialLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Storage blocked: fall back to the system's language.
  }
  const system = navigator.language?.slice(0, 2);
  return isLanguage(system) ? system : 'en';
}

export const language: LanguageCode = initialLanguage();
const { messages, content } = LANGUAGES[language];
const plurals = new Intl.PluralRules(language);
setText(messages.engine, messages.terms, language);
document.documentElement.lang = language;

/** The game content, with names and descriptions in the current language. */
export const gameData = language === 'en' ? englishGameData : buildGameData(localizeContent(contentSource, content));

/** Every dotted key of the screens' text, e.g. 'menu.newRun'. */
type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type TextKey = Paths<Messages['ui']>;

/** Screen text at `key`, filled in with `params` (see the notes at the top of locales/en.ts). */
export function t(key: TextKey, params?: MessageParams): string {
  const template = lookupMessage(messages.ui, key) ?? lookupMessage(LANGUAGES.en.messages.ui, key) ?? key;
  return formatMessage(template, params, messages.terms, plurals);
}

/** One of the game's own words (Grit, Hold, Will…) in the current language. */
export function term(name: keyof Messages['terms']): string {
  return messages.terms[name];
}

/** Every language the game can be shown in, by code. */
export const languages = Object.entries(LANGUAGES).map(([code, l]) => ({ code: code as LanguageCode, name: l.name }));

/** Switch to another language: remembered on this device, applied by reloading. */
export function setLanguage(code: LanguageCode): void {
  if (code === language) return;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Storage blocked: after the reload, the system's language is used again.
  }
  location.reload();
}
