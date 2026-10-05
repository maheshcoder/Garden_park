/* ===================================================================
   Day / night model - ported unchanged from the classic 2D garden's
   script.js (SKY_KEYS + sampleSky) so both experiences share exactly
   the same palette and transition timing.
   =================================================================== */
import { clamp, lerp, mixHex } from '../utils.js';

export const SKY_KEYS = [
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

export function sampleSky(hour) {
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
