/* ===================================================================
   FeedingSystem - simple, data-only flow:

     placeFood(pos)            -> FoodPlaced {mesh, amount}
       -> birds notice         -> BirdDetectsFood (BirdManager polls)
       -> bird flies, lands     -> eats over time
       -> eatOne(pile)         -> amount--; crumbs + munch sound
       -> amount <= 0          -> FoodConsumed (mesh removed, count--)

   The system never tells birds what to do; BirdManager polls piles()
   each frame. That keeps the two systems decoupled per the spec.
   =================================================================== */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { rand, TAU } from '../utils.js';

const PILE_AMOUNT = 4;          /* bites per pile */

export class FeedingSystem {
  constructor(scene, terrain, effects, audio) {
    this.scene = scene;
    this.terrain = terrain;
    this.effects = effects;
    this.audio = audio;
    this.food = CONFIG.startFood;               /* units in the player's pocket */
    this.max = CONFIG.maxFood;
    this.piles = [];
    this.totalFed = 0;           /* bites eaten - drives progress */
    this._nextId = 1;

    this.pileGeo = new THREE.SphereGeometry(0.28, 8, 6);
    this.pileGeo.scale(1, 0.45, 1);
    this.pileMat = new THREE.MeshStandardMaterial({ color: 0xd8b46a, roughness: 1 });
    this.seedGeo = new THREE.SphereGeometry(0.05, 5, 4);
    this.seedMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1 });
  }

  takeFood(n = 1) {
    if (this.food < n) return false;
    this.food -= n;
    return true;
  }

  /* place a pile on the ground; returns the pile or null */
  placeFood(x, z, y) {
    if (this.food <= 0) return null;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !this.terrain.inBounds(x, z) || this.terrain.inPond(x, z)) return null;
    this.food--;
    const g = new THREE.Group();
    const mound = new THREE.Mesh(this.pileGeo, this.pileMat);
    mound.castShadow = true;
    mound.receiveShadow = true;
    g.add(mound);
    /* a few visible seeds scattered on top */
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(this.seedGeo, this.seedMat);
      const a = rand(TAU), d = rand(0.05, 0.24);
      s.position.set(Math.cos(a) * d, 0.1, Math.sin(a) * d);
      g.add(s);
    }
    g.position.set(x, (y !== undefined ? y : this.terrain.heightAt(x, z)) + 0.06, z);
    this.scene.add(g);

    const pile = { id: this._nextId++, mesh: g, pos: g.position.clone(), amount: PILE_AMOUNT };
    this.piles.push(pile);
    this.effects?.sparkle(g.position.x, g.position.y + 0.2, g.position.z, '#ffe9a8', 6);
    this.audio?.feed();
    return pile;
  }

  /* BirdManager: nearest pile with food left, within range of pos */
  findFoodNear(pos, range = 40) {
    let best = null, bd = range * range;
    for (const p of this.piles) {
      if (p.amount <= 0) continue;
      const d = p.pos.distanceToSquared(pos);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /* BirdManager: one bite. Returns true while food remains. */
  eatOne(pile) {
    if (pile.amount <= 0) return false;
    pile.amount--;
    this.totalFed++;
    this.effects?.crumbs(pile.pos.x, pile.pos.y + 0.1, pile.pos.z, 3);
    this.audio?.munch();
    /* shrink the mound as it is eaten */
    const k = 0.35 + 0.65 * (pile.amount / PILE_AMOUNT);
    pile.mesh.scale.setScalar(k);
    if (pile.amount <= 0) this.removePile(pile);
    return pile.amount > 0;
  }

  removePile(pile) {
    const i = this.piles.indexOf(pile);
    if (i >= 0) {
      this.piles.splice(i, 1);
      this.scene.remove(pile.mesh);
    }
  }

  clearPiles() {
    for (const p of [...this.piles]) this.removePile(p);
  }

  update(dt) {
    /* piles sit still today; hook for future decay/ant animation */
  }
}
