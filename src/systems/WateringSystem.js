/* ===================================================================
   WateringSystem - the player carries a can with a finite amount of
   water; watering a plant raises its waterLevel (Flowers.water()),
   spraying shows droplet particles, and the pond refills the can.

     Plant flow:  WateringSystem -> Flowers.water(f) -> growth boost
   =================================================================== */
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class WateringSystem {
  constructor(effects, audio) {
    this.effects = effects;
    this.audio = audio;
    this.amount = CONFIG.startWater;   /* integer units left in the can */
    this.max = CONFIG.maxWater;
    this.sprayT = 0;                   /* accumulates droplet emission   */
    this.pouring = false;
    this.totalWatered = 0;             /* drives the ⭐ progress goal     */
  }

  hasWater() { return this.amount > 0; }

  /* called every frame while the water tool is active + trigger held */
  spray(fromPos, targetPos, dt) {
    if (this.amount <= 0) { this.pouring = false; return false; }
    this.pouring = true;
    this.sprayT += dt;
    /* ~14 droplets/second */
    while (this.sprayT > 1 / 14) {
      this.sprayT -= 1 / 14;
      this.effects.droplet(fromPos.x, fromPos.y, fromPos.z, targetPos.x, targetPos.y, targetPos.z);
    }
    return true;
  }

  stop() { this.pouring = false; }

  /* one-shot: water a single plant (E interaction) */
  waterPlant(plant, canPos) {
    if (this.amount <= 0) return false;
    this.amount--;
    this.totalWatered++;
    plant.watered();
    const head = plant.headPos ? plant.headPos() : new THREE.Vector3(plant.x, plant.y + 0.6, plant.z);
    for (let i = 0; i < 8; i++) {
      this.effects.droplet(canPos.x, canPos.y, canPos.z, head.x, head.y, head.z);
    }
    this.effects.sparkle(head.x, head.y, head.z, '#9fd8ff', 5);
    this.audio.water();
    return true;
  }

  refill(pondPos) {
    if (this.amount >= this.max) return false;
    this.amount = this.max;
    this.effects.sparkle(pondPos.x, pondPos.y + 0.3, pondPos.z, '#cdeaff', 10);
    this.audio.refill();
    return true;
  }

  /* condense the continuous spray into plant water: called by main
     while the trigger is held on a target plant                    */
  applyContinuous(targetPlant, canPos, targetPos, dt) {
    if (!this.spray(canPos, targetPos, dt)) return false;
    /* each full second of spray = 1 can unit and one water() pulse */
    this._carry = (this._carry || 0) + dt;
    if (this._carry >= 1) {
      this._carry -= 1;
      this.amount = Math.max(0, this.amount - 1);
      this.totalWatered++;
      if (targetPlant) targetPlant.watered();
    }
    return true;
  }
}
