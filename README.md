# 🚀 Space Tycoon

A space-logistics business game inspired by the SpaceX business model and
*Transport Tycoon*. Run a private launch company: win delivery contracts, send
rockets across the solar system, reuse boosters, and invest R&D into a lower
cost-per-launch.

It's a **fully static web prototype** — no backend, no build step, no
dependencies. Just HTML/CSS/JS that runs anywhere, including your phone.

## Play

Open the live build (once Pages is enabled — see below):

> **https://santmatthew.github.io/space-tycoon/**

### How it plays
- **Contracts** arrive over time, each to a destination (LEO → GEO → Moon →
  Mars) for a cargo, satellite, or crew payload. Higher distance and fancier
  cargo pay more.
- Tap a contract to **assign a ready rocket** or **buy one** that meets the
  required range and capacity, then launch.
- Watch the rocket fly the route on the **solar-system map**. On arrival it
  delivers and you're paid.
- **Reusable rockets** fly home and go into **refurbishment** (a cost + a few
  days of downtime) before they can fly again. Expendable rockets are consumed.
- Spend in **R&D** to cut launch/refurb costs, improve reliability, and unlock
  the Moon and Mars — modeling the SpaceX cost-per-launch curve.
- Time controls (⏸ / 1× / 3× / 8×) let you speed through the wait. Progress
  **autosaves** to your browser; ↺ starts a new company.

## Run locally

No tooling required — just serve the folder:

```bash
cd space-tycoon
python3 -m http.server 8000
# open http://localhost:8000
```

(ES modules require an `http://` origin, so open it through a server rather than
`file://`.)

## Deploy to GitHub Pages

This is a static site served straight from the repo root, so it uses
branch-based Pages (no build, no Actions workflow needed). One-time setup:

1. **Settings → Pages → Source:** choose **Deploy from a branch**.
2. **Branch:** select `claude/space-logistics-game-5zqg8b` and folder **`/ (root)`**, then **Save**.
3. Wait a minute or two — the published URL appears under Settings → Pages:
   **https://santmatthew.github.io/space-tycoon/**

Every push to that branch republishes automatically.

## Project structure

```
index.html              # mobile-first shell: HUD, canvas, panels
css/styles.css          # responsive dark theme (side panel desktop / bottom panel phone)
js/
  constants.js          # all balance tuning: destinations, rockets, R&D
  state.js              # game state + localStorage save/load
  contracts.js          # procedural contract generation
  fleet.js              # buy / assign / launch / travel / refurbish rockets
  economy.js            # cash, cost & reward math, R&D effects
  map.js                # canvas solar-system render + animated rockets
  ui.js                 # DOM panels, modals, toasts
  main.js               # bootstrap + fixed-timestep game loop
```

All game balance lives in `js/constants.js`, so tuning is a single-file edit.
