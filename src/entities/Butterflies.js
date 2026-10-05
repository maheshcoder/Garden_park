/* ===================================================================
   Butterflies - the classic 2D feature, lifted into 3D.
   Preserved behaviours (all QA-verified in the 2D build):
     - they follow the cursor (ray-cast to a plane instead of pixels)
     - hard containment: never below the lawn, never outside the fence
     - spawns clamp to the sky half, never pop in over the grass
   Rendered as ONE InstancedMesh of merged open-wing meshes; banking
   plus vertical squash sells the flap. Max 24.
   =================================================================== */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { rand, pick, clamp, TAU } from '../utils.js';

const PALETTES = [
  { wing: 0xff9a3c, mark: 0xf2762a },  /* monarch */
  { wing: 0x63b3ff, mark: 0x3f7fe0 },  /* blue    */
  { wing: 0xff8fb8, mark: 0xef5f96 },  /* pink    */
  { wing: 0xf7f3ff, mark: 0xdbd4f0 },  /* white   */
  { wing: 0xc58bff, mark: 0x9a5ae0 },  /* purple  */
  { wing: 0xffe066, mark: 0xf0b429 }   /* yellow  */
];

function butterflyGeometry() {
  /* two wing quads + slim body, all in one buffer */
  const parts = [];
  const wing = (s) => {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([
      /* forewing */ 0.02 * s, 0, 0.06,  0.30 * s, 0.02, 0.20,  0.34 * s, 0.01, 0.02,
      /* hindwing */ 0.02 * s, 0, -0.04, 0.22 * s, 0.01, -0.16, 0.26 * s, 0.0, -0.02
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  };
  parts.push(wing(1), wing(-1));
  const body = new THREE.CylinderGeometry(0.02, 0.012, 0.24, 5);
  body.rotateX(Math.PI / 2);
  parts.push(body);

  let count = 0;
  const ready = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    count += ng.attributes.position.count;
    return ng;
  });
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of ready) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

export class Butterflies {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.list = [];
    this.pointer = null;      /* THREE.Vector3 or null */
    this.time = 0;

    this.geo = butterflyGeometry();
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide,
      transparent: true, opacity: 0.96
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, CONFIG.maxButterflies);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
  }

  /* spawn near a point; y is clamped into the sky so nothing pops in
     over the grass (classic addButterfly fix)                       */
  add(x, z) {
    if (this.list.length >= CONFIG.maxButterflies) this.list.shift();
    const cx = x !== undefined ? x : rand(-15, 15);
    const cz = z !== undefined ? z : rand(-15, 15);
    const groundY = this.terrain.heightAt(cx, cz);
    const pal = pick(PALETTES);
    const b = {
      x: cx, y: groundY + rand(3.5, 7),
      vx: rand(-1, 1), vy: rand(-0.3, 0.3), vz: rand(-1, 1),
      goal: new THREE.Vector3(cx + rand(-6, 6), groundY + rand(3, 8), cz + rand(-6, 6)),
      phase: rand(TAU),
      flapSpeed: rand(7, 11),
      size: rand(0.8, 1.3),
      color: pal.wing,
      turn: rand(-1, 1)
    };
    /* hard clamp: never spawn over the grass */
    b.y = Math.min(b.y, groundY + 7.4);
    this.list.push(b);
    const i = this.list.length - 1;
    this.mesh.setColorAt(i, this._color.setHex(pal.wing));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return b;
  }

  clear() { this.list.length = 0; }

  /* the cursor's world point (ray vs. a horizontal plane at h) */
  setPointer(ray, planeY) {
    if (!ray) { this.pointer = null; return; }
    const t = (planeY - ray.origin.y) / ray.direction.y;
    if (t > 0 && t < 200) {
      if (!this.pointer) this.pointer = new THREE.Vector3();
      this.pointer.copy(ray.origin).addScaledVector(ray.direction, t);
    } else {
      this.pointer = null;
    }
  }

  update(dt) {
    this.time += dt;
    const attract = CONFIG.attractRadius;
    const goalProbe = new THREE.Vector3();
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i];
      const groundY = this.terrain.heightAt(b.x, b.z);

      /* seek the wander goal, or the cursor if it is close enough */
      let gx = b.goal.x, gy = b.goal.y, gz = b.goal.z;
      let nearCursor = false;
      if (this.pointer) {
        const d = Math.hypot(this.pointer.x - b.x, this.pointer.z - b.z);
        if (d < attract) {
          nearCursor = true;
          gx = this.pointer.x;
          gy = Math.max(groundY + 1.6, this.pointer.y + Math.sin(this.time * 2 + b.phase) * 0.5);
          gz = this.pointer.z;
        }
      }
      const dx = gx - b.x, dy = gy - b.y, dz = gz - b.z;
      const dl = Math.hypot(dx, dy, dz) || 1;
      const speed = nearCursor ? 3.4 : 1.9;
      /* steering with a bit of wander noise */
      b.vx += ((dx / dl) * speed - b.vx) * Math.min(1, dt * 2.2) + rand(-0.4, 0.4) * dt;
      b.vy += ((dy / dl) * speed - b.vy) * Math.min(1, dt * 2.2) + Math.sin(this.time * 3 + b.phase) * dt * 0.8;
      b.vz += ((dz / dl) * speed - b.vz) * Math.min(1, dt * 2.2) + rand(-0.4, 0.4) * dt;

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;

      /* hard containment backstop (classic resize/clamp fix) */
      const r = Math.hypot(b.x, b.z);
      if (r > 46) { b.x *= 46 / r; b.z *= 46 / r; b.vx *= -0.5; b.vz *= -0.5; }
      b.y = clamp(b.y, groundY + 1.2, groundY + 16);
      if (b.y <= groundY + 1.25 && b.vy < 0) b.vy *= -0.6;

      /* reached the goal? pick a new one */
      goalProbe.set(b.x, b.y, b.z);
      if (b.goal.distanceToSquared(goalProbe) < 1.2) {
        const a = rand(TAU), d = rand(4, 18);
        let nx = Math.cos(a) * d, nz = Math.sin(a) * d;
        const rr = Math.hypot(nx, nz);
        if (rr > 40) { nx *= 40 / rr; nz *= 40 / rr; }
        b.goal.set(nx, this.terrain.heightAt(nx, nz) + rand(2.5, 9), nz);
      }

      /* instance transform: face the velocity, flap via vertical squash */
      const yaw = Math.atan2(b.vx, b.vz);
      const flap = 0.5 + 0.5 * Math.sin(this.time * b.flapSpeed + b.phase);
      this._dummy.position.set(b.x, b.y, b.z);
      this._dummy.rotation.set(
        -clamp(Math.atan2(b.vy, Math.hypot(b.vx, b.vz)), -0.6, 0.6),
        yaw,
        (flap - 0.5) * 0.3
      );
      this._dummy.scale.set(b.size, b.size * (0.55 + flap * 0.6), b.size);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }
    /* hide unused instances */
    this._dummy.scale.setScalar(0.0001);
    this._dummy.position.set(0, -999, 0);
    this._dummy.updateMatrix();
    for (let i = this.list.length; i < CONFIG.maxButterflies; i++) {
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.mesh.count = CONFIG.maxButterflies;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
