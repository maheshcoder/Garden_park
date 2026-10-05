/* =====================================================================
   Enchanted Garden  --  flowers, butterflies and full user control
   Vanilla JavaScript + HTML5 Canvas.  No libraries, no build step.
   Open index.html in any modern browser.

   Layout of this file
     1. utils + colour helpers
     2. sky / day-night model
     3. flower species + pre-rendered head sprites
     4. Flower
     5. Butterfly
     6. clouds, birds, motes, rain, gardener
     7. Garden  (setup, input, update)
     8. Garden  (drawing) + boot + UI wiring
   ===================================================================== */
'use strict';

/* ------------------------------------------------------------ 1. utils */
const TAU = Math.PI * 2;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sqDist = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/* ---------------------------------------------------------- colour --- */
/* accepts '#abc', '#aabbcc' and 'rgb(r,g,b)' - the sky palette hands
   back interpolated rgb() strings, so both forms must work          */
function parseColor(css) {
  if (!css) return { r: 0, g: 0, b: 0 };
  if (css.charAt(0) === '#') {
    let hx = css.slice(1);
    if (hx.length === 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2];
    const n = parseInt(hx, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const m = String(css).match(/-?\d+(\.\d+)?/g) || [0, 0, 0];
  return { r: +m[0] | 0, g: +m[1] | 0, b: +m[2] | 0 };
}
function mixHex(a, b, t) {
  const A = parseColor(a), B = parseColor(b);
  return 'rgb(' + Math.round(lerp(A.r, B.r, t)) + ',' + Math.round(lerp(A.g, B.g, t)) + ',' + Math.round(lerp(A.b, B.b, t)) + ')';
}
function shade(hex, amt) { return amt < 0 ? mixHex(hex, '#000000', -amt) : mixHex(hex, '#ffffff', amt); }
function alpha(css, a) {
  const c = parseColor(css);
  return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
}
const fade = alpha;

/* ------------------------------------------------------------ config - */
const CONFIG = {
  maxFlowers: 90,
  maxButterflies: 34,
  horizon: 0.62,        // ground line as a fraction of canvas height
  attractRadius: 210,   // how far the cursor pulls butterflies
  startFlowers: 34,
  startButterflies: 12,
  dayLength: 170        // seconds for a full 24h cycle
};

/* --------------------------------------------- 2. day / night model -- */
/* key frames for the sky palette, hours must stay ascending */
const SKY_KEYS = [
  { h: 0,  top: '#070a26', bot: '#1b1436', sun: '#f6f6ff', glow: 'rgba(150,170,255,0.22)', stars: 1,
    hills: ['#0e1830', '#132039', '#182943'], ground: '#14301e', gLight: '#1c3b27', light: '#2a3270', lightA: 0.40 },
  { h: 5,  top: '#1b2450', bot: '#5c4470', sun: '#ffd9a0', glow: 'rgba(255,185,115,0.26)', stars: 0.65,
    hills: ['#233052', '#2a3a58', '#324a5f'], ground: '#1c3a26', gLight: '#24482d', light: '#4a4690', lightA: 0.30 },
  { h: 7,  top: '#3f9ad6', bot: '#ffcfa0', sun: '#fff0b8', glow: 'rgba(255,205,150,0.28)', stars: 0.08,
    hills: ['#48795a', '#558760', '#639460'], ground: '#2e6b3a', gLight: '#398042', light: '#ffbe82', lightA: 0.16 },
  { h: 12, top: '#3ba3e8', bot: '#d6f1ff', sun: '#fffbe6', glow: 'rgba(255,250,205,0.28)', stars: 0,
    hills: ['#5c9a60', '#6daa68', '#7dbb71'], ground: '#3e8a44', gLight: '#4c9c4e', light: '#ffffff', lightA: 0.0 },
  { h: 17, top: '#4c9ede', bot: '#ffd9a6', sun: '#ffeeb4', glow: 'rgba(255,200,140,0.28)', stars: 0,
    hills: ['#548858', '#61985c', '#70a862'], ground: '#3c7f41', gLight: '#47914a', light: '#ffc896', lightA: 0.10 },
  { h: 19, top: '#3a4f96', bot: '#ff9a62', sun: '#ffb765', glow: 'rgba(255,145,80,0.32)', stars: 0.15,
    hills: ['#3b5a48', '#45654c', '#50724f'], ground: '#295a34', gLight: '#31693a', light: '#ff965a', lightA: 0.20 },
  { h: 21, top: '#18214c', bot: '#4a3368', sun: '#ececf8', glow: 'rgba(180,195,255,0.24)', stars: 0.85,
    hills: ['#192942', '#1f304b', '#263b52'], ground: '#1a3623', gLight: '#21422a', light: '#323c80', lightA: 0.36 },
  { h: 24, top: '#070a26', bot: '#1b1436', sun: '#f6f6ff', glow: 'rgba(150,170,255,0.22)', stars: 1,
    hills: ['#0e1830', '#132039', '#182943'], ground: '#14301e', gLight: '#1c3b27', light: '#2a3270', lightA: 0.40 }
];

function sampleSky(hour) {
  hour = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].h <= hour) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
  const t = clamp((hour - a.h) / (b.h - a.h), 0, 1);
  return {
    top: mixHex(a.top, b.top, t),
    bot: mixHex(a.bot, b.bot, t),
    sun: mixHex(a.sun, b.sun, t),
    glow: (t < 0.5 ? a : b).glow,
    stars: lerp(a.stars, b.stars, t),
    hills: [
      mixHex(a.hills[0], b.hills[0], t),
      mixHex(a.hills[1], b.hills[1], t),
      mixHex(a.hills[2], b.hills[2], t)
    ],
    ground: mixHex(a.ground, b.ground, t),
    gLight: mixHex(a.gLight, b.gLight, t),
    light: mixHex(a.light, b.light, t),
    lightA: lerp(a.lightA, b.lightA, t),
    night: hour < 5.6 || hour > 19.4
  };
}

/* ------------------------------------------- 3. flower species ------ */
const FLOWER_TYPES = {
  rose: {
    label: 'Rose', head: 'round', height: 62, headSize: 27,
    petals: 12, petalLen: 0.95, petalWide: 0.44, coreR: 0.30, core: '#ffd166',
    colors: ['#ff4f81', '#e01e6f', '#ff9ec4'], stem: '#2f9e4f', leaves: 2
  },
  daisy: {
    label: 'Daisy', head: 'round', height: 46, headSize: 25,
    petals: 16, petalLen: 0.97, petalWide: 0.17, coreR: 0.33, core: '#ffcc33', dots: true,
    colors: ['#ffffff', '#ffe9f0', '#f6f2ff'], stem: '#37a35a', leaves: 2
  },
  sunflower: {
    label: 'Sunflower', head: 'round', height: 80, headSize: 33,
    petals: 20, petalLen: 0.96, petalWide: 0.2, coreR: 0.44, core: '#6b3f1d', dots: true,
    colors: ['#ffc61a', '#ffa51f', '#ffdd55'], stem: '#2b7a3d', leaves: 3
  },
  tulip: {
    label: 'Tulip', head: 'cup', height: 58, headSize: 30,
    cupW: 0.6, cupH: 0.95,
    colors: ['#ff3d6e', '#ff7b54', '#c86bff', '#ffe066'], stem: '#2f9e4f', leaves: 2
  },
  lavender: {
    label: 'Lavender', head: 'spike', height: 66, headSize: 21,
    colors: ['#8e6bff', '#b39bff', '#6f8dff'], stem: '#3a8f52', leaves: 2
  }
};
const FLOWER_KEYS = Object.keys(FLOWER_TYPES);

/* heads are drawn once into offscreen canvases, then blitted (fast) */
const HEAD_PX = 72;
const headCache = new Map();

