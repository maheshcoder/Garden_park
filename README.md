# Blossom Park

A complete local, single-player 3D browser park built with React, TypeScript, Vite, Three.js / React Three Fiber and React Three Rapier. No accounts, network rooms, chat or microphone access.

## Completed checklist

- [x] Application setup and actual 3D rendering
- [x] Avatar, grounded movement, collisions and camera
- [x] Six connected park areas
- [x] Scenery, environmental animation and ambience
- [x] Working interactions and accessible interface
- [x] Touch controls, persistence and real quality presets
- [x] Type checks, automated gameplay verification and visual review

## Run locally

Requires Node.js 22.12+ (Node 24 also works) and a browser with WebGL 2 / hardware acceleration.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite (normally http://127.0.0.1:5173).

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run preview` serves the production build. Runtime assets are generated locally; no external font, model, audio or texture services are required. Rapier's WASM is included by the build.

## Play

Choose a display name and one of three outfits, preview your avatar, then enter. Jackets can also be changed from Park settings while playing. Follow the looping cream path through the entrance, fountain plaza, blossom grove, flower beds, lily pond / wooden bridge, and bird garden.

| Action                  | Desktop                  | Touch                              |
| ----------------------- | ------------------------ | ---------------------------------- |
| Walk                    | WASD or arrow keys       | Left joystick                      |
| Run                     | Hold Shift               | Hold Run                           |
| Look around             | Drag the world           | Drag the world with another finger |
| Zoom                    | Mouse wheel              | —                                  |
| Read sign / sit / stand | E or contextual button   | Interact or contextual button      |
| Wave                    | Wave button              | Wave button                        |
| Pause / settings        | Escape or sliders button | Sliders button                     |

All six benches have configured seat and standing positions. Movement is blocked while seated. Signs open accessible, keyboard-trapped dialogs and only work within range. Settings include working mute, volume, decorative motion and low / medium / high quality controls. Return to the entrance from settings; automatic recovery also handles falling or leaving the boundary. Blur and visibility changes clear movement.

Audio starts after Enter park. Original synthesized birdsong and filtered water noise run through Web Audio, with mute and volume control; hidden pages suspend the context. Browser audio restrictions do not prevent gameplay.

Appearance and settings persist under `blossom-park:v1` in local storage. Malformed, unavailable and quota-limited storage fall back safely to session settings. Reduced-motion preferences are respected on startup and can be changed in the menu.

## Architecture

- `src/config/park.ts`: seeded layout, spawn, trees, flower beds, loop, benches / seats, sign content, outfits and actual quality budgets.
- `src/state/`: small external React store for UI state, separate mutable frame data, and validated persistence.
- `src/controllers/`: keyboard / pointer / joystick collection, timestep-independent movement helpers, Rapier's grounded kinematic character controller, collision sliding / autostep / slope limits, follow camera with physics-ray obstruction checks.
- `src/avatar/`: procedural humanoid with articulated hips, knees, shoulders and elbows; speed-driven walk / run cycles, idle, sit and wave poses. The illustrated character has layered hair, blinking eyes, a collared jacket, pockets, cuffs, a cross-body satchel and laced boots. It accepts appearance and motion data independently of local controls so future remote avatars can reuse it.
- `src/config/terrain.ts`: shared contoured surface used by physical ground, paths, scenery and bench anchors.
- `src/world/art.tsx`: shared three-tone lighting ramp, beveled geometry and silhouette outlines.
- `src/world/`: textured terrain, conforming ribbon paths and six park areas; `props/` contains trees, flowers, seating, water and structures; `effects/` contains seeded petals, wing-animated birds, butterflies and grass.
- `src/interactions/`: shared sit / stand, sign and entrance actions.
- `src/audio/`: procedural ambience and browser audio lifecycle.
- `src/ui/`, `src/styles/`: entry, live HUD, map, accessible dialogs, responsive touch controls and illustrated cream / sage styling with mustard controls, outlined panels and motion-aware transitions.

Trees have tapered branching trunks and roots, compact foliage and individual five-petal blossoms. Recognizable bluebirds and robins alternate flapping and gliding along smooth routes, while perched birds fold their wings and look around. Water uses moving illustrated ripple textures. Rendering uses instanced foliage, flowers, grass, fence pieces and particles; simple colliders cover solid gameplay obstacles rather than every decorative flower. Medium caps DPR at 1.35 with 1024 shadows; low disables shadows and reduces blossom geometry detail and flower / particle / wildlife counts; high raises those budgets and caps DPR at 1.75. Hidden pages stop the render loop and physics. Frequent gameplay updates stay out of React state.

## Checks

`npm test` exercises camera-relative and normalized movement, timestep-independent smoothing, turning, spawn / fall safety, bench standing distances, persistence validation, deterministic placement, quality budgets and flower-bed clearance from the looping path.

For Chrome integration checks, start the development server first:

```sh
npm run dev -- --port 4176
npm run test:browser
```

After building, verify the production bundle in a second terminal:

```sh
npm run preview -- --port 4177
npm run test:production
```

The test script uses installed desktop Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`. Set `CHROME_PATH` for another installation and `PARK_URL` for another local port. It checks the real running physics body, UI and touch events; development-only body inspection is disabled in production. Screenshots and measured browser results go into ignored `artifacts/`. No browser binaries are downloaded by installation.

## Assets and licenses

All park geometry, avatar, canvas sign textures, favicon and synthesized audio are original procedural assets created for this project. There are no third-party model / texture / sound downloads to attribute. Empty `public/models`, `public/textures` and `public/audio` directories are reserved for replacing procedural assets if desired; the app does not request files from them.

Dependency licenses: React / ReactDOM, Three.js, React Three Fiber, React Three Rapier and Vite use MIT; TypeScript and the underlying Rapier physics engine use Apache-2.0. Playwright (development-only) uses Apache-2.0. The committed lockfile pins the installed dependency graph.

Visual inspiration: [Abeto Messenger](https://messenger.abeto.co/), inspected in Chrome for its illustrated character, ink outlines, restrained colors and game interface. This park uses original geometry and textures; no reference code or assets were copied.

## Limits

This is Phase 1 only. Audio is synthesized rather than field-recorded ambience. Decorative flowers, petals and birds have no physics bodies; pond-edge and foliage camera colliders deliberately use simple shapes. The pond is visually animated using ripples rather than fluid simulation. Desktop Chrome and emulated touch input can be tested locally; real iOS / Android devices and other browsers need device testing. Performance depends on the GPU and chosen quality preset; measured results are reported separately, without a promised frame rate. Optional footsteps are omitted.

## Verified locally

On 10 October 2026, type checking, the production build, seven core tests and 29 browser-check groups passed. The built production app also passed a separate Chrome smoke check, including an avatar close-up after the final hairline and horizon refinements. Chrome integration covered profile selection, keyboard walking / running, camera-relative motion, orbit / zoom and obstruction, solid collisions, bank-to-bank bridge crossing, all six benches and five signs, wave, mute / audio startup, volume, every quality preset, entry respawn (including while seated), fall recovery, focus loss, visibility suspension / resumption, persistence, emulated simultaneous touch controls and the WebGL error screen. The browser run reported no console errors or failed assets. Avatar jacket changes during gameplay are also checked. Screenshots were inspected for desktop entry, gameplay, avatar close-up, grove, pond, birds, sitting, signs, and 390 × 844 mobile entry / gameplay.

A 90-frame requestAnimationFrame sample near the plaza at medium quality, 1440 × 1000 viewport and device pixel ratio 1, measured 33.3 ms mean, 33.3 ms median frame time and 34.0 ms p95 (about 30 FPS) on Intel UHD graphics via ANGLE / Direct3D 11 in headless Chrome. The sampled frame had approximately 680 draw calls and 1,201,000 triangles, including renderer passes. This is a short idle-view measurement, not a guarantee for the full park, every camera angle, other GPUs or real phones. Raw measurements and screenshots are in `artifacts/browser-report.json` and `artifacts/` after running browser checks.

Vite reports a large scene chunk (about 861 kB gzipped) because it includes Three.js scene code and the bundled Rapier WASM. The UI and scene are split; no runtime CDN is required. First-load speed on slow networks has not been measured.
