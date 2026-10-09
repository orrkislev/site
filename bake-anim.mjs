// Bakes CMU BVH clips (dance, gymnastics, acrobatics, martial arts) into anim/<id>.json —
// world joint positions per frame, plus the move's type. Run by hand: node bake-anim.mjs [clip-id ...]
import * as THREE from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import fs from 'node:fs';
import assert from 'node:assert';

const REPO = 'https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master';
// id -> what the move is. Subject 05 is a single dancer, so the dance clips share one skeleton;
// the rest each bring their own, which the per-clip height scaling below flattens out.
const CLIPS = {
  '05_06': 'dance', '05_02': 'dance', '05_03': 'dance', '05_04': 'dance', '05_05': 'dance',
  '05_08': 'dance', '05_09': 'dance', '05_10': 'dance', '05_11': 'dance', '05_12': 'dance',
  '05_15': 'dance',
  // subject 49 (modern dance + gymnastics), 90 (cartwheels), 87 (acrobatics)
  '49_04': 'gymnastics', '49_06': 'gymnastics', '49_07': 'gymnastics', '49_08': 'gymnastics',
  '49_18': 'gymnastics', '87_05': 'gymnastics',
  '90_02': 'gymnastics', '90_08': 'gymnastics', '90_09': 'gymnastics', '90_11': 'gymnastics',
  // skipped 90_14 and 90_15: both front hand flips, both captured floating ~0.3 m off the floor
  // subjects 87-89 (acrobatics), 85 (flips and breakdance)
  '87_01': 'acrobatics', '87_03': 'acrobatics',
  '88_02': 'acrobatics', '88_04': 'acrobatics', '88_05': 'acrobatics', '88_06': 'acrobatics',
  '89_03': 'acrobatics', '89_05': 'acrobatics',
  '85_04': 'acrobatics', '85_12': 'acrobatics', '85_14': 'acrobatics',
  // subject 135 (karate kata), 144 (kicks, punches, blocks), 12 (tai chi)
  '135_01': 'martial arts', '135_02': 'martial arts', '135_04': 'martial arts',
  '135_07': 'martial arts', '135_11': 'martial arts',
  '144_05': 'martial arts', '144_20': 'martial arts', '144_26': 'martial arts',
  '12_04': 'martial arts',
};
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS);
const FPS = 60;
const OUT_FPS = 30;   // the sketch interpolates between frames anyway
const HEIGHT = 1.8;   // metres, standing

fs.mkdirSync('anim', { recursive: true });

