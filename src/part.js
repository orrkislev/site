// A body part: a smooth tube through a chain of joints, optionally rounded off with spheres.
// Everything the figure is made of — limbs, torso, shorts, socks — is one of these.

import * as THREE from 'three';
import { TUBE_SEG, TUBE_SIDES, STROKES, STROKE_W } from './config.js';
import { strokeMat } from './materials.js';

export const ball = new THREE.SphereGeometry(1, 24, 18);                            // shared by every cap
export const cone = new THREE.ConeGeometry(1, 2, 12);                             // apex up, base radius 1
export const dome = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);  // top half

// The back-facing twin that shows only where the fill doesn't cover it. `r` is the radius the
// mesh is actually drawn at, so the twin sticks out by STROKE_W however big the mesh is.
export function strokeTwin(mesh, r) {
  if (STROKES) {
    const o = new THREE.Mesh(mesh.geometry, strokeMat);
    o.scale.setScalar((r + STROKE_W) / r);
    mesh.add(o);
  }
  return mesh;
}

export class Part extends THREE.Group {
  constructor(points, radius, material, caps = true, detail = [TUBE_SEG, TUBE_SIDES]) {
    super();
    this.detail = detail;   // [segments along, sides around]
    this.points = points;
    this.radius = radius;
    this.material = material;
    this.curve = new THREE.CatmullRomCurve3(points);

    this.tube = new THREE.Mesh(this.geo(radius), material);
    this.tube.castShadow = true;
    this.add(this.tube);

    // The tube's vertices are absolute, so its outline can't just be a scaled copy — it's a
    // second tube down the same curve at a bigger radius. An open-ended tube (all the clothing)
    // has no cap to draw its hem either, so there the outline also runs a little past both ends
    // and shows as a ring.
    if (STROKES) {
      const t0 = this.curve.getTangent(0), t1 = this.curve.getTangent(1);
      this.strokePts = caps ? points.map(p => p.clone()) : [
        points[0].clone().addScaledVector(t0, -STROKE_W),
        ...points.map(p => p.clone()),
        points[points.length - 1].clone().addScaledVector(t1, STROKE_W)];
      this.add(this.stroke = new THREE.Mesh(this.strokeGeo(), strokeMat));
    }

    this.caps = [null, null];
    this.domes = [null, null];
    if (caps) { this.cap(0); this.cap(1); }
  }

  geo(r) { return new THREE.TubeGeometry(this.curve, this.detail[0], r, this.detail[1], false); }

  strokeGeo() {
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(this.strokePts),
      this.detail[0], this.radius + STROKE_W, this.detail[1], false);
  }

  end(i) { return i ? this.points[this.points.length - 1] : this.points[0]; }

  // end: 0 = start of the chain, 1 = finish. material null removes the cap.
  cap(end, material = this.material) {
    if (this.caps[end]) { this.remove(this.caps[end]); this.caps[end] = null; }
    if (!material) return null;
    const m = new THREE.Mesh(ball, material);
    m.position.copy(this.end(end));
    m.scale.setScalar(this.radius);
    m.castShadow = true;
    this.add(strokeTwin(m, this.radius));
    return this.caps[end] = m;
  }

  // a half sphere pulled over one end, facing outward — clothing on top of a cap
  domeCap(end, material = this.material, scale = 1.05) {
    if (this.domes[end]) { this.remove(this.domes[end]); this.domes[end] = null; }
    if (!material) return null;
    const m = new THREE.Mesh(dome, material);
    m.position.copy(this.end(end));
    m.scale.setScalar(this.radius * scale);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      this.curve.getTangent(end ? 1 : 0).multiplyScalar(end ? 1 : -1));
    m.castShadow = true;
    this.add(strokeTwin(m, this.radius * scale));
    return this.domes[end] = m;
  }

  // a fatter/thinner copy of a stretch of this path — clothing rides on it
  trim(t0, t1, radius = this.radius, material = this.material, caps = false, steps = 16) {
    const pts = Array.from({ length: steps + 1 },
      (_, k) => this.curve.getPoint(t0 + (t1 - t0) * k / steps));
    return new Part(pts, radius, material, caps);
  }

  // Move the whole part so its mid point lands at parameter `t` on another part's curve.
  // Solved outright rather than by searching the other curve for the nearest sample — a
  // sampled answer snaps between samples, and across an animation that snap is visible.
  slideTo(other, t) {
    return this.translate(other.curve.getPoint(t).sub(this.curve.getPoint(0.5)));
  }

  translate(off) {
    this.points.forEach(p => p.add(off));
    this.curve = new THREE.CatmullRomCurve3(this.points);
    this.tube.geometry.dispose();
    this.tube.geometry = this.geo(this.radius);
    if (this.stroke) {
      this.strokePts.forEach(p => p.add(off));   // its own copies, extended past the ends
      this.stroke.geometry.dispose();
      this.stroke.geometry = this.strokeGeo();
    }
    for (const m of [...this.caps, ...this.domes]) if (m) m.position.add(off);
    return this;
  }

  dispose() { this.tube.geometry.dispose(); this.stroke?.geometry.dispose(); }
}