function renderHead(spec, color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = HEAD_PX * 2;
  const c = cv.getContext('2d');
  c.translate(HEAD_PX, HEAD_PX);
  if (spec.head === 'round') drawRoundHead(c, spec, color);
  else if (spec.head === 'cup') drawCupHead(c, spec, color);
  else drawSpikeHead(c, spec, color);
  return cv;
}

function getHeadSprite(type, color) {
  const key = type + '|' + color;
  let s = headCache.get(key);
  if (!s) { s = renderHead(FLOWER_TYPES[type], color); headCache.set(key, s); }
  return s;
}

/* daisy / rose / sunflower: petals radiating from a central disc */
function drawRoundHead(c, spec, color) {
  const n = spec.petals, len = HEAD_PX * spec.petalLen, wide = HEAD_PX * spec.petalWide;
  for (let i = 0; i < n; i++) {
    c.save();
    c.rotate((i / n) * TAU);
    const g = c.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, shade(color, -0.3));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, 0.28));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, -len * 0.5, wide, len * 0.5, 0, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.07)';
    c.lineWidth = HEAD_PX * 0.014;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -len * 0.88);
    c.stroke();
    c.restore();
  }
  const cr = HEAD_PX * spec.coreR;
  const g2 = c.createRadialGradient(-cr * 0.32, -cr * 0.32, cr * 0.08, 0, 0, cr);
  g2.addColorStop(0, shade(spec.core, 0.4));
  g2.addColorStop(0.7, spec.core);
  g2.addColorStop(1, shade(spec.core, -0.3));
  c.fillStyle = g2;
  c.beginPath();
  c.arc(0, 0, cr, 0, TAU);
  c.fill();
  if (spec.dots) {
    /* seed texture in a golden-angle spiral */
    c.fillStyle = shade(spec.core, -0.42);
    for (let i = 0; i < 46; i++) {
      const t = i / 46, a = i * 2.39996, r = Math.sqrt(t) * cr * 0.86;
      c.globalAlpha = 0.5;
      c.beginPath();
      c.arc(Math.cos(a) * r, Math.sin(a) * r, cr * 0.09, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
}

/* tulip: a narrow base flaring into a pointed cup */
function drawCupHead(c, spec, color) {
  const h = HEAD_PX * spec.cupH, w = HEAD_PX * spec.cupW;
  const petal = (sc, col, dx) => {
    c.save();
    c.translate(dx, 0);
    c.scale(sc, sc);
    const g = c.createLinearGradient(0, 0, 0, -h);
    g.addColorStop(0, shade(col, -0.42));
    g.addColorStop(0.5, col);
    g.addColorStop(1, shade(col, 0.32));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-w * 0.42, 0);
    c.bezierCurveTo(-w * 1.02, -h * 0.22, -w * 0.9, -h * 0.8, 0, -h);
    c.bezierCurveTo(w * 0.9, -h * 0.8, w * 1.02, -h * 0.22, w * 0.42, 0);
    c.quadraticCurveTo(0, h * 0.16, -w * 0.42, 0);
    c.closePath();
    c.fill();
    c.restore();
  };
  petal(0.92, shade(color, -0.18), -w * 0.5);
  petal(0.92, shade(color, -0.3), w * 0.5);
  petal(1, color, 0);
  /* centre seam and a soft highlight */
  c.strokeStyle = 'rgba(0,0,0,0.1)';
  c.lineWidth = HEAD_PX * 0.018;
  c.beginPath();
  c.moveTo(0, -h * 0.05);
  c.lineTo(0, -h * 0.88);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.2)';
  c.beginPath();
  c.ellipse(-w * 0.3, -h * 0.5, w * 0.1, h * 0.26, -0.15, 0, TAU);
  c.fill();
}

/* lavender: a spike of little florets */
function drawSpikeHead(c, spec, color) {
  const R = HEAD_PX;
  /* two green sepals peeking out at the base */
  c.strokeStyle = '#3f8f52';
  c.lineWidth = R * 0.05;
  c.beginPath();
  c.moveTo(0, R * 0.95);
  c.quadraticCurveTo(R * 0.32, R * 0.55, R * 0.16, R * 0.05);
  c.moveTo(0, R * 0.95);
  c.quadraticCurveTo(-R * 0.32, R * 0.55, -R * 0.16, R * 0.05);
  c.stroke();
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const y = R * 0.88 - t * R * 1.8;
    const spread = Math.sin(t * Math.PI) * R * 0.3 * (1 - t * 0.35);
    const x = (i % 2 ? spread : -spread) * 0.8;
    const r = R * 0.17 * (1 - t * 0.32);
    c.fillStyle = shade(color, i % 3 === 0 ? 0.22 : -0.05 - t * 0.15);
    c.beginPath();
    c.ellipse(x, y, r * 0.8, r, 0, 0, TAU);
    c.fill();
  }
}

