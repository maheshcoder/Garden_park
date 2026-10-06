# Garden upgrade analysis

The repository is a clean, client-only JavaScript ES-module application. Vite 8.3.2 builds two HTML entry points; Three.js 0.186.1 is the only runtime dependency. There is no React, TypeScript compiler, router, backend, authentication, API, environment configuration, or Capacitor project. The lockfile agrees with the manifest. Assets are procedural geometry, canvas textures and synthesized WebAudio; the PNGs at the root are earlier screenshots.

The original Canvas 2D garden remains in classic.html, script.js and style.css. The 3D entry is index.html -> src/main.js. GardenApp orchestrates scene, terrain, instanced flowers/trees, butterflies, a procedural player, bird state machines, centralized interactions, feeding, watering, rain and audio. State currently lives in those system instances; window.garden preserves the classic console API. Existing QA pages exercise both applications.

Preserve planting/picking, five seed species, butterflies, rain, day/night, pause, clear, the classic facade, URL presets and both build entries. Reuse all existing 3D modules and resource pools. No framework migration or backend is justified. Improve the 3D presentation independently of the classic stylesheet.

Implementation: repair startup ordering, instance visibility, invalid butterfly positions, reach checks, pointer targeting, mobile movement and bird landing; add a modular procedural landscape, responsive HUD/settings/journal, useful loading/WebGL fallback, reduced motion, optional volume control, bounded rendering quality and runtime diagnostics. Keep state in the existing systems and derive progress centrally. Add regression tests and a Chrome DevTools smoke runner without introducing a browser automation dependency.

Reference: https://messenger.abeto.co/ is inspiration only. No source code, branding or assets are copied. Its canvas-only page could not be visually inspected through the text browser.
