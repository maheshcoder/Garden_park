/* ===================================================================
   BirdBehavior - lightweight state machine, no pathfinding AI:

     FLYING  --food nearby-->  SEEKING_FOOD --close-->  LANDING
       ^                          |                       |
       |                        --lost--> FLYING          v
       |                                             LANDED
       |                          food here             |
       +------ ate it all ------ RETURNING <-- EATING <-+
                              (LANDED --timer--> FLYING)

   Transitions are polled once per frame by BirdManager.
   =================================================================== */
import { rand, TAU } from '../utils.js';

export const STATE = {
  FLYING: 'FLYING',
  LANDING: 'LANDING',
  LANDED: 'LANDED',
  SEEKING_FOOD: 'SEEKING_FOOD',
  EATING: 'EATING',
  RETURNING: 'RETURNING'
};

export class BirdBehavior {
  constructor(bird, world) {
    this.bird = bird;
    this.world = world;        /* { terrain, trees, feeding, audio } */
    this.state = STATE.FLYING;
    this.timer = rand(1, 4);   /* generic state timer */
    this.landSpot = null;      /* {x,y,z,yaw} */
    this.foodPile = null;
    this.eatTimer = 0;
    this.pickWanderTarget();
  }

  /* ---------------------------------------------------------- helpers */
  pickWanderTarget() {
    const b = this.bird;
    const a = rand(TAU), d = rand(8, 34);
    b.target.set(
      Math.cos(a) * d,
      b.homeY + rand(-2.5, 2.5),
      Math.sin(a) * d
    );
    /* stay over the garden */
    const r = Math.hypot(b.target.x, b.target.z);
    if (r > 40) { b.target.x *= 40 / r; b.target.z *= 40 / r; }
  }

  chooseLandSpot() {
    const w = this.world;
    const roll = rand();
    if (roll < 0.4) {
      /* a tree canopy edge */
      const p = w.trees.randomCanopyPoint();
      this.landSpot = { x: p.x, y: p.y - 0.15, z: p.z, yaw: rand(TAU) };
    } else if (roll < 0.6) {
      /* the bench */
      const t = w.terrain;
      this.landSpot = { x: t.benchPos.x + rand(-1.2, 1.2), y: t.benchTop, z: t.benchPos.z, yaw: rand(TAU) };
    } else if (roll < 0.75) {
      /* the feeder platform */
      const f = w.terrain.feederPos;
      this.landSpot = { x: f.x, y: f.y + 0.08, z: f.z, yaw: rand(TAU) };
    } else {
      /* open lawn */
      const a = rand(TAU), d = rand(6, 26);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (w.terrain.inPond(x, z)) { this.landSpot = { x: 0, y: w.terrain.heightAt(0, 0) + 0.14, z: 0, yaw: 0 }; return; }
      this.landSpot = { x, y: w.terrain.heightAt(x, z) + 0.14, z, yaw: rand(TAU) };
    }
  }

