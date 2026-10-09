// Entry point: start the first clip, then play — advance the frame, rebuild the figure,
// follow it with the camera, render.

import * as THREE from 'three';
import { XFADE } from './src/config.js';
import { scene, camera, renderer, controls, key, ground } from './src/scene.js';
import { loadClip, nextIndex, poseAt, gazeAt, fps, names, frames, last } from './src/clips.js';
import { randomize, stepOutfit } from './src/outfit.js';
import { initSkeleton, useClip, buildFigure, hipsAt, span } from './src/figure.js';

await loadClip(nextIndex());
initSkeleton(names);
useClip(frames);

document.getElementById('randomize').onclick = e => { randomize(); e.currentTarget.blur(); };

// ── playback ─────────────────────────────────────────────────────────────────
let frame = 0, t0 = performance.now();

// The hand-off into the next clip, as a decaying offset rather than a blend between two poses:
// the new clip plays from its first frame while the leftover difference from the old pose fades
// out on a smoothstep. Matching end velocities with a Hermite instead overshoots by a whole
// second of travel, which is what tore the limbs apart mid-swap.
const cur = Float64Array.from(frames[0]);   // the pose on screen right now
let xfade = null;

// Move on to the next clip — on space, or on its own once the current one runs out. The old clip
// keeps playing while the next downloads; every clip shares the joint layout, so only the frames
// and the clip's length actually change.
let switching = false;
async function next() {
  if (switching) return;   // the loop calls this every frame while the last frame is held
  switching = true;
  await loadClip(nextIndex());
  useClip(frames);
  frame = 0;
  t0 = performance.now();
  // The new clip starts playing at once. What carries over is the gap between where the figure
  // was standing and where the new clip opens, which then decays to nothing — so the hand-off
  // starts exactly on the old pose, never stalls, and never leaves the span of two real poses.
  xfade = { off: cur.map((c, k) => c - frames[0][k]), t: t0 };
  switching = false;
}

addEventListener('keydown', e => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  next();
});

// ── camera follow ────────────────────────────────────────────────────────────
const aim = new THREE.Vector3();
let lastFollow = performance.now();
function followFigure(pose) {
  const now = performance.now(), dt = Math.min((now - lastFollow) / 1000, 0.1);
  lastFollow = now;
  // Follow the dancer's travel, but lazily — a target pinned to the hips shakes the camera
  // with every step, and camera shake reads as the figure jittering.
  const [hx, hz] = hipsAt(pose);
  // Still smoothed, but the further behind it falls the harder it catches up.
  aim.set(hx, 1.0, hz);
  controls.target.lerp(aim, 1 - Math.exp(-dt * (3 + 6 * controls.target.distanceTo(aim))));

  // The shadow camera and the ground are small and fixed in size, so they travel with the target.
  key.position.set(controls.target.x, ground.position.y + 6, controls.target.z);
  key.target.position.set(controls.target.x, ground.position.y, controls.target.z);
  ground.position.x = controls.target.x;
  ground.position.z = controls.target.z;

  // Far enough back that the figure fills the view, then backed off to give the arms room to
  // swing. The camera's own height is ignored — it is always looking at the hips, and the
  // figure's height is not rigid.
  const dist = Math.max(1.5, 0.5 * span / Math.tan(camera.fov * Math.PI / 360)) * 2.6;
  const a = controls.getAzimuthalAngle();
  // ponytail: snapped straight onto the orbit ring each frame. OrbitControls' own damping and
  // auto-rotate already smooth the motion; add a lerp here only if the follow reads as too stiff.
  camera.position.set(
    controls.target.x + dist * Math.sin(a),
    controls.target.y + dist * 0.3,
    controls.target.z + dist * Math.cos(a));
  controls.update();
}

// ── loop ─────────────────────────────────────────────────────────────────────
let prev = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  stepOutfit((now - prev) / 1000);
  prev = now;
  // Held on the last frame rather than wrapped: the clip is over, and `next` takes it from
  // there. The hold only shows if the next clip is slow to download.
  frame = Math.min((now - t0) / 1000 * fps, last);

  const pose = poseAt(frame);
  if (xfade) {
    const u = (now - xfade.t) / (XFADE * 1000);
    if (u >= 1) xfade = null;
    else {
      const w = 1 - u * u * (3 - 2 * u);   // smoothstep, fading out
      for (let k = 0; k < xfade.off.length; k++) pose[k] += xfade.off[k] * w;
    }
  }
  if (frame >= last) next();

  buildFigure(pose, gazeAt(frame));
  cur.set(pose);
  followFigure(pose);
  renderer.render(scene, camera);
});
