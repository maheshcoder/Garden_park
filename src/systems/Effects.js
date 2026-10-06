/* ===================================================================
   Effects - one pooled Points cloud for every particle in the game:
   falling petals, pollen/fireflies, water droplets, interaction bursts.
   Particles live in flat typed arrays; dead ones get alpha 0 and are
   recycled. No allocation happens inside update().
   =================================================================== */
import * as THREE from 'three';
import { rand, TAU } from '../utils.js';

const VERT = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (240.0 / max(-mv.z, 0.1));
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = vAlpha * (1.0 - smoothstep(0.15, 0.5, d));
    gl_FragColor = vec4(vColor, a);
  }`;

export class Effects {
  constructor(scene, tier) {
    this.max = tier.petals + tier.pollen + 320;
    this.count = 0;
    const n = this.max;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.life = new Float32Array(n);   /* remaining seconds */
    this.ttl = new Float32Array(n);
    this.grav = new Float32Array(n);   /* downward accel    */
    this.drag = new Float32Array(n);
    this.spin = new Float32Array(n);   /* horizontal swirl   */

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500); /* never culled */
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      vertexColors: true
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
  }

  _spawn(x, y, z, vx, vy, vz, color, size, ttl, grav, drag, spin) {
    let i = this.count;
    if (i >= this.max) {
      /* recycle the particle closest to death */
      i = 0; let worst = Infinity;
      for (let k = 0; k < this.max; k++) {
        if (this.life[k] < worst) { worst = this.life[k]; i = k; }
      }
    } else {
      this.count++;
    }
    const j = i * 3;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    const c = new THREE.Color(color);
    this.col[j] = c.r; this.col[j + 1] = c.g; this.col[j + 2] = c.b;
    this.size[i] = size;
    this.alpha[i] = 1;
    this.ttl[i] = ttl;
    this.life[i] = ttl;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.spin[i] = spin;
    return i;
  }

  /* ---- emitters ------------------------------------------------- */

  petal(x, y, z, color) {
    this._spawn(x, y, z, rand(-0.25, 0.25), rand(-0.1, 0.1), rand(-0.25, 0.25),
      color, rand(2.4, 4.2), rand(4, 7), -0.22, 0.6, rand(-1, 1));
  }

  pollen(x, y, z, color) {
    this._spawn(x, y, z, rand(-0.15, 0.15), rand(0.02, 0.12), rand(-0.15, 0.15),
      color, rand(1.4, 2.6), rand(3, 6), 0.01, 0.9, rand(-0.6, 0.6));
  }

  droplet(x, y, z, tx, ty, tz) {
    /* water arc from can to flower: aim at the target with lift */
    const dx = tx - x, dy = ty - y, dz = tz - z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const sp = Math.max(2.2, d * 1.15);
    this._spawn(x, y, z,
      (dx / d) * sp + rand(-0.3, 0.3),
      (dy / d) * sp + d * 0.9,
      (dz / d) * sp + rand(-0.3, 0.3),
      rand() < 0.5 ? '#9fd8ff' : '#cdeaff', rand(1.6, 2.6), rand(0.5, 0.85), -7.5, 0.02, 0);
  }

  burst(x, y, z, color, count = 8, speed = 1.6) {
    for (let i = 0; i < count; i++) {
      const a = rand(TAU), e = rand(-0.4, 1.2);
      const s = rand(0.4, speed);
      this._spawn(x, y, z,
        Math.cos(a) * Math.cos(e) * s,
        Math.sin(e) * s + 0.6,
        Math.sin(a) * Math.cos(e) * s,
        color, rand(1.8, 3.4), rand(0.6, 1.3), -3.4, 0.4, rand(-2, 2));
    }
  }

  sparkle(x, y, z, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const a = rand(TAU);
      this._spawn(x, y, z,
        Math.cos(a) * rand(0.3, 1.1), rand(0.4, 1.4), Math.sin(a) * rand(0.3, 1.1),
        color, rand(2, 3.2), rand(0.5, 1.0), -1.2, 0.5, rand(-3, 3));
    }
  }

  crumbs(x, y, z, count = 4) {
    for (let i = 0; i < count; i++) {
      const a = rand(TAU);
      this._spawn(x, y, z,
        Math.cos(a) * rand(0.2, 0.7), rand(0.5, 1.1), Math.sin(a) * rand(0.2, 0.7),
        rand() < 0.5 ? '#d8b46a' : '#b98c46', rand(1.4, 2.2), rand(0.5, 0.9), -4.5, 0.2, 0);
    }
  }

  /* ---- simulation ------------------------------------------------ */
  update(dt) {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const j = i * 3;
      const dr = 1 - Math.min(1, this.drag[i] * dt);
      this.vel[j] *= dr;
      this.vel[j + 2] *= dr;
      this.vel[j + 1] = this.vel[j + 1] * dr + this.grav[i] * dt;
      /* gentle swirl so petals flutter instead of dropping like stones */
      if (this.spin[i] !== 0) {
        const s = this.spin[i] * dt;
        const x = this.vel[j], z = this.vel[j + 2];
        this.vel[j] = x * Math.cos(s) - z * Math.sin(s);
        this.vel[j + 2] = x * Math.sin(s) + z * Math.cos(s);
      }
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const t = this.life[i] / this.ttl[i];
      this.alpha[i] = t > 0.8 ? (1 - t) * 5 : t; /* fade in fast, out slow */
    }
    while (this.count > 0 && this.life[this.count - 1] <= 0) this.count--;
    this.geo.setDrawRange(0, this.count);
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

