/**
 * Player-facing text. The engine only knows message keys: the words come from a language file
 * (src/locales), handed over by the UI with `setText` at startup.
 *
 * Templates (shared with the UI's `t`, see `formatMessage`):
 * - `{name}` is replaced by the `name` param.
 * - `{@grit}` is replaced by the language's term for it (`terms.grit`): the game's own words
 *   (Grit, Hold, Panic…) are named once per language.
 * - `one form|other form` picks a plural form from the `n` param, by the language's rules.
 */
export type MessageTable = { [key: string]: string | MessageTable };
export type MessageParams = Record<string, string | number>;

let messages: MessageTable = {};
let terms: Record<string, string> = {};
let plurals = new Intl.PluralRules('en');

/** The engine's messages (`engine` in a language file), the game's terms, and the language code. */
export function setText(engineMessages: MessageTable, termTable: Record<string, string>, language: string): void {
  messages = engineMessages;
  terms = termTable;
  plurals = new Intl.PluralRules(language);
}

/** The template at a dotted key (`describe.deal`), if there is one. */
export function lookupMessage(table: MessageTable, key: string): string | undefined {
  let node: string | MessageTable | undefined = table;
  for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined;
  return typeof node === 'string' ? node : undefined;
}

/** Fills in a template: plural form, then terms, then params. */
export function formatMessage(
  template: string,
  params: MessageParams = {},
  termTable: Record<string, string> = terms,
  rules: Intl.PluralRules = plurals,
): string {
  let text = template;
  if (text.includes('|')) {
    const [one, other = one] = text.split('|');
    text = typeof params.n === 'number' && rules.select(params.n) === 'one' ? one : other;
  }
  return text
    .replace(/\{@(\w+)\}/g, (_, name: string) => termTable[name] ?? name)
    .replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** The engine message at `key`, filled in. Falls back to the key itself, so a missing message shows. */
export function text(key: string, params?: MessageParams): string {
  const template = lookupMessage(messages, key);
  return template === undefined ? key : formatMessage(template, params);
}

/** One of the game's terms (Grit, Hold, Panic…) in the current language. */
export function term(name: string): string {
  return terms[name] ?? name;
}
