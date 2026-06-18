// contracts.js — procedural contract generation.

import {
  DESTINATIONS,
  CARGO_TYPES,
  MAX_OPEN_CONTRACTS,
  CONTRACT_SPAWN_DAYS,
} from './constants.js';
import { state, genId, logEvent } from './state.js';
import { computeReward, isDestUnlocked } from './economy.js';

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Eligible (unlocked, non-home) destinations for new contracts.
function eligibleDestinations() {
  return DESTINATIONS.filter((d) => !d.home && isDestUnlocked(d.id));
}

export function createContract() {
  const dests = eligibleDestinations();
  if (dests.length === 0) return null;
  const dest = pick(dests);
  const cargo = pick(CARGO_TYPES);
  // Mass scales loosely with distance so far targets carry heavier payloads.
  const mass = Math.max(2, Math.round((2 + Math.random() * 16) * (0.6 + dest.dist)));
  const reward = computeReward(dest.id, cargo.id, mass);
  return {
    id: genId('ctr'),
    destId: dest.id,
    cargoId: cargo.id,
    mass,
    reward,
    status: 'open', // 'open' | 'assigned'
    rocketId: null,
  };
}

// Advance contract spawning. Called from the sim tick with elapsed in-game days.
export function tickContracts(elapsedDays) {
  state.daysSinceContract += elapsedDays;
  const openCount = state.contracts.filter((c) => c.status === 'open').length;
  if (state.daysSinceContract >= CONTRACT_SPAWN_DAYS && openCount < MAX_OPEN_CONTRACTS) {
    state.daysSinceContract = 0;
    const c = createContract();
    if (c) {
      state.contracts.push(c);
      logEvent(`New contract available to ${destName(c.destId)}.`);
    }
  }
}

// Seed a couple of starter contracts so a fresh game has something to do.
export function seedInitialContracts() {
  for (let i = 0; i < 3; i++) {
    const c = createContract();
    if (c) state.contracts.push(c);
  }
}

function destName(id) {
  return (DESTINATIONS.find((d) => d.id === id) || {}).name || id;
}
