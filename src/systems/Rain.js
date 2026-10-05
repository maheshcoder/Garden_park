/* ===================================================================
   Rain - one LineSegments cloud of drops that follows the camera.
   Intensity is a 0..1 blend so toggleRain() can fade like the 2D
   version did (drizzle -> downpour) instead of popping on/off.
   =================================================================== */
import * as THREE from 'three';
import { rand } from '../utils.js';

const BOX = 34;      /* half-width of the drop volume */
const TOP = 22;

export class Rain {
  constructor(scene, tier) {
    this.n = tier.rain;
    this.blend = 0;              /* current 0..1 intensity */
    this.target = 0;             /* rainTarget              */
    this.pos = new Float32Array(this.n * 6);
    this.speed = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) this._reset(i, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
    this.mat = new THREE.LineBasicMaterial({
      color: 0xaecdf0, transparent: true, opacity: 0, fog: true
    });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    scene.add(this.lines);
    this.geo = geo;
  }

  _reset(i, anywhere) {
    const j = i * 6;
    const x = rand(-BOX, BOX);
    const z = rand(-BOX, BOX);
    const y = anywhere ? rand(0, TOP) : TOP + rand(0, 6);
    /* each drop is a short slanted segment */
    this.pos[j] = x;      this.pos[j + 1] = y;      this.pos[j + 2] = z;
    this.pos[j + 3] = x + 0.12; this.pos[j + 4] = y - 0.55; this.pos[j + 5] = z;
    this.speed[i] = rand(14, 20);
  }

  toggle() {
    this.target = this.target > 0.5 ? 0 : 1;
    return this.target;
  }

  /* cx/cz: the point the drop volume follows (camera target) */
  update(dt, cx, cz, wind) {
    /* ease the blend like the classic rain ramp */
    this.blend += (this.target - this.blend) * Math.min(1, dt * 0.6);
    this.mat.opacity = this.blend * 0.55;
    this.lines.visible = this.blend > 0.02;
    if (!this.lines.visible) return;

    const drift = wind * 2.2;
    for (let i = 0; i < this.n; i++) {
      const j = i * 6;
      const fall = this.speed[i] * dt;
      this.pos[j + 1] -= fall;
      this.pos[j + 4] -= fall;
      this.pos[j] += drift * dt;
      this.pos[j + 3] += drift * dt;
      /* keep the cloud centred on the action */
      if (this.pos[j + 1] < 0) {
        this._reset(i, false);
        this.pos[j] += cx;       this.pos[j + 2] += cz;
        this.pos[j + 3] += cx;   this.pos[j + 5] += cz;
        /* clamp back into the box around the centre */
        if (Math.abs(this.pos[j] - cx) > BOX) this.pos[j] = cx + rand(-BOX, BOX);
        if (Math.abs(this.pos[j + 2] - cz) > BOX) this.pos[j + 2] = cz + rand(-BOX, BOX);
        this.pos[j + 3] = this.pos[j] + 0.12;
        this.pos[j + 5] = this.pos[j + 2];
      }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
