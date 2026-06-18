// ui.js — renders DOM panels (HUD, contracts, fleet, R&D), wires interactions,
// and shows toasts/modals. Pure presentation over the game state + actions.

import {
  ROCKET_TYPES,
  ROCKET_BY_ID,
  DEST_BY_ID,
  UPGRADES,
  CARGO_TYPES,
} from './constants.js';
import { state, reset } from './state.js';
import {
  fmtMoney,
  valuation,
  canAfford,
  launchCostFor,
  activeEffects,
} from './economy.js';
import {
  buyRocket,
  launch,
  idleRocketsForContract,
} from './fleet.js';

const CARGO_BY_ID = Object.fromEntries(CARGO_TYPES.map((c) => [c.id, c]));

let els = {};
let onChange = () => {};

export function initUI(handlers = {}) {
  onChange = handlers.onChange || (() => {});
  els = {
    cash: document.getElementById('hud-cash'),
    valuation: document.getElementById('hud-valuation'),
    flights: document.getElementById('hud-flights'),
    day: document.getElementById('hud-day'),
    speedBtns: Array.from(document.querySelectorAll('[data-speed]')),
    tabBtns: Array.from(document.querySelectorAll('[data-tab]')),
    panels: {
      contracts: document.getElementById('panel-contracts'),
      fleet: document.getElementById('panel-fleet'),
      rnd: document.getElementById('panel-rnd'),
      log: document.getElementById('panel-log'),
    },
    resetBtn: document.getElementById('reset-btn'),
    toast: document.getElementById('toast'),
    modal: document.getElementById('modal'),
  };

  els.speedBtns.forEach((b) =>
    b.addEventListener('click', () => {
      state.speed = Number(b.dataset.speed);
      renderHUD();
      onChange();
    })
  );

  els.tabBtns.forEach((b) =>
    b.addEventListener('click', () => setActiveTab(b.dataset.tab))
  );

  els.resetBtn.addEventListener('click', () => {
    showModal(
      'Start over?',
      'This wipes your saved company and begins a new game.',
      [
        { label: 'Cancel', kind: 'ghost', action: hideModal },
        {
          label: 'Reset game',
          kind: 'danger',
          action: () => {
            reset();
            hideModal();
            onChange();
            renderAll();
            toast('New company founded.');
          },
        },
      ]
    );
  });

  setActiveTab('contracts');
}

let activeTab = 'contracts';
export function setActiveTab(tab) {
  activeTab = tab;
  els.tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  Object.entries(els.panels).forEach(([k, el]) =>
    el.classList.toggle('active', k === tab)
  );
  renderActivePanel();
}

export function renderAll() {
  renderHUD();
  renderActivePanel();
}

function renderActivePanel() {
  if (activeTab === 'contracts') renderContracts();
  else if (activeTab === 'fleet') renderFleet();
  else if (activeTab === 'rnd') renderRnD();
  else if (activeTab === 'log') renderLog();
}

export function renderHUD() {
  if (!els.cash) return;
  els.cash.textContent = '$' + fmtMoney(state.cash);
  els.valuation.textContent = '$' + fmtMoney(valuation());
  els.flights.textContent = String(state.flightsCompleted);
  els.day.textContent = 'Day ' + Math.floor(state.day);
  els.cash.classList.toggle('negative', state.cash < 0);
  els.speedBtns.forEach((b) =>
    b.classList.toggle('active', Number(b.dataset.speed) === state.speed)
  );
}

function renderContracts() {
  const open = state.contracts.filter((c) => c.status === 'open');
  const assigned = state.contracts.filter((c) => c.status === 'assigned');
  const el = els.panels.contracts;

  if (open.length === 0 && assigned.length === 0) {
    el.innerHTML = emptyState('No contracts yet. New ones arrive over time.');
    return;
  }

  let html = '';
  if (open.length) {
    html += sectionTitle('Available contracts');
    html += open.map(contractCard).join('');
  }
  if (assigned.length) {
    html += sectionTitle('In progress');
    html += assigned.map(assignedCard).join('');
  }
  el.innerHTML = html;

  el.querySelectorAll('[data-accept]').forEach((btn) =>
    btn.addEventListener('click', () => openAssignDialog(btn.dataset.accept))
  );
}

