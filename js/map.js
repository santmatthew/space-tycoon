// map.js — canvas rendering of the solar-system map + animated rockets, and
// tap hit-testing on destination nodes.

import { DESTINATIONS } from './constants.js';
import { state } from './state.js';
import { isDestUnlocked } from './economy.js';

let canvas, ctx;
let width = 0, height = 0, dpr = 1;
let stars = [];
let onDestTap = null;

// Layout cache: screen position of each destination node.
const nodePos = {};

export function initMap(canvasEl, { onDestinationTap } = {}) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  onDestTap = onDestinationTap;
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', handleTap);
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildStars();
  layoutNodes();
}

function buildStars() {
  stars = [];
  const count = Math.floor((width * height) / 6000);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.3 + 0.2,
      a: Math.random() * 0.6 + 0.2,
    });
  }
}

// Earth sits lower-left; destinations fan out along a diagonal by distance.
function layoutNodes() {
  const margin = Math.min(width, height) * 0.14;
  const x0 = margin;
  const y0 = height - margin;
  const x1 = width - margin;
  const y1 = margin;
  for (const d of DESTINATIONS) {
    nodePos[d.id] = {
      x: x0 + (x1 - x0) * d.dist,
      y: y0 + (y1 - y0) * d.dist,
    };
  }
}

function handleTap(e) {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  for (const d of DESTINATIONS) {
    const p = nodePos[d.id];
    const r = nodeRadius(d);
    if (Math.hypot(px - p.x, py - p.y) <= r + 14) {
      if (onDestTap) onDestTap(d.id);
      return;
    }
  }
}

function nodeRadius(d) {
  if (d.home) return 22;
  return 9 + d.dist * 12;
}

// Called every animation frame.
export function render() {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  drawStars();
  drawRoutes();
  drawNodes();
  drawRockets();
}

function drawStars() {
  for (const s of stars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = '#cdd6ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawRoutes() {
  const earth = nodePos.earth;
  for (const d of DESTINATIONS) {
    if (d.home) continue;
    const p = nodePos[d.id];
    const unlocked = isDestUnlocked(d.id);
    ctx.strokeStyle = unlocked ? 'rgba(120,150,220,0.35)' : 'rgba(120,130,150,0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash(unlocked ? [] : [4, 6]);
    ctx.beginPath();
    ctx.moveTo(earth.x, earth.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawNodes() {
  for (const d of DESTINATIONS) {
    const p = nodePos[d.id];
    const r = nodeRadius(d);
    const unlocked = isDestUnlocked(d.id) || d.home;
    const selected = state.selectedDest === d.id;

    // Glow.
    const grad = ctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * 2.2);
    grad.addColorStop(0, hexA(d.color, unlocked ? 0.5 : 0.12));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Body.
    ctx.fillStyle = unlocked ? d.color : '#3a4252';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Label.
    ctx.fillStyle = unlocked ? '#e8edff' : '#8089a0';
    ctx.font = `${d.home ? 14 : 12}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const labelY = p.y + r + 16;
    ctx.fillText(unlocked ? d.name : `${d.name} 🔒`, p.x, labelY);
  }
}

function drawRockets() {
  for (const rocket of state.rockets) {
    if (rocket.status !== 'flight' || !rocket.destId) continue;
    const earth = nodePos.earth;
    const dest = nodePos[rocket.destId];
    let from, to;
    if (rocket.phase === 'inbound') {
      from = dest; to = earth;
    } else {
      from = earth; to = dest;
    }
    const t = Math.max(0, Math.min(1, rocket.progress));
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Exhaust trail.
    ctx.fillStyle = 'rgba(255,170,80,0.6)';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-16, 3);
    ctx.lineTo(-16, -3);
    ctx.closePath();
    ctx.fill();
    // Body.
    ctx.fillStyle = '#f2f4ff';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, 4);
    ctx.lineTo(-6, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// Convert "#rrggbb" + alpha to rgba() string.
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
