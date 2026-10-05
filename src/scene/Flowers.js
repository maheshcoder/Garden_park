/* ===================================================================
   Flowers - 5 species matching the classic FLOWER_TYPES palette.
   Instancing: one shared stem InstancedMesh (per-instance height via
   scale) + one head InstancedMesh per species (per-instance colour).
   Plant data follows the spec:
     Plant { health, growth, waterLevel, watered() }
   =================================================================== */
import * as THREE from 'three';
import { CONFIG, SEEDS } from '../config.js';
import { swayMaterial } from '../materials.js';
import { clamp, lerp, rand, pick, TAU, easeOutCubic } from '../utils.js';

/* ported from script.js FLOWER_TYPES (heights scaled px -> world) */
export const FLOWER_SPECS = {
  rose:      { label: 'Rose',      head: 'round', h: 0.62, headR: 0.16, petals: 12, core: '#ffd166',
               colors: ['#ff4f81', '#e01e6f', '#ff9ec4'], stem: '#2f9e4f' },
  daisy:     { label: 'Daisy',     head: 'round', h: 0.46, headR: 0.14, petals: 16, core: '#ffcc33',
               colors: ['#ffffff', '#ffe9f0', '#f6f2ff'], stem: '#37a35a' },
  sunflower: { label: 'Sunflower', head: 'round', h: 0.80, headR: 0.24, petals: 20, core: '#6b3f1d',
               colors: ['#ffc61a', '#ffa51f', '#ffdd55'], stem: '#2b7a3d' },
  tulip:     { label: 'Tulip',     head: 'cup',   h: 0.58, headR: 0.13, petals: 6,  core: '#ffd166',
               colors: ['#ff3d6e', '#ff7b54', '#c86bff', '#ffe066'], stem: '#2f9e4f' },
  lavender:  { label: 'Lavender',  head: 'spike', h: 0.66, headR: 0.07, petals: 9,  core: '#8e6bff',
               colors: ['#8e6bff', '#b39bff', '#6f8dff'], stem: '#3a8f52' }
};

const UP = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();

/* ---------------------------------------------------------- geometry */
function petalGeo(w, l, bend) {
  const g = new THREE.SphereGeometry(1, 6, 4, 0, TAU, 0, Math.PI);
  g.scale(w, l * 0.12, l);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setY(i, p.getY(i) + Math.pow(Math.max(p.getZ(i) / l, 0), 2) * bend);
  }
  g.computeVertexNormals();
  return g;
}

/* head geometry with baked vertex colours: petals = white (so the
   per-instance colour shows through), core = species core colour   */
function headGeometry(spec) {
  const parts = [];
  const vc = (g, col) => {
    const c = new THREE.Color(col);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };

  if (spec.head === 'round') {
    const core = new THREE.SphereGeometry(spec.headR * 0.45, 10, 6);
    core.scale(1, 0.55, 1);
    parts.push(vc(core, spec.core));
    const pl = petalGeo(spec.headR * 0.35, spec.headR, spec.headR * 0.3);
    for (let i = 0; i < spec.petals; i++) {
      const a = (i / spec.petals) * TAU;
      const g = pl.clone();
      g.rotateX(-Math.PI / 2 + 0.35);
      g.rotateY(a);
      g.translate(Math.sin(a) * spec.headR * 0.5, 0, Math.cos(a) * spec.headR * 0.5);
      parts.push(vc(g, '#ffffff'));
    }
  } else if (spec.head === 'cup') {
    /* tulip: 6 petals curving upward into a cup */
    for (let i = 0; i < spec.petals; i++) {
      const a = (i / spec.petals) * TAU;
      const g = petalGeo(spec.headR * 0.5, spec.headR * 1.15, -spec.headR * 0.45);
      g.rotateX(-0.28);
      g.rotateY(a);
      g.translate(Math.sin(a) * spec.headR * 0.32, spec.headR * 0.5, Math.cos(a) * spec.headR * 0.32);
      parts.push(vc(g, '#ffffff'));
    }
    const core = new THREE.SphereGeometry(spec.headR * 0.3, 8, 6);
    core.scale(1, 1.4, 1);
    core.translate(0, spec.headR * 0.4, 0);
    parts.push(vc(core, spec.core));
  } else {
    /* lavender: a spike of little florets stacked upward */
    for (let i = 0; i < spec.petals; i++) {
      const t = i / (spec.petals - 1);
      const g = new THREE.IcosahedronGeometry(spec.headR * (1 - t * 0.55), 0);
      g.translate(
        Math.sin(i * 2.4) * spec.headR * 0.35 * (1 - t),
        t * spec.h * 0.42 + 0.03,
        Math.cos(i * 2.4) * spec.headR * 0.35 * (1 - t)
      );
      parts.push(vc(g, i % 2 ? '#ffffff' : spec.core));
    }
  }
  return mergeColored(parts);
}

/* ------------------------------------------------------------- stem */
/* one geometry for every species: stalk + two leaves, tinted per
   instance so species stem colours still apply                       */
