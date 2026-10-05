/* ===================================================================
   InteractionSystem - one registry every world object registers with.
   The player controller only ever talks to this system; adding a new
   interactable means register()-ing it, never editing controller code.

     register({ id, pos, radius, getPrompt(tool), onInteract(ctx) })

   Each frame it picks the best candidate (crosshair ray first, then
   proximity) and publishes a single prompt like "[E] Water Plant".
   =================================================================== */
import * as THREE from 'three';

export class InteractionSystem {
  constructor() {
    this.entries = [];
    this.active = null;
    this.promptEl = document.getElementById('prompt');
    this._ray = new THREE.Raycaster();
    this._ray.far = 40;
    this._center = new THREE.Vector2(0, 0);
    this._lastPrompt = null;
  }

  register(entry) {
    this.entries.push(entry);
    return entry;
  }

  unregister(id) {
    const i = this.entries.findIndex((e) => e.id === id);
    if (i >= 0) this.entries.splice(i, 1);
    if (this.active && this.active.id === id) this.active = null;
  }

  clear() { this.entries.length = 0; this.active = null; }

  /* camera: for crosshair raycasting; playerPos: proximity fallback */
  update(camera, playerPos, tool) {
    let best = null, bestScore = -Infinity;

    /* 1) what is the camera pointing at? */
    this._ray.setFromCamera(this._center, camera);
    const hits = this._ray.intersectObjects(
      this.entries.map((e) => e.object).filter(Boolean), true
    );
    let viaRay = null;
    if (hits.length) {
      viaRay = this._findByObject(hits[0].object);
    }

    /* 2) score every candidate the player could reach */
    for (const e of this.entries) {
      if (!e.pos) continue;
      const d = playerPos.distanceTo(e.pos);
      if (d > (e.maxRange || 6)) continue;
      const prompt = e.getPrompt ? e.getPrompt(tool) : null;
      if (!prompt) continue;
      let score = 10 - d;
      if (e === viaRay) score += 100;
      if (score > bestScore) { bestScore = score; best = e; }
    }

    this.active = best;
    const text = best ? (best.getPrompt(tool)) : null;
    if (text !== this._lastPrompt) {
      this._lastPrompt = text;
      if (this.promptEl) {
        if (text) {
          this.promptEl.innerHTML = '<kbd>E</kbd>' + text;
          this.promptEl.hidden = false;
        } else {
          this.promptEl.hidden = true;
        }
      }
    }
  }

  /* run the active interaction; returns true if something happened */
  interact(ctx) {
    if (!this.active || !this.active.onInteract) return false;
    const prompt = this.active.getPrompt ? this.active.getPrompt(ctx.tool) : null;
    if (!prompt) return false;
    this.active.onInteract(ctx);
    return true;
  }

  _findByObject(obj) {
    /* walk up from the hit child to the registered root */
    let cur = obj;
    while (cur) {
      const e = this.entries.find((x) => x.object === cur);
      if (e) return e;
      cur = cur.parent;
    }
    return null;
  }

  /* used by pointer clicks: which entry is under this screen point? */
  pickAt(camera, ndcX, ndcY) {
    this._ray.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hits = this._ray.intersectObjects(
      this.entries.map((e) => e.object).filter(Boolean), true
    );
    return hits.length ? this._findByObject(hits[0].object) : null;
  }
}
