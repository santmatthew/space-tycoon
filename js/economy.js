// economy.js — money, cost/reward math, R&D upgrade effects.

import {
  UPGRADE_BY_ID,
  REWARD_BASE,
  REWARD_PER_TONNE,
  DEST_BY_ID,
  CARGO_TYPES,
  ROCKET_BY_ID,
} from './constants.js';
import { state, logEvent } from './state.js';

const CARGO_BY_ID = Object.fromEntries(CARGO_TYPES.map((c) => [c.id, c]));

// Aggregate the effects of all purchased upgrades into a single modifier set.
export function activeEffects() {
  const eff = {
    refurbTimeMult: 1,
    refurbCostMult: 1,
    launchCostMult: 1,
    reliabilityBonus: 0,
    unlockedDests: new Set(['earth', 'leo', 'geo']),
  };
  for (const id of state.upgrades) {
    const u = UPGRADE_BY_ID[id];
    if (!u) continue;
    const e = u.effect || {};
    if (e.refurbTimeMult != null) eff.refurbTimeMult *= e.refurbTimeMult;
    if (e.refurbCostMult != null) eff.refurbCostMult *= e.refurbCostMult;
    if (e.launchCostMult != null) eff.launchCostMult *= e.launchCostMult;
    if (e.reliabilityBonus != null) eff.reliabilityBonus += e.reliabilityBonus;
    if (e.unlockDest) eff.unlockedDests.add(e.unlockDest);
  }
  return eff;
}

export function isDestUnlocked(destId) {
  return activeEffects().unlockedDests.has(destId);
}

// Effective per-launch cost for a rocket type after upgrades.
export function launchCostFor(rocketType) {
  return Math.round(rocketType.launchCost * activeEffects().launchCostMult);
}

// Effective refurbishment cost/time for a reusable rocket type after upgrades.
export function refurbCostFor(rocketType) {
  return Math.round((rocketType.refurbCost || 0) * activeEffects().refurbCostMult);
}
export function refurbDaysFor(rocketType) {
  return Math.round((rocketType.refurbDays || 0) * activeEffects().refurbTimeMult);
}

// Compute the reward for a contract given destination + cargo + mass.
export function computeReward(destId, cargoId, massTonnes) {
  const dest = DEST_BY_ID[destId];
  const cargo = CARGO_BY_ID[cargoId];
  const distFactor = 0.3 + dest.dist; // even LEO pays something
  const raw = (REWARD_BASE + REWARD_PER_TONNE * massTonnes) * distFactor * cargo.mult;
  return Math.round(raw / 100_000) * 100_000; // round to $0.1M
}

export function canAfford(amount) {
  return state.cash >= amount;
}

export function spend(amount, reason) {
  state.cash -= amount;
  if (reason) logEvent(`-$${fmtMoney(amount)} — ${reason}`);
}

export function earn(amount, reason) {
  state.cash += amount;
  if (reason) logEvent(`+$${fmtMoney(amount)} — ${reason}`);
}

// A simple derived "company valuation" used for HUD flavor.
export function valuation() {
  const fleetValue = state.rockets.reduce((sum, r) => {
    return sum + estimateRocketValue(r.typeId);
  }, 0);
  const goodwill = state.flightsCompleted * 2_000_000;
  return state.cash + fleetValue + goodwill;
}

function estimateRocketValue(typeId) {
  const type = ROCKET_BY_ID[typeId];
  return type ? type.purchaseCost * 0.6 : 0;
}

// Money formatting helpers shared across UI.
export function fmtMoney(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(Math.round(n));
}