  /* --------------------------------------------------------- the loop */
  update(dt) {
    const b = this.bird;
    const w = this.world;
    this.timer -= dt;

    switch (this.state) {
      /* ---------------------------------------------------- flying */
      case STATE.FLYING: {
        b.fly(dt, 4.4);
        if (b.pos.distanceToSquared(b.target) < 4 || this.timer <= 0) {
          this.pickWanderTarget();
          this.timer = rand(3, 7);
          /* occasionally decide to rest */
          if (rand() < 0.3) {
            this.chooseLandSpot();
            this.state = STATE.LANDING;
          }
          /* notice food if any is placed */
          const pile = w.feeding.findFoodNear(b.pos);
          if (pile && rand() < 0.75) this._seek(pile);
        }
        break;
      }

      /* ------------------------------------------------ seeking food */
      case STATE.SEEKING_FOOD: {
        if (!this.foodPile || this.foodPile.amount <= 0) {
          /* FoodConsumed: leave gracefully */
          this.state = STATE.RETURNING;
          this.timer = rand(4, 7);
          this.pickWanderTarget();
          break;
        }
        b.target.copy(this.foodPile.pos);
        b.target.y += 1.6;
        b.fly(dt, 5.4, { agility: 3.2 });
        const d2 = b.pos.distanceToSquared(this.foodPile.pos);
        if (d2 < 5) {
          /* set down next to the pile, not on it */
          const a = rand(TAU);
          this.landSpot = {
            x: this.foodPile.pos.x + Math.cos(a) * 0.32,
            y: this.foodPile.pos.y + 0.1,
            z: this.foodPile.pos.z + Math.sin(a) * 0.32,
            yaw: 0
          };
          this.state = STATE.LANDING;
          this.timer = 8;
        }
        break;
      }

      /* --------------------------------------------------- landing */
      case STATE.LANDING: {
        if (!this.landSpot) { this.state = STATE.FLYING; this.pickWanderTarget(); break; }
        b.target.set(this.landSpot.x, this.landSpot.y, this.landSpot.z);
        b.fly(dt, 2.6, { agility: 2.2, sink: 1.2 });
        const dy = Math.abs(b.pos.y - this.landSpot.y);
        const dh = Math.hypot(b.pos.x - this.landSpot.x, b.pos.z - this.landSpot.z);
        if (dy < 0.3 && dh < 0.55) {
          b.pos.copy(b.target);
          b.vel.set(0, 0, 0);
          if (this.foodPile && this.foodPile.amount > 0) {
            this.state = STATE.EATING;
            this.eatTimer = rand(0.5, 1.2);
          } else {
            this.state = STATE.LANDED;
            this.timer = rand(4, 9);
          }
        } else if (this.timer < -6) {
          /* aborted approach */
          this.state = STATE.FLYING;
          this.pickWanderTarget();
          this.timer = rand(3, 6);
        }
        break;
      }

      /* ---------------------------------------------------- landed */
      case STATE.LANDED: {
        const s = this.landSpot;
        b.settle(dt, s.yaw, s.y);
        if (this.timer <= 0) {
          if (rand() < 0.35) {
            this.chooseLandSpot();
            this.state = STATE.LANDING;
          } else {
            this.state = STATE.FLYING;
            this.pickWanderTarget();
            this.timer = rand(3, 7);
          }
        }
        /* food appeared while resting? */
        const pile = w.feeding.findFoodNear(b.pos, 20);
        if (pile && rand() < 0.5) this._seek(pile);
        break;
      }

      /* ---------------------------------------------------- eating */
      case STATE.EATING: {
        const s = this.landSpot;
        if (!s || !this.foodPile || this.foodPile.amount <= 0) {
          this.state = STATE.RETURNING;
          this.timer = rand(4, 7);
          this.pickWanderTarget();
          break;
        }
        b.settle(dt,
          Math.atan2(this.foodPile.pos.x - b.pos.x, this.foodPile.pos.z - b.pos.z),
          s.y);
        this.eatTimer -= dt;
        if (this.eatTimer <= 0) {
          this.eatTimer = rand(0.7, 1.4);
          const more = w.feeding.eatOne(this.foodPile);
          if (!more) {
            /* FoodConsumed */
            this.foodPile = null;
            this.state = STATE.RETURNING;
            this.timer = rand(4, 7);
            this.pickWanderTarget();
            if (w.onFoodConsumed) w.onFoodConsumed();
          }
        }
        break;
      }

      /* -------------------------------------------------- returning */
      case STATE.RETURNING: {
        b.fly(dt, 4.4);
        if (b.pos.y > b.homeY - 1.5 || this.timer <= 0) {
          this.state = STATE.FLYING;
          this.pickWanderTarget();
          this.timer = rand(3, 7);
        }
        break;
      }
    }

    /* keep every bird above the lawn no matter what */
    const floor = w.terrain.heightAt(b.pos.x, b.pos.z) + 0.14;
    if (b.pos.y < floor && this.state !== STATE.EATING && this.state !== STATE.LANDED) {
      b.pos.y = floor;
      if (b.vel.y < 0) b.vel.y = 0;
    }
    b.animate(dt, this.state);
  }

  _seek(pile) {
    this.foodPile = pile;
    this.state = STATE.SEEKING_FOOD;
    this.timer = 8;
  }

  /* startle: player got too close while grounded */
  startle() {
    if (this.state === STATE.LANDED || this.state === STATE.EATING) {
      this.foodPile = null;
      this.state = STATE.FLYING;
      this.pickWanderTarget();
      this.timer = rand(4, 8);
      return true;
    }
    return false;
  }
}
