// Randomized hair: a puff of balls of various sizes over the head, drawn with the same flat
// material (and outline) as the rest of the figure.

import * as THREE from 'three';
import { ball, cone, strokeTwin } from './part.js';
import { hairMat } from './materials.js';
import { o } from './outfit.js';

const rand = (a, b) => a + Math.random() * (b - a);

// Each root is a direction in the head's own frame (x right, y up, z forward) — over the scalp and
// back of the head, never the face — with its own ball size and how far out it sits.
export const hair = { roots: [], cover: '', cone: false };

// Where hair may grow. Cycled, so every cut comes up in turn.
const COVER = {
  'half bald': d => Math.abs(d.x) > 0.6 && d.y > 0 && d.z < 0.5,                              // sides only
  'less bald': d => d.y > 0.05 && d.z < 0.5 && (Math.abs(d.x) > 0.6 || d.z < -0.3),          // sides and back
  'full': d => d.y > 0.1 && !(d.z > 0.5 && d.y < 0.7),
};
const CUTS = Object.keys(COVER);
let cut = -1;

// Pick a new puff; returns the value `o.hairLen` should grow to.
export function rerollHair() {
  hair.cover = CUTS[cut = (cut + 1) % CUTS.length];
  hair.cone = Math.random() < 0.5;
  const count = Math.floor(rand(100, 220)), max = rand(0.3, 0.6);   // max ball size, x head radius
  hair.roots = [];
  while (hair.roots.length < count) {
    const d = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    if (d.lengthSq() > 1 || d.lengthSq() < 0.01) continue;
    d.normalize();
    if (!COVER[hair.cover](d)) continue;
    hair.roots.push({ d, size: rand(0.15, max), out: rand(0.6, 1.0) });
  }
  return Math.random() < 0.2 ? 1 : 0;   // rare: most of the time, no hair
}

const Y = new THREE.Vector3(0, 1, 0);
const up = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();

export function addHair(head, neck, gaze, R, figure) {
  if (o.hairLen < 0.005) return;
  up.copy(head).sub(neck).normalize();
  fwd.copy(gaze).addScaledVector(up, -gaze.dot(up)).normalize();
  right.crossVectors(up, fwd);
  hair.roots.forEach(({ d, size, out }) => {
    const r = R * size * o.hairLen;
    const m = new THREE.Mesh(hair.cone ? cone : ball, hairMat);
    const w = new THREE.Vector3().addScaledVector(right, d.x).addScaledVector(up, d.y).addScaledVector(fwd, d.z);
    m.position.copy(head).addScaledVector(w, R * out);
    if (hair.cone) {   // apex pointing away from the head
      m.quaternion.setFromUnitVectors(Y, w);
      m.scale.set(r, r * 1.6, r);
    } else m.scale.setScalar(r);
    m.castShadow = true;
    figure.add(strokeTwin(m, r));
  });
}
