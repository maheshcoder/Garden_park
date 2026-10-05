/* ===================================================================
   PlayerController - input -> movement + camera.

   Desktop:  WASD / arrows walk (camera-relative), drag to orbit,
             wheel to zoom, E interact, left-click acts on the world.
   Mobile:   virtual joystick (from Joystick.js) for walking, drag on
             the canvas to orbit, the ⏎ button triggers interact.

   The controller never hardcodes what an interaction does - it asks
   InteractionSystem and hands it a context object.
   =================================================================== */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp } from '../utils.js';

export class PlayerController {
  constructor(canvas, player, scene3d, terrain) {
    this.canvas = canvas;
    this.player = player;
    this.scene3d = scene3d;
    this.terrain = terrain;

    this.keys = new Set();
    this.moveIntent = new THREE.Vector3();
    this.joy = { x: 0, y: 0 };      /* set by the virtual joystick */
    this.interacting = false;

    this.dragging = false;
    this.dragMoved = 0;
    this.lastX = 0; this.lastY = 0;
    this.pendingClick = null;        /* {x, y} screen coords of a click */

    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();

    /* spawn on the path near the south gate */
    player.pos.set(0, terrain.heightAt(0, 30), 30);
    player.yaw = Math.PI;

    this._bindKeyboard();
    this._bindPointer();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.dragMoved = 0;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      if (this.dragMoved > 6) {
        /* orbit the camera */
        this.scene3d.yaw -= dx * 0.005;
        this.scene3d.pitch = clamp(this.scene3d.pitch + dy * 0.004, 0.12, 1.25);
      }
    });
    c.addEventListener('pointerup', (e) => {
      this.dragging = false;
      if (this.dragMoved <= 6) {
        /* treat as a click for the interaction system */
        this.pendingClick = { x: e.clientX, y: e.clientY };
      }
    });
    c.addEventListener('pointercancel', () => { this.dragging = false; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scene3d.dist = clamp(this.scene3d.dist + e.deltaY * 0.01, 4, 22);
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* consume a queued click, returning NDC coords or null */
  takeClick() {
    if (!this.pendingClick) return null;
    const p = this.pendingClick;
    this.pendingClick = null;
    this._ndc.set((p.x / window.innerWidth) * 2 - 1, -(p.y / window.innerHeight) * 2 + 1);
    return { x: this._ndc.x, y: this._ndc.y };
  }

  /* world point under the screen centre (crosshair ray) */
  groundUnderCrosshair() {
    this._ray.setFromCamera({ x: 0, y: 0 }, this.scene3d.camera);
    const hits = this._ray.intersectObject(this.terrain.lawn, false);
    return hits.length ? hits[0].point : null;
  }

  update(dt) {
    const k = this.keys;
    let ix = 0, iz = 0;
    if (k.has('a') || k.has('arrowleft')) ix -= 1;
    if (k.has('d') || k.has('arrowright')) ix += 1;
    if (k.has('w') || k.has('arrowup')) iz -= 1;
    if (k.has('s') || k.has('arrowdown')) iz += 1;
    /* joystick overrides/extends keys when touched */
    if (Math.hypot(this.joy.x, this.joy.y) > 0.1) {
      ix = this.joy.x;
      iz = -this.joy.y;
    }
    const mag = Math.hypot(ix, iz);
    if (mag > 1) { ix /= mag; iz /= mag; }

    /* camera-relative movement: forward = from eye toward target */
    const yaw = this.scene3d.yaw;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    this.moveIntent.set(0, 0, 0);
    if (mag > 0.05) {
      this.moveIntent.addScaledVector(fwd, -iz);
      this.moveIntent.addScaledVector(right, ix);
      if (this.moveIntent.lengthSq() > 1) this.moveIntent.normalize();

      const step = CONFIG.walkSpeed * dt;
      const nx = this.player.pos.x + this.moveIntent.x * step;
      const nz = this.player.pos.z + this.moveIntent.z * step;
      /* fence bound + pond exclusion */
      if (this.terrain.inBounds(nx, nz)) {
        const pd = Math.hypot(nx - this.terrain.pondCenter.x, nz - this.terrain.pondCenter.z);
        if (pd > this.terrain.pondRadius + 0.4) {
          this.player.pos.x = nx;
          this.player.pos.z = nz;
        }
      }
      this.player.faceTowards(this.moveIntent.x, this.moveIntent.z, dt);
    }
    this.player.pos.y = this.terrain.heightAt(this.player.pos.x, this.player.pos.z);

    /* camera follows: target sits just above the player's head */
    this.scene3d.setCameraTarget(
      this.player.pos.x,
      this.player.pos.y + 1.3,
      this.player.pos.z
    );
    this.player.update(dt, this.moveIntent, this.interacting);
  }
}
