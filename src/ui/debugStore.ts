import { ref } from 'vue';
import type { DebugScenario } from '../engine';

/**
 * Per-device debug settings, in localStorage (blocked storage only means nothing is remembered):
 * whether the debug panel shows ("Show debug panel" in the options) and the named scenarios saved
 * from it. Neither is part of the save or the profile.
 */
const PANEL_KEY = 'slay-the-fish:debug-panel';
const SCENARIOS_KEY = 'slay-the-fish:debug-scenarios';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: kept for this session only.
  }
}

export const debugPanel = ref(read(PANEL_KEY) === 'true');

export function setDebugPanel(on: boolean) {
  debugPanel.value = on;
  write(PANEL_KEY, String(on));
}

function readScenarios(): Record<string, DebugScenario> {
  try {
    const parsed = JSON.parse(read(SCENARIOS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Saved scenarios by name. Not checked here: loading one validates it (`validateScenario`). */
export const savedScenarios = ref<Record<string, DebugScenario>>(readScenarios());

export function saveScenario(name: string, scenario: DebugScenario) {
  savedScenarios.value = { ...savedScenarios.value, [name]: scenario };
  write(SCENARIOS_KEY, JSON.stringify(savedScenarios.value));
}

export function deleteScenario(name: string) {
  const { [name]: _, ...rest } = savedScenarios.value;
  savedScenarios.value = rest;
  write(SCENARIOS_KEY, JSON.stringify(rest));
}
