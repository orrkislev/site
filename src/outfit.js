// The outfit's live dimensions and colours. `randomize` picks a new target; `stepOutfit` eases
// the live values toward it every frame, so a new outfit grows into place instead of jumping.

import * as THREE from 'three';
import { SHORTS_SPAN, SHORTS_R, SHIRT_SPAN, SHIRT_R, SLEEVE_R, WITH_SOCKS, SOCK_LEN } from './config.js';
import { bodyMat, shirtMat, shortsMat, sockMats, hairMat } from './materials.js';
import { rerollHair } from './hair.js';

// Colour sets that look good together: skin, shirt, shorts, then sock stripes.
const PRESETS = [
  { skin: '#f6b293', shirt: '#4a6fd8', shorts: '#ff6b4a', socks: ['#ffffff', '#ff6b4a', '#4a6fd8'], hair: '#3a2418' },
  { skin: '#f4d68d', shirt: '#2f9e8f', shorts: '#f2f0e6', socks: ['#2f9e8f', '#f2f0e6', '#ffb703'], hair: '#1a1a1a' },
  { skin: '#f0a8be', shirt: '#7b4fc9', shorts: '#ffd166', socks: ['#ffd166', '#7b4fc9', '#ffffff'], hair: '#e9b44c' },
  { skin: '#9cd2d0', shirt: '#e63946', shorts: '#1d3557', socks: ['#ffffff', '#e63946', '#1d3557'], hair: '#8a2b1f' },
  { skin: '#c4ace0', shirt: '#ffb703', shorts: '#2b2d42', socks: ['#2b2d42', '#ffb703', '#ffffff'], hair: '#f2f0e6' },
  { skin: '#e1c5a0', shirt: '#6a994e', shorts: '#f2cc8f', socks: ['#f2cc8f', '#6a994e', '#bc4749'], hair: '#5c3d2e' },
];

// live values (what's on screen) and their targets
export const o = {
  shortsLen: (SHORTS_SPAN[1] - SHORTS_SPAN[0]) / 2, shortsR: SHORTS_R,
  hem: SHIRT_SPAN[0], neck: SHIRT_SPAN[1], shirtR: SHIRT_R,
  sleeveLen: 0.19, sleeveR: SLEEVE_R,
  sockLen: WITH_SOCKS ? SOCK_LEN : 0, sockSteps: 2, hairLen: rerollHair(),
};
const target = { ...o };
const colors = [bodyMat, shirtMat, shortsMat, ...sockMats, hairMat].map(m => ({ m, c: m.color.clone() }));

const between = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export function randomize() {
  const p = pick(PRESETS);
  [p.skin, p.shirt, p.shorts, ...p.socks, p.hair].forEach((c, i) => colors[i].c.set(c));
  o.hairLen = 0;   // new hair grows in from nothing
  Object.assign(target, {
    hairLen: rerollHair(),
    shortsLen: between(0.08, 0.49), shortsR: between(1.3, 2.2),
    hem: between(0.02, 0.2), neck: between(0.4, 0.92), shirtR: between(1.04, 1.2),
    sleeveLen: between(0.05, 0.49), sleeveR: between(1.2, 1.8),
    sockLen: Math.random() < 0.5 ? between(0.03, 0.12) : 0,
    sockSteps: 1 + Math.floor(Math.random() * 3),
  });
}

export function stepOutfit(dt) {
  const k = 1 - Math.exp(-dt * 3);
  for (const key in o) o[key] += (target[key] - o[key]) * k;
  o.sockSteps = target.sockSteps;   // a stripe count can't be in between
  colors.forEach(({ m, c }) => m.color.lerp(c, k));
}
