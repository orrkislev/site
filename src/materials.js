// One material per surface. In STROKES mode they all go background-white and the outline
// comes from `strokeMat` instead.

import * as THREE from 'three';
import {
  BG, STROKES, STROKE_COLOR, SHORTS_COLOR, SHIRT_COLOR, EYE_COLOR,
  SOCK_COLORS, PALETTE, SKIN_INDEX,
} from './config.js';

export const bodyMat = new THREE.MeshBasicMaterial();
export const shortsMat = new THREE.MeshBasicMaterial({ color: SHORTS_COLOR, side: THREE.DoubleSide });
export const shirtMat = new THREE.MeshBasicMaterial({ color: SHIRT_COLOR, side: THREE.DoubleSide });
export const hairMat = new THREE.MeshBasicMaterial({ color: '#2b2622', side: THREE.DoubleSide });
export const eyeMat = new THREE.MeshBasicMaterial({ color: EYE_COLOR });
export const sockMats = [0, 1, 2].map(i => SOCK_COLORS[i % SOCK_COLORS.length]).map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
export const strokeMat = new THREE.MeshBasicMaterial({ color: STROKE_COLOR, side: THREE.BackSide });

// Fills stay opaque so parts still hide each other — a true wireframe of forty tubes is mush.
if (STROKES) [bodyMat, shortsMat, shirtMat, eyeMat, hairMat, ...sockMats].forEach(m => m.color.set(BG));
else bodyMat.color.setStyle(`rgb(${PALETTE[SKIN_INDEX].join(',')})`);

