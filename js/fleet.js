// fleet.js — rockets: buy, assign to contracts, launch, travel, refurbish.

import {
  ROCKET_BY_ID,
  DEST_BY_ID,
  BASE_TRAVEL_DAYS,
} from './constants.js';
import { state, genId, logEvent } from './state.js';
import {
  canAfford,
  spend,
  earn,
  launchCostFor,
  refurbCostFor,
  refurbDaysFor,
  activeEffects,
  fmtMoney,
} from './economy.js';

// Buy a new rocket of the given type; returns the rocket or null if too poor.
export function buyRocket(typeId) {
  const type = ROCKET_BY_ID[typeId];
  if (!type) return null;
  if (!canAfford(type.purchaseCost)) return null;
  spend(type.purchaseCost, `Bought ${type.name}`);
  const rocket = {
    id: genId('rkt'),
    typeId,
    status: 'idle', // 'idle' | 'flight' | 'refurb'
    name: `${type.name.split(' ')[0]}-${state.rockets.length + 1}`,
    contractId: null,
    // Flight progress fields:
    destId: null,
    phase: null, // 'outbound' | 'inbound'
    progress: 0, // 0..1 along current leg
    legDays: 0, // total in-game days for current leg
    refurbRemaining: 0,
  };
  state.rockets.push(rocket);
  return rocket;
}

// Can this idle rocket take this contract? (range + capacity)
export function canRocketTakeContract(rocket, contract) {
  if (rocket.status !== 'idle') return false;
  const type = ROCKET_BY_ID[rocket.typeId];
  const dest = DEST_BY_ID[contract.destId];
  if (type.range < dest.range) return false;
  if (type.capacity < contract.mass) return false;
  return true;
}

export function idleRocketsForContract(contract) {
  return state.rockets.filter((r) => canRocketTakeContract(r, contract));
}

// Compute in-game travel days for a rocket type to reach a destination (one leg).
function legDaysFor(typeId, destId) {
  const type = ROCKET_BY_ID[typeId];
  const dest = DEST_BY_ID[destId];
  return Math.max(2, (BASE_TRAVEL_DAYS * dest.dist) / type.speed);
}

// Assign a rocket to a contract and launch it. Deducts launch cost.
// Returns { ok, reason }.
export function launch(rocket, contract) {
  if (!canRocketTakeContract(rocket, contract)) {
    return { ok: false, reason: 'Rocket cannot take this contract.' };
  }
  const type = ROCKET_BY_ID[rocket.typeId];
  const cost = launchCostFor(type);
  if (!canAfford(cost)) return { ok: false, reason: 'Not enough cash for launch costs.' };

  spend(cost, `Launch of ${rocket.name} to ${DEST_BY_ID[contract.destId].name}`);

  // Launch reliability check.
  const reliability = Math.min(0.995, type.reliability + activeEffects().reliabilityBonus);
  if (Math.random() > reliability) {
    // Failure: rocket lost (and reusable ones too), contract reopened.
    state.flightsFailed++;
    logEvent(`💥 ${rocket.name} failed at launch. Vehicle lost.`);
    removeRocket(rocket.id);
    contract.status = 'open';
    contract.rocketId = null;
    return { ok: true, reason: 'failure' };
  }

  contract.status = 'assigned';
  contract.rocketId = rocket.id;
  rocket.status = 'flight';
  rocket.contractId = contract.id;
  rocket.destId = contract.destId;
  rocket.phase = 'outbound';
  rocket.progress = 0;
  rocket.legDays = legDaysFor(rocket.typeId, contract.destId);
  logEvent(`🚀 ${rocket.name} launched to ${DEST_BY_ID[contract.destId].name}.`);
  return { ok: true, reason: 'launched' };
}

// Advance all in-flight / refurbishing rockets by elapsed in-game days.
export function tickFleet(elapsedDays) {
  for (const rocket of state.rockets) {
    if (rocket.status === 'flight') {
      tickFlight(rocket, elapsedDays);
    } else if (rocket.status === 'refurb') {
      rocket.refurbRemaining -= elapsedDays;
      if (rocket.refurbRemaining <= 0) {
        rocket.refurbRemaining = 0;
        rocket.status = 'idle';
        logEvent(`${rocket.name} refurbished and ready.`);
      }
    }
  }
}

function tickFlight(rocket, elapsedDays) {
  rocket.progress += elapsedDays / rocket.legDays;
  if (rocket.progress < 1) return;

  const type = ROCKET_BY_ID[rocket.typeId];

  if (rocket.phase === 'outbound') {
    // Arrived at destination → deliver contract.
    const contract = state.contracts.find((c) => c.id === rocket.contractId);
    if (contract) {
      earn(contract.reward, `Delivered ${contract.mass}t to ${DEST_BY_ID[contract.destId].name}`);
      state.flightsCompleted++;
      state.contracts = state.contracts.filter((c) => c.id !== contract.id);
    }
    rocket.contractId = null;
    if (type.reusable) {
      // Reusable rockets fly home for recovery + refurbishment.
      rocket.phase = 'inbound';
      rocket.progress = 0;
      rocket.legDays = legDaysFor(rocket.typeId, rocket.destId);
    } else {
      // Expendable rockets are consumed after delivering their payload.
      logEvent(`${rocket.name} expended after mission.`);
      removeRocket(rocket.id);
    }
  } else {
    // Reusable rocket returned to Earth → refurbishment.
    rocket.phase = null;
    rocket.destId = null;
    rocket.progress = 0;
    const cost = refurbCostFor(type);
    spend(cost, `Refurbishing ${rocket.name}`);
    rocket.status = 'refurb';
    rocket.refurbRemaining = refurbDaysFor(type);
    logEvent(`${rocket.name} landed. Refurb (${rocket.refurbRemaining}d, $${fmtMoney(cost)}).`);
  }
}

export function removeRocket(id) {
  state.rockets = state.rockets.filter((r) => r.id !== id);
}
