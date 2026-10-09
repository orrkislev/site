// Downloads CMU mocap dance clips (BVH) and bakes a library of distinct poses into poses.json.
// Run by hand: node bake.mjs
import * as THREE from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import fs from 'node:fs';
import assert from 'node:assert';

const REPO = 'https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master';
const KEEP = /^(\d+)_(\d+)\t(.*(?:dance|salsa|ballet|capoeira|martial).*)$/i;
const CANDIDATES = 120;   // frames sampled per clip
const PER_CLIP = 10;      // distinct poses kept per clip
const HEIGHT = 1.8;       // metres, standing

fs.mkdirSync('bvh', { recursive: true });

const index = await (await fetch(`${REPO}/cmu-mocap-index-text.txt`)).text();
const clips = index.split('\n').map(l => l.match(KEEP)).filter(Boolean)
  .map(([, subj, trial, label]) => ({ subj, trial, label: label.trim(), id: `${subj}_${trial}` }));
console.log(`${clips.length} dance clips in index`);

for (const c of clips) {
  c.file = `bvh/${c.id}.bvh`;
  if (fs.existsSync(c.file)) continue;
  const url = `${REPO}/data/${c.subj.padStart(3, '0')}/${c.id}.bvh`;
  const res = await fetch(url);
  if (!res.ok) { console.warn(`  miss ${c.id} (${res.status})`); c.file = null; continue; }
  fs.writeFileSync(c.file, Buffer.from(await res.arrayBuffer()));
  process.stdout.write(`\rdownloaded ${c.id}   `);
}
console.log();

const loader = new BVHLoader();
let names = null, edges = null;
const poses = [];

for (const c of clips.filter(c => c.file)) {
  const { skeleton, clip } = loader.parse(fs.readFileSync(c.file, 'utf8'));
  const bones = skeleton.bones;

  // Same wiring as the three.js BVH example: the clip's tracks address `.bones[Name]`,
  // which only resolves against a SkeletonHelper carrying the skeleton.
  const root = new THREE.Group();
  root.add(bones[0]);
  const helper = new THREE.SkeletonHelper(bones[0]);
  helper.skeleton = skeleton;
  const mixer = new THREE.AnimationMixer(helper);
  mixer.clipAction(clip).play();

  if (!names) {
    names = bones.map(b => b.name);
    edges = bones.flatMap((b, i) => {
      const p = bones.indexOf(b.parent);
      return p === -1 ? [] : [[p, i]];
    });
  }
  if (bones.length !== names.length) { console.warn(`  skip ${c.id}: ${bones.length} bones`); continue; }

  // sample raw world positions
  const v = new THREE.Vector3();
  const frames = [];
  for (let s = 0; s < CANDIDATES; s++) {
    mixer.setTime((s / CANDIDATES) * clip.duration);
    root.updateMatrixWorld(true);
    frames.push(bones.flatMap(b => b.getWorldPosition(v).toArray()));
  }

  // One scale per clip, from the tallest frame — normalising each pose to the same height
  // would flatten a crouch into a stand.
  const heightOf = f => { let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < f.length; i += 3) { lo = Math.min(lo, f[i]); hi = Math.max(hi, f[i]); }
    return hi - lo; };
  const scale = HEIGHT / Math.max(...frames.map(heightOf));

  const norm = frames.map(f => {
    const out = f.map(n => n * scale);
    const [rootX, , rootZ] = out;
    let lo = Infinity;
    for (let i = 1; i < out.length; i += 3) lo = Math.min(lo, out[i]);
    for (let i = 0; i < out.length; i += 3) {
      out[i] -= rootX;      // centre x on the root
      out[i + 1] -= lo;     // feet on the ground
      out[i + 2] -= rootZ;  // centre z on the root
    }
    return out;
  });

  const live = norm.filter(f => !isRest(f, names));
  for (const i of farthestPoints(live, PER_CLIP)) {
    poses.push({ label: c.label, xyz: live[i].map(n => +n.toFixed(3)) });
  }
}

// Clips open and close on a neutral calibration stance — legs dead straight, feet planted,
// torso upright. Farthest-point selection loves those (a T-pose is maximally unlike a dance),
// so they have to go before selection, not after.
function isRest(f, names) {
  const J = {}; names.forEach((n, i) => { if (!(n in J)) J[n] = i; });
  const g = j => [f[j * 3], f[j * 3 + 1], f[j * 3 + 2]];
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const len = a => Math.hypot(...a);
  const angle = (a, b, c) => {
    const u = sub(a, b), v = sub(c, b);
    return Math.acos(u.reduce((s, x, i) => s + x * v[i], 0) / (len(u) * len(v))) * 180 / Math.PI;
  };
  const knee = s => angle(g(J[s + 'UpLeg']), g(J[s + 'Leg']), g(J[s + 'Foot']));
  const axis = sub(g(J.Head + 1), g(J.Hips));
  return knee('Left') > 170 && knee('Right') > 170
    && Math.max(g(J.LeftFoot)[1], g(J.RightFoot)[1]) < 0.12
    && Math.acos(axis[1] / len(axis)) * 180 / Math.PI < 20;
}

// Greedy farthest-point selection: adjacent frames of a dance are near-identical, so pick the
// n frames that are maximally unlike each other rather than n random times.
function farthestPoints(frames, n) {
  const dist = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i += 3) sum += Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]);
    return sum / (a.length / 3);
  };
  const mean = frames[0].map((_, i) => frames.reduce((s, f) => s + f[i], 0) / frames.length);
  const picked = [frames.reduce((best, f, i) => dist(f, mean) > dist(frames[best], mean) ? i : best, 0)];
  const minDist = frames.map(f => dist(f, frames[picked[0]]));
  while (picked.length < Math.min(n, frames.length)) {
    let next = 0;
    for (let i = 1; i < frames.length; i++) if (minDist[i] > minDist[next]) next = i;
    picked.push(next);
    for (let i = 0; i < frames.length; i++) minDist[i] = Math.min(minDist[i], dist(frames[i], frames[next]));
  }
  return picked;
}

for (const p of poses) {
  assert.equal(p.xyz.length, names.length * 3, 'pose has wrong joint count');
  const ys = p.xyz.filter((_, i) => i % 3 === 1);
  assert.ok(Math.min(...ys) > -0.01 && Math.max(...ys) < HEIGHT + 0.01, `pose out of bounds: ${p.label}`);
}

fs.writeFileSync('poses.json', JSON.stringify({ names, edges, poses }));
console.log(`${poses.length} poses, ${names.length} joints, ${(fs.statSync('poses.json').size / 1e6).toFixed(2)} MB`);
