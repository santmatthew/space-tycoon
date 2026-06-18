// state.js — game state model, plus localStorage save/load and reset.

import { STARTING_CASH } from './constants.js';

const SAVE_KEY = 'space-tycoon-save-v1';

// The live game state. Treated as a singleton module export.
export const state = createNewState();

let nextId = 1;
export function genId(prefix = 'id') {
  return `${prefix}_${nextId++}`;
}

function createNewState() {
  return {
    cash: STARTING_CASH,
    day: 0, // in-game days elapsed (float)
    speed: 1, // time multiplier (0 = paused)
    flightsCompleted: 0,
    flightsFailed: 0,
    rockets: [], // { id, typeId, status: 'idle'|'flight'|'refurb', ... }
    contracts: [], // open + accepted (not yet delivered) contracts
    upgrades: [], // purchased upgrade ids
    daysSinceContract: 0,
    selectedDest: null,
    log: [], // recent event strings (most recent first)
  };
}

// Replace the live state's fields in place so existing imports stay valid.
export function loadInto(target, source) {
  Object.keys(target).forEach((k) => delete target[k]);
  Object.assign(target, source);
}

export function save() {
  try {
    const payload = { state, nextId };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('Save failed:', e);
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload || !payload.state) return false;
    loadInto(state, payload.state);
    if (typeof payload.nextId === 'number') nextId = payload.nextId;
    // Always resume paused-aware but running.
    if (typeof state.speed !== 'number' || state.speed <= 0) state.speed = 1;
    return true;
  } catch (e) {
    console.warn('Load failed:', e);
    return false;
  }
}

export function reset() {
  localStorage.removeItem(SAVE_KEY);
  loadInto(state, createNewState());
  nextId = 1;
}

// Append a short event to the log (kept to a manageable length).
export function logEvent(msg) {
  state.log.unshift({ day: Math.floor(state.day), msg });
  if (state.log.length > 40) state.log.length = 40;
}
