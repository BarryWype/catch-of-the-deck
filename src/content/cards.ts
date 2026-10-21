import type { CardDef } from '../engine';

/**
 * Every card in the game. Rules text is generated from `effects` (set `description` to override
 * it). See README → "Adding a card".
 *
 * - `type`: 'attack' | 'defense' | 'drain' | 'support' | 'power'. Attack and Drain cards count as
 *   attacks for the rules that count them. Powers leave play and last the whole fight.
 * - `rarity`: 'normal' | 'rare'.
 * - `family` (families.ts): creatures of that family offer it as a reward. Starter cards have none
 *   and are never offered.
 * - `target`: 'enemy' (dragged onto a creature), 'random' (a random creature), or 'none'.
 * - `patienceCost`: Patience it costs on top of its energy `cost`.
 * - `tags`: what it's about, stored for later.
 * The full list and the rules behind it are in CARD_REWORK.md.
 */
export const cards: CardDef[] = [
  // --- Starter ------------------------------------------------------------------
  { id: 'tug', name: 'Tug', art: '🎣', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', tags: ['damage'], effects: [{ type: 'dealDamage', amount: 5 }] },
  { id: 'holdTight', name: 'Hold Tight', art: '✊', type: 'defense', rarity: 'normal', cost: 1, target: 'none', tags: ['hold'], effects: [{ type: 'gainBlock', amount: 5 }] },
  {
    id: 'steadyHand', name: 'Steady Hand', art: '🫴', type: 'attack', rarity: 'normal', cost: 1, patienceCost: 2, target: 'enemy',
    tags: ['damage', 'patience'], effects: [{ type: 'dealDamage', amount: 10 }],
  },
  {
    id: 'reelIn', name: 'Reel In', art: '🧵', type: 'drain', rarity: 'normal', cost: 1, target: 'enemy', tags: ['drain', 'intent', 'conditional'],
    effects: [{ type: 'ifIntent', tag: 'strike', then: [{ type: 'changeEscape', amount: -4 }], else: [{ type: 'changeEscape', amount: -7 }] }],
  },
  {
    id: 'brace', name: 'Brace', art: '🧍', type: 'defense', rarity: 'normal', cost: 1, target: 'enemy', tags: ['hold', 'drain', 'intent', 'conditional'],
    effects: [{ type: 'gainBlock', amount: 5 }, { type: 'ifIntent', tag: 'pull', then: [{ type: 'changeEscape', amount: -3 }] }],
  },
  { id: 'slackLine', name: 'Slack Line', art: '🎐', type: 'support', rarity: 'normal', cost: 1, target: 'enemy', tags: ['slow'], effects: [{ type: 'applyStatus', status: 'slow', amount: 3 }] },
  {
    id: 'playTheLine', name: 'Play the Line', art: '🪢', type: 'drain', rarity: 'normal', cost: 1, patienceCost: 2, target: 'enemy',
    tags: ['drain', 'slow', 'patience'], effects: [{ type: 'changeEscape', amount: -12 }, { type: 'applyStatus', status: 'slow', amount: 2 }],
  },
  {
    id: 'throwTheNet', name: 'Throw the Net', art: 'net-blue', type: 'attack', rarity: 'normal', cost: 1, target: 'none',
    tags: ['damage'], effects: [{ type: 'dealDamage', amount: 3, target: 'allEnemies' }],
  },
  {
    id: 'drawTheNet', name: 'Draw the Net', art: '🥅', type: 'drain', rarity: 'normal', cost: 1, target: 'none',
    tags: ['drain'], effects: [{ type: 'changeEscape', amount: -3, target: 'allEnemies' }],
  },
  { id: 'waitForTheRise', name: 'Wait for the Rise', art: 'floater1', type: 'support', rarity: 'normal', cost: 1, target: 'none', tags: ['patience'], effects: [{ type: 'gainPatience', amount: 2 }] },
  {
    id: 'perfectCast', name: 'Perfect Cast', art: 'lure1', type: 'attack', rarity: 'normal', cost: 0, patienceCost: 3, target: 'enemy',
    tags: ['damage', 'drain', 'patience'], effects: [{ type: 'dealDamage', amount: 6 }, { type: 'changeEscape', amount: -6 }],
  },

  // --- Shell ----------------------------------------------------------------------
  {
    id: 'hardShell', name: 'Hard Shell', art: '🛡️', type: 'power', rarity: 'rare', cost: 2, target: 'none', family: 'shell', tags: ['hold'],
    effects: [{ type: 'power', power: 'hardShell' }],
  },
  {
    id: 'bareTeeth', name: 'Bare Teeth', art: '😬', type: 'defense', rarity: 'normal', cost: 1, target: 'random', family: 'shell', tags: ['hold', 'intent'],
    effects: [{ type: 'applyStatus', status: 'intimidated', amount: 1 }, { type: 'gainBlock', amount: 3 }],
  },
  {
    id: 'thickShell', name: 'Thick Shell', art: '🦪', type: 'defense', rarity: 'normal', cost: 1, patienceCost: 1, target: 'none', family: 'shell',
    tags: ['hold', 'patience', 'delayed'], effects: [{ type: 'gainBlock', amount: 4 }, { type: 'delayed', turns: 2, effects: [{ type: 'gainBlock', amount: 4 }] }],
  },
  {
    id: 'weatherTheStorm', name: 'Weather the Storm', art: '⛈️', type: 'defense', rarity: 'normal', cost: 0, patienceCost: 4, target: 'none', family: 'shell',
    tags: ['hold', 'patience', 'delayed'], effects: [{ type: 'gainBlock', amount: 10 }, { type: 'delayed', turns: 1, effects: [{ type: 'gainBlock', amount: 10 }] }],
  },
  {
    id: 'shellUp', name: 'Shell Up', art: '🐚', type: 'defense', rarity: 'normal', cost: 1, target: 'none', family: 'shell', tags: ['hold'],
    effects: [{ type: 'gainBlock', amount: 6 }, { type: 'keepHold' }],
  },
  { id: 'steadyFooting', name: 'Steady Footing', art: '🥾', type: 'defense', rarity: 'normal', cost: 2, target: 'none', family: 'shell', tags: ['hold'], effects: [{ type: 'gainBlock', amount: 12 }] },
  {
    id: 'atTheLimit', name: 'At the Limit', art: '🧗', type: 'defense', rarity: 'normal', cost: 0, target: 'none', family: 'shell', tags: ['hold', 'drain', 'tension', 'conditional'],
    effects: [{ type: 'ifTension', tension: 'full', then: [{ type: 'gainBlock', amount: 6 }, { type: 'changeEscape', amount: -4, target: 'randomEnemy' }] }],
  },

  // --- Venom ----------------------------------------------------------------------
  {
    id: 'stingsAndSpines', name: 'Stings and Spines', art: '🌵', type: 'power', rarity: 'rare', cost: 2, target: 'none', family: 'venom', tags: ['venom', 'drain'],
    effects: [{ type: 'power', power: 'stingsAndSpines', amount: 2 }],
  },
  {
    id: 'envenomedHooks', name: 'Envenomed Hooks', art: '🪝', type: 'power', rarity: 'rare', cost: 1, target: 'none', family: 'venom', tags: ['venom'],
    effects: [{ type: 'power', power: 'envenomedHooks', amount: 1 }],
  },
  {
    id: 'painWithTheTide', name: 'Pain Comes with the Tide', art: '🌊', type: 'support', rarity: 'normal', cost: 1, patienceCost: 1, target: 'random', family: 'venom',
    tags: ['venom', 'patience'], effects: [{ type: 'venomNow' }],
  },
  {
    id: 'toxicDread', name: 'Toxic Dread', art: '☠️', type: 'support', rarity: 'rare', cost: 2, target: 'random', family: 'venom', tags: ['venom'],
    effects: [{ type: 'multiplyStatus', status: 'venom', factor: 2, max: 10 }, { type: 'venomBonus', amount: 3 }],
  },
  { id: 'toxicCoating', name: 'Toxic Coating', art: '🧪', type: 'support', rarity: 'rare', cost: 1, target: 'none', family: 'venom', tags: ['venom'], effects: [{ type: 'venomCoating', amount: 2 }] },
  {
    id: 'sting', name: 'Sting', art: '🐝', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'venom', tags: ['damage', 'venom'],
    effects: [{ type: 'dealDamage', amount: 2 }, { type: 'applyStatus', status: 'venom', amount: 3 }],
  },
  {
    id: 'numbingSting', name: 'Numbing Sting', art: '💉', type: 'support', rarity: 'normal', cost: 1, target: 'random', family: 'venom', tags: ['venom', 'slow'],
    effects: [{ type: 'applyStatus', status: 'venom', amount: 2 }, { type: 'applyStatus', status: 'slow', amount: 2 }],
  },
  {
    id: 'venomBarb', name: 'Venom Barb', art: '🪝', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'venom', tags: ['damage', 'venom'],
    effects: [{ type: 'dealDamage', amount: 6 }, { type: 'applyStatus', status: 'venom', amount: 2 }],
  },
  {
    id: 'lunge', name: 'Lunge', art: '🦂', type: 'attack', rarity: 'normal', cost: 1, patienceCost: 2, target: 'enemy', family: 'venom', tags: ['damage', 'venom', 'patience'],
    effects: [{ type: 'dealDamage', amount: 8 }, { type: 'applyStatus', status: 'venom', amount: 3 }],
  },

  // --- Hunter ---------------------------------------------------------------------
  { id: 'coiled', name: 'Coiled', art: '🐍', type: 'support', rarity: 'normal', cost: 1, target: 'none', family: 'hunter', tags: ['damage', 'drain'], effects: [{ type: 'coil' }] },
  {
    id: 'severeBite', name: 'Severe Bite', art: '🦷', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', family: 'hunter', tags: ['damage', 'delayed'],
    effects: [{ type: 'dealDamage', amount: 8 }, { type: 'echoDamage', share: 0.5 }],
  },
  {
    id: 'seizeTheLull', name: 'Seize the Lull', art: '🌊', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'hunter', tags: ['damage', 'slow'],
    effects: [{ type: 'dealDamage', amount: 6, perStatus: { status: 'slow', amount: 2 } }],
  },
  {
    id: 'rightTiming', name: 'Right Timing', art: '⏱️', type: 'attack', rarity: 'normal', cost: 1, patienceCost: 2, target: 'enemy', family: 'hunter',
    tags: ['damage', 'drain', 'patience'], effects: [{ type: 'dealDamage', amount: 7 }, { type: 'changeEscape', amount: -7 }],
  },
  {
    id: 'savageBite', name: 'Savage Bite', art: '🦈', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'hunter', tags: ['damage', 'tradeoff'],
    effects: [{ type: 'dealDamage', amount: 10 }, { type: 'changeEscape', amount: 6 }],
  },
  {
    id: 'noFightLeft', name: 'No Fight Left', art: '🏳️', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'hunter', tags: ['damage', 'conditional'],
    effects: [{ type: 'ifBelow', bar: 'will', part: 3, then: [{ type: 'dealDamage', amount: 10 }], else: [{ type: 'dealDamage', amount: 5 }] }],
  },
  {
    id: 'tautLine', name: 'Taut Line', art: '🪢', type: 'attack', rarity: 'normal', cost: 0, target: 'enemy', family: 'hunter', tags: ['damage', 'tension'],
    effects: [{ type: 'dealDamage', amount: 0, perTension: 3 }],
  },

  // --- Swift ----------------------------------------------------------------------
  {
    id: 'baitBall', name: 'Bait Ball', art: '🐟', type: 'power', rarity: 'rare', cost: 1, target: 'none', family: 'swift', tags: ['drain'],
    effects: [{ type: 'power', power: 'baitBall', amount: 3 }],
  },
  {
    id: 'callAMate', name: 'Call a Mate', art: '📣', type: 'defense', rarity: 'normal', cost: 0, patienceCost: 2, target: 'none', family: 'swift',
    tags: ['hold', 'patience', 'delayed'], effects: [{ type: 'delayed', turns: 1, effects: [{ type: 'gainBlock', amount: 8 }] }],
  },
  {
    id: 'dartingNips', name: 'Darting Nips', art: '🐟', type: 'attack', rarity: 'normal', cost: 1, target: 'none', family: 'swift', tags: ['damage', 'multihit'],
    effects: [{ type: 'dealDamage', amount: 2, hits: 4, target: 'randomEnemy' }],
  },
  {
    id: 'mirrorImage', name: 'Mirror Image', art: '🪞', type: 'defense', rarity: 'normal', cost: 1, target: 'none', family: 'swift', tags: ['hold', 'draw'],
    effects: [{ type: 'gainBlock', amount: 5 }, { type: 'drawCards', amount: 1 }],
  },
  {
    id: 'dartingBites', name: 'Darting Bites', art: '🐠', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'swift', tags: ['damage', 'multihit', 'draw'],
    effects: [{ type: 'dealDamage', amount: 2, hits: 3 }, { type: 'drawCards', amount: 1 }],
  },
  {
    id: 'quickFlick', name: 'Quick Flick', art: '💨', type: 'attack', rarity: 'normal', cost: 0, target: 'enemy', family: 'swift', tags: ['damage', 'draw'],
    effects: [{ type: 'dealDamage', amount: 3 }, { type: 'drawCards', amount: 1 }],
  },
  {
    id: 'safetyInNumbers', name: 'Safety in Numbers', art: '🐡', type: 'defense', rarity: 'normal', cost: 1, target: 'none', family: 'swift', tags: ['hold', 'draw'],
    effects: [{ type: 'gainBlock', amount: 4 }, { type: 'drawCards', amount: 2 }],
  },
  { id: 'checkTheBait', name: 'Check the Bait', art: '🔍', type: 'support', rarity: 'normal', cost: 0, target: 'none', family: 'swift', tags: ['draw'], effects: [{ type: 'pickFromDraw', look: 3 }] },

  // --- Endurance ------------------------------------------------------------------
  {
    id: 'musselBait', name: 'Mussel Bait', art: '🦐', type: 'drain', rarity: 'normal', cost: 2, target: 'enemy', family: 'endurance', tags: ['drain', 'delayed'],
    effects: [{ type: 'delayed', turns: 3, effects: [{ type: 'changeEscape', amount: -6 }] }],
  },
  {
    id: 'wearThemOut', name: 'Wear Them Out', art: '🥱', type: 'drain', rarity: 'normal', cost: 1, target: 'enemy', family: 'endurance', tags: ['drain', 'slow'],
    effects: [{ type: 'changeEscape', amount: 0, perStatus: { status: 'slow', amount: -3 } }],
  },
  {
    id: 'tireOut', name: 'Tire Out', art: '😮‍💨', type: 'support', rarity: 'rare', cost: 2, target: 'random', family: 'endurance', tags: ['slow'],
    effects: [{ type: 'applyStatus', status: 'snared', amount: 2 }],
  },
  { id: 'wearDown', name: 'Wear Down', art: '🪨', type: 'drain', rarity: 'normal', cost: 2, target: 'enemy', family: 'endurance', tags: ['drain'], effects: [{ type: 'changeEscape', amount: -15 }] },
  {
    id: 'heavyLine', name: 'Heavy Line', art: '⚓', type: 'drain', rarity: 'normal', cost: 1, target: 'enemy', family: 'endurance', tags: ['drain', 'slow'],
    effects: [{ type: 'changeEscape', amount: -5 }, { type: 'applyStatus', status: 'slow', amount: 2 }],
  },
  {
    id: 'slowSqueeze', name: 'Slow Squeeze', art: '🫳', type: 'drain', rarity: 'normal', cost: 1, patienceCost: 1, target: 'enemy', family: 'endurance', tags: ['drain', 'patience'],
    effects: [{ type: 'changeEscape', amount: -12 }],
  },
  {
    id: 'steadyHaul', name: 'Steady Haul', art: '🧵', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'endurance', tags: ['damage', 'drain'],
    effects: [{ type: 'dealDamage', amount: 5 }, { type: 'changeEscape', amount: -5 }],
  },
  {
    id: 'tiringBlow', name: 'Tiring Blow', art: '🥊', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', family: 'endurance',
    tags: ['damage', 'drain', 'slow', 'conditional'],
    effects: [
      { type: 'dealDamage', amount: 10 },
      { type: 'ifStatus', status: 'slow', then: [{ type: 'changeEscape', amount: -12 }], else: [{ type: 'changeEscape', amount: -8 }] },
    ],
  },
  {
    id: 'tiredFish', name: 'Tired Fish', art: '😩', type: 'drain', rarity: 'normal', cost: 1, target: 'enemy', family: 'endurance', tags: ['drain', 'conditional'],
    effects: [{ type: 'ifBelow', bar: 'health', part: 2, then: [{ type: 'changeEscape', amount: -10 }], else: [{ type: 'changeEscape', amount: -5 }] }],
  },

  // --- Patient --------------------------------------------------------------------
  {
    id: 'oldAsTheRiver', name: 'Old as the River', art: '🐢', type: 'power', rarity: 'rare', cost: 2, target: 'none', family: 'patient', tags: ['damage', 'patience'],
    effects: [{ type: 'power', power: 'oldAsTheRiver', amount: 3 }],
  },
  {
    id: 'stillAsAStone', name: 'Still as a Stone', art: '🗿', type: 'defense', rarity: 'normal', cost: 1, target: 'none', family: 'patient', tags: ['hold', 'patience'],
    effects: [{ type: 'gainBlock', amount: 6 }, { type: 'gainPatience', amount: 1 }],
  },
  {
    id: 'danglingLure', name: 'Dangling Lure', art: '🪱', type: 'support', rarity: 'normal', cost: 1, target: 'random', family: 'patient', tags: ['slow', 'patience'],
    effects: [{ type: 'applyStatus', status: 'slow', amount: 4 }, { type: 'gainPatience', amount: 1 }],
  },
  {
    id: 'suddenGulp', name: 'Sudden Gulp', art: '🐊', type: 'attack', rarity: 'normal', cost: 1, patienceCost: 2, target: 'enemy', family: 'patient', tags: ['damage', 'patience'],
    effects: [{ type: 'dealDamage', amount: 14 }],
  },
  {
    id: 'patientStrike', name: 'Patient Strike', art: '🎯', type: 'attack', rarity: 'normal', cost: 1, patienceCost: 1, target: 'enemy', family: 'patient', tags: ['damage', 'patience'],
    effects: [{ type: 'dealDamage', amount: 10 }],
  },
  {
    id: 'theLongWait', name: 'The Long Wait', art: '☕', type: 'attack', rarity: 'normal', cost: 0, patienceCost: 3, target: 'enemy', family: 'patient', tags: ['damage', 'patience'],
    effects: [{ type: 'dealDamage', amount: 15 }],
  },

  {
    id: 'bePrepared', name: 'Be Prepared', art: '🎒', type: 'defense', rarity: 'normal', cost: 1, target: 'none', family: 'patient', tags: ['hold', 'patience'],
    effects: [{ type: 'patienceToHold', per: 4 }],
  },
  {
    id: 'slackWater', name: 'Slack Water', art: '🏞️', type: 'drain', rarity: 'normal', cost: 0, target: 'enemy', family: 'patient', tags: ['drain', 'tension', 'conditional'],
    effects: [{ type: 'ifTension', tension: 0, then: [{ type: 'changeEscape', amount: -8 }], else: [{ type: 'changeEscape', amount: -2 }] }],
  },
  {
    id: 'breatheOut', name: 'Breathe Out', art: '😮‍💨', type: 'support', rarity: 'rare', cost: 0, patienceCost: 2, target: 'none', family: 'patient', tags: ['tension', 'draw', 'patience'],
    effects: [{ type: 'gainEnergy', amount: 2 }, { type: 'drawCards', amount: 1 }],
  },

  // --- Trickster ------------------------------------------------------------------
  {
    id: 'menacingPresence', name: 'Menacing Presence', art: '👁️', type: 'support', rarity: 'normal', cost: 0, patienceCost: 2, target: 'none', family: 'trickster',
    tags: ['intent', 'patience'], effects: [{ type: 'applyStatus', status: 'cowed', amount: 1, target: 'allEnemies' }],
  },
  {
    id: 'duckAndJab', name: 'Duck and Jab', art: '🥊', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'trickster',
    tags: ['damage', 'tradeoff', 'intent', 'conditional'],
    effects: [{ type: 'ifIntent', tag: 'strike', then: [{ type: 'dealDamage', amount: 12 }, { type: 'changeEscape', amount: 6 }], else: [{ type: 'dealDamage', amount: 4 }] }],
  },
  {
    id: 'letItRun', name: 'Let It Run', art: '🏃', type: 'drain', rarity: 'normal', cost: 1, target: 'enemy', family: 'trickster',
    tags: ['drain', 'tradeoff', 'intent', 'conditional'],
    effects: [{ type: 'ifIntent', tag: 'pull', then: [{ type: 'changeEscape', amount: -14 }, { type: 'heal', amount: 6 }], else: [{ type: 'changeEscape', amount: -5 }] }],
  },
  {
    id: 'boggedDown', name: 'Bogged Down', art: '🥾', type: 'support', rarity: 'normal', cost: 0, target: 'random', family: 'trickster', tags: ['slow', 'tradeoff'],
    effects: [{ type: 'multiplyStatus', status: 'slow', factor: 2 }, { type: 'changeEscape', amount: 5 }],
  },
  {
    id: 'turnTheTables', name: 'Turn the Tables', art: '🔄', type: 'support', rarity: 'rare', cost: 2, target: 'random', family: 'trickster', tags: ['tradeoff'],
    effects: [{ type: 'swapHealthAndWill' }],
  },
  {
    id: 'tickle', name: 'Tickle', art: '🪶', type: 'drain', rarity: 'normal', cost: 0, target: 'enemy', family: 'trickster', tags: ['drain', 'tradeoff'],
    effects: [{ type: 'changeEscape', amount: -10 }, { type: 'heal', amount: 6 }],
  },
  {
    id: 'cheapShot', name: 'Cheap Shot', art: '👊', type: 'attack', rarity: 'normal', cost: 0, target: 'enemy', family: 'trickster', tags: ['damage', 'tradeoff'],
    effects: [{ type: 'dealDamage', amount: 5 }, { type: 'changeEscape', amount: 5 }],
  },
  {
    id: 'giveAndTake', name: 'Give and Take', art: '🤝', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'trickster', tags: ['damage', 'rhythm', 'conditional'],
    effects: [{ type: 'ifLastCard', cardType: 'drain', then: [{ type: 'dealDamage', amount: 8 }], else: [{ type: 'dealDamage', amount: 4 }] }],
  },
  {
    id: 'easeOff', name: 'Ease Off', art: '🍃', type: 'drain', rarity: 'normal', cost: 1, target: 'enemy', family: 'trickster', tags: ['drain', 'rhythm', 'conditional'],
    effects: [{ type: 'ifLastCard', cardType: 'attack', then: [{ type: 'changeEscape', amount: -8 }], else: [{ type: 'changeEscape', amount: -4 }] }],
  },
  {
    id: 'giveLine', name: 'Give Line', art: '🧶', type: 'defense', rarity: 'normal', cost: 1, target: 'none', family: 'trickster', tags: ['hold', 'rhythm', 'conditional'],
    effects: [{ type: 'ifLastCard', cardType: 'attack', then: [{ type: 'gainBlock', amount: 8 }], else: [{ type: 'gainBlock', amount: 5 }] }],
  },

  // --- Flashy ---------------------------------------------------------------------
  {
    id: 'dazzle', name: 'Dazzle', art: '🌈', type: 'support', rarity: 'normal', cost: 1, target: 'random', family: 'flashy', tags: ['intent', 'tradeoff'],
    effects: [{ type: 'applyStatus', status: 'dazzled', amount: 2 }],
  },
  {
    id: 'spinnerLure', name: 'Spinner Lure', art: '🎏', type: 'drain', rarity: 'normal', cost: 1, target: 'enemy', family: 'flashy', tags: ['drain', 'intent'],
    effects: [{ type: 'changeEscape', amount: -6 }, { type: 'applyStatus', status: 'lured', amount: 1 }],
  },
  {
    id: 'flashOfColour', name: 'Flash of Colour', art: '✨', type: 'support', rarity: 'normal', cost: 0, target: 'enemy', family: 'flashy', tags: ['intent', 'draw'],
    effects: [{ type: 'applyStatus', status: 'distracted', amount: 4 }, { type: 'drawCards', amount: 1 }],
  },
  {
    id: 'glitterBurst', name: 'Glitter Burst', art: '🎆', type: 'support', rarity: 'rare', cost: 1, target: 'random', family: 'flashy', tags: ['intent'],
    effects: [{ type: 'flipIntent' }],
  },
  {
    id: 'adaptation', name: 'Adaptation', art: '🦎', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy', family: 'flashy',
    tags: ['damage', 'drain', 'tradeoff', 'intent', 'conditional'],
    effects: [
      {
        type: 'ifIntent', tag: 'strike',
        then: [{ type: 'dealDamage', amount: 10 }, { type: 'changeEscape', amount: 10 }],
        else: [{ type: 'changeEscape', amount: -10 }, { type: 'heal', amount: 10 }],
      },
    ],
  },
  {
    id: 'flashStrike', name: 'Flash Strike', art: '⚡', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'flashy', tags: ['damage', 'intent'],
    effects: [{ type: 'dealDamage', amount: 6 }, { type: 'applyStatus', status: 'distracted', amount: 3 }],
  },
  {
    id: 'lureAndLunge', name: 'Lure and Lunge', art: '🪝', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'flashy',
    tags: ['damage', 'intent', 'conditional'],
    effects: [{ type: 'ifIntent', tag: 'pull', then: [{ type: 'dealDamage', amount: 10 }], else: [{ type: 'dealDamage', amount: 5 }] }],
  },
  { id: 'colourShift', name: 'Colour Shift', art: '🎨', type: 'support', rarity: 'normal', cost: 0, target: 'random', family: 'flashy', tags: ['intent'], effects: [{ type: 'rerollIntent' }] },
  {
    id: 'readTheLine', name: 'Read the Line', art: '📖', type: 'support', rarity: 'normal', cost: 1, target: 'enemy', family: 'flashy', tags: ['hold', 'drain', 'damage', 'tension', 'conditional'],
    effects: [{ type: 'byTension', effects: [[{ type: 'gainBlock', amount: 6 }], [{ type: 'changeEscape', amount: -6 }], [{ type: 'dealDamage', amount: 6 }]] }],
  },

  // --- Camo -----------------------------------------------------------------------
  {
    id: 'perfectDisguise', name: 'Perfect Disguise', art: '🦑', type: 'power', rarity: 'rare', cost: 2, target: 'none', family: 'camo', tags: ['hold', 'slow', 'conditional'],
    effects: [{ type: 'power', power: 'perfectDisguise', amount: 6 }],
  },
  {
    id: 'lieLow', name: 'Lie Low', art: '🌿', type: 'defense', rarity: 'normal', cost: 1, target: 'random', family: 'camo', tags: ['hold', 'slow', 'conditional'],
    effects: [{ type: 'gainBlock', amount: 6 }, { type: 'ifNoAttack', then: [{ type: 'applyStatus', status: 'slow', amount: 2 }] }],
  },
  {
    id: 'unseenApproach', name: 'Unseen Approach', art: '🥷', type: 'drain', rarity: 'normal', cost: 0, target: 'enemy', family: 'camo', tags: ['drain', 'conditional'],
    effects: [{ type: 'ifNoAttack', then: [{ type: 'changeEscape', amount: -10 }], else: [{ type: 'changeEscape', amount: -5 }] }],
  },
  {
    id: 'shadowTheFish', name: 'Shadow the Fish', art: '👤', type: 'defense', rarity: 'normal', cost: 2, target: 'random', family: 'camo', tags: ['hold', 'intent'],
    effects: [{ type: 'holdFromIntent', max: 12 }],
  },
  {
    id: 'fromNowhere', name: 'From Nowhere', art: '🫥', type: 'attack', rarity: 'normal', cost: 1, patienceCost: 1, target: 'enemy', family: 'camo', tags: ['damage', 'hold', 'patience'],
    effects: [{ type: 'dealDamage', amount: 0, fromHold: true }, { type: 'loseHold', share: 0.5 }],
  },
  {
    id: 'leanBack', name: 'Lean Back', art: '🙆', type: 'drain', rarity: 'normal', cost: 1, target: 'enemy', family: 'camo', tags: ['drain', 'hold'],
    effects: [{ type: 'changeEscape', amount: 0, fromHold: true }, { type: 'loseHold', share: 1 }],
  },

  // --- Slimy ----------------------------------------------------------------------
  {
    id: 'pushTheLimits', name: 'Push the Limits', art: '🧲', type: 'power', rarity: 'rare', cost: 1, target: 'none', family: 'slimy', tags: ['slow'],
    effects: [{ type: 'power', power: 'pushTheLimits' }],
  },
  {
    id: 'deadWeight', name: 'Dead Weight', art: '🪨', type: 'power', rarity: 'rare', cost: 1, target: 'none', family: 'slimy', tags: ['slow'],
    effects: [{ type: 'power', power: 'deadWeight', amount: 1 }],
  },
  {
    id: 'gooeyMess', name: 'Gooey Mess', art: '🫠', type: 'power', rarity: 'rare', cost: 2, target: 'none', family: 'slimy', tags: ['hold', 'intent'],
    effects: [{ type: 'power', power: 'gooeyMess', amount: 3 }],
  },
  {
    id: 'stickySlime', name: 'Sticky Slime', art: '🫧', type: 'defense', rarity: 'normal', cost: 1, target: 'random', family: 'slimy', tags: ['hold', 'slow'],
    effects: [{ type: 'gainBlock', amount: 4 }, { type: 'applyStatus', status: 'slow', amount: 3 }],
  },
  { id: 'slimeCoat', name: 'Slime Coat', art: '🐌', type: 'support', rarity: 'normal', cost: 1, target: 'enemy', family: 'slimy', tags: ['slow'], effects: [{ type: 'applyStatus', status: 'slow', amount: 5 }] },
  {
    id: 'stickySnare', name: 'Sticky Snare', art: '🕸️', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', family: 'slimy', tags: ['damage', 'drain'],
    effects: [{ type: 'dealDamage', amount: 4 }, { type: 'changeEscape', amount: -5 }],
  },

  // --- Bait: made from a bucket creature of its tier (`bait`), gone from the deck once played ---
  {
    id: 'bait', name: 'Bait', art: '🪱', type: 'drain', rarity: 'normal', cost: 0, target: 'enemy', bait: 1, tags: ['drain', 'intent'],
    effects: [{ type: 'changeEscape', amount: -15 }, { type: 'delayMove' }],
  },
  {
    id: 'cutBait', name: 'Cut Bait', art: '🔪', type: 'drain', rarity: 'normal', cost: 0, target: 'none', bait: 2, tags: ['drain', 'intent'],
    effects: [{ type: 'changeEscape', amount: -10, target: 'allEnemies' }, { type: 'delayMove', target: 'allEnemies' }],
  },
  {
    id: 'bigLure', name: 'Big Lure', art: 'lure1', type: 'drain', rarity: 'normal', cost: 0, target: 'enemy', bait: 3, tags: ['drain', 'intent'],
    effects: [{ type: 'changeEscape', amount: -30 }, { type: 'delayMove' }],
  },

  // --- Junk: creatures' special moves slip these into the deck for the fight (`addJunk`) ---
  { id: 'pebbleInTheBoot', name: 'Pebble in the Boot', art: '🥾', type: 'junk', rarity: 'normal', cost: 0, target: 'none', unplayable: true, effects: [] },
  { id: 'slimySeaweed', name: 'Slimy Seaweed', art: '🌿', type: 'junk', rarity: 'normal', cost: 1, target: 'none', exhaust: true, inHand: { gritAtEndOfTurn: 2 }, effects: [] },
  { id: 'tangledLine', name: 'Tangled Line', art: '🧶', type: 'junk', rarity: 'normal', cost: 1, target: 'none', exhaust: true, inHand: { holdLess: 1 }, effects: [] },
];
