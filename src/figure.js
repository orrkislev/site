// The figure: which joints make which body part, how thick each is, and how to rebuild the
// whole thing from one pose.

import * as THREE from 'three';
import {
  R_TORSO, R_ARMS, R_LEGS, ARM_T, EYE_OUT, EYE_R,
  WITH_EYE, WITH_SHIRT, WITH_SLEEVES, WITH_SHORTS, WITH_SOCKS,
  SEAT_R, SOCK_R, FLOOR_LIFT,
} from './config.js';
import { o } from './outfit.js';
import { addHair } from './hair.js';
import { scene, ground, W, H } from './scene.js';
import { bodyMat, shortsMat, shirtMat, eyeMat, sockMats } from './materials.js';
import { Part, ball, strokeTwin } from './part.js';

export const figure = new THREE.Group();
scene.add(figure);

const joint = (xyz, j) => new THREE.Vector3(xyz[j * 3], xyz[j * 3 + 1], xyz[j * 3 + 2]);

// ── skeleton ─────────────────────────────────────────────────────────────────
let I = {};          // joint name → index
let PARTS = {};      // part name → [joint chain, thickness as a fraction of the hips-to-crown span]
let ARM_ROOT = 0, LEG_ROOT = 0;
let parts = {};      // the Parts currently in the scene

// Every clip shares this layout, so it is worked out once from the first clip's joint names.
export function initSkeleton(names) {
  I = {};
  names.forEach((n, i) => { if (!(n in I)) I[n] = i; });
  const tip = n => I[n] + 1;   // an ENDSITE always follows the joint it caps

  // FingerBase sits exactly on top of Hand in this skeleton — a zero-length segment, which
  // collapses the end of the tube and leaves the hand flat. HandIndex1 is a real point past it.
  const arm = s => [I[s + 'Shoulder'], I[s + 'Arm'], I[s + 'ForeArm'], I[s + 'Hand'], I[s + 'HandIndex1']];
  const leg = s => [I[s + 'UpLeg'], I[s + 'Leg'], I[s + 'Foot']];   // no feet — the ankle ball is the foot

  PARTS = {
    torso: [[I.LowerBack, I.Spine, I.Neck, I.Head], R_TORSO],
    arms: [[...arm('Left').reverse(), ...arm('Right')], R_ARMS],
    legs: [[...leg('Left').reverse(), I.Hips, ...leg('Right')], R_LEGS],
  };
  ARM_ROOT = PARTS.arms[0].indexOf(I.LeftShoulder);   // the chain's midpoint, between the shoulders
  LEG_ROOT = PARTS.legs[0].indexOf(I.Hips);
  I.tipOfHead = tip('Head');
}

// ── per-clip measurements ────────────────────────────────────────────────────
// Every thickness is a fraction of `span`, measured once. Hips-to-crown is not a rigid distance —
// the spine bends — so measuring it per frame made the whole figure swell and shrink as it danced.
export let span = 1;

// The floor is the lowest joint the legs are drawn through (the ankle — the toe joints aren't
// used), minus the leg tube's full radius, since the joint is the centre of the tube and its
// underside is what rests on the ground. Frame 0 can't be trusted for it — the baked clips open
// on a pose that sits up to 0.15 off the real floor — so it is the 5th percentile of that lowest
// point over the whole clip, i.e. where the feet are when they are down. Set once per clip, not
// per frame: chasing the lowest joint every frame drags the floor up into the air with every leap.
export function useClip(frames) {
  const at0 = j => joint(frames[0], j);
  span = at0(I.Hips).distanceTo(at0(I.tipOfHead));
  const lows = frames.map(f => Math.min(...PARTS.legs[0].map(j => f[j * 3 + 1]))).sort((a, b) => a - b);
  ground.position.y = lows[Math.floor(0.05 * (lows.length - 1))] - R_LEGS * span / 2 + FLOOR_LIFT * span;
}

// ── exaggeration ─────────────────────────────────────────────────────────────
// The mouse stretches the limbs: horizontal is the arms, vertical the legs, dead centre leaves
// both at 1. Only bone lengths change — every bone keeps its direction and its radius, so it
// stays the same pose, just drawn on a differently proportioned body.
let armK = 1, legK = 1;
addEventListener('pointermove', e => {
  armK = 2 ** ((e.clientX / W() - 0.5) * 2);
  legK = 2 ** ((0.5 - e.clientY / H()) * 2);
});

