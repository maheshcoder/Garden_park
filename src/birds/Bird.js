/* ===================================================================
   Bird - the visual bird: one merged body geometry (shared across
   all birds) + two wing meshes that flap via animate() below.
   Colours differ per instance through the material, so 8 birds cost
   8 * 3 = 24 tiny draw calls with 2 shared geometries.
   =================================================================== */
import * as THREE from 'three';
import { rand, pick, TAU, lerp, clamp } from '../utils.js';

/* palette: [body, wing, belly] */
export const BIRD_PALETTES = [
  ['#8a5a3a', '#6e4526', '#e8d9b8'],   /* robin-ish   */
  ['#4a5a78', '#39465e', '#cdd8ea'],   /* blue-ish    */
  ['#c9a227', '#a8871d', '#f3e6bc'],   /* goldfinch   */
  ['#7d7d86', '#5f5f68', '#d9d9e0'],   /* pigeon      */
  ['#2f3542', '#1f242e', '#f5f5f7']    /* magpie-ish  */
];

let BODY = null, WING = null;

function sharedGeometries() {
  if (BODY) return;
  /* body: ellipsoid + head + beak + tail, merged as one geometry */
  const body = new THREE.SphereGeometry(0.16, 8, 6);
  body.scale(0.85, 0.9, 1.35);
  const head = new THREE.SphereGeometry(0.1, 7, 6);
  head.translate(0, 0.1, 0.19);
  const beak = new THREE.ConeGeometry(0.035, 0.1, 5);
  beak.rotateX(Math.PI / 2);
  beak.translate(0, 0.09, 0.3);
  const tail = new THREE.BoxGeometry(0.09, 0.02, 0.24);
  tail.translate(0, 0.02, -0.26);
  tail.rotateX(0.25);
  BODY = mergeSimple([body, head, beak, tail]);

  /* wing: flat tapered quad, hinged at the shoulder (x = 0) */
  const w = new THREE.BufferGeometry();
  const v = new Float32Array([
    0, 0, 0.10,   0, 0, -0.06,
    0.30, 0, 0.16,  0.30, 0, -0.10,
    0.46, 0, 0.05,  0.46, 0, -0.04
  ]);
  w.setAttribute('position', new THREE.BufferAttribute(v, 3));
  w.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5]);
  w.computeVertexNormals();
  WING = w;
}

function mergeSimple(list) {
  let count = 0;
  const parts = list.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    count += ng.attributes.position.count;
    return ng;
  });
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}

export class Bird {
  constructor(scene) {
    sharedGeometries();
    const pal = pick(BIRD_PALETTES);
    this.pal = pal;
    this.size = rand(0.85, 1.2);
    this.group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: pal[0], roughness: 0.9 });
    const wingMat = new THREE.MeshStandardMaterial({
      color: pal[1], roughness: 0.9, side: THREE.DoubleSide
    });
    this.body = new THREE.Mesh(BODY, bodyMat);
    this.body.castShadow = true;
    this.group.add(this.body);

    /* left wing mirrored: scale.x = -1 flips winding, hence DoubleSide */
    this.wingL = new THREE.Mesh(WING, wingMat);
    this.wingR = new THREE.Mesh(WING, wingMat);
    this.wingR.scale.x = -1;
    this.group.add(this.wingL, this.wingR);

    this.group.scale.setScalar(this.size);
    scene.add(this.group);

    /* motion state */
    this.pos = new THREE.Vector3(rand(-20, 20), rand(6, 12), rand(-20, 20));
    this.vel = new THREE.Vector3(rand(-2, 2), 0, rand(-2, 2));
    this.target = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.bank = 0;

    /* animation state */
    this.flapPhase = rand(TAU);
    this.flapAmp = 1;              /* 0 = gliding, 1 = full flap  */
    this.flapSpeed = rand(9, 13);
    this.groundIdle = rand(TAU);

    /* where this bird likes to hang out */
    this.homeY = rand(5, 11);
  }

  /* animation: wings + subtle body bob. dt in seconds. */
  animate(dt, stateName) {
    const grounded = stateName === 'LANDED' || stateName === 'EATING';
    const targetAmp = grounded ? 0.06 : this.flapAmp;
    /* glide cycles: birds alternate flap and hold */
    if (stateName === 'FLYING' || stateName === 'RETURNING') {
      this._glideT = (this._glideT || 0) - dt;
      if (this._glideT <= 0) {
        this._glideT = rand(1.2, 3);
        this.flapAmp = this.flapAmp > 0.5 ? rand(0.1, 0.3) : 1;
        this.flapSpeed = rand(9, 14);
      }
    }
    const amp = lerp(this.flapAmp, targetAmp, Math.min(1, dt * 6));
    this.flapPhase += dt * this.flapSpeed * (0.4 + amp);
    const swing = Math.sin(this.flapPhase) * 0.95 * amp + (grounded ? 0.35 : 0.12);
    this.wingL.rotation.z = swing;
    this.wingR.rotation.z = -swing;

    /* landing fold + idle breathing */
    const fold = grounded ? 0.45 : 0;
    this.wingL.rotation.x = fold;
    this.wingR.rotation.x = fold;
    const bob = grounded ? Math.sin(performance.now() * 0.003 + this.groundIdle) * 0.01 : 0;
    this.body.position.y = bob;
    /* pecking when eating */
    if (stateName === 'EATING') {
      this.body.rotation.x = Math.max(0, Math.sin(performance.now() * 0.012 + this.groundIdle)) * 0.6;
    } else {
      this.body.rotation.x = 0;
    }
  }

  /* BirdFlight: steer toward target, orient the mesh to velocity */
  fly(dt, speed, opts = {}) {
    const desired = this._desired.subVectors(this.target, this.pos);
    const dist = desired.length();
    if (dist > 0.01) desired.divideScalar(dist).multiplyScalar(speed);
    const agility = opts.agility || 2.4;
    this.vel.lerp(desired, Math.min(1, dt * agility));
    /* gravity bias while landing keeps descents believable */
    if (opts.sink) this.vel.y -= opts.sink * dt;
    this.pos.addScaledVector(this.vel, dt);
    this._orient(dt);
    this.group.position.copy(this.pos);
  }

  _orient(dt) {
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.15) {
      const wantYaw = Math.atan2(this.vel.x, this.vel.z);
      let d = wantYaw - this.yaw;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      this.yaw += d * Math.min(1, dt * 6);
      /* bank into turns */
      const wantBank = clamp(-d * 3, -0.6, 0.6);
      this.bank = lerp(this.bank, wantBank, Math.min(1, dt * 4));
    }
    const wantPitch = clamp(Math.atan2(this.vel.y, Math.max(sp, 0.5)), -0.7, 0.7);
    this.pitch = lerp(this.pitch, wantPitch, Math.min(1, dt * 4));
    this.group.rotation.set(-this.pitch, this.yaw, this.bank, 'YXZ');
  }

  /* when grounded we still face a direction and sit on the surface */
  settle(dt, yaw, groundY) {
    this.yaw += (yaw - this.yaw) * Math.min(1, dt * 3);
    this.vel.set(0, 0, 0);
    this.pos.y = lerp(this.pos.y, groundY, Math.min(1, dt * 8));
    this.bank = lerp(this.bank, 0, Math.min(1, dt * 5));
    this.pitch = lerp(this.pitch, 0, Math.min(1, dt * 5));
    this.group.rotation.set(-this.pitch, this.yaw, this.bank, 'YXZ');
    this.group.position.copy(this.pos);
  }
}
