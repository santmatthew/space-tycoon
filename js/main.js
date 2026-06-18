// main.js — bootstrap, the requestAnimationFrame game loop with a fixed-timestep
// simulation, and wiring between the map, UI, and simulation.

import { DAYS_PER_SECOND, DEST_BY_ID } from './constants.js';
import { state, save, load, logEvent } from './state.js';
import { tickContracts, seedInitialContracts } from './contracts.js';
import { tickFleet } from './fleet.js';
import { isDestUnlocked } from './economy.js';
import { initMap, render } from './map.js';
import { initUI, renderAll, renderHUD, setActiveTab, toast } from './ui.js';

const SIM_STEP_DAYS = 0.25; // fixed simulation step (in-game days)
let dayAccumulator = 0;
let lastTime = 0;
let lastSave = 0;

function boot() {
  const hadSave = load();
  if (!hadSave) {
    seedInitialContracts();
    logEvent('Company founded. Welcome to the launch business!');
  }

  initMap(document.getElementById('map'), { onDestinationTap: handleDestTap });
  initUI({ onChange: () => { renderHUD(); } });
  renderAll();

  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function handleDestTap(destId) {
  state.selectedDest = state.selectedDest === destId ? null : destId;
  const dest = DEST_BY_ID[destId];
  if (dest.home) {
    toast('Earth — your launch base and recovery site.');
  } else if (!isDestUnlocked(destId)) {
    toast(`${dest.name} is locked. Research it in R&D.`);
    setActiveTab('rnd');
  } else {
    toast(`${dest.name} — open a contract here from the Contracts tab.`);
    setActiveTab('contracts');
  }
}

function loop(now) {
  const dtSec = Math.min((now - lastTime) / 1000, 0.5); // clamp big gaps
  lastTime = now;

  // Advance the fixed-timestep simulation.
  if (state.speed > 0) {
    dayAccumulator += dtSec * DAYS_PER_SECOND * state.speed;
    while (dayAccumulator >= SIM_STEP_DAYS) {
      stepSimulation(SIM_STEP_DAYS);
      dayAccumulator -= SIM_STEP_DAYS;
    }
  }

  render();
  renderHUD();

  // Autosave roughly every 4 seconds.
  if (now - lastSave > 4000) {
    save();
    lastSave = now;
    // Refresh the active panel periodically so progress bars / statuses update.
    renderAll();
  }

  requestAnimationFrame(loop);
}

function stepSimulation(stepDays) {
  state.day += stepDays;
  tickContracts(stepDays);
  tickFleet(stepDays);
}

// Pause when tab is hidden to avoid runaway accumulation; resume cleanly.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) lastTime = performance.now();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
