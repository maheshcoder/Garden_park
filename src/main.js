/* ===================================================================
   Enchanted Garden 3D - boot + orchestration.

   Wires together: scene, terrain, flora, trees, butterflies, birds,
   player, interaction, watering, feeding, rain, audio, HUD.
   Also exposes window.garden with the classic 2D API surface so the
   console/tests keep the same vocabulary:
     flowers, butterflies, picked, hour, rainTarget, paused, seedType,
     plant(), addButterfly(), toggleRain(), toggleDayNight(),
     clearGarden(), fastForward()
   =================================================================== */
import * as THREE from 'three';
import { CONFIG, SEEDS } from './config.js';
import { Landscape } from './scene/Landscape.js';
import { GardenHUD } from './ui/GardenHUD.js';
import { GardenState } from './state/GardenState.ts';
import { windUniforms, rand, pick, withSeed } from './utils.js';
import { GardenScene } from './scene/GardenScene.js';
import { Terrain } from './scene/Terrain.js';
import { Trees } from './scene/Trees.js';
import { Flowers, FLOWER_SPECS } from './scene/Flowers.js';
import { Butterflies } from './entities/Butterflies.js';
import { Player } from './player/Player.js';
import { PlayerController } from './player/PlayerController.js';
import { Joystick } from './player/Joystick.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { WateringSystem } from './systems/WateringSystem.js';
import { FeedingSystem } from './systems/FeedingSystem.js';
import { Rain } from './systems/Rain.js';

const el = (id) => document.getElementById(id);