function contractCard(c) {
  const dest = DEST_BY_ID[c.destId];
  const cargo = CARGO_BY_ID[c.cargoId];
  const ready = idleRocketsForContract(c).length > 0;
  return `
    <div class="card">
      <div class="card-head">
        <span class="badge" style="--c:${dest.color}">${dest.name}</span>
        <span class="reward">+$${fmtMoney(c.reward)}</span>
      </div>
      <div class="card-body">
        ${cargo.icon} ${cargo.name} · ${c.mass}t payload
      </div>
      <div class="card-foot">
        <button class="btn ${ready ? 'primary' : ''}" data-accept="${c.id}">
          ${ready ? 'Assign rocket' : 'Assign / buy rocket'}
        </button>
      </div>
    </div>`;
}

function assignedCard(c) {
  const dest = DEST_BY_ID[c.destId];
  const rocket = state.rockets.find((r) => r.id === c.rocketId);
  const pct = rocket ? Math.round(rocket.progress * 100) : 0;
  return `
    <div class="card">
      <div class="card-head">
        <span class="badge" style="--c:${dest.color}">${dest.name}</span>
        <span class="reward">+$${fmtMoney(c.reward)}</span>
      </div>
      <div class="card-body">${rocket ? rocket.name : '—'} en route…</div>
      <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;
}

// Dialog to pick an idle rocket or buy a new one for a contract.
function openAssignDialog(contractId) {
  const contract = state.contracts.find((c) => c.id === contractId);
  if (!contract) return;
  const dest = DEST_BY_ID[contract.destId];
  const idle = idleRocketsForContract(contract);

  let body = `<p class="modal-sub">${dest.name} · ${contract.mass}t · reward $${fmtMoney(contract.reward)}</p>`;

  if (idle.length) {
    body += `<div class="modal-section-title">Ready rockets</div>`;
    body += idle
      .map((r) => {
        const type = ROCKET_BY_ID[r.typeId];
        const cost = launchCostFor(type);
        return `<button class="list-row" data-launch="${r.id}">
          <span>${r.name} <small>(${type.name})</small></span>
          <span class="muted">launch $${fmtMoney(cost)}</span>
        </button>`;
      })
      .join('');
  } else {
    body += `<p class="muted">No ready rocket can take this. Buy one that meets the range &amp; capacity.</p>`;
  }

  body += `<div class="modal-section-title">Buy &amp; launch</div>`;
  body += ROCKET_TYPES.map((type) => {
    const fits = type.range >= dest.range && type.capacity >= contract.mass;
    const total = type.purchaseCost + launchCostFor(type);
    const affordable = canAfford(total);
    const disabled = !fits || !affordable;
    const why = !fits ? 'insufficient range/capacity' : !affordable ? 'too expensive' : `$${fmtMoney(total)}`;
    return `<button class="list-row" data-buy="${type.id}" ${disabled ? 'disabled' : ''}>
      <span>${type.name} <small>(${type.capacity}t)</small></span>
      <span class="muted">${why}</span>
    </button>`;
  }).join('');

  showModal(`Assign to ${dest.name}`, body, [
    { label: 'Close', kind: 'ghost', action: hideModal },
  ], true);

  els.modal.querySelectorAll('[data-launch]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const rocket = state.rockets.find((r) => r.id === btn.dataset.launch);
      doLaunch(rocket, contract);
    })
  );
  els.modal.querySelectorAll('[data-buy]:not([disabled])').forEach((btn) =>
    btn.addEventListener('click', () => {
      const rocket = buyRocket(btn.dataset.buy);
      if (!rocket) return toast('Could not afford that rocket.');
      doLaunch(rocket, contract);
    })
  );
}

function doLaunch(rocket, contract) {
  if (!rocket) return;
  const res = launch(rocket, contract);
  hideModal();
  if (!res.ok) {
    toast(res.reason);
  } else if (res.reason === 'failure') {
    toast('💥 Launch failure — vehicle lost.');
  } else {
    toast(`🚀 ${rocket.name} on its way!`);
  }
  onChange();
  renderAll();
}

function renderFleet() {
  const el = els.panels.fleet;
  let html = sectionTitle('Buy rockets');
  html += ROCKET_TYPES.map((type) => {
    const affordable = canAfford(type.purchaseCost);
    return `
      <div class="card">
        <div class="card-head">
          <strong>${type.name}</strong>
          <span class="muted">$${fmtMoney(type.purchaseCost)}</span>
        </div>
        <div class="card-body small">
          ${type.desc}<br>
          ${type.capacity}t · range ${type.range} · ${type.reusable ? '♻️ reusable' : 'expendable'} ·
          launch $${fmtMoney(type.launchCost)}
        </div>
        <div class="card-foot">
          <button class="btn ${affordable ? 'primary' : ''}" data-buy="${type.id}" ${affordable ? '' : 'disabled'}>
            Buy
          </button>
        </div>
      </div>`;
  }).join('');

  html += sectionTitle(`Your fleet (${state.rockets.length})`);
  if (state.rockets.length === 0) {
    html += emptyState('No rockets yet. Buy one above or from a contract.');
  } else {
    html += state.rockets.map(fleetRow).join('');
  }
  el.innerHTML = html;

  el.querySelectorAll('[data-buy]:not([disabled])').forEach((btn) =>
    btn.addEventListener('click', () => {
      const r = buyRocket(btn.dataset.buy);
      if (!r) return toast('Could not afford that rocket.');
      toast(`${r.name} added to fleet.`);
      onChange();
      renderAll();
    })
  );
}

function fleetRow(r) {
  const type = ROCKET_BY_ID[r.typeId];
  let status;
  if (r.status === 'idle') status = '<span class="tag ok">Ready</span>';
  else if (r.status === 'flight') {
    const where = r.phase === 'inbound' ? 'returning' : `→ ${DEST_BY_ID[r.destId].name}`;
    status = `<span class="tag fly">${where} ${Math.round(r.progress * 100)}%</span>`;
  } else status = `<span class="tag warn">Refurb ${Math.ceil(r.refurbRemaining)}d</span>`;
  return `
    <div class="card compact">
      <div class="card-head">
        <strong>${r.name}</strong>${status}
      </div>
      <div class="card-body small muted">${type.name}</div>
    </div>`;
}

function renderRnD() {
  const el = els.panels.rnd;
  const eff = activeEffects();
  let html = `<div class="rnd-summary small muted">
    Launch cost ×${eff.launchCostMult.toFixed(2)} ·
    Refurb ×${eff.refurbCostMult.toFixed(2)} ·
    Reliability +${Math.round(eff.reliabilityBonus * 100)}%
  </div>`;
  html += UPGRADES.map((u) => {
    const owned = state.upgrades.includes(u.id);
    const affordable = canAfford(u.cost);
    return `
      <div class="card">
        <div class="card-head">
          <strong>${u.name}</strong>
          <span class="muted">${owned ? 'Owned' : '$' + fmtMoney(u.cost)}</span>
        </div>
        <div class="card-body small">${u.desc}</div>
        <div class="card-foot">
          <button class="btn ${owned ? '' : affordable ? 'primary' : ''}"
            data-rnd="${u.id}" ${owned || !affordable ? 'disabled' : ''}>
            ${owned ? '✓ Researched' : 'Research'}
          </button>
        </div>
      </div>`;
  }).join('');
  el.innerHTML = html;

  el.querySelectorAll('[data-rnd]:not([disabled])').forEach((btn) =>
    btn.addEventListener('click', () => purchaseUpgrade(btn.dataset.rnd))
  );
}

function purchaseUpgrade(id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || state.upgrades.includes(id) || !canAfford(u.cost)) return;
  state.cash -= u.cost;
  state.upgrades.push(id);
  toast(`Researched: ${u.name}`);
  onChange();
  renderAll();
}

function renderLog() {
  const el = els.panels.log;
  if (state.log.length === 0) {
    el.innerHTML = emptyState('No activity yet.');
    return;
  }
  el.innerHTML = state.log
    .map((e) => `<div class="log-row"><span class="muted">D${e.day}</span> ${e.msg}</div>`)
    .join('');
}

// ---- small UI helpers ----
function sectionTitle(t) {
  return `<div class="section-title">${t}</div>`;
}
function emptyState(t) {
  return `<div class="empty">${t}</div>`;
}

let toastTimer = null;
export function toast(msg) {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

export function showModal(title, bodyHtml, buttons = [], scrollable = false) {
  els.modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card ${scrollable ? 'scroll' : ''}">
      <h3>${title}</h3>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-actions"></div>
    </div>`;
  const actions = els.modal.querySelector('.modal-actions');
  buttons.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = `btn ${b.kind || ''}`;
    btn.textContent = b.label;
    btn.addEventListener('click', b.action);
    actions.appendChild(btn);
  });
  els.modal.querySelector('.modal-backdrop').addEventListener('click', hideModal);
  els.modal.classList.add('show');
}

export function hideModal() {
  els.modal.classList.remove('show');
  els.modal.innerHTML = '';
}