function stemGeometry() {
  const parts = [];
  const stalk = new THREE.CylinderGeometry(0.014, 0.022, 1, 5, 3);
  stalk.translate(0, 0.5, 0);
  parts.push(stalk);
  for (const [y, s, rot] of [[0.35, 1, 0.9], [0.6, -1, -0.8]]) {
    const leaf = new THREE.SphereGeometry(1, 5, 3);
    leaf.scale(0.16, 0.012, 0.07);
    leaf.rotateY(rot);
    leaf.rotateZ(0.5 * Math.sign(rot));
    leaf.translate(0.06 * Math.sign(rot), y, 0);
    parts.push(leaf);
  }
  return mergeColored(parts, '#ffffff');
}

/* merge parts that each carry a 'color' attribute */
function mergeColored(list, forceColor) {
  let vCount = 0;
  const parts = list.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    vCount += ng.attributes.position.count;
    return ng;
  });
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else {
      const c = new THREE.Color(forceColor || '#ffffff');
      for (let i = 0; i < g.attributes.position.count; i++) {
        col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b;
      }
    }
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/* ============================================================ class */
export class Flowers {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.flowers = [];
    this.picked = 0;
    this.group = new THREE.Group();
    scene.add(this.group);

    const cap = CONFIG.flowerCapacityPerSpecies;

    /* shared stems: white vertex colours tinted by instance colour */
    const stemMat = swayMaterial(
      { color: 0xffffff, vertexColors: true, roughness: 0.9 },
      { stiffness: 0.4, gust: 1.5 }
    );
    this.stemMesh = new THREE.InstancedMesh(stemGeometry(), stemMat, CONFIG.maxFlowers);
    this.stemMesh.castShadow = true;
    this.stemMesh.frustumCulled = false;
    this.stemMesh.count = 0;
    this.group.add(this.stemMesh);

