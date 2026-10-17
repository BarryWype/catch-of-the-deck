import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

// CombatView's module tree reads these at import and setup; the test has no DOM.
let compactMatches = false;
vi.stubGlobal('window', {
  innerHeight: 800,
  matchMedia: () => ({ matches: compactMatches, addEventListener: () => {}, removeEventListener: () => {} }),
});
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('navigator', { language: 'en' });
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });

/** The fight screen's HTML: the real content, a fight against a schooling creature. */
async function renderFight(hold = 0, spot?: string, compact = false): Promise<string> {
  compactMatches = compact;
  const { default: CombatView } = await import('../src/ui/CombatView.vue');
  const { createCombat } = await import('../src/engine');
  const { gameData } = await import('../src/content');
  // A creature whose one move is a heavy 6-damage Strike, so the intent's numbers are known.
  const creature = {
    ...gameData.enemies.progenetica,
    id: 'creature',
    tier: 2,
    hp: [20, 20] as [number, number],
    escapeAt: 100,
    escapeStart: 50,
    escapeRate: 5,
    moves: [
      { id: 'nip', name: 'Nip at the Lure', tag: 'strike' as const, intensity: 'heavy' as const, effects: [{ type: 'dealDamage' as const, amount: 6 }] },
    ],
    pattern: { type: 'sequence' as const, moves: ['nip'] },
  };
  const data = { ...gameData, enemies: { ...gameData.enemies, creature } };
  const state = createCombat(
    { seed: 1, deck: [...gameData.builds.rod.starterDeck], enemies: ['creature'], playerHp: 80, playerMaxHp: 80 },
    data,
  );
  state.player.block = hold;
  // `v-tip` is a client directive; the server render only needs it to resolve to nothing.
  const app = createSSRApp({
    render: () => h(CombatView, { state, data, equipment: [], newEggs: 0, releaseReason: null, spot }),
  });
  app.directive('tip', { getSSRProps: () => ({}) });
  return renderToString(app);
}

describe('CombatView', () => {
  it('lays the creature column out: intent, then one block of name, Will, health and statuses above the sprite', async () => {
    const html = await renderFight();
    const creature = html.slice(html.indexOf('data-enemy-id'));
    const at = (marker: string) => creature.indexOf(marker);
    expect(at('class="intent-slot"')).toBeLessThan(at('class="hud"'));
    expect(at('class="hud"')).toBeLessThan(at('class="name"'));
    expect(at('class="name"')).toBeLessThan(at('class="panicbar'));
    expect(at('class="panicbar')).toBeLessThan(at('class="healthbar"'));
    expect(at('class="healthbar"')).toBeLessThan(at('class="statuses"'));
    expect(at('class="statuses"')).toBeLessThan(at('class="portrait"'));
  });

  it('shows the Grit bar in the corner panel, not under the player sprite, and the families as icons', async () => {
    const html = await renderFight();
    const player = html.slice(html.indexOf('player-anchor'), html.indexOf('data-enemy-id'));
    expect(player).not.toContain('class="healthbar');
    expect(html.indexOf('class="resources"')).toBeLessThan(html.indexOf('class="healthbar grit"'));
    expect(html.indexOf('class="healthbar grit"')).toBeLessThan(html.indexOf('class="orbs"'));
    const icons = html.match(/class="family"[^>]*>([^<]*)</g) ?? [];
    expect(icons).toHaveLength(2);
    expect(icons.join(' ')).toContain('🏃'); // Swift
    expect(icons.join(' ')).toContain('🎭'); // Trickster
  });

  it('shows the creature health inside its bar, and says when it escapes', async () => {
    const html = await renderFight();
    expect(/♥ \d+\/\d+/.test(html)).toBe(true);
    expect(/Escapes in \d+ turns?|Escapes next turn!/.test(html)).toBe(true);
  });

  it('shows the intent: a Strike icon, damage after Hold, and intensity pips', async () => {
    const html = await renderFight(5);
    expect(html).toContain('Nip at the Lure');
    expect(html).toContain('6 → 1'); // 6 damage, 5 Hold soaks all but 1
    expect(html).toContain('class="pips"');
    const pipsSpan = html.slice(html.indexOf('class="pips"'), html.indexOf('class="pips"') + 160);
    expect((pipsSpan.match(/<i /g) ?? []).length).toBe(3); // heavy: three pips
    const blocked = await renderFight(10);
    expect(blocked).toContain('6 → 0');
    expect(blocked).toContain('class="blocked"'); // Hold covers it all
  });

  it('dresses the scene: water tint, surface line, the spot colour, and the player on the bank', async () => {
    const html = await renderFight(0, 'RP'); // Rock pools: #3E8C83
    expect(html).toContain('class="water-tint"');
    expect(html).toContain('class="surface-line"');
    expect(html).toContain('class="raised player-anchor"');
    expect(html).toContain('--spot:#3E8C83');
  });

  it('sizes sprites by tier: a tier-2 creature (240px) stands bigger than the player (192px)', async () => {
    const html = await renderFight();
    expect(html).toContain('width:240px');
    expect(html).toContain('width:192px');
  });

  it('shows the turn counter', async () => {
    const html = await renderFight();
    expect(html).toContain('Turn 1');
  });

  it('goes compact: smaller sprite frames, the player still on the bank against one creature', async () => {
    const html = await renderFight(0, undefined, true);
    expect(html).toContain('class="raised player-anchor"'); // one creature: room on the bank
    expect(html).toContain('width:144px'); // the tier-2 creature: 3 frames of 48px
    expect(html).toContain('width:96px'); // the player: 2 frames
  });
});
