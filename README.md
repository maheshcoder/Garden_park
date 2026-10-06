# Enchanted Garden

A procedural Three.js garden with a walking gardener, blossoming trees, wildflower meadows, birds, butterflies, pond, weather and a responsive HUD. The original Canvas 2D application remains at /classic.html.

## Run

Use Node.js 24 or newer for the test runner's native TypeScript support. Install the locked dependencies:

~~~sh
npm ci
npm run dev
~~~

Open the local URL printed by Vite. To test the production output:

~~~sh
npm run build
npm run preview
~~~

The existing Vite plugin copies script.js for the classic page into dist. Keep both HTML entries and the copied script when hosting. There is no backend or environment-variable setup.

## Controls

- WASD / arrow keys: walk relative to the camera; drag: orbit; scroll: zoom.
- E or a canvas click: interact; 1 / 2 / 3: explore, water, feed.
- Space: plant; B: invite butterfly; R: rain; N: day/night; P: pause.
- Mobile: left joystick, drag the world to look, right action button, bottom toolbelt.
- Walk close to flowers to discover them. Watering consumes water and changes moisture/growth; refill by the pond with Water selected.
- Place bird food and step back. Birds approach, land, consume the pile and return to flight. Picking flowers replenishes food.
- Field notes shows session goals. Garden view offers a wider camera; return to walk to interact.
- Settings contains seeds, weather, sound, volume, performance, reduced motion and the original garden controls.

Sound starts muted and is enabled through Settings. Progress and inventory are session-only, as in the original application; refreshing starts a new visit.

## Validation

~~~sh
npm test
npm run typecheck
npm run check
npm run build
npm run test:browser
node scripts/browser-check.mjs --preview
~~~

The regression suite uses Node's test runner. TypeScript strictly checks src/state/GardenState.ts; the retained JavaScript modules receive syntax, build and runtime checks. No lint tool was configured in the original repository; npm run check is explicitly a syntax check, not a linter.

The browser runner starts and stops its own Vite server and hidden headless Chrome, then exercises desktop/mobile controls, gameplay and fallback. It defaults to Chrome's standard Windows location; set CHROME_PATH to another Chromium executable if needed. Ports 4175 and 9227 must be free. Screenshots go to artifacts/ (gitignored). Its software renderer is suitable for correctness checks, not hardware FPS claims. The existing /_qa3d.html remains available in development and runs 91 integration checks.

## Assets and architecture

No external models, textures, images or sound files are required. Geometry, canvas textures and WebAudio are generated locally. public/favicon.ico is the only new static asset and is copied by Vite. There are no model/audio folders to populate and no external asset URLs.

The existing scene, player, birds and systems remain modular. src/scene/Landscape.js adds seeded instanced scenery. src/ui/GardenHUD.js owns the responsive settings and journal. src/state/GardenState.ts tracks unique discoveries and derives journey progress from existing care systems, without duplicating inventory state. See docs/PROJECT_ANALYSIS.md for the pre-implementation analysis and docs/UPGRADE_REPORT.md for the complete file report.

For diagnostics, window.__gardenApp.metrics reports sampled FPS, render calls, triangles and the active quality tier. Low sustained FPS reduces resolution, shadows and grass automatically; the explicit quality setting is also available. Rendering pauses when the document is hidden. The WebGL fallback links to the classic application.