    /* one head mesh per species, per-instance colour */
    this.headMeshes = {};
    for (const k of SEEDS) {
      const mat = swayMaterial(
        { color: 0xffffff, vertexColors: true, roughness: 0.85 },
        { stiffness: 0.3, gust: 1.6 }
      );
      const m = new THREE.InstancedMesh(headGeometry(FLOWER_SPECS[k]), mat, cap);
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      m.userData.species = k;
      this.headMeshes[k] = m;
      this.group.add(m);
    }
    /* per-species free slots: instance index = position in flowers[]
       restricted to same species via slotMap                     */
    this.slotNext = {}; for (const k of SEEDS) this.slotNext[k] = 0;
  }

  /* ------------------------------------------------------------ API */
  /* returns the flower record or null when the garden/caps are full */
  plant(x, z, type) {
    if (this.flowers.length >= CONFIG.maxFlowers) return null;
    if (this.terrain.inPond(x, z)) return null;
    type = FLOWER_SPECS[type] ? type : pick(SEEDS);
    const spec = FLOWER_SPECS[type];
    const slot = this.slotNext[type]++;
    if (slot >= CONFIG.flowerCapacityPerSpecies) return null;

    const f = {
      type, spec, slot,
      x, z,
      y: this.terrain.heightAt(x, z),
      color: pick(spec.colors),
      stemColor: spec.stem,
      /* spec: health / growth / waterLevel */
      health: 1, growth: 0.08, waterLevel: rand(0.35, 0.7),
      growSpeed: rand(0.10, 0.16) * (this.terrain.isOnSoil(x, z, 0.4) ? 1.5 : 1),
      yaw: rand(TAU),
      scale: rand(0.85, 1.2),
      waterT: 0,          /* seconds since last watered (sparkle timer) */
      hoverT: 0,
      dead: false
    };
    /* spec-shaped API: Plant { health, growth, waterLevel, watered() } */
    f.watered = () => this.water(f);
    this.flowers.push(f);
    this._sync(f);
    return f;
  }

  /* classic right-click removal: no pick counted */
  remove(f) {
    f.dead = true;
    this._hide(f);
    const i = this.flowers.indexOf(f);
    if (i >= 0) this.flowers.splice(i, 1);
    /* compact: rebuilding indices keeps slot math trivial at 90 items */
    this._reindex();
    return true;
  }

  /* hand tool: pick -> counted, petals burst by caller */
  pick(f) {
    this.picked++;
    return this.remove(f);
  }

  /* watering system calls this */
  water(f) {
    f.waterLevel = Math.min(1, f.waterLevel + 0.55);
    f.health = Math.min(1, f.health + 0.12);
    f.waterT = 0;
    f.hoverT = 1;
    this._sync(f);
  }

  /* focus/inspect: pointer hovering a flower makes it bob + shine */
  setHover(f, on) { f.hoverT = on ? 1 : Math.max(0, f.hoverT - 0.02); }

  clear() {
    for (const f of this.flowers) this._hide(f);
    this.flowers.length = 0;
    this._reindex();
  }

  /* average health 0..1 for the HUD garden-health chip */
  health() {
    if (!this.flowers.length) return 1;
    let s = 0;
    for (const f of this.flowers) s += f.health;
    return s / this.flowers.length;
  }

  /* nearest flower to a world point within radius (interaction) */
  nearest(x, z, radius) {
    let best = null, bd = radius * radius;
    for (const f of this.flowers) {
      const d = (f.x - x) * (f.x - x) + (f.z - z) * (f.z - z);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  /* --------------------------------------------------- instancing -- */
  /* renumber slots after a removal so every species stays compact  */
  _reindex() {
    const bySpecies = {};
    for (const f of this.flowers) {
      (bySpecies[f.type] = bySpecies[f.type] || []).push(f);
    }
    for (const k of Object.keys(this.headMeshes)) {
      const list = bySpecies[k] || [];
      for (let i = 0; i < list.length; i++) list[i].slot = i;
      this.slotNext[k] = list.length;
      this.headMeshes[k].count = list.length;
    }
    for (let i = 0; i < this.flowers.length; i++) this.flowers[i].stemSlot = i;
    this.stemMesh.count = this.flowers.length;
    for (const f of this.flowers) this._sync(f);
  }

  _hide(f) {
    dummy.position.set(0, -999, 0);
    dummy.scale.setScalar(0.0001);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    if (f.stemSlot !== undefined) this.stemMesh.setMatrixAt(f.stemSlot, dummy.matrix);
    const hm = this.headMeshes[f.type];
    if (hm && f.slot !== undefined) hm.setMatrixAt(f.slot, dummy.matrix);
    this.stemMesh.instanceMatrix.needsUpdate = true;
    if (hm) hm.instanceMatrix.needsUpdate = true;
  }

  /* write one flower's stem + head transform (and colour)           */
  _sync(f) {
    if (f.stemSlot === undefined) f.stemSlot = this.flowers.indexOf(f);
    const grow = easeOutCubic(clamp(f.growth, 0, 1));
    const h = f.spec.h * f.scale * (0.25 + 0.75 * grow);
    const pulse = 1 + f.waterT * 0 + Math.sin(f.waterT * 6) * 0.04 * Math.max(0, 1 - f.waterT * 2);

    /* stem: unit height geometry scaled to the flower's height */
    dummy.position.set(f.x, f.y, f.z);
    dummy.rotation.set(0, f.yaw, 0);
    dummy.scale.set(f.scale * (0.7 + 0.3 * grow), h, f.scale * (0.7 + 0.3 * grow));
    dummy.updateMatrix();
    this.stemMesh.setMatrixAt(f.stemSlot, dummy.matrix);
    this.stemMesh.setColorAt(f.stemSlot, new THREE.Color(f.stemColor));

    /* head: sits on top of the stem, tilts slightly when hovered */
    const hm = this.headMeshes[f.type];
    const hs = f.scale * (0.3 + 0.7 * grow) * pulse * (1 + f.hoverT * 0.12);
    dummy.position.set(f.x, f.y + h, f.z);
    dummy.rotation.set(f.hoverT * 0.18, f.yaw + f.waterT * 0.05, 0);
    dummy.scale.setScalar(hs);
    dummy.updateMatrix();
    hm.setMatrixAt(f.slot, dummy.matrix);
    hm.setColorAt(f.slot, new THREE.Color(f.color));

    this.stemMesh.instanceMatrix.needsUpdate = true;
    hm.instanceMatrix.needsUpdate = true;
    if (this.stemMesh.instanceColor) this.stemMesh.instanceColor.needsUpdate = true;
    if (hm.instanceColor) hm.instanceColor.needsUpdate = true;
  }

  /* ------------------------------------------------- simulation --- */
  /* Plant spec: health, growth, waterLevel, watered()               */
  update(dt) {
    let dirty = false;
    for (const f of this.flowers) {
      /* water is consumed over time; the classic 2D garden drains
         at roughly this rate, keeping watering meaningful          */
      const before = f.growth;
      f.waterLevel = Math.max(0, f.waterLevel - dt * 0.035);
      f.waterT += dt;
      f.hoverT = Math.max(0, f.hoverT - dt * 1.5);

      /* growth: boosted while watered and while recently watered */
      if (f.growth < 1) {
        const boost = 1 + f.waterLevel * 1.6;
        f.growth = Math.min(1, f.growth + dt * f.growSpeed * boost);
      }

      /* health: recovers when watered, wilts slowly when dry */
      if (f.waterLevel > 0.12) {
        f.health = Math.min(1, f.health + dt * 0.05);
      } else {
        f.health = Math.max(0.25, f.health - dt * 0.02);
      }

      /* re-sync while growing or when a water pulse is visible */
      if (f.growth < 1 || before !== f.growth || f.waterT < 1.2 || f.hoverT > 0.01) {
        this._sync(f);
        dirty = true;
      }
    }
    if (dirty) {
      this.stemMesh.instanceMatrix.needsUpdate = true;
    }
  }
}


