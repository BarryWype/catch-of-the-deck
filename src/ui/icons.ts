const files = import.meta.glob<string>('./assets/icons/*.png', { eager: true, query: '?url', import: 'default' });
const URLS: Record<string, string> = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.slice('./assets/icons/'.length, -'.png'.length), url]));

/** Emoji that have pixel art in assets/icons, and the file each one uses. */
const EMOJI: Record<string, string> = {
  '🏠': 'house', '🏡': 'house', '🪣': 'bucket', '📖': 'book', '📘': 'question-mark', '❓': 'question-mark',
  '🪙': 'coin-stack', '💰': 'coin-stack', '📦': 'chest', '🎁': 'chest', '⚡': 'lightning', '🛡️': 'shield2', '⚔️': 'sword',
  '💪': 'muscle', '🪝': 'hook', '💨': 'excape1', '🎣': 'rod1', '🎋': 'rod2', '🔱': 'harpoon', '🧵': 'hook-on-string',
  '🥅': 'net-green', '☕': 'coffee',
};

/** Hold's icon, shared by the keyword and the defense card type. */
export const HOLD_ICON = 'life-buoy';

/** Each card type's icon file. */
export const TYPE_ICONS = { attack: 'hook-on-string', drain: 'net-green', defense: HOLD_ICON, support: 'floater2', power: 'muscle', junk: 'thorn' } as const;

/** The image for an emoji or an icon file name (without `.png`), if there is one. */
export function iconUrl(icon: string): string | undefined {
  return URLS[EMOJI[icon] ?? icon];
}
