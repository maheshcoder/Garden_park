/* ===================================================================
   Player - controllable avatar.
   Built procedurally, with no external asset required.
   setExternalModel(model) remains available for a caller-supplied model.

   States: 'idle' | 'walking' | 'interacting'
   =================================================================== */
import * as THREE from 'three';
import { lerp, TAU } from '../utils.js';

export class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    this.state = 'idle';
    this.yaw = Math.PI;             /* facing -z initially */
    this.animT = 0;
    this.external = null;

    const skin = new THREE.MeshStandardMaterial({ color: 0xf6cda0, roughness: 0.9 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xf4ead1, roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x59715a, roughness: 0.9 });
    const hatM = new THREE.MeshStandardMaterial({ color: 0xe8c06a, roughness: 1 });
    const canM = new THREE.MeshStandardMaterial({ color: 0x5a8f3c, roughness: 0.6, metalness: 0.3 });

    /* legs pivot at the hip (y = 0.55) */
    this.legL = limb(pants, 0.12, 0.55); this.legL.position.set(-0.11, 0.55, 0);
    this.legR = limb(pants, 0.12, 0.55); this.legR.position.set(0.11, 0.55, 0);

    /* torso */
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.36, 4, 8), shirt);
    torso.position.y = 0.92;
    torso.castShadow = true;

    /* arms pivot at the shoulder (y = 1.12) */
    this.armL = limb(shirt, 0.09, 0.44); this.armL.position.set(-0.28, 1.12, 0);
    this.armR = limb(shirt, 0.09, 0.44); this.armR.position.set(0.28, 1.12, 0);

    /* head + straw hat */
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
    head.position.y = 1.38;
    head.castShadow = true;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 14), hatM);
    brim.position.y = 1.48;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.14, 12), hatM);
    cap.position.y = 1.56;

    /* watering can in the right hand, hidden unless watering */
    this.can = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 10), canM);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.26, 6), canM);
    spout.rotation.z = -0.9;
    spout.position.set(-0.14, 0.05, 0);
    this.can.add(body, spout);
    this.can.position.set(0.06, -0.4, 0.05);
    this.can.visible = false;
    this.armR.add(this.can);

    this.placeholder = new THREE.Group();
    this.placeholder.add(this.legL, this.legR, torso, this.armL, this.armR, head, brim, cap);
    this.placeholder.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(this.placeholder);

    scene.add(this.group);
    this.pos = this.group.position;
  }

  /* GLB swap-in: hide the placeholder, play clips if the file has them */
  setExternalModel(model) {
    if (this.external) this.group.remove(this.external);
    this.external = model;
    this.placeholder.visible = false;
    model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(model);
    if (model.animations && model.animations.length) {
      this.mixer = new THREE.AnimationMixer(model);
      this.clips = {};
      for (const c of model.animations) this.clips[c.name.toLowerCase()] = this.mixer.clipAction(c);
      this.idleAction = this.clips.idle || this.clips.stand || null;
      if (this.idleAction) this.idleAction.play();
    }
  }

  setTool(tool) { this.can.visible = tool === 'water'; }

  /* moveIntent: {x, z} normalized; interacting: bool */
  update(dt, moveIntent, interacting) {
    const mag = Math.hypot(moveIntent.x, moveIntent.z);
    const moving = mag > 0.05;

    if (this.mixer) this.mixer.update(dt);

    if (this.external && this.clips) {
      /* crossfade between whatever clips the GLB ships with */
      const want = interacting ? (this.clips.interact || this.clips.water || null)
        : moving ? (this.clips.walk || this.clips.run || null)
          : this.idleAction;
      if (want && want !== this._current) {
        if (this._current) this._current.fadeOut(0.2);
        want.reset().fadeIn(0.2).play();
        this._current = want;
      }
    }

    this.state = interacting ? 'interacting' : (moving ? 'walking' : 'idle');

    if (!this.external || !this.mixer) {
      this._animatePlaceholder(dt, moving, interacting);
    }
  }

  _animatePlaceholder(dt, moving, interacting) {
    this.animT += dt * (moving ? 9 : 2.5);
    const t = this.animT;
    if (this.state === 'walking') {
      const swing = Math.sin(t) * 0.65;
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.8;
      this.armR.rotation.x = interacting ? -1.1 : swing * 0.8;
      this.placeholder.position.y = Math.abs(Math.sin(t)) * 0.045;
    } else if (this.state === 'interacting') {
      this.legL.rotation.x = lerp(this.legL.rotation.x, 0, dt * 8);
      this.legR.rotation.x = lerp(this.legR.rotation.x, 0, dt * 8);
      this.armL.rotation.x = lerp(this.armL.rotation.x, -0.3, dt * 8);
      /* right arm tips the can forward */
      this.armR.rotation.x = lerp(this.armR.rotation.x, -1.25, dt * 8);
      this.placeholder.position.y = lerp(this.placeholder.position.y, 0, dt * 8);
    } else {
      /* idle: gentle breathing + occasional sway */
      this.legL.rotation.x = lerp(this.legL.rotation.x, 0, dt * 6);
      this.legR.rotation.x = lerp(this.legR.rotation.x, 0, dt * 6);
      this.armL.rotation.x = lerp(this.armL.rotation.x, Math.sin(t * 0.5) * 0.06, dt * 4);
      this.armR.rotation.x = lerp(this.armR.rotation.x, Math.sin(t * 0.5 + 1) * 0.06, dt * 4);
      this.placeholder.position.y = Math.sin(t * 0.8) * 0.012;
    }
  }

  /* face a world direction smoothly */
  faceTowards(dx, dz, dt) {
    if (Math.hypot(dx, dz) < 0.001) return;
    const want = Math.atan2(dx, dz);
    let d = want - this.yaw;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    this.yaw += d * Math.min(1, dt * 10);
    this.group.rotation.y = this.yaw;
  }
}

/* a simple hanging limb: box whose origin is the joint */
function limb(mat, thickness, length) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(thickness, length, thickness), mat);
  m.position.y = -length / 2;
  m.castShadow = true;
  g.add(m);
  return g;
}
