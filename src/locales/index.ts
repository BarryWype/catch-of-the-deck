import type { ContentTranslations } from '../content/localize';
import { en, type Messages } from './en';
import { fr } from './fr';
import { frContent } from './fr-content';

/**
 * The languages the game can be played in. To add one: copy en.ts to `<code>.ts` and translate
 * it, translate the content in `<code>-content.ts` (see fr-content.ts), and list it here.
 */
export const LANGUAGES = {
  en: { name: 'English', messages: en, content: {} as ContentTranslations },
  fr: { name: 'Français', messages: fr, content: frContent },
} satisfies Record<string, { name: string; messages: Messages; content: ContentTranslations }>;

export type LanguageCode = keyof typeof LANGUAGES;
export type { Messages };