class GardenApp {
  constructor() {
    const canvas = el('garden');
    const tier = GardenScene.tierFor();
    this.tier = tier;
    this.ready = false;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.state = new GardenState();
    this.metrics = { fps: 0, calls: 0, triangles: 0, quality: tier.shadows ? 'standard' : 'low' };

    /* ---- core world ---- */
    this.scene3d = new GardenScene(canvas, tier);
    this.terrain = withSeed(1937, () => new Terrain(this.scene3d.scene, tier));
    this.trees = withSeed(6201, () => new Trees(this.scene3d.scene, this.terrain));
    this.landscape = new Landscape(this.scene3d.scene, this.terrain, tier);
    this.flowers = new Flowers(this.scene3d.scene, this.terrain);
    this.rain = new Rain(this.scene3d.scene, tier);
    this.butterflies = new Butterflies(this.scene3d.scene, this.terrain);

    /* ---- audio (silent until first gesture) ---- */
    this.audio = null;
    this._audioReady = this._loadAudio();

    /* ---- gameplay systems (core) ---- */
    this.watering = new WateringSystem(null, null); // effects/audio injected later
    this.feeding = new FeedingSystem(this.scene3d.scene, this.terrain, null, null);
    this.interactions = new InteractionSystem();

    /* ---- player ---- */
    this.player = new Player(this.scene3d.scene);
    this.controller = new PlayerController(canvas, this.player, this.scene3d, this.terrain);

    /* ---- birds (world context shared with behaviour) ---- */
    this.birds = null;
    this._birdsReady = this._loadBirds();

    /* ---- tool + session state ---- */
    this.tool = 'hand';
    this.paused = false;
    this.seedType = 'random';
    this.progress = { planted: 0, watered: 0, fed: 0 };
    this.time = 0;
    this._rainbow = 0;
    this._heldKeys = new Set();
    this._v1 = new THREE.Vector3();
    this._defaultHint = el('hint').textContent;
    this._raycaster = new THREE.Raycaster();
    this._ff = false;

    this.joystick = new Joystick(this.controller, () => this._doInteract());

    this._registerInteractions();
    this._wireUI();
    this._wireKeyboard();
    withSeed(1307, () => this._seedWorld());
    this.hud = new GardenHUD(this);
    document.addEventListener('visibilitychange', () => {
      this._last = 0; this.controller.keys.clear(); this._heldKeys.clear();
      this.controller.joy.x = this.controller.joy.y = 0;
      this.audio?.suspend(document.hidden || this.paused);
    });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.contextLost = true;
      showFallback('The graphics connection was interrupted. Try again, or visit the classic garden.');
    });
    window.addEventListener('pagehide', event => { if (!event.persisted) this.dispose(); });
  }

  async _loadAudio() {
    let AudioSystem;
    try { ({ AudioSystem } = await import('./systems/AudioSystem.js')); }
    catch {
      const silent = new Proxy({ muted: true }, { get: (target, key) => key in target ? target[key] : () => {} });
      this.audio = silent; this.watering.audio = silent; this.feeding.audio = silent;
      return;
    }
    this.audio = new AudioSystem();
    this.watering.audio = this.audio;
    this.feeding.audio = this.audio;
    const wakeAudio = () => { if (!this.audio.muted) this.audio.ensure(); };
    window.addEventListener('pointerdown', wakeAudio);
    window.addEventListener('keydown', wakeAudio);
    this._wakeAudio = wakeAudio;
  }

  async _loadBirds() {
    const { BirdManager } = await import('./birds/BirdManager.js');
    const { Effects } = await import('./systems/Effects.js');
    this.effects = new Effects(this.scene3d.scene, this.tier);
    this.watering.effects = this.effects;
    this.feeding.effects = this.effects;

    this.birds = new BirdManager(this.scene3d.scene, {
      terrain: this.terrain,
      trees: this.trees,
      feeding: this.feeding,
      audio: this.audio, // may be null initially, BirdManager handles it
      count: CONFIG.startBirds,
      onFoodConsumed: () => this._say('The birds finished the seeds 🐦')
    });
  }

  /* ================================================ interactions ==== */
  /* Every world object opts in here; the controller never hardcodes
     per-object logic - it just calls interactions.interact(ctx).      */
  _registerInteractions() {
    const I = this.interactions;

    /* --- flowers are dynamic: one pooled entry re-targeted each frame */
    this._entryFlower = {
      id: 'flower',
      pos: new THREE.Vector3(9999, -99, 9999),
      maxRange: CONFIG.reach,
      getPrompt: (tool) => {
        const f = this._focusFlower;
        if (!f) return null;
        if (tool === 'water') {
          return this.watering.hasWater()
            ? 'Water plant'
            : 'Can is empty - refill at the pond';
        }
        if (tool === 'food') return null;    /* food goes on the ground */
        return 'Pick ' + f.spec.label.toLowerCase();
      },
      onInteract: (ctx) => {
        const f = this._focusFlower;
        if (!f) return;
        if (ctx.tool === 'water') this._waterPlant(f);
        else this._pickFlower(f);
      }
    };
    I.register(this._entryFlower);
    this._entryBird = I.register({
      id: 'bird', pos: new THREE.Vector3(9999,0,9999), maxRange: 3.4,
      getPrompt: tool => tool === 'hand' && this._focusBird ? 'Listen to the bird' : null,
      onInteract: () => { this.audio?.chirp(); this._say('A little greeting. Step back and leave some seeds for your visitor.'); }
    });

    /* --- pond: refill the can --- */
    I.register({
      id: 'pond',
      pos: this.terrain.pondCenter.clone(),
      maxRange: this.terrain.pondRadius + CONFIG.reach,
      getPrompt: (tool) =>
        tool === 'water' && this.watering.amount < this.watering.max
          ? 'Refill watering can'
          : null,
      onInteract: () => {
        if (this.watering.refill(this.terrain.pondCenter)) {
          this._say('Watering can refilled 💧');
        }
      }
    });

    /* --- feeder: place food from the pocket --- */
    I.register({
      id: 'feeder',
      pos: this.terrain.feederPos.clone(),
      maxRange: CONFIG.reach + 1,
      getPrompt: () => this.feeding.food > 0 ? 'Feed the birds' : 'Out of bird food',
      onInteract: () => {
        if (this.feeding.food <= 0) { this._say('Pick flowers to earn more bird food 🌸'); return; }
        this._placeFood(this.terrain.feederPos.x, this.terrain.feederPos.z, this.terrain.feederPos.y);
      }
    });

    /* --- birdhouse: inspect --- */
    I.register({
      id: 'birdhouse',
      pos: this.terrain.birdhousePos.clone(),
      maxRange: CONFIG.reach + 2,
      getPrompt: () => 'Inspect birdhouse',
      onInteract: () => this._say('A cozy home - birds come here to rest 🐦')
    });

    /* --- bench: inspect --- */
    I.register({
      id: 'bench',
      pos: this.terrain.benchPos.clone().setY(this.terrain.benchTop),
      maxRange: CONFIG.reach + 1,
      getPrompt: () => 'Inspect the garden bench',
      onInteract: () => this._say('A perfect spot to watch the garden 🌳')
    });

    /* --- trees: one entry per trunk --- */
    this.trees.trees.forEach((t, i) => {
      I.register({
        id: 'tree-' + i,
        pos: new THREE.Vector3(t.slot.x, t.group.position.y + t.h * 0.4, t.slot.z),
        maxRange: 3.4,
        getPrompt: () => 'Inspect ' + t.variant.name + ' tree',
        onInteract: () => { this.state.inspectTree('tree-' + i); this._say(this._treeBlurb(t)); }
      });
    });

    /* --- ground: planting / food placement happen via crosshair --- */
    this._entryGround = {
      id: 'ground',
      priority: -20,
      pos: new THREE.Vector3(9999, -99, 9999),   /* retargeted per frame */
      maxRange: 11,
      getPrompt: (tool) => {
        if (!this._groundPoint) return null;
        if (tool === 'hand') return 'Plant here';
        if (tool === 'food') return this.feeding.food > 0 ? 'Place bird food' : 'Out of bird food';
        return null;
      },
      onInteract: () => {
        if (!this._groundPoint) return;
        if (this.tool === 'hand') this._plantAt(this._groundPoint.x, this._groundPoint.z);
        else if (this.tool === 'food') this._placeFood(this._groundPoint.x, this._groundPoint.z);
      }
    };
    I.register(this._entryGround);
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
    for (let i = 0; i < this.terrain.rocks.count; i++) {
      this.terrain.rocks.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
      I.register({id: 'rock-' + i, pos: position.clone(), maxRange: 2,
        getPrompt: tool => tool === 'hand' ? 'Inspect mossy stone' : null,
        onInteract: () => this._say('A little shelter for insects, warmed by the sun.')});
    }
  }

  _treeBlurb(t) {
    const V = t.variant;
    return V.ratio > 0.5
      ? V.name + ' tree - blossoms drift off in the wind 🌸'
      : V.name + ' tree - mostly leaves, few petals 🍃';
  }

  /* ====================================================== actions ==== */
  _say(msg) {
    el('hint').textContent = msg;
    this._sayUntil = performance.now() + 3000;
  }

  _canPos(out) {
    /* roughly the player's right hand, in world space */
    out.set(0.3, 1.0, 0.3);
    this.player.group.localToWorld(out);
    return out;
  }

  _waterPlant(f) {
    if (!f || f.dead || Math.hypot(f.x - this.player.pos.x, f.z - this.player.pos.z) > CONFIG.reach) return false;
    const can = this._canPos(this._v1 || (this._v1 = new THREE.Vector3()));
    const head = new THREE.Vector3(f.x, f.y + f.spec.h * 0.9, f.z);
    if (this.watering.waterPlant(f, can)) {
      this._actionTime = 0.8;
      this.state.discoverFlower(f.type);
      this.watering.spray(can, head, 0.25);   /* extra droplets for feedback */
      return true;
    }
    this._say('The can is empty - refill at the pond 💧');
    return false;
  }

  _pickFlower(f) {
    const head = new THREE.Vector3(f.x, f.y + f.spec.h * 0.8, f.z);
    this.effects.burst(head.x, head.y, head.z, f.color, 10, 1.8);
    this.flowers.pick(f);
    this.audio.pick();
    /* seeds for the birds: picking is how you earn more bird food */
    this.feeding.food = Math.min(this.feeding.max, this.feeding.food + 1);
    this._say('Picked a ' + f.spec.label.toLowerCase() + ' 🌸  (+1 bird food)');
  }

  _plantAt(x, z) {
    if (this.terrain.inPond(x, z)) { this._say('Nothing grows in the pond 💧'); return false; }
    const f = this.flowers.plant(x, z, this.seedType);
    if (!f) {
      this._say('The garden is full 🌼 pick or remove a flower first');
      return false;
    }
    this.progress.planted++;
    this.audio.plant();
    this.effects.burst(x, this.terrain.heightAt(x, z) + 0.2, z, '#7cc46a', 6, 1.2);
    return true;
  }

  _placeFood(x, z, y) {
    if (this.feeding.food <= 0) { this._say('Pick flowers to earn more bird food 🌸'); return false; }
    const pile = this.feeding.placeFood(x, z, y);
    if (!pile) { this._say('Food must go on dry ground 🌱'); return false; }
    this._say('Seeds down - the birds are on their way 🐦');
    return true;
  }

  _removeFlower(f) {
    const head = new THREE.Vector3(f.x, f.y + f.spec.h * 0.7, f.z);
    this.effects.burst(head.x, head.y, head.z, f.color, 8, 1.5);
    this.flowers.remove(f);
    this.audio.pop();
  }

  _doInteract() {
    if (!this.ready || this.paused || this.overview || this.hud?.dialog?.open) return false;
    const ctx = { tool: this.tool, player: this.player, app: this };
    if (this.interactions.interact(ctx)) {
      this.audio.pop();
      this._actionTime = 0.7;
      return true;
    }
    return false;
  }

  /* crosshair focus: what is the player looking at this frame? */
  _updateFocus(ndc = { x: 0, y: 0 }, proximity = true) {
    const cam = this.scene3d.camera;
    const pp = this.player.pos;
    this._raycaster.setFromCamera(ndc, cam);

    /* flower under the crosshair? */
    const heads = Object.values(this.flowers.headMeshes);
    const hits = this._raycaster.intersectObjects(heads, false);
    let focus = null;
    if (hits.length) {
      const h = hits[0];
      const species = h.object.userData.species;
      focus = this.flowers.flowers.find(
        (f) => f.type === species && f.slot === h.instanceId
      ) || null;
    }
    /* proximity fallback: nearest flower just in front of us */
    if (focus && Math.hypot(focus.x - pp.x, focus.z - pp.z) > CONFIG.reach) focus = null;
    if (!focus && proximity) {
      focus = this.flowers.nearest(pp.x, pp.z, 2.4);
      if (focus) {
        const d = Math.hypot(focus.x - pp.x, focus.z - pp.z);
        if (d > CONFIG.reach) focus = null;
      }
    }
    this._focusBird = this.birds?.nearestGrounded(pp, 3.4);
    if (this._focusBird) this._entryBird.pos.copy(this._focusBird.bird.pos);
    else this._entryBird.pos.set(9999,0,9999);
    this._focusFlower = focus;
    if (focus) this.state.discoverFlower(focus.type);
    this._entryFlower.pos.set(
      focus ? focus.x : 9999,
      focus ? focus.y + focus.spec.h : -99,
      focus ? focus.z : 9999
    );

    /* ground under the crosshair (for plant / place food) */
    const gHits = this._raycaster.intersectObject(this.terrain.lawn, false);
    let gp = null;
    if (gHits.length) {
      const p = gHits[0].point;
      const d = Math.hypot(p.x - pp.x, p.z - pp.z);
      if (d < 11) gp = p;
    }
    this._groundPoint = gp;
    if (gp) this._entryGround.pos.copy(gp);
    else this._entryGround.pos.set(9999, -99, 9999);

    /* hover feedback on the focused flower */
    for (const f of this.flowers.flowers) {
      this.flowers.setHover(f, f === focus);
    }
  }

  /* =========================================================== UI ==== */
  _setTool(t) {
    this.tool = t;
    this.player.setTool(t);
    for (const [id, name] of [
      ['btnToolHand', 'hand'], ['btnToolWater', 'water'], ['btnToolFood', 'food']
    ]) {
      el(id).classList.toggle('on', name === t);
      el(id).setAttribute('aria-pressed', String(name === t));
    }
    this._say(
      t === 'hand' ? 'Hand: pick flowers, plant, inspect (1)'
        : t === 'water' ? 'Watering can: water plants, refill at the pond (2)'
          : 'Bird food: place seeds for the birds (3)'
    );
  }

  _wireUI() {
    /* tool select */
    el('btnToolHand').addEventListener('click', () => { this._setTool('hand'); this.audio.pop(); });
    el('btnToolWater').addEventListener('click', () => { this._setTool('water'); this.audio.pop(); });
    el('btnToolFood').addEventListener('click', () => { this._setTool('food'); this.audio.pop(); });

    /* seed select (classic behaviour preserved) */
    el('seedSelect').addEventListener('change', (e) => {
      this.seedType = e.target.value;
      this._say('Seeds switched to ' +
        (this.seedType === 'random' ? 'a random species' : FLOWER_SPECS[this.seedType].label + 's'));
      this.audio.pop();
    });

    /* classic control buttons */
    el('btnFlower').addEventListener('click', () => {
      const p = this.player.pos;
      if (!this._plantAt(p.x + rand(-2, 2), p.z + rand(-2, 2))) return;
    });
    el('btnButterfly').addEventListener('click', () => {
      this.butterflies.add(this.player.pos.x + rand(-4, 4), this.player.pos.z + rand(-4, 4));
      this._say('A butterfly joins the garden 🦋');
      this.audio.pop();
    });
    el('btnRain').addEventListener('click', () => {
      const on = this.rain.toggle();
      if (on === 0) this._rainbow = 6;      /* reward with a rainbow, like 2D */
      this._say(on ? '🌧️ Rain is falling' : '☀️ The rain clears');
      this._refreshUI();
    });
    el('btnDayNight').addEventListener('click', () => {
      const t = this.scene3d.toggleDayNight();
      this._say(t > 12 ? '🌙 Night falls over the garden' : '🌅 Morning light returns');
      this._refreshUI();
    });
    el('btnPause').addEventListener('click', () => {
      this.paused = !this.paused;
      this.controller.keys.clear(); this._heldKeys.clear();
      this.audio?.suspend(this.paused);
      this._refreshUI();
      this._say(this.paused ? 'Paused - take your time 🌼' : 'Back to the garden');
    });
    el('btnClear').addEventListener('click', () => {
      for (const f of this.flowers.flowers) {
        this.effects.burst(f.x, f.y + f.spec.h * 0.7, f.z, f.color, 4, 1.4);
      }
      this.flowers.clear();
      this._say('Garden cleared 🧹 plant something new');
      this._refreshUI();
    });
    el('btnMute').addEventListener('click', () => {
      this.audio.ensure();
      this.audio.setMuted(!this.audio.muted);
      el('btnMute').textContent = this.audio.muted ? 'Sound off' : 'Sound on';
      el('btnMute').classList.toggle('on', this.audio.muted);
      this._refreshUI();
    });
  }

  _wireKeyboard() {
    this._heldKeys = new Set();
    window.addEventListener('keydown', (e) => {
      if (!this.ready || this.hud?.dialog?.open || e.target?.closest?.('input, select, textarea, button, a')) return;
      const k = e.key.toLowerCase();
      this._heldKeys.add(k);
      if (e.repeat) return;
      if (this.paused && k !== 'p') return;
      if (k === ' ' || k === 'enter') e.preventDefault();
      if (k === 'e' || k === 'enter') { this._doInteract(); return; }
      if (k === '1') { this._setTool('hand'); return; }
      if (k === '2') { this._setTool('water'); return; }
      if (k === '3') { this._setTool('food'); return; }
      if (k === ' ') { this._plantAt(this.player.pos.x + rand(-2, 2), this.player.pos.z + rand(-2, 2)); return; }
      if (k === 'b') {
        this.butterflies.add(this.player.pos.x + rand(-4, 4), this.player.pos.z + rand(-4, 4));
        this._say('A butterfly joins the garden 🦋');
        return;
      }
      if (k === 'n') { el('btnDayNight').click(); return; }
      if (k === 'r') { el('btnRain').click(); return; }
      if (k === 'c') { el('btnClear').click(); return; }
      if (k === 'p') { el('btnPause').click(); return; }
    });
    window.addEventListener('keyup', (e) => {
      this._heldKeys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => this._heldKeys.clear());
  }

  /* ------------------------------------------------------- HUD tick -- */
  _refreshUI() {
    this._uiAt = 0;      /* force the next tick to run */
  }

  _tickUI(now) {
    if (now - (this._uiAt || 0) < 160) return;
    this._uiAt = now;

    const health = Math.round(this.flowers.health() * 100);
    el('statHealth').textContent = health + '%';
    el('statWater').textContent = this.watering.amount;
    el('statFood').textContent = this.feeding.food;
    el('statFlowers').textContent = this.flowers.flowers.length;
    el('statButterflies').textContent = this.butterflies.list.length;
    el('statPicked').textContent = this.flowers.picked;

    /* ⭐ progress: goals completed / 3 */
    const G = CONFIG.goals;
    let done = 0;
    if (this.progress.planted >= G.plant) done++;
    if (this.watering.totalWatered >= G.water) done++;
    if (this.feeding.totalFed >= G.feed) done++;
    el('statProgress').textContent = Math.round((done / 3) * 100) + '%';

    const h = Math.floor(this.scene3d.hour), m = Math.floor((this.scene3d.hour % 1) * 60);
    el('statTime').textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    el('statWeather').textContent =
      this.rain.blend > 0.4 ? '🌧️ Rain' : this.rain.blend > 0.05 ? '🌦️ Drizzle' : '☀️ Clear';

    el('btnRain').classList.toggle('on', this.rain.target > 0.5);
    el('btnPause').classList.toggle('on', this.paused);
    el('btnPause').textContent = this.paused ? 'Resume' : 'Pause';
    this.hud?.update();

    /* restore the default hint after a temporary say() */
    if (this._sayUntil && now > this._sayUntil) {
      el('hint').textContent = this._defaultHint;
      this._sayUntil = 0;
    }
  }

  /* ================================================ world seeding ==== */
  _seedWorld() {
    /* flowers: scattered over soil beds and lawn, classic start count */
    let placed = 0, guard = 0;
    while (placed < CONFIG.startFlowers && guard++ < 400) {
      let x, z;
      if (rand() < 0.6) {
        const bed = pick(this.terrain.soilBeds);
        x = bed.x + rand(-bed.w / 2, bed.w / 2);
        z = bed.z + rand(-bed.d / 2, bed.d / 2);
      } else {
        const a = rand(Math.PI * 2), d = rand(4, 30);
        x = Math.cos(a) * d; z = Math.sin(a) * d;
      }
      if (this.terrain.inPond(x, z)) continue;
      /* keep a doorway clear around the spawn */
      if (Math.hypot(x, z - 30) < 3) continue;
      if (this.flowers.plant(x, z, 'random')) placed++;
    }
    this.progress.planted = 0;
    for (const flower of this.flowers.flowers) { flower.growth = rand(0.65, 1); this.flowers._sync(flower); }

    /* butterflies */
    for (let i = 0; i < CONFIG.startButterflies; i++) this.butterflies.add();
  }

  /* ---------------------------------------------------- URL presets -- */
  /* ?t=20&hour=22&rain=1&seed=rose  - same contract as the classic 2D */
  _applyUrlParams() {
    const q = new URLSearchParams(location.search);
    if (q.has('seed')) {
      const v = q.get('seed');
      this.seedType = SEEDS.includes(v) ? v : 'random';
      el('seedSelect').value = this.seedType;
    }
    if (q.has('hour')) {
      this.scene3d.hour = ((Number(q.get('hour')) || 0) % 24 + 24) % 24;
      this.scene3d.hourTarget = null;
    }
    if (q.has('rain')) {
      const r = Math.max(0, Math.min(1, parseFloat(q.get('rain')) || 0));
      this.rain.target = r > 0.5 ? 1 : 0;
      this.rain.blend = r;
    }
    if (q.has('t')) this.fastForward(parseFloat(q.get('t')) || 0);
  }

  /* run the simulation forward without rendering (classic fastForward) */
  fastForward(seconds) {
    const step = 1 / 60;
    const n = Number.isFinite(seconds) ? Math.max(0, Math.min(20000, Math.round(seconds / step))) : 0;
    this._ff = true;               /* skip raycasts + DOM prompt writes */
    for (let i = 0; i < n; i++) this.update(step);
    this._ff = false;
  }

  /* ================================================ classic facade === */
  _exposeApi() {
    const app = this;
    window.garden = {
      get flowers() { return app.flowers.flowers; },
      get butterflies() { return app.butterflies.list; },
      get picked() { return app.flowers.picked; },
      get hour() { return app.scene3d.hour; },
      set hour(v) { app.scene3d.hour = v; app.scene3d.hourTarget = null; },
      get hourTarget() { return app.scene3d.hourTarget; },
      get rain() { return app.rain.blend; },
      get rainTarget() { return app.rain.target; },
      set rainTarget(v) { app.rain.target = v ? 1 : 0; },
      get paused() { return app.paused; },
      set paused(v) { app.paused = !!v; app._refreshUI(); },
      get seedType() { return app.seedType; },
      set seedType(v) { app.seedType = v; },
      get gardener() { return app.player.pos; },
      get progress() { return app.state.snapshot({ planted: app.progress.planted, watered: app.watering.totalWatered, fed: app.feeding.totalFed }); },
      plant(x, z, type) {
        const f = app.flowers.plant(x, z, type || app.seedType);
        if (f) app.progress.planted++;
        return f;
      },
      addButterfly(x, z) { return app.butterflies.add(x, z); },
      toggleRain() {
        const t = app.rain.toggle();
        if (t === 0) app._rainbow = 6;
        app._refreshUI();
        return t;
      },
      toggleDayNight() { const t = app.scene3d.toggleDayNight(); app._refreshUI(); return t; },
      clearGarden() { app.flowers.clear(); app._refreshUI(); },
      fastForward(sec) { app.fastForward(sec); },
      groundAt(x, z) { return app.terrain.heightAt(x, z); }
    };
  }

  /* ================================================== sim + loop ===== */
  update(dt) {
    this.time += dt;

    /* wind shared by every swaying material */
    windUniforms.uTime.value += dt;
    windUniforms.uWind.value =
      0.3 + Math.sin(this.time * 0.35) * 0.18 + Math.sin(this.time * 1.7) * 0.06
      + this.rain.blend * 0.4;

    if (this.reducedMotion) windUniforms.uWind.value *= 0.15;
    this._actionTime = Math.max(0, (this._actionTime || 0) - dt);
    this.controller.interacting = this._actionTime > 0 || this.watering.pouring;
    this.controller.locked = this.overview || !!this.hud?.dialog?.open;
    this.controller.update(dt);
    if (this.overview) this.scene3d.setCameraTarget(0, 1, 0);
    this.scene3d.applyCamera(dt);
    this.scene3d.scene.updateMatrixWorld(true);
    this._focusElapsed = (this._focusElapsed || 0) + dt;
    if (!this._ff && this._focusElapsed >= 0.08) { this._updateFocus(); this._focusElapsed = 0; }

    /* world systems */
    this.scene3d.updateClock(dt);
    this.terrain.updateWater(this.reducedMotion ? 0 : this.time);
    this.landscape.update(this.time, this.reducedMotion);
    this.flowers.rain = this.rain.blend;
    this.flowers.update(dt);
    if (Math.hypot(this.player.pos.x-this.terrain.pondCenter.x, this.player.pos.z-this.terrain.pondCenter.z) < this.terrain.pondRadius + CONFIG.reach) this.state.visitPond();
    this._raycaster.setFromCamera(this.controller.pointer, this.scene3d.camera);
    this.butterflies.setPointer(this._raycaster.ray, this.player.pos.y + 2);
    this.butterflies.update(dt);
    if (this.birds) this.birds.update(dt, this.player.pos);
    this.feeding.update(dt);
    this.rain.update(dt, this.player.pos.x, this.player.pos.z, windUniforms.uWind.value);
    if (this.effects) this.effects.update(dt);

    /* falling petals from blossoms */
    this.trees.emitPetals(this.reducedMotion ? dt * 0.1 : dt, (p) => this.effects.petal(p.x, p.y, p.z, p.color));

    /* ambient pollen by day, fireflies by night */
    this._ambientT = (this._ambientT || 0) - dt;
    if (this._ambientT <= 0) {
      this._ambientT = 0.18;
      const night = this.scene3d.sky.night;
      const a = rand(Math.PI * 2), d = rand(3, 32);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      this.effects.pollen(
        x, this.terrain.heightAt(x, z) + rand(0.4, 2.2), z,
        night ? '#d9ff9e' : '#fff3c4'
      );
    }

      /* interaction prompt (skipped during headless fast-forward) */
    if (!this._ff) {
      this.interactions.update(this.scene3d.camera, this.player.pos, this.tool);
    }

    /* continuous watering: hold E with water tool on a focused flower */
    if (!this._ff && !this.controller.locked && this.tool === 'water' && this._heldKeys.has('e') && this._focusFlower && Math.hypot(this._focusFlower.x-this.player.pos.x, this._focusFlower.z-this.player.pos.z) <= CONFIG.reach) {
      const can = this._canPos(this._v1);
      const head = new THREE.Vector3(this._focusFlower.x, this._focusFlower.y + this._focusFlower.spec.h * 0.9, this._focusFlower.z);
      this.watering.applyContinuous(this._focusFlower, can, head, dt);
    } else {
      this.watering.stop();
    }

    /* rainbow: shows after rain clears, fades over time */
    if (this._rainbow > 0) this._rainbow = Math.max(0, this._rainbow - dt);
    this.scene3d.setRainbow(this._rainbow / 6, this.player.pos);

    /* audio beds */
    if (this.audio) {
      this.audio.update(dt, {
        wind: windUniforms.uWind.value,
        rain: this.rain.blend
      });
    }
  }

   frame(now) {
    cancelAnimationFrame(this._raf);
    if (this.disposed || this.contextLost) return;
    if (document.hidden) { this._last = now; this._raf = requestAnimationFrame(t => this.frame(t)); return; }
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000) || 0.016;
    this._last = now;

    if (!this.paused) this.update(dt);

    /* consume a canvas click (no-drag pointerup) as an interaction */
    const click = this.controller.takeClick();
    if (click && !this.paused && !this.overview) {
      this._updateFocus(click, false);
      this.interactions.update(this.scene3d.camera, this.player.pos, this.tool);
      if (this._focusFlower && this._entryFlower.getPrompt(this.tool)) this.interactions.active = this._entryFlower;
      else if (this._groundPoint && this._entryGround.getPrompt(this.tool)) this.interactions.active = this._entryGround;
      this._doInteract();
    }

    this.scene3d.render();
    this._tickUI(now);

    this._measure(now);
    this._raf = requestAnimationFrame((t) => this.frame(t));
  }

  _measure(now) {
    this._frames = (this._frames || 0) + 1;
    if (!this._measureAt) this._measureAt = now;
    if (now - this._measureAt < 3000) return;
    this.metrics.fps = Math.round(this._frames * 1000 / (now - this._measureAt));
    Object.assign(this.metrics, {calls: this.scene3d.renderer.info.render.calls, triangles: this.scene3d.renderer.info.render.triangles});
    this._frames = 0; this._measureAt = now;
    if (this.metrics.fps < 28 && this.hud.quality !== 'low' && !this.paused) {
      this.hud.setQuality('low'); this.metrics.quality = 'low';
    }
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this._raf);
    window.removeEventListener('pointerdown', this._wakeAudio);
    window.removeEventListener('keydown', this._wakeAudio);
    this.audio?.dispose(); this.scene3d.dispose();
  }

  async start() {
    await this._audioReady;
    await this._birdsReady;
    this.birds.world.audio = this.audio;
    this._applyUrlParams();
    this.controller.update(0);
    this.scene3d.updateClock(0);
    this.scene3d.applyCamera();
    this.ready = true;
    this._exposeApi();
    this._tickUI(performance.now());
    if (el('loading')) el('loading').hidden = true;
    this._raf = requestAnimationFrame((t) => this.frame(t));
  }
}

function showFallback(message) {
  if (el('loading')) el('loading').hidden = true;
  if (el('fallback')) el('fallback').hidden = false;
  if (el('fallbackMessage')) el('fallbackMessage').textContent = message;
}

/* ================================================================ boot */
(async () => {
  try {
    const app = new GardenApp();
    await app.start();
    window.__gardenApp = app;
    document.title = 'Enchanted Garden · A little space to slow down';
  } catch (err) {
    window.__err = window.__err || [];
    window.__err.push(String((err && err.stack) || err));
    showFallback('This device could not open the 3D garden. Try a modern browser, or enjoy the classic garden.');
    console.error('Garden startup failed', err);
  }
})();
