/* ===================================================================
   BirdManager - owns every Bird + BirdBehavior, pumps them each
   frame, handles startle-on-approach and occasional ambient chirps.

   BirdManager
    ├── Bird           (visual + flight + animation, Bird.js)
    ├── BirdBehavior   (FLYING/LANDING/LANDED/SEEKING_FOOD/EATING/RETURNING)
    └── bird flock loop
   =================================================================== */
import { Bird } from './Bird.js';
import { BirdBehavior, STATE } from './BirdBehavior.js';
import { rand } from '../utils.js';

export class BirdManager {
  constructor(scene, world) {
    this.world = world;
    this.birds = [];
    this.chirpTimer = rand(2, 5);
    this.count = world.count || 8;
    for (let i = 0; i < this.count; i++) {
      const b = new Bird(scene);
      this.birds.push({ bird: b, brain: new BirdBehavior(b, world) });
    }
  }

  /* any bird currently in the given state (for tests/debug) */
  birdsInState(name) {
    return this.birds.filter((e) => e.brain.state === name);
  }

  /* nearest grounded bird to a point - used by "feed by hand" flows */
  nearestGrounded(pos, range = 3) {
    let best = null, bd = range * range;
    for (const e of this.birds) {
      if (e.brain.state !== STATE.LANDED && e.brain.state !== STATE.EATING) continue;
      const d = e.bird.pos.distanceToSquared(pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  update(dt, playerPos) {
    for (const e of this.birds) {
      /* player walking up scares grounded birds off */
      if (playerPos && e.bird.pos.distanceToSquared(playerPos) < 4.5) {
        e.brain.startle();
      }
      e.brain.update(dt);
    }
    /* ambient chirps so the garden sounds alive */
    this.chirpTimer -= dt;
    if (this.chirpTimer <= 0) {
      this.chirpTimer = rand(2.5, 7);
      if (this.world.audio) this.world.audio.chirp();
    }
  }
}
