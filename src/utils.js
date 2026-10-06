/* Shared, cycle-free helpers used across the 3D garden modules. */
export const TAU = Math.PI * 2;
let randomSource = Math.random;
export function seededRandom(seed = 48271) {
  return () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed); seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed); return ((seed ^ seed >>> 14) >>> 0) / 4294967296; };
}
export function withSeed(seed, build) {
  const previous = randomSource;
  randomSource = seededRandom(seed);
  try { return build(); } finally { randomSource = previous; }
}
export const rand = (a = 1, b) => (b === undefined ? randomSource() * a : a + randomSource() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[(randomSource() * arr.length) | 0];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* accepts '#abc', '#aabbcc' and 'rgb(r,g,b)' - the sky palette hands
   back interpolated rgb() strings, so both forms must work          */
export function parseColor(css) {
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

export function mixHex(a, b, t) {
  const A = parseColor(a), B = parseColor(b);
  return 'rgb(' + Math.round(lerp(A.r, B.r, t)) + ',' + Math.round(lerp(A.g, B.g, t)) + ',' + Math.round(lerp(A.b, B.b, t)) + ')';
}

/* ------------------------------------------------------------- wind --
   One shared uniform object every swaying material references, so the
   render loop updates the clock in exactly one place.                */
export const windUniforms = {
  uTime: { value: 0 },
  uWind: { value: 0.35 }
};