/* --------------------------------------------------------- 4. Flower */
class Flower {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.spec = FLOWER_TYPES[type];
    this.color = pick(this.spec.colors);
    this.sprite = getHeadSprite(type, this.color);
    this.size = rand(1, 1.4);
    this.grow = 0;                 // 0 -> 1 growth animation
    this.growSpeed = rand(0.42, 0.85);
    this.swaySpeed = rand(0.7, 1.35);
    this.phase = rand(0, TAU);
    this.bloomAt = rand(0.3, 0.6); // fraction of growth where the head opens
    this.water = 0;                // fresh-water glow, decays
    this.hover = 0;                // 0..1 highlight when the cursor is near
    this.hue = 0;                  // cached sway offset
    this.dead = false;
  }

  get depth() { return this._d || 0; }

  /* depth foreshortening: far flowers are smaller than near ones */
  scale() { return (0.5 + 0.9 * this.depth) * this.size; }

  update(dt, t, wind) {
    const boost = 1 + this.water * 1.6 + this.hover * 0.5;
    if (this.grow < 1) this.grow = Math.min(1, this.grow + dt * this.growSpeed * boost);
    this.water = Math.max(0, this.water - dt * 0.5);
    this.hover = Math.max(0, this.hover - dt * 3);
    this.hue = Math.sin(t * this.swaySpeed + this.phase) * (0.34 + wind * 0.95);
  }

  /* top of the bloom, in world space - used for picking / landing */
  headPoint() {
    const s = this.scale();
    const h = this.spec.height * s * easeOutCubic(this.grow);
    return { x: this.x + this.hue * h * 0.3, y: this.y - h, s: s, h: h };
  }

  draw(ctx) {
    const spec = this.spec;
    const d = this.depth;
    const s = this.scale();
    const g = easeOutCubic(this.grow);
    const h = spec.height * s * g;
    if (h < 0.6) return;

    const sway = this.hue;
    const tipX = this.x + sway * h * 0.32;
    const tipY = this.y - h;

    /* soft contact shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, (5 + 5 * d) * this.size * g, (1.6 + 2.4 * d) * this.size * g, 0, 0, TAU);
    ctx.fill();

    /* stem */
    ctx.strokeStyle = spec.stem;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.8, 2.9 * s);
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.quadraticCurveTo(this.x + sway * h * 0.1, this.y - h * 0.55, tipX, tipY);
    ctx.stroke();

    /* leaves along the stem */
    const leaves = spec.leaves || 2;
    for (let i = 0; i < leaves; i++) {
      const t = 0.26 + (i / leaves) * 0.34;
      const lx = this.x + sway * h * 0.18 * t + (i % 2 ? 1 : -1) * h * 0.03;
      const ly = this.y - h * t;
      const dir = i % 2 ? 1 : -1;
      const ll = h * 0.3 * (1 - t * 0.4);
      ctx.fillStyle = alpha(spec.stem, 0.95);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.quadraticCurveTo(lx + dir * ll * 0.7, ly - ll * 0.62, lx + dir * ll, ly - ll * 0.1);
      ctx.quadraticCurveTo(lx + dir * ll * 0.55, ly + ll * 0.16, lx, ly);
      ctx.fill();
    }

    /* head */
    if (this.grow > this.bloomAt * 0.55) {
      const open = clamp((this.grow - this.bloomAt) / (1 - this.bloomAt), 0, 1);
      const hs = spec.headSize * s * g * lerp(0.35, 1, easeOutBack(open));
      const size = hs * 2;
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(sway * 0.22);
      if (this.water > 0.02 || this.hover > 0.02) {
        ctx.globalAlpha = 0.3 * Math.max(this.water, this.hover);
        ctx.drawImage(this.sprite, -size * 0.62, -size * 0.62, size * 1.24, size * 1.24);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(this.sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------ 5. Butterfly */
const BUTTERFLY_COLORS = [
  { wing: '#ff9a3c', wing2: '#f2762a', edge: '#40291a', mark: '#fff0cf' },  /* monarch */
  { wing: '#63b3ff', wing2: '#3f7fe0', edge: '#17305c', mark: '#e8f4ff' },  /* blue    */
  { wing: '#ff8fb8', wing2: '#ef5f96', edge: '#5c1636', mark: '#fff0f6' },  /* pink    */
  { wing: '#f7f3ff', wing2: '#dbd4f0', edge: '#5b5470', mark: '#ffffff' },  /* white   */
  { wing: '#c58bff', wing2: '#9a5ae0', edge: '#2e1a4d', mark: '#f3e6ff' },  /* purple  */
  { wing: '#ffe066', wing2: '#f0b429', edge: '#5c4410', mark: '#fffbe6' }   /* yellow  */
];

class Butterfly {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const sp = rand(26, 46);
    this.vx = rand(-sp, sp);
    this.vy = rand(-sp, sp) * 0.6;
    this.maxSpeed = rand(30, 58);
    this.pal = pick(BUTTERFLY_COLORS);
    this.size = rand(0.8, 1.45);
    this.flap = rand(0, TAU);
    this.flapSpeed = rand(15, 23);
    this.phase = rand(0, TAU);
    this.nt = rand(0, 10);
    this.ang = rand(0, TAU);
    this.state = 'wander';
    this.goal = { x: x, y: y };
    this.goalT = rand(0.5, 2.5);
    this.flower = null;
    this.restT = 0;
    this.restCd = rand(0, 6);
    this.dead = false;
  }

  pickGoal(g) {
    this.goal.x = rand(-20, g.w + 20);
    const floor = g.groundAt(this.goal.x);
    /* mostly down among the blooms rather than up in the sky */
    this.goal.y = rand(g.horizonY * 0.45, Math.max(g.horizonY * 0.55, floor - 30));
    this.goalT = rand(1.4, 4);
  }

  update(dt, t, g) {
    this.flap += dt * this.flapSpeed * (this.state === 'rest' ? 0.16 : 1);
    this.nt += dt;
    this.restCd = Math.max(0, this.restCd - dt);

    /* ---- resting on a flower ------------------------------------- */
    if (this.state === 'rest') {
      this.restT -= dt;
      const f = this.flower;
      if (!f || f.dead) { this.state = 'wander'; this.flower = null; this.pickGoal(g); }
      else {
        const hp = f.headPoint();
        this.x += (hp.x - this.x) * Math.min(1, dt * 6);
        this.y += (hp.y - f.spec.headSize * f.size * 0.45 - this.y) * Math.min(1, dt * 6);
        this.vx *= 0.82; this.vy *= 0.82;
        this.ang += dt * 0.6;
        if (this.restT <= 0) { this.state = 'wander'; this.flower = null; this.restCd = rand(2.5, 7); this.pickGoal(g); }
        return;
      }
    }

    /* ---- choose a target ----------------------------------------- */
    const p = g.pointer;
    const pd = p.active ? Math.hypot(p.x - this.x, p.y - this.y) : Infinity;
    let tx, ty, chase = false;
    if (pd < g.attractRadius) {
      chase = true;
      this.state = 'chase';
      if (p.down && pd < 110) {             /* swirl around the finger */
        this.state = 'orbit';
        const a = Math.atan2(this.y - p.y, this.x - p.x) + 0.55;
        tx = p.x + Math.cos(a) * 32;
        ty = p.y + Math.sin(a) * 32;
      } else { tx = p.x; ty = p.y; }
    } else {
      if (this.state !== 'wander') this.pickGoal(g);
      this.state = 'wander';
      this.goalT -= dt;
      if (this.goalT <= 0 || sqDist(this.x, this.y, this.goal.x, this.goal.y) < 8100) this.pickGoal(g);
      tx = this.goal.x; ty = this.goal.y;
    }

    /* ---- steering ------------------------------------------------ */
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = this.maxSpeed * (chase ? 1.3 : 1);
    const grip = chase ? 5.5 : 1.9;
    let ax = ((dx / d) * want - this.vx) * grip;
    let ay = ((dy / d) * want - this.vy) * grip;

    /* fluttery wander noise */
    if (!chase) {
      ax += (Math.sin(this.nt * 1.7 + this.phase) + 0.5 * Math.sin(this.nt * 3.1 + this.phase * 2)) * 26;
      ay += Math.cos(this.nt * 1.35 + this.phase * 1.7) * 24;
    }

    /* stay inside the scene, hovering just above the grass */
    const floor = g.groundAt(this.x), m = 40;
    if (this.x < m) ax += (m - this.x) * 3;
    if (this.x > g.w - m) ax -= (this.x - (g.w - m)) * 3;
    if (this.y < m) ay += (m - this.y) * 3;
    if (this.y > floor - 26) ay -= (this.y - (floor - 26)) * 2.2;

    /* personal space, so the swarm spreads out */
    for (let i = 0; i < g.butterflies.length; i++) {
      const o = g.butterflies[i];
      if (o === this) continue;
      const ox = this.x - o.x, oy = this.y - o.y, dd = ox * ox + oy * oy;
      if (dd < 2116 && dd > 0.01) {
        const f = ((2116 - dd) / 2116) * 130, r = Math.sqrt(dd);
        ax += (ox / r) * f; ay += (oy / r) * f;
      }
    }

    const al = Math.hypot(ax, ay), maxF = this.maxSpeed * 2.4;
    if (al > maxF) { ax = (ax / al) * maxF; ay = (ay / al) * maxF; }

    this.vx += ax * dt; this.vy += ay * dt;
    const sp = Math.hypot(this.vx, this.vy), cap = this.maxSpeed * (chase ? 1.5 : 1.2);
    if (sp > cap) { this.vx = (this.vx / sp) * cap; this.vy = (this.vy / sp) * cap; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    /* hard backstop: the soft margin force above can briefly lose the argument
       to a fast chase, and a window resize can shrink the frame mid-flight. */
    this.x = clamp(this.x, 6, g.w - 6);
    this.y = clamp(this.y, 12, g.groundAt(this.x) - 10);
    if (sp > 3) this.ang = lerp(this.ang, Math.atan2(this.vy, this.vx), Math.min(1, dt * 9));

    /* ---- occasionally settle on a flower -------------------------- */
    if (this.state === 'wander' && this.restCd <= 0 && g.flowers.length) {
      const f = g.flowers[(Math.random() * g.flowers.length) | 0];
      if (f && !f.dead && f.grow > 0.85 && sqDist(this.x, this.y, f.x, f.y - 20) < 1600) {
        this.state = 'rest';
        this.flower = f;
        this.restT = rand(1.4, 3.6);
      }
    }
  }

  draw(ctx) {
    const c = this.pal;
    const L = 13 * this.size, W = 18 * this.size;
    const open = 0.14 + 0.86 * Math.abs(Math.cos(this.flap));
    const lift = Math.cos(this.flap) > 0 ? 1 : 0.94;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.ang + Math.PI / 2);
    ctx.scale(open, lift);

    /* wings, drawn once and then mirrored */
    for (let s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.scale(s, 1);
      ctx.fillStyle = c.wing;
      ctx.beginPath();
      ctx.moveTo(0, -L * 0.38);
      ctx.bezierCurveTo(W * 0.5, -L * 0.9, W * 1.1, -L * 0.52, W * 0.78, -L * 0.04);
      ctx.bezierCurveTo(W * 0.6, L * 0.18, W * 0.18, L * 0.12, 0, -L * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c.wing2;
      ctx.beginPath();
      ctx.moveTo(0, -L * 0.04);
      ctx.bezierCurveTo(W * 0.46, L * 0.04, W * 0.72, L * 0.52, W * 0.3, L * 0.56);
      ctx.bezierCurveTo(W * 0.1, L * 0.57, 0, L * 0.32, 0, L * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = Math.max(0.7, 1.5 * this.size);
      ctx.stroke();
      ctx.fillStyle = c.mark;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.ellipse(W * 0.55, -L * 0.34, W * 0.15, L * 0.13, -0.4, 0, TAU);
      ctx.ellipse(W * 0.34, L * 0.28, W * 0.11, L * 0.1, 0.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* body, head, antennae */
    ctx.fillStyle = c.edge;
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.7 * this.size, L * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -L * 0.5, 1.9 * this.size, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = Math.max(0.6, 0.9 * this.size);
    ctx.beginPath();
    ctx.moveTo(-0.6 * this.size, -L * 0.62);
    ctx.quadraticCurveTo(-W * 0.34, -L, -W * 0.42, -L * 0.82);
    ctx.moveTo(0.6 * this.size, -L * 0.62);
    ctx.quadraticCurveTo(W * 0.34, -L, W * 0.42, -L * 0.82);
    ctx.stroke();
    ctx.restore();
  }
}

/* ------------------------- 6. clouds, birds, motes, rain, gardener - */
class Cloud {
  constructor(w, horizonY) {
    this.x = rand(-140, w + 140);
    this.y = rand(horizonY * 0.08, horizonY * 0.62);
    this.s = rand(0.55, 1.5);
    this.v = rand(5, 14);
    this.puffs = [];
    const n = randInt(4, 6);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      this.puffs.push({
        dx: (t - 0.5) * 78 * this.s + rand(-8, 8),
        dy: Math.sin(t * Math.PI) * -9 * this.s + rand(-4, 4),
        r: rand(15, 24) * this.s
      });
    }
  }

  update(dt, wind, w) {
    this.x += (this.v + wind * 14) * dt;
    if (this.x > w + 170 * this.s) this.x = -180 * this.s;
  }

  draw(ctx, sky) {
    ctx.fillStyle = alpha('#ffffff', 0.62 + (1 - sky.stars) * 0.3);
    ctx.beginPath();
    for (const p of this.puffs) {
      ctx.moveTo(this.x + p.dx + p.r, this.y + p.dy);
      ctx.arc(this.x + p.dx, this.y + p.dy, p.r, 0, TAU);
    }
    ctx.rect(this.x - 42 * this.s, this.y - 2, 84 * this.s, 20 * this.s);
    ctx.fill();
  }
}

class Bird {
  constructor(w, horizonY) {
    this.x = rand(0, w);
    this.y = rand(horizonY * 0.12, horizonY * 0.5);
    this.v = rand(16, 34) * (Math.random() < 0.5 ? -1 : 1);
    this.s = rand(0.7, 1.2);
    this.flap = rand(0, TAU);
    this.flapSpeed = rand(5, 8);
  }

  update(dt, w) {
    this.flap += dt * this.flapSpeed;
    this.x += this.v * dt;
    if (this.x > w + 30) this.x = -30;
    if (this.x < -30) this.x = w + 30;
  }

  draw(ctx, sky) {
    const f = Math.sin(this.flap);
    const s = 7 * this.s;
    ctx.strokeStyle = alpha('#20304a', 0.35 + (1 - sky.stars) * 0.4);
    ctx.lineWidth = 1.6 * this.s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x - s, this.y + f * s * 0.5);
    ctx.quadraticCurveTo(this.x - s * 0.4, this.y - s * 0.55 * f, this.x, this.y);
    ctx.quadraticCurveTo(this.x + s * 0.4, this.y - s * 0.55 * f, this.x + s, this.y + f * s * 0.5);
    ctx.stroke();
  }
}

/* pollen motes in daylight, fireflies once it gets dark */
class Mote {
  constructor(w, horizonY, h) {
    this.x = rand(0, w);
    this.ground = rand(horizonY * 0.9, h);          /* pollen hugs the flowers */
    this.y = this.ground;
    this.phase = rand(0, TAU);
    this.s = rand(0.6, 1.5);
    this.speed = rand(0.25, 0.9);
    this.blink = rand(0.6, 2.4);
  }

  update(dt, t, wind, w, h) {
    this.phase += dt * this.speed;
    this.x += (Math.sin(this.phase * 0.9) * 8 + wind * 16) * dt;
    this.y = this.ground - 14 - (Math.sin(this.phase * 0.6) * 0.5 + 0.5) * 52 - Math.cos(this.phase * 1.3) * 12;
    if (this.x > w + 20) this.x = -20;
    if (this.x < -20) this.x = w + 20;
  }

  draw(ctx, t, sky) {
    const night = sky.stars > 0.25;
    const blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * this.blink * 2.2 + this.phase));
    const col = night ? '#e9ff8a' : '#fff6cf';
    const a = night ? (0.5 + 0.5 * blink) * 0.85 : 0.12 * blink;
    const r = (night ? 2.6 : 1.5) * this.s;
    const glow = r * (night ? 6 : 3.4);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glow);
    g.addColorStop(0, alpha(col, a));
    g.addColorStop(1, alpha(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, glow, 0, TAU);
    ctx.fill();
    if (night) {
      ctx.fillStyle = alpha(col, Math.min(1, a * 1.2));
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

/* the little gardener: walk with WASD / arrows, plant with Space */
class Gardener {
  constructor(x, frac) {
    this.x = x;
    this.frac = frac === undefined ? rand(0.45, 0.7) : frac;  /* 0 = far edge of the lawn, 1 = near */
    this.y = 0;
    this.vx = 0;
    this.face = 1;
    this.step = 0;
    this.waterT = 0;
    this.pouring = false;
  }

  update(dt, keys, g) {
    let ax = 0, ay = 0;
    if (keys.has('a') || keys.has('arrowleft')) ax -= 1;
    if (keys.has('d') || keys.has('arrowright')) ax += 1;
    if (keys.has('w') || keys.has('arrowup')) ay -= 1;
    if (keys.has('s') || keys.has('arrowdown')) ay += 1;
    const mag = Math.hypot(ax, ay);
    if (mag > 0) { ax /= mag; ay /= mag; }

    /* walking up and down the lawn slides him along its depth */
    this.frac = clamp(this.frac + ay * 0.42 * dt, 0, 1);

    this.vx = lerp(this.vx, ax * 210, Math.min(1, dt * 12));
    this.x = clamp(this.x + this.vx * dt, 20, g.w - 20);

    /* always standing on the grass, whatever the window size */
    const floor = g.groundAt(this.x) + 4;
    this.y = floor + this.frac * (g.h - 12 - floor);

    const moving = Math.abs(this.vx) > 8;
    this.step += moving ? dt * 9 : dt * 1.4;
    if (Math.abs(this.vx) > 6) this.face = this.vx > 0 ? 1 : -1;
    this.pouring = keys.has('e');
    this.waterT = this.pouring ? Math.min(1, this.waterT + dt * 4) : Math.max(0, this.waterT - dt * 4);
  }

  /* can tip a little water onto the flowers around us */
  waterRadius() { return 60 + this.waterT * 26; }

  draw(ctx) {
    const s = 0.8 + 0.62 * this._d;
    const bob = Math.sin(this.step * 2) * 1.1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s * this.face, s);

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 3.6, 0, 0, TAU);
    ctx.fill();

    ctx.translate(0, bob);

    /* legs */
    const kick = Math.sin(this.step) * 4;
    ctx.strokeStyle = '#3b5b93';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -13); ctx.lineTo(-2 + kick, 0);
    ctx.moveTo(2, -13); ctx.lineTo(2 - kick, 0);
    ctx.stroke();

    /* body */
    ctx.fillStyle = '#4f8ef7';
    ctx.beginPath();
    ctx.ellipse(0, -19, 8, 9, 0, 0, TAU);
    ctx.fill();
    /* arms */
    ctx.strokeStyle = '#e0a86a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -23); ctx.lineTo(-10 - kick * 0.5, -15);
    ctx.moveTo(6, -23); ctx.lineTo(10 + kick * 0.5, -15);
    ctx.stroke();

    /* head */
    ctx.fillStyle = '#f6cda0';
    ctx.beginPath();
    ctx.arc(0, -31, 6.4, 0, TAU);
    ctx.fill();
    /* eyes */
    ctx.fillStyle = '#22304a';
    ctx.beginPath();
    ctx.arc(-2.2, -32, 1.05, 0, TAU);
    ctx.arc(2.2, -32, 1.05, 0, TAU);
    ctx.fill();
    /* straw hat */
    ctx.fillStyle = '#f0c96b';
    ctx.beginPath();
    ctx.ellipse(0, -35.5, 11, 3.6, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -38, 5.4, 4.2, 0, Math.PI, 0);
    ctx.fill();

    /* watering can, tilts when pouring */
    ctx.save();
    ctx.translate(12, -14);
    ctx.rotate(-this.waterT * 0.85);
    ctx.fillStyle = '#9fb3c8';
    ctx.fillRect(-2, -4, 9, 8);
    ctx.strokeStyle = '#9fb3c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, -3); ctx.lineTo(11, -8);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
}

/* ================================================================
   7. GARDEN  -  scene setup, input, simulation
   ================================================================ */
class Garden {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.skyCanvas = document.createElement('canvas');
    this.skyKey = '';

    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.horizonY = 0;

    this.time = 0;
    this.paused = false;
    this.hour = 9.2;
    this.hourTarget = null;

    this.rain = 0;
    this.rainTarget = 0;
    this.rainbow = 0;
    this.wind = 0.45;
    this.gust = 0;
    this.gustT = 3;

    this.flowers = [];
    this.butterflies = [];
    this.clouds = [];
    this.birds = [];
    this.motes = [];
    this.drops = [];
    this.splashes = [];
    this.sparks = [];
    this.grass = [];
    this.trees = [];
    this.stars = [];

    this.pointer = { x: 0, y: 0, active: false, down: false, glow: 0 };
    this.keys = new Set();
    this.seedType = 'random';
    this.picked = 0;
    this.waterAcc = 0;
    this.last = 0;
    this.gardener = null;

    this.bindInput();
    this.resize();
    this.seed();
    this.gardener = new Gardener(this.w * 0.5);
  }

  /* ---------------------------------------------------- geometry -- */
  groundAt(x) {
    return this.horizonY + Math.sin(x * 0.0035 + 0.8) * 10 + Math.sin(x * 0.0091 + 2.1) * 5;
  }

  depthAt(x, y) {
    const f = this.groundAt(x);
    return clamp((y - f) / Math.max(1, this.h - f), 0, 1);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(320, r.width || window.innerWidth);
    this.h = Math.max(320, r.height || window.innerHeight);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.skyCanvas.width = this.canvas.width;
    this.skyCanvas.height = this.canvas.height;
    this.skyKey = '';
    this.horizonY = this.h * CONFIG.horizon;

    /* grass blades, batched into a few colour/width groups so the
       whole lawn costs only a handful of draw calls                    */
    this.grass = [];
    const span = this.h - this.horizonY;
    const tufts = clamp(Math.round((this.w * span) / 2000), 60, 460);
    for (let i = 0; i < tufts; i++) {
      const cx = rand(-14, this.w + 14);
      const cy = this.groundAt(cx) + Math.pow(Math.random(), 0.62) * (span + 6);
      const n = randInt(3, 7);                          /* blades in a clump */
      for (let j = 0; j < n; j++) {
        const x = cx + rand(-15, 15), y = cy + rand(-7, 9);
        const d = this.depthAt(x, y);
        const b = {
          x: x, y: y,
          h: rand(8, 22) * (0.55 + d * 1.05),
          d: d,
          phase: rand(0, TAU),
          speed: rand(0.7, 1.7),
          lean: rand(-0.4, 0.4),
          bucket: 0
        };
        b.bucket = (b.h < 12 ? 0 : b.h < 17 ? 1 : 2) * 2 + (Math.random() < 0.5 ? 0 : 1);
        this.grass.push(b);
      }
    }
    this.grass.sort((a, b) => a.y - b.y);

    /* soft patches of lighter / darker turf */
    this.patches = [];
    for (let i = 0; i < 14; i++) {
      const x = rand(-60, this.w + 60);
      this.patches.push({
        x: x, y: this.groundAt(x) + Math.pow(Math.random(), 0.6) * (this.h - this.groundAt(x)),
        rx: rand(120, 300), ry: rand(30, 80), light: Math.random() < 0.5
      });
    }

    /* background trees + stars */
    this.trees = [];
    for (let i = 0; i < 16; i++) {
      this.trees.push({ x: rand(-30, this.w + 30), s: rand(0.5, 1.15), k: Math.random() < 0.5 ? 0 : 1 });
    }
    this.trees.sort((a, b) => a.s - b.s);
    this.stars = [];
    for (let i = 0; i < 150; i++) {
      this.stars.push({ x: rand(0, this.w), y: rand(0, this.horizonY * 0.92), r: rand(0.5, 1.5), p: rand(0, TAU) });
    }

    /* keep everyone inside the new frame */
    for (const f of this.flowers) {
      f.x = clamp(f.x, 6, this.w - 6);
      f.y = clamp(f.y, this.groundAt(f.x) + 2, this.h - 6);
    }
    for (const b of this.butterflies) {
      b.x = clamp(b.x, 10, this.w - 10);
      b.y = clamp(b.y, 20, this.groundAt(b.x) - 14);
    }
    if (this.gardener) {
      this.gardener.x = clamp(this.gardener.x, 20, this.w - 20);
    }
    /* the cursor may now sit outside the shrunken frame. Re-activating on the
       next pointermove means we can safely drop it here, otherwise chasing
       butterflies would follow a phantom target off the edge of the lawn.  */
    const p = this.pointer;
    if (p.x < 0 || p.x > this.w || p.y < 0 || p.y > this.h) {
      p.active = false; p.down = false;
    } else {
      p.x = clamp(p.x, 0, this.w); p.y = clamp(p.y, 0, this.h);
    }
  }

  /* ------------------------------------------------------- seeding - */
  seed() {
    for (let i = 0; i < 7; i++) this.clouds.push(new Cloud(this.w, this.horizonY));
    for (let i = 0; i < 3; i++) this.birds.push(new Bird(this.w, this.horizonY));
    for (let i = 0; i < 34; i++) this.motes.push(new Mote(this.w, this.horizonY, this.h));
    for (let i = 0; i < CONFIG.startFlowers; i++) this.plant(rand(0, this.w), null, true);
    for (let i = 0; i < CONFIG.startButterflies; i++) {
      this.butterflies.push(new Butterfly(rand(0, this.w), rand(this.horizonY * 0.2, this.horizonY * 0.9)));
    }
  }

  nextType() { return this.seedType === 'random' ? pick(FLOWER_KEYS) : this.seedType; }

  /* -------------------------------------------------------- actions - */
  plant(x, y, silent) {
    if (this.flowers.length >= CONFIG.maxFlowers) return null;
    x = clamp(x, 8, this.w - 8);
    if (y === null || y === undefined) {
      const f = this.groundAt(x);
      y = f + Math.pow(Math.random(), 0.7) * (this.h - f - 8);
    }
    y = clamp(y, this.groundAt(x) + 2, this.h - 6);
    const fl = new Flower(x, y, this.nextType());
    fl._d = this.depthAt(x, y);
    if (!silent) fl.grow = rand(0.02, 0.2);
    this.flowers.push(fl);
    this.burst(x, y - 10, fl.color, 10);
    return fl;
  }

  addButterfly(x, y) {
    if (this.butterflies.length >= CONFIG.maxButterflies) this.butterflies.shift();
    /* butterflies belong in the sky, but callers usually hand us a point next
       to the gardener, who stands on the lawn below the horizon. Clamp upward
       so a new arrival never pops into existence over the grass.        */
    if (y === undefined) y = rand(this.horizonY * 0.2, this.horizonY * 0.85);
    y = Math.min(y, this.horizonY * 0.92);
    const b = new Butterfly(x === undefined ? rand(0, this.w) : x, y);
    this.butterflies.push(b);
    this.burst(b.x, b.y, b.pal.wing, 8);
    return b;
  }

  flowerNear(x, y, r) {
    let best = null, bd = r * r;
    for (const f of this.flowers) {
      const hp = f.headPoint();
      const d = Math.min(sqDist(x, y, f.x, f.y), sqDist(x, y, hp.x, hp.y));
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  removeFlower(f) {
    if (!f) return;
    f.dead = true;
    const i = this.flowers.indexOf(f);
    if (i >= 0) this.flowers.splice(i, 1);
    this.burst(f.x, f.y - 14, f.color, 12);
  }

  clearGarden() {
    for (const f of this.flowers) this.burst(f.x, f.y - 12, f.color, 4);
    this.flowers.length = 0;
    this.picked = 0;
  }

  toggleRain() {
    this.rainTarget = this.rainTarget > 0.5 ? 0 : 1;
    if (this.rainTarget === 0) this.rainbow = 1;          /* reward with a rainbow */
    return this.rainTarget > 0.5;
  }

  toggleDayNight() {
    this.hourTarget = this.hour > 6.5 && this.hour < 18 ? 22 : 9.5;
    return this.hourTarget;
  }

  burst(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(25, 120);
      this.sparks.push({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
        life: 0, max: rand(0.35, 0.8),
        size: rand(1.4, 3.4), col: col, grav: 210
      });
    }
  }

  /* ---------------------------------------------------------- input - */
  bindInput() {
    const c = this.canvas;
    const at = (e) => {
      const r = c.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      this.pointer.active = true;
    };
    c.addEventListener('pointermove', at);
    c.addEventListener('pointerdown', (e) => {
      at(e);
      this.pointer.down = true;
      if (e.button === 2 || e.shiftKey) {
        this.removeFlower(this.flowerNear(this.pointer.x, this.pointer.y, 34));
      } else {
        const f = this.flowerNear(this.pointer.x, this.pointer.y, 20);
        if (f) { this.picked++; this.removeFlower(f); }         /* pick a flower */
        else this.plant(this.pointer.x, this.pointer.y);         /* plant a new one */
      }
      e.preventDefault();
    });
    window.addEventListener('pointerup', () => { this.pointer.down = false; });
    c.addEventListener('pointerleave', () => { this.pointer.active = false; this.pointer.down = false; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') e.preventDefault();
      if (this.keys.has(k)) return;                            /* ignore auto-repeat */
      this.keys.add(k);
      const gd = this.gardener;
      switch (k) {
        case ' ': this.plant(gd.x + rand(-26, 26), gd.y + rand(-8, 10)); break;
        case 'b': this.addButterfly(gd.x + rand(-40, 40), gd.y - rand(40, 90)); break;
        case 'n': ui.refresh(this.toggleDayNight()); break;
        case 'r': ui.refresh(this.toggleRain()); break;
        case 'c': this.clearGarden(); break;
        case 'p': this.paused = !this.paused; ui.refresh(); break;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('resize', () => this.resize());
  }

  /* ------------------------------------------------------ simulate - */
  update(dt) {
    this.time += dt;
    this.skyNow = sampleSky(this.hour);

    /* ---- time of day ---- */
    if (this.hourTarget !== null) {
      this.hour += (this.hourTarget - this.hour) * Math.min(1, dt * 0.8);
      if (Math.abs(this.hourTarget - this.hour) < 0.04) { this.hour = this.hourTarget; this.hourTarget = null; }
    } else {
      this.hour = (this.hour + (dt * 24) / CONFIG.dayLength) % 24;
    }

    /* ---- weather + wind ---- */
    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * 0.6);
    this.rainbow = Math.max(0, this.rainbow - dt * 0.028);
    this.gustT -= dt;
    if (this.gustT <= 0) { this.gustT = rand(2.5, 7); this.gust = rand(0.25, 1); }
    this.gust = Math.max(0, this.gust - dt * 0.3);
    this.wind = 0.3 + Math.sin(this.time * 0.31) * 0.15 + this.gust * 0.45 + this.rain * 0.8;

    /* ---- pointer ---- */
    this.pointer.glow += ((this.pointer.active ? 1 : 0) - this.pointer.glow) * Math.min(1, dt * 4);

    /* ---- gardener + watering ---- */
    const gd = this.gardener;
    gd._d = this.depthAt(gd.x, gd.y);
    gd.update(dt, this.keys, this);
    if (gd.waterT > 0.15) {
      const r2 = gd.waterRadius() * gd.waterRadius();
      for (const f of this.flowers) if (sqDist(f.x, f.y, gd.x, gd.y) < r2) f.water = 1;
      this.waterAcc += dt;
      while (this.waterAcc > 0.03) {
        this.waterAcc -= 0.03;
        this.sparks.push({
          x: gd.x + rand(4, 18) * gd.face, y: gd.y - rand(30, 46),
          vx: rand(-16, 30), vy: rand(70, 160),
          life: 0, max: 0.5, size: rand(1, 2.2), col: '#8fd8ff', grav: 320
        });
      }
    }

    /* ---- flowers ---- */
    const p = this.pointer;
    for (const f of this.flowers) {
      f._d = this.depthAt(f.x, f.y);
      f.update(dt, this.time, this.wind);
      if (p.active && sqDist(p.x, p.y, f.x, f.y - f.spec.height * 0.6) < 3600) f.hover = 1;
    }
    if (this.flowers.length > 1) this.flowers.sort((a, b) => a.y - b.y);

    /* ---- butterflies ---- */
    for (const b of this.butterflies) b.update(dt, this.time, this);
    if (this.butterflies.some((b) => b.dead)) this.butterflies = this.butterflies.filter((b) => !b.dead);

    /* ---- sky life ---- */
    for (const c of this.clouds) c.update(dt, this.wind, this.w);
    for (const b of this.birds) b.update(dt, this.w);
    for (const m of this.motes) m.update(dt, this.time, this.wind, this.w, this.h);

    /* ---- rain ---- */
    const want = Math.floor(this.rain * 190);
    while (this.drops.length < want) {
      this.drops.push({ x: rand(-40, this.w + 40), y: rand(-this.h, 0), len: rand(9, 24), spd: rand(640, 1000) });
    }
    if (this.drops.length > want) this.drops.length = want;
    if (want > 0) {
      for (const d of this.drops) {
        d.x += this.wind * 90 * dt;
        d.y += d.spd * dt;
        if (d.y > this.h) {
          if (this.splashes.length < 80 && Math.random() < 0.45) {
            this.splashes.push({ x: clamp(d.x, 0, this.w), y: this.groundAt(clamp(d.x, 0, this.w)), r: 0, life: 0 });
          }
          d.y = rand(-180, -10);
          d.x = rand(-40, this.w + 40);
        }
      }
    }
    for (const s of this.splashes) { s.life += dt; s.r += dt * 48; }
    for (let i = this.splashes.length - 1; i >= 0; i--) if (this.splashes[i].life > 0.32) this.splashes.splice(i, 1);

    /* ---- sparkles ---- */
    for (const s of this.sparks) { s.life += dt; s.vy += s.grav * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    for (let i = this.sparks.length - 1; i >= 0; i--) if (this.sparks[i].life > this.sparks[i].max) this.sparks.splice(i, 1);
    if (this.sparks.length > 400) this.sparks.splice(0, this.sparks.length - 400);
  }

  /* -------------------------------------------------------- render - */
  hillSurface(L, x) {
    return L.base - L.amp * 0.5 - Math.sin(x * L.f1 + L.ph) * L.amp * 0.5 - Math.sin(x * L.f2 + L.ph * 2) * L.amp * 0.16;
  }

  drawSky(ctx, sky) {
    const key = Math.round(this.hour * 5) + '|' + this.w + 'x' + this.h;
    if (key !== this.skyKey) {
      this.skyKey = key;
      const c = this.skyCanvas.getContext('2d');
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const g = c.createLinearGradient(0, 0, 0, this.horizonY + 4);
      g.addColorStop(0, sky.top);
      g.addColorStop(0.8, mixHex(sky.top, sky.bot, 0.45));
      g.addColorStop(1, sky.bot);
      c.fillStyle = g;
      c.fillRect(0, 0, this.w, this.horizonY + 4);
    }
    ctx.drawImage(this.skyCanvas, 0, 0, this.w, this.h);
  }

  drawStars(ctx, sky) {
    if (sky.stars < 0.03) return;
    ctx.fillStyle = '#ffffff';
    for (const s of this.stars) {
      ctx.globalAlpha = sky.stars * (0.2 + 0.8 * (0.5 + 0.5 * Math.sin(this.time * 1.7 + s.p)));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* sun by day, moon by night, on the same arc */
  bodyPos() {
    const day = this.hour >= 6 && this.hour <= 18.5;
    const t = clamp(day ? (this.hour - 6) / 12 : (this.hour < 6 ? this.hour + 24 - 18 : this.hour - 18) / 12, 0, 1);
    return {
      day: day,
      x: this.w * (0.08 + t * 0.84),
      y: this.horizonY * 0.92 - Math.sin(t * Math.PI) * this.horizonY * 0.7
    };
  }

  drawBody(ctx, sky) {
    const p = this.bodyPos();
    const r = p.day ? 27 : 21;
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.4, p.x, p.y, r * (p.day ? 5.5 : 4.2));
    g.addColorStop(0, p.day ? fade(sky.glow, 0.55) : fade(sky.glow, 0.4));
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * (p.day ? 5.5 : 4.2), 0, TAU);
    ctx.fill();

    const d = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
    d.addColorStop(0, shade(sky.sun, 0.45));
    d.addColorStop(1, sky.sun);
    ctx.fillStyle = d;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();

    if (!p.day) {                                   /* moon craters */
      ctx.fillStyle = 'rgba(120,130,160,0.35)';
      ctx.beginPath();
      ctx.arc(p.x - r * 0.3, p.y - r * 0.15, r * 0.2, 0, TAU);
      ctx.arc(p.x + r * 0.28, p.y + r * 0.25, r * 0.14, 0, TAU);
      ctx.arc(p.x + r * 0.05, p.y - r * 0.42, r * 0.1, 0, TAU);
      ctx.fill();
    }
  }

  drawRainbow(ctx) {
    if (this.rainbow <= 0) return;
    const a = this.rainbow * 0.5;
    const cx = this.w * 0.5, cy = this.horizonY + 8, R = Math.max(this.w, this.h) * 0.62;
    const bands = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'];
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineWidth = R * 0.045;
    for (let i = 0; i < bands.length; i++) {
      ctx.strokeStyle = bands[i];
      ctx.beginPath();
      ctx.arc(cx, cy, R - i * R * 0.045, Math.PI, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHills(ctx, sky) {
    const w = this.w, hz = this.horizonY;
    const layers = [
      { col: sky.hills[0], base: hz - 4, amp: 80, f1: 0.0042, f2: 0.011, ph: 1.0 },
      { col: sky.hills[1], base: hz + 6, amp: 52, f1: 0.0035, f2: 0.013, ph: 2.2 },
      { col: sky.hills[2], base: hz + 16, amp: 30, f1: 0.0028, f2: 0.009, ph: 4.1 }
    ];
    for (const L of layers) {
      ctx.fillStyle = L.col;
      ctx.beginPath();
      ctx.moveTo(0, L.base + 240);
      ctx.lineTo(0, this.hillSurface(L, 0));
      for (let x = 8; x <= w + 8; x += 8) ctx.lineTo(x, this.hillSurface(L, x));
      ctx.lineTo(w + 8, L.base + 240);
      ctx.closePath();
      ctx.fill();
    }

    /* a few trees on the middle hills */
    for (const tr of this.trees) {
      const L = layers[tr.k];
      const y = this.hillSurface(L, tr.x), s = tr.s;
      ctx.fillStyle = 'rgba(30,44,34,0.75)';
      ctx.fillRect(tr.x - 1.5 * s, y - 9 * s, 3 * s, 10 * s);
      ctx.fillStyle = 'rgba(24,52,38,0.8)';
      ctx.beginPath();
      ctx.arc(tr.x, y - 15 * s, 8.5 * s, 0, TAU);
      ctx.arc(tr.x - 6.5 * s, y - 10 * s, 6 * s, 0, TAU);
      ctx.arc(tr.x + 6.5 * s, y - 11 * s, 6.5 * s, 0, TAU);
      ctx.fill();
    }
  }

  drawGround(ctx, sky) {
    const w = this.w;
    ctx.beginPath();
    ctx.moveTo(0, this.groundAt(0));
    for (let x = 8; x <= w + 8; x += 8) ctx.lineTo(x, this.groundAt(x));
    ctx.lineTo(w + 8, this.h);
    ctx.lineTo(0, this.h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, this.horizonY - 12, 0, this.h);
    g.addColorStop(0, sky.gLight);
    g.addColorStop(0.45, sky.ground);
    g.addColorStop(1, sky.ground);
    ctx.fillStyle = g;
    ctx.fill();

    /* uneven turf, clipped to the lawn, soft edges */
    ctx.save();
    ctx.clip();
    for (const p of this.patches) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx);
      g.addColorStop(0, p.light ? 'rgba(255,255,255,0.075)' : 'rgba(12,45,18,0.1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, p.ry / p.rx);
      ctx.beginPath();
      ctx.arc(0, 0, p.rx, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /* the lawn, drawn as 6 batched strokes instead of one per blade */
  drawGrass(ctx, sky) {
    const wind = this.wind;
    const tones = ['#3f9250', '#4da75c', '#348546', '#57b066', '#2c7a3f', '#61bd6d'];
    for (let b = 0; b < 6; b++) {
      ctx.strokeStyle = tones[b];
      ctx.lineWidth = 1 + (b >> 1) * 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const bl of this.grass) {
        if (bl.bucket !== b) continue;
        const s = Math.sin(this.time * bl.speed + bl.phase) * (2 + wind * 5) * (0.4 + bl.d);
        const tipX = bl.x + s + bl.lean * bl.h;
        const tipY = bl.y - bl.h;
        ctx.moveTo(bl.x, bl.y);
        ctx.quadraticCurveTo(bl.x + s * 0.4, bl.y - bl.h * 0.55, tipX, tipY);
      }
      ctx.stroke();
    }
  }

  drawRain(ctx) {
    if (!this.drops.length) return;
    ctx.strokeStyle = 'rgba(190,220,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const d of this.drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - this.wind * 5, d.y - d.len);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210,235,255,0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const s of this.splashes) {
      const k = 1 - s.life / 0.32;
      ctx.moveTo(s.x - s.r * k, s.y);
      ctx.lineTo(s.x + s.r * k, s.y);
    }
    ctx.stroke();
  }

  drawSparks(ctx) {
    if (!this.sparks.length) return;
    for (const s of this.sparks) {
      const k = 1 - s.life / s.max;
      ctx.globalAlpha = k;
      ctx.fillStyle = s.col;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.4 + k * 0.8), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* the cursor is a little pool of light the butterflies follow */
  drawPointer(ctx) {
    const p = this.pointer;
    if (p.glow < 0.02) return;
    const r = 46 + Math.sin(this.time * 2.4) * 3;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, 'rgba(255,246,200,' + (0.34 * p.glow) + ')');
    g.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 * p.glow) + ')';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13 + (p.down ? -3 : 0), 0, TAU);
    ctx.stroke();
  }

  drawOverlay(ctx, sky) {
    if (sky.lightA > 0.01) {
      ctx.fillStyle = fade(sky.light, sky.lightA);
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.rain > 0.02) {
      ctx.fillStyle = 'rgba(70,90,120,' + (0.26 * this.rain) + ')';
      ctx.fillRect(0, 0, this.w, this.h);
    }
    const v = ctx.createRadialGradient(this.w * 0.5, this.h * 0.5, Math.min(this.w, this.h) * 0.35,
      this.w * 0.5, this.h * 0.5, Math.max(this.w, this.h) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  draw() {
    const ctx = this.ctx, sky = this.skyNow || sampleSky(this.hour);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.lineJoin = 'round';

    this.drawSky(ctx, sky);
    this.drawStars(ctx, sky);
    this.drawBody(ctx, sky);
    if (sky.stars < 0.5) for (const b of this.birds) b.draw(ctx, sky);
    for (const c of this.clouds) c.draw(ctx, sky);
    this.drawRainbow(ctx);
    this.drawHills(ctx, sky);
    this.drawGround(ctx, sky);
    this.drawGrass(ctx, sky);

    /* flowers, gardener and butterflies share one depth-sorted pass */
    const items = this.flowers.slice();
    items.push(this.gardener);
    for (const b of this.butterflies) items.push(b);
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw(ctx, sky);

    for (const m of this.motes) m.draw(ctx, this.time, sky);
    this.drawRain(ctx);
    this.drawSparks(ctx);
    this.drawPointer(ctx);
    this.drawOverlay(ctx, sky);
  }

  /* run the simulation forward without waiting (used by ?t= and on boot) */
  fastForward(seconds) {
    const step = 1 / 60;
    const n = Math.min(20000, Math.round(seconds / step));
    for (let i = 0; i < n; i++) this.update(step);
  }

  start() {
    const loop = (now) => {
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
      this.last = now;
      if (!this.paused) this.update(dt);
      this.draw();
      ui.tick(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

/* ================================================================
   8. UI + BOOT
   ================================================================ */
const el = (id) => document.getElementById(id);
let garden = null;
let sayT = 0;

const ui = {
  flowers: el('statFlowers'),
  butterflies: el('statButterflies'),
  picked: el('statPicked'),
  clock: el('statTime'),
  weather: el('statWeather'),
  hint: el('hint'),
  btnRain: el('btnRain'),
  btnPause: el('btnPause'),
  at: 0,

  say(msg) {
    this.hint.textContent = msg;
    sayT = 3;
  },

  /* throttled, called from the render loop */
  tick(now) {
    if (now - this.at < 160) return;
    this.at = now;
    this.flowers.textContent = garden.flowers.length;
    this.butterflies.textContent = garden.butterflies.length;
    this.picked.textContent = garden.picked;
    const h = Math.floor(garden.hour), m = Math.floor((garden.hour % 1) * 60);
    this.clock.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    this.weather.textContent = garden.rain > 0.4 ? '🌧️ Rain' : garden.rain > 0.05 ? '🌦️ Drizzle' : '☀️ Clear';
    this.btnRain.classList.toggle('on', garden.rainTarget > 0.5);
    this.btnPause.classList.toggle('on', garden.paused);
    this.btnPause.textContent = garden.paused ? '▶️ Resume' : '⏸ Pause';
  },

  refresh() { this.at = 0; }
};

el('seedSelect').addEventListener('change', (e) => {
  garden.seedType = e.target.value;
  ui.say('Seeds switched to ' + (garden.seedType === 'random' ? 'a random species' : FLOWER_TYPES[garden.seedType].label + 's'));
});

el('btnFlower').addEventListener('click', () => {
  const g = garden.gardener;
  if (!garden.plant(g.x + rand(-70, 70), g.y + rand(-24, 18))) ui.say('The garden is full 🌼 pick or remove a flower first');
});

el('btnButterfly').addEventListener('click', () => {
  const g = garden.gardener;
  garden.addButterfly(g.x + rand(-70, 70), g.y - rand(50, 110));
  ui.say('A butterfly joins the garden 🦋');
});

el('btnRain').addEventListener('click', () => {
  const on = garden.toggleRain();
  ui.refresh();
  ui.say(on ? 'Rain is falling 🌧️ the wind picks up' : 'The rain stops 🌈 a rainbow appears');
});

el('btnDayNight').addEventListener('click', () => {
  const target = garden.toggleDayNight();
  ui.refresh();
  ui.say(target > 18 ? 'Night falls 🌙 fireflies come out' : 'Good morning ☀️ the sun rises');
});

el('btnPause').addEventListener('click', () => { garden.paused = !garden.paused; ui.refresh(); });
el('btnClear').addEventListener('click', () => { garden.clearGarden(); ui.refresh(); ui.say('Garden cleared 🧹 plant something new'); });

/* temporary hint messages */
const HINT = 'Move the mouse to gather butterflies · click the grass to plant · click a flower to pick it · right-click to remove';
(function hintLoop() {
  if (sayT > 0) {
    sayT -= 0.2;
    if (sayT <= 0) ui.hint.textContent = HINT;
  }
  setTimeout(hintLoop, 200);
})();

/* ------------------------------------------------------------- boot - */
const canvas = el('garden');
if (canvas && canvas.getContext) {
  garden = new Garden(canvas);
  window.garden = garden;              /* handy handle for the console */

  /* optional presets:  ?t=20&hour=22&rain=1&seed=rose  */
  const q = new URLSearchParams(location.search);
  if (q.has('seed')) {
    const v = q.get('seed');
    garden.seedType = FLOWER_TYPES[v] ? v : 'random';
    el('seedSelect').value = garden.seedType;
  }
  if (q.has('hour')) { garden.hour = parseFloat(q.get('hour')) || 0; garden.hourTarget = null; }
  if (q.has('rain')) { garden.rainTarget = clamp(parseFloat(q.get('rain')) || 0, 0, 1); }
  if (q.has('t')) garden.fastForward(parseFloat(q.get('t')) || 0);

  garden.start();
  ui.hint.textContent = HINT;
} else {
  document.body.innerHTML = '<p style="padding:24px;font:16px system-ui">This garden needs a browser with HTML5 canvas support.</p>';
}












