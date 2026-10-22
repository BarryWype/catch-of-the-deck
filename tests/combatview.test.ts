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
async function renderFight(hold = 0, spot?: string, compact = false, homeAquarium: { id: string; size: 'small'; bond: number }[] = []): Promise<string> {
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
    render: () => h(CombatView, { state, data, equipment: [], releaseReason: null, spot, homeAquarium, creatureBook: {}, unlocked: [], fishermenMet: [] }),
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

  it('shows the Grit globe in the corner panel under Patience, with Tension beside it, not under the player sprite, and no family icons', async () => {
    const html = await renderFight();
    const player = html.slice(html.indexOf('player-anchor'), html.indexOf('data-enemy-id'));
    expect(player).not.toContain('class="healthbar');
    expect(player).not.toContain('class="globe');
    expect(html.indexOf('class="resources"')).toBeLessThan(html.indexOf('class="patience"'));
    expect(html.indexOf('class="patience"')).toBeLessThan(html.indexOf('class="globe'));
    expect(html.indexOf('class="globe')).toBeLessThan(html.indexOf('class="tension"'));
    expect(html).not.toContain('class="family"');
  });

  it('shows the creature health inside its bar, and says when it escapes', async () => {
    const html = await renderFight();
    expect(/♥<\/span> \d+\/\d+/.test(html)).toBe(true);
    expect(/Escapes in \d+ turns?|Escapes next turn!/.test(html)).toBe(true);
  });

  it('shows Hold in the Grit globe, filling it from the top, not beside the player', async () => {
    const html = await renderFight(5);
    const globe = html.slice(html.indexOf('class="globe'), html.indexOf('class="tension"'));
    expect(globe).toMatch(/class="hold" style="height:6.25%;"/); // 5 Hold of 80 max Grit
    expect(globe).toMatch(/class="hold-value"[^>]*>.*5/s);
    expect(html).not.toContain('player-hold');
    // Its 6 Strike takes all 5 Hold (from the Hold's lower edge up), then 1 Grit, drawn right under the Hold.
    expect(globe).toMatch(/class="[^"]*loss[^"]*" style="top:0%;height:6.25%;"/);
    expect(globe).toMatch(/class="grit-preview" style="transform:translateY\(6.25%\);"/);
    expect(globe).toMatch(/class="[^"]*loss[^"]*" style="bottom:98.75%;height:1.25%;"/);
  });

  it('shows the intent: a Strike icon and its damage before Hold (the Grit bar shows what gets through)', async () => {
    const html = await renderFight(5);
    expect(html).toContain('Nip at the Lure');
    expect(html).toMatch(/<b[^>]*>6<\/b>/);
    expect(html).not.toContain('6 → 1');
    expect(html).not.toContain('class="pips"');
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

  it('marks a creature already in the home aquarium with a 🏠 badge, with the count past one', async () => {
    expect(await renderFight()).not.toContain('badge home');
    const one = await renderFight(0, undefined, false, [{ id: 'creature', size: 'small', bond: 0 }]);
    expect(one).toMatch(/class="badge home"[^>]*aria-label="1 in your home aquarium\."/);
    const two = await renderFight(0, undefined, false, [{ id: 'creature', size: 'small', bond: 0 }, { id: 'creature', size: 'small', bond: 0 }]);
    const badge = (html: string) => html.slice(html.indexOf('class="badge home"'), html.indexOf('</span>', html.indexOf('class="badge home"')));
    expect(badge(one)).not.toMatch(/>\d</);
    expect(badge(two)).toMatch(/>2</);
  });

  it('leaves the turn counter to the top bar', async () => {
    const html = await renderFight();
    expect(html).not.toContain('class="turn"');
  });

  it('goes compact: smaller sprite frames, the player still on the bank against one creature', async () => {
    const html = await renderFight(0, undefined, true);
    expect(html).toContain('class="raised player-anchor"'); // one creature: room on the bank
    expect(html).toContain('width:144px'); // the tier-2 creature: 3 frames of 48px
    expect(html).toContain('width:96px'); // the player: 2 frames
  });
});

describe('PowerList', () => {
  it("shows this turn's buffs and waiting effects as chips, with their number or the turns left", async () => {
    const { default: PowerList } = await import('../src/ui/PowerList.vue');
    const { createCombat } = await import('../src/engine');
    const { gameData } = await import('../src/content');
    const state = createCombat({ seed: 1, deck: [...gameData.builds.rod.starterDeck], enemies: ['progenetica'], playerHp: 80, playerMaxHp: 80 }, gameData);
    state.thisTurn = { coiled: true, venomCoating: 2 };
    state.delayed = [{ turnsLeft: 3, effects: [{ type: 'changeEscape', amount: -6 }], targetId: state.enemies[0].id }];
    const app = createSSRApp({ render: () => h(PowerList, { state, data: gameData }) });
    app.directive('tip', { getSSRProps: () => ({}) });
    const html = await renderToString(app);
    expect(html.match(/class="power temporary"/g)).toHaveLength(3);
    expect(html).toContain('🐍'); // Coiled's art
    expect(html).toMatch(/>2<\/b>/); // Toxic Coating's Venom
    expect(html).toContain('🦐'); // Mussel Bait's art
    expect(html).toMatch(/>3<\/b>/); // turns left
  });
});