// Walk out from `root` in one direction, rescaling each bone in place. The running offset carries
// the stretch onward, which is what keeps the joints past it in their original relative positions.
function stretch(pts, root, dir, k) {
  const off = new THREE.Vector3();
  let prev = pts[root].clone();
  for (let i = root + dir; i >= 0 && i < pts.length; i += dir) {
    const orig = pts[i].clone();
    off.add(orig.clone().sub(prev).multiplyScalar(k - 1));
    pts[i].add(off);
    prev = orig;
  }
}

// ── build ────────────────────────────────────────────────────────────────────
// ponytail: the whole figure is rebuilt every frame — the tubes follow a curve through the
// joints, so there is no skeleton to just re-pose. Cheap enough at this joint count; if it
// ever drags, keep the geometries and rewrite their position attributes in place.
export function buildFigure(xyz, gaze) {
  Object.values(parts).forEach(p => p.dispose());
  figure.clear();
  parts = {};

  const at = j => joint(xyz, j);
  const part = (name, pts) => parts[name] = new Part(pts, PARTS[name][1] * span / 2, bodyMat);

  part('torso', PARTS.torso[0].map(at));
  if (WITH_EYE) addEye(at(I.Head), gaze);

  const armPts = PARTS.arms[0].map(at);
  stretch(armPts, ARM_ROOT, -1, armK);        // out to the left hand
  stretch(armPts, ARM_ROOT + 1, 1, armK);     // and to the right — the shoulder span itself is left alone
  part('arms', armPts);
  parts.arms.slideTo(parts.torso, ARM_T);   // arms meet the body here, not at the skeleton's shoulders

  const legPts = PARTS.legs[0].map(at);
  const floor = Math.min(...legPts.map(p => p.y));
  stretch(legPts, LEG_ROOT, -1, legK);
  stretch(legPts, LEG_ROOT, 1, legK);
  // Longer legs hang the hips at the same height, which sinks the dancer through the floor. Put
  // the lowest joint back where it was instead — that works whichever leg is the one standing.
  figure.position.y = floor - Math.min(...legPts.map(p => p.y));
  part('legs', legPts);

  addClothes();
  addHair(at(I.Head), at(I.Neck), gaze, parts.torso.radius, figure);
  figure.add(...Object.values(parts));
}

// A single eye, sitting on the head ball where the gaze leaves it. The joints only give the
// head's axis, so without the baked direction this would stare straight ahead through every turn.
function addEye(head, gaze) {
  const r = parts.torso.radius * EYE_R;
  const eye = new THREE.Mesh(ball, eyeMat);
  eye.position.copy(head).addScaledVector(gaze, parts.torso.radius * EYE_OUT);
  eye.scale.setScalar(r);
  eye.castShadow = true;
  figure.add(strokeTwin(eye, r));
}

function addClothes() {
  if (WITH_SHORTS) {
    parts.shorts = parts.legs.trim(.5 - o.shortsLen, .5 + o.shortsLen, parts.legs.radius * o.shortsR, shortsMat);
    parts.torso.domeCap(0, shortsMat, SEAT_R);   // seat of the shorts over the torso's own cap
  }
  // Socks, both ends of the leg chain at once: t runs left foot → hips → right foot, so the
  // left sock is [0, SOCK_LEN] and the right is its mirror.
  if (WITH_SOCKS && o.sockLen > 0.003) {
    const r = parts.legs.radius * SOCK_R, stripes = sockMats.slice(0, o.sockSteps);
    stripes.forEach((mat, k) => {
      const a = o.sockLen * k / stripes.length, b = o.sockLen * (k + 1) / stripes.length;
      parts['sockL' + k] = parts.legs.trim(a, b, r, mat, false, 4);
      parts['sockR' + k] = parts.legs.trim(1 - a, 1 - b, r, mat, false, 4);
    });
    parts.legs.domeCap(0, sockMats[0], SOCK_R);   // rounded toe over the ankle ball
    parts.legs.domeCap(1, sockMats[0], SOCK_R);
  }
  if (WITH_SHIRT)
    parts.shirt = parts.torso.trim(o.hem, o.neck, parts.torso.radius * o.shirtR, shirtMat);
  if (WITH_SLEEVES) {
    parts.sleeveL = parts.arms.trim(.5 - o.sleeveLen, .5, parts.arms.radius * o.sleeveR, shirtMat);
    parts.sleeveR = parts.arms.trim(.5, .5 + o.sleeveLen, parts.arms.radius * o.sleeveR, shirtMat);
  }
}

export const hipsAt = xyz => [xyz[I.Hips * 3], xyz[I.Hips * 3 + 2]];
