// constants.js — single source of truth for game tuning.
// Other modules stay pure logic/rendering and read balance values from here.

// Starting cash for a new company.
export const STARTING_CASH = 120_000_000; // $120M

// Simulation: how many in-game days pass per real second at 1x speed.
export const DAYS_PER_SECOND = 0.5;

// How often (in-game days) a new contract may spawn, and the cap on open ones.
export const CONTRACT_SPAWN_DAYS = 6;
export const MAX_OPEN_CONTRACTS = 6;

// Destinations. `dist` is normalized 0..1 from Earth and drives travel time +
// reward scaling. `range` is the minimum rocket range needed to reach it.
// `unlock` (if present) is the R&D id required before contracts here appear.
export const DESTINATIONS = [
  { id: 'earth', name: 'Earth', dist: 0.0, range: 0, color: '#4f9dff', home: true },
  { id: 'leo',   name: 'Low Earth Orbit', dist: 0.16, range: 1, color: '#6fd1ff' },
  { id: 'geo',   name: 'Geostationary Orbit', dist: 0.34, range: 2, color: '#8be0c0' },
  { id: 'moon',  name: 'The Moon', dist: 0.62, range: 3, color: '#cfd3da', unlock: 'lunar_cert' },
  { id: 'mars',  name: 'Mars', dist: 1.0, range: 4, color: '#ff7a59', unlock: 'mars_program' },
];

export const DEST_BY_ID = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));

// Cargo types — affect reward multiplier and add a little flavor.
export const CARGO_TYPES = [
  { id: 'cargo',     name: 'Resupply Cargo', mult: 1.0,  icon: '📦' },
  { id: 'satellite', name: 'Satellite',      mult: 1.35, icon: '🛰️' },
  { id: 'crew',      name: 'Crew',           mult: 1.7,  icon: '👨‍🚀' },
];

// Rocket catalog. Costs in dollars, capacity in tonnes, speed scales travel
// time, reliability is launch success chance, range gates destinations.
export const ROCKET_TYPES = [
  {
    id: 'sparrow',
    name: 'Sparrow (Light)',
    capacity: 6,
    range: 2,
    speed: 1.0,
    reliability: 0.9,
    reusable: false,
    purchaseCost: 8_000_000,
    launchCost: 3_500_000,
    desc: 'Cheap expendable lifter. Consumed on every flight.',
  },
  {
    id: 'condor',
    name: 'Condor 9 (Reusable)',
    capacity: 18,
    range: 3,
    speed: 1.2,
    reliability: 0.95,
    reusable: true,
    purchaseCost: 38_000_000,
    launchCost: 5_000_000,
    refurbCost: 2_400_000,
    refurbDays: 20,
    desc: 'Workhorse reusable booster. Refurbished between flights.',
  },
  {
    id: 'leviathan',
    name: 'Leviathan (Heavy, Reusable)',
    capacity: 100,
    range: 5,
    speed: 1.5,
    reliability: 0.92,
    reusable: true,
    purchaseCost: 130_000_000,
    launchCost: 9_000_000,
    refurbCost: 5_500_000,
    refurbDays: 30,
    desc: 'Fully reusable heavy lifter. Unlocks deep-space contracts.',
  },
];

export const ROCKET_BY_ID = Object.fromEntries(ROCKET_TYPES.map((r) => [r.id, r]));

// R&D upgrades. Each is a one-time purchase whose effect is read by economy/
// fleet logic. `effect` is interpreted in economy.js (applyUpgradeEffects).
export const UPGRADES = [
  {
    id: 'lunar_cert',
    name: 'Lunar Flight Certification',
    cost: 25_000_000,
    desc: 'Unlocks contracts to the Moon.',
    effect: { unlockDest: 'moon' },
  },
  {
    id: 'rapid_refurb',
    name: 'Rapid Refurbishment',
    cost: 30_000_000,
    desc: 'Cut reusable refurbishment time & cost by 40%.',
    effect: { refurbTimeMult: 0.6, refurbCostMult: 0.6 },
  },
  {
    id: 'engine_eff',
    name: 'Full-Flow Engines',
    cost: 40_000_000,
    desc: 'Reduce per-launch cost by 25% across the fleet.',
    effect: { launchCostMult: 0.75 },
  },
  {
    id: 'avionics',
    name: 'Redundant Avionics',
    cost: 35_000_000,
    desc: 'Improve launch reliability (fewer failures).',
    effect: { reliabilityBonus: 0.05 },
  },
  {
    id: 'mars_program',
    name: 'Mars Program',
    cost: 90_000_000,
    desc: 'Unlocks high-value contracts to Mars.',
    effect: { unlockDest: 'mars' },
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// Travel-time tuning: base in-game days at dist=1.0 for a speed-1.0 rocket.
export const BASE_TRAVEL_DAYS = 60;

// Reward tuning: base $ per tonne at dist=1.0 before cargo multiplier.
export const REWARD_PER_TONNE = 1_400_000;
export const REWARD_BASE = 4_000_000;