for (const ID of IDS) {
  const file = `bvh/${ID}.bvh`;
  if (!fs.existsSync(file)) {
    const url = `${REPO}/data/${ID.split('_')[0].padStart(3, '0')}/${ID}.bvh`;
    const res = await fetch(url);
    assert.ok(res.ok, `download failed: ${url} (${res.status})`);
    fs.mkdirSync('bvh', { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }

  const { skeleton, clip } = new BVHLoader().parse(fs.readFileSync(file, 'utf8'));
  const bones = skeleton.bones;
  const names = bones.map(b => b.name);
  const I = {}; names.forEach((n, i) => { if (!(n in I)) I[n] = i; });

  // Same wiring as the three.js BVH example: the clip's tracks address `.bones[Name]`,
  // which only resolves against a SkeletonHelper carrying the skeleton.
  const root = new THREE.Group();
  root.add(bones[0]);
  const helper = new THREE.SkeletonHelper(bones[0]);
  helper.skeleton = skeleton;
  const mixer = new THREE.AnimationMixer(helper);
  mixer.clipAction(clip).play();

  const v = new THREE.Vector3(), q = new THREE.Quaternion();
  const n = Math.round(clip.duration * FPS);
  let frames = [], gaze = [];
  for (let i = 0; i < n; i++) {
    mixer.setTime(i / FPS);
    root.updateMatrixWorld(true);
    frames.push(bones.flatMap(b => b.getWorldPosition(v).toArray()));
    // Where the face points. The joint positions give the head's axis but not the twist around
    // it, so a stare over the shoulder reads as facing front. The skull's local +Z is forward —
    // checked against chest facing across a clip: median 11 deg off, p90 36 deg, a neck's range.
    gaze.push(v.set(0, 0, 1).applyQuaternion(bones[I.Head].getWorldQuaternion(q)).toArray());
  }

  // A [1,2,1] pass over time. Mocap carries a little marker noise, and a tube drawn through
  // noisy joints wobbles far more visibly than a stick figure does.
  const smooth = A => A.map((f, i) => {
    const a = A[Math.max(0, i - 1)], b = A[Math.min(A.length - 1, i + 1)];
    return f.map((c, k) => (a[k] + 2 * c + b[k]) / 4);
  });
  frames = smooth(frames);
  gaze = smooth(gaze);

  // Scale from the skeleton's own standing height — sole to crown along the bones. Bone lengths
  // are rigid, so this is one number for the clip; a bounding box would shrink the figure every
  // time it leapt or threw its arms up.
  const at = (f, j) => new THREE.Vector3(f[j*3], f[j*3+1], f[j*3+2]);
  const chain = (...js) => js.slice(1).reduce((s, j, k) => s + at(frames[0], js[k]).distanceTo(at(frames[0], j)), 0);
  const standing =
    chain(I.LeftUpLeg, I.LeftLeg, I.LeftFoot, I.LeftToeBase, I.LeftToeBase + 1) +
    chain(I.Hips, I.LowerBack, I.Spine, I.Spine1, I.Neck, I.Neck1, I.Head, I.Head + 1);
  const scale = HEIGHT / standing;

  // CMU's capture volume is already calibrated with the floor at y=0, so y needs no rebasing —
  // re-grounding on the clip's own lowest frame just lifts the whole dance off the floor by
  // however far one landing punched through it. Only x/z are recentred, on the opening frame.
  const [x0, , z0] = frames[0].map(c => c * scale);

  // Only the joints the sketch actually draws. Feet, fingers, thumbs, hip joints, Spine1 and
  // Neck1 are all baked and never read — better half the file than half a millimetre.
  const KEEP = [I.Hips,
    I.LeftUpLeg, I.LeftLeg, I.LeftFoot, I.RightUpLeg, I.RightLeg, I.RightFoot,
    I.LowerBack, I.Spine, I.Neck, I.Head, I.Head + 1,   // ENDSITE caps the head; `tip()` wants it next door
    I.LeftShoulder, I.LeftArm, I.LeftForeArm, I.LeftHand, I.LeftHandIndex1,
    I.RightShoulder, I.RightArm, I.RightForeArm, I.RightHand, I.RightHandIndex1];
  const keptNames = KEEP.map(j => names[j]);

  const step = FPS / OUT_FPS;
  const out = frames.filter((_, i) => i % step === 0).map(f => {
    const p = KEEP.flatMap(j => [f[j*3] * scale - x0, f[j*3+1] * scale, f[j*3+2] * scale - z0]);
    return p.map(c => +c.toFixed(3));   // millimetres; the figure is ~1.8 m tall
  });

  // Smoothing pulls the direction off the unit sphere, so renormalise on the way out.
  const look = gaze.filter((_, i) => i % step === 0).map(g => {
    const l = Math.hypot(...g);
    return g.map(c => +(c / l).toFixed(3));
  });

  const lows = out.map(f => { let lo = Infinity;
    for (let i = 1; i < f.length; i += 3) lo = Math.min(lo, f[i]); return lo; }).sort((a, b) => a - b);
  // The tenth-percentile frame, not the median: a handspring or a backflip spends most of its
  // frames off the ground, and only a clip that never comes near the floor is really miscalibrated.
  const p10 = lows[Math.floor(lows.length * 0.1)];
  for (const f of out) assert.equal(f.length, KEEP.length * 3, 'frame has wrong joint count');
  for (const g of look) assert.ok(Math.abs(Math.hypot(...g) - 1) < 0.01, `: gaze is not a unit vector`);
  assert.ok(Math.abs(p10) < 0.15, `${ID}: figure does not stand on the floor (p10 low ${p10})`);

  const dest = `anim/${ID}.json`;
  fs.writeFileSync(dest, JSON.stringify({ id: ID, type: CLIPS[ID] ?? 'dance', fps: OUT_FPS, names: keptNames, frames: out, gaze: look }));
  console.log(`${ID}: ${out.length} frames @ ${OUT_FPS}fps, ${(fs.statSync(dest).size / 1e3).toFixed(0)} kB` +
    `  ·  height x${scale.toFixed(3)}, low ${p10.toFixed(3)}`);
}

// The sketch reads this to know what it can play, and what each clip is.
const index = Object.entries(CLIPS).filter(([id]) => fs.existsSync(`anim/${id}.json`))
  .map(([id, type]) => ({ id, type }));
fs.writeFileSync('anim/index.json', JSON.stringify(index));
console.log(`anim/index.json: ${index.length} clips`);
