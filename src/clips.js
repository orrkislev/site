// Loading baked clips and reading a pose out of one.
//
// Every baked clip — dance, gymnastics, acrobatics, martial arts — is one file, listed in
// anim/index.json by `bake-anim.mjs`. Fetched on demand rather than all at once: forty clips is
// several megabytes and you only ever watch one.

import * as THREE from 'three';

export const CLIPS = await fetch('anim/index.json').then(r => r.json());

// The clip currently playing. Live bindings — importers see each new clip as it lands.
export let id, type, fps, names, frames, gaze, last;

let index = -1;
let blend = null;   // scratch buffer for poseAt

export async function loadClip(i) {
  const c = await fetch(`anim/${CLIPS[i].id}.json`).then(r => r.json());
  index = i;
  ({ id, type, fps, frames, gaze } = c);
  names ??= c.names;             // one skeleton for every clip, taken from the first
  last = frames.length - 1;
  blend ??= new Array(frames[0].length);
  return c;
}

// Playing order: shuffle each kind, shuffle the kinds, then deal them out round-robin so
// consecutive clips are different kinds (dance, gymnastics, ...) for as long as there are any.
const shuffle = a => { for (let i = a.length; i > 1;) { const j = Math.floor(Math.random() * i--); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const groups = {};
CLIPS.forEach((c, i) => (groups[c.type] ??= []).push(i));
const lists = shuffle(Object.values(groups).map(shuffle));
const order = [];
while (lists.some(l => l.length)) lists.forEach(l => l.length && order.push(l.pop()));
let pos = -1;
export const nextIndex = () => order[pos = (pos + 1) % order.length];

// The pose between two baked frames. Rebuilding on the nearest baked frame instead makes the
// figure step at the clip's frame rate no matter how fast the screen refreshes, which is most
// of what reads as jitter.
export function poseAt(f) {
  const i = Math.floor(f), a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)], u = f - i;
  for (let k = 0; k < a.length; k++) blend[k] = a[k] + (b[k] - a[k]) * u;
  return blend;
}

// The face direction between the same two frames. Lerping a pair of unit vectors shortens the
// result, so it is renormalised on the way out.
const look = new THREE.Vector3();
export function gazeAt(f) {
  const i = Math.floor(f), a = gaze[i], b = gaze[Math.min(i + 1, gaze.length - 1)], u = f - i;
  return look.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u).normalize();
}
