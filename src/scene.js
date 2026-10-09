// Renderer, camera, lights, ground — everything that exists before the figure does.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BG, SHADOW_OPACITY } from './config.js';

export const W = () => innerWidth, H = () => innerHeight;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

export const camera = new THREE.PerspectiveCamera(45, W() / H(), 0.1, 100);
camera.position.set(2.6, 1.9, 3.4);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(W(), H());
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;  // hard-edged shadow
document.body.appendChild(renderer.domElement);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.5;

scene.add(new THREE.HemisphereLight(BG, BG, 2.0));

export const key = new THREE.DirectionalLight(BG, 2.2);
key.position.set(0, 2, 0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.1, far: 20 });
scene.add(key, key.target);

// Catches the shadow and nothing else — the background colour already does the floor.
export const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.ShadowMaterial({ opacity: SHADOW_OPACITY })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Hero layout: the view is shifted so the figure sits in the right part of the screen.
function fit() {
  camera.aspect = W() / H();
  camera.setViewOffset(W(), H(), (W() > 760 ? -0.22 : 0) * W(), 0, W(), H());
  renderer.setSize(W(), H());
}
fit();
addEventListener('resize', fit);
