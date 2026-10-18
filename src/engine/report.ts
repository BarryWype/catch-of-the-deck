/**
 * The report of what one action did: the Strikes and Pulls a creature landed on the player, the
 * Venom and Slow anyone put on, and the damage and calming a played card did, recorded as they
 * resolve. The UI reads it to play its sounds (CombatView); it never feeds back into the rules,
 * is not part of the saved state, and `applyAction` drops whatever was left unread when the next
 * action starts.
 */
export type CombatReport =
  /** A creature's Strike on the player: `blocked` soaked by Hold, `hpLost` off Grit. */
  | { kind: 'strike'; blocked: number; hpLost: number }
  /** A creature's Pull on the player: `blocked` held, `raised` added to its Will. */
  | { kind: 'pull'; blocked: number; raised: number }
  /** Venom or Slow put on someone. */
  | { kind: 'status'; status: 'venom' | 'slow' }
  /** A played card took Will off a creature. */
  | { kind: 'drain' }
  /** A played card dealt damage. */
  | { kind: 'hit' };

let report: CombatReport[] = [];

export function reportEvent(event: CombatReport): void {
  report.push(event);
}

/** The events recorded since the last call, oldest first; empties the report. */
export function takeReport(): CombatReport[] {
  const taken = report;
  report = [];
  return taken;
}
