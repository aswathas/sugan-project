// A small toolkit of crafted parts.
//
// Every part here is meant to be a real thing you could build: a slab with
// a chamfer that catches the light, a screw with a slot in its head, a knob
// with knurling cut into it, a spring that is actually a spring. The point is
// that no part is a bare box.
//
// The four tones follow the anatomy kit: the base is lo, the structure is
// mid, the subject is hi, and exactly one part in the whole scene is lit.

import * as THREE from '/vendor/three.module.min.js';

/* ---------------- the tones ---------------- */

// lo   the base, it recedes
// mid  the structure
// hi   the subject, the thing the eye follows
// lit  the one accent
export function toneSet(palette) {
  const make = (color, roughness, metalness) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    lo: make(palette.lo, 0.95, 0.0),
    mid: make(palette.mid, 0.6, 0.25),
    hi: make(palette.hi, 0.45, 0.35),
    lit: make(palette.lit, 0.35, 0.3),
    paper: make(palette.paper, 0.95, 0.0),
    brass: make(palette.brass, 0.32, 0.85),
  };
}

/* ---------------- the shapes ---------------- */

// A rounded rectangle as a 2D shape, for the parts that are extruded.
export function roundedRect(w, d, r) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  const radius = Math.min(r, w / 2, d / 2);
  shape.moveTo(x + radius, y);
  shape.lineTo(x + w - radius, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + radius);
  shape.lineTo(x + w, y + d - radius);
  shape.quadraticCurveTo(x + w, y + d, x + w - radius, y + d);
  shape.lineTo(x + radius, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

// A slab with a chamfer on its top edge, so the light finds the edge.
export function slabGeometry(w, d, h, bevel = 0.8, corner = 1.2) {
  const shape = roundedRect(w, d, corner);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(h - bevel * 2, 0.05),
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, h - bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

// A ring of tiny teeth cut into a knob.
export function knurlGeometry(radius, height, teeth = 28) {
  const parts = [];
  const tooth = new THREE.BoxGeometry(0.55, height * 0.82, 0.9);
  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2;
    const g = tooth.clone();
    g.translate(radius * 0.99, 0, 0);
    g.rotateY(angle);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

// Merge a list of geometries into one, so a knurled knob is one draw call.
export function mergeGeometries(geometries) {
  const merged = [];
  let count = 0;
  for (const geo of geometries) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    merged.push(g);
    count += g.attributes.position.count;
  }
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  let offset = 0;
  for (const geo of merged) {
    positions.set(geo.attributes.position.array, offset * 3);
    normals.set(geo.attributes.normal.array, offset * 3);
    if (geo.attributes.uv) uvs.set(geo.attributes.uv.array, offset * 2);
    offset += geo.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return out;
}

/* ---------------- the parts ---------------- */

// A bench plate with a chamfer, a groove and screws at the corners.
export function benchPlate(group, w, d, h, tones, cornerInset = 6) {
  const plate = new THREE.Mesh(slabGeometry(w, d, h, 1.2, 3), tones.lo);
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  // the groove: a sunken line round the inside of the plate
  const groove = new THREE.Mesh(
    new THREE.BoxGeometry(w - cornerInset * 2, 0.25, d - cornerInset * 2),
    tones.mid
  );
  groove.position.y = h - 0.02;
  group.add(groove);

  // the feet
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 3, 16), tones.lo);
    foot.position.set((x * (w / 2 - 8)), -h / 2 - 1.2, (z * (d / 2 - 8)));
    foot.castShadow = true;
    group.add(foot);
  }
  return plate;
}

// A screw head: a small cylinder with a slot cut across it.
export function screw(group, x, y, z, tones, radius = 1.1) {
  const head = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.1, 0.7, 12), tones.mid);
  head.position.set(x, y, z);
  head.castShadow = true;
  group.add(head);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.9, 0.18, radius * 0.35), tones.lo);
  slot.position.set(x, y + 0.32, z);
  group.add(slot);
  return head;
}

// Screws at the four corners of a rectangle.
export function screwCorners(group, w, d, y, tones, inset = 5, radius = 1.1) {
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    screw(group, (x * (w / 2 - inset)), y, (z * (d / 2 - inset)), tones, radius);
  }
}

// A ruler strip with real ticks that hang from its edge.
export function rulerStrip(group, w, d, y, tones, every = 4, minor = 2.4, major = 4.2) {
  const strip = new THREE.Mesh(slabGeometry(w, d, 0.5, 0.15, 0.4), tones.mid);
  strip.position.y = y;
  strip.receiveShadow = true;
  group.add(strip);
  const tickGeoms = [];
  for (let x = -w / 2 + 3; x <= w / 2 - 3; x += every) {
    const isMajor = Math.round((x + w / 2 - 3) / every) % 5 === 0;
    const len = isMajor ? major : minor;
    const g = new THREE.BoxGeometry(0.35, 0.12, len);
    g.translate(x, y + 0.3, d / 2 - len / 2);
    tickGeoms.push(g);
  }
  const ticks = new THREE.Mesh(mergeGeometries(tickGeoms), tones.lo);
  group.add(ticks);
  return strip;
}

// A knob with knurling and a face that carries radial ticks.
export function knurledKnob(group, radius, height, tones, teeth = 30) {
  const knob = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.97, height, 28), tones.mid);
  body.castShadow = true;
  knob.add(body);
  const knurl = new THREE.Mesh(knurlGeometry(radius, height, teeth), tones.lo);
  knurl.castShadow = true;
  knob.add(knurl);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, 0.5, 28), tones.hi);
  face.position.y = height / 2;
  knob.add(face);
  const tickGeoms = [];
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const long = i % 6 === 0;
    const g = new THREE.BoxGeometry(0.3, 0.12, long ? 3.2 : 1.8);
    g.translate(0, 0, radius * 0.62);
    g.rotateY(angle);
    tickGeoms.push(g);
  }
  const ticks = new THREE.Mesh(mergeGeometries(tickGeoms), tones.lo);
  ticks.position.y = height / 2 + 0.3;
  knob.add(ticks);
  group.add(knob);
  return knob;
}

// A coil spring: a chain of tori, which is what a spring looks like.
export function coilSpring(group, radius, coils, wire, length, tones) {
  const parts = [];
  const geo = new THREE.TorusGeometry(radius, wire, 6, 16);
  for (let i = 0; i < coils; i++) {
    const g = geo.clone();
    g.rotateX(Math.PI / 2);
    g.translate(0, (i / (coils - 1)) * length, 0);
    parts.push(g);
  }
  const spring = new THREE.Mesh(mergeGeometries(parts), tones.mid);
  spring.castShadow = true;
  group.add(spring);
  return spring;
}

// A bushing: a short tube that a shaft runs through.
export function bushing(group, radius, height, tones) {
  const bush = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), tones.mid);
  bush.castShadow = true;
  group.add(bush);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, height + 0.2, 16), tones.lo);
  group.add(inner);
  return bush;
}

// A post with a collar at its foot, the way a guide pillar is made.
export function guidePost(group, radius, height, tones) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), tones.mid);
  post.position.y = height / 2;
  post.castShadow = true;
  group.add(post);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.7, radius * 1.9, height * 0.09, 20), tones.lo);
  collar.position.y = height * 0.055;
  collar.castShadow = true;
  group.add(collar);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.25, radius * 1.1, height * 0.04, 20), tones.hi);
  cap.position.y = height;
  group.add(cap);
  return post;
}

// A label plate: a small chamfered plate with three rule lines, as printed text.
export function labelPlate(group, w, d, y, tones) {
  const plate = new THREE.Mesh(slabGeometry(w, d, 0.7, 0.25, 1), tones.mid);
  plate.position.y = y;
  plate.castShadow = true;
  group.add(plate);
  const lines = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.BoxGeometry(w * (0.7 - i * 0.14), 0.12, 0.5);
    g.translate(-w * (0.35 - i * 0.07), y + 0.4, -d * 0.18 + i * d * 0.18);
    lines.push(g);
  }
  const rules = new THREE.Mesh(mergeGeometries(lines), tones.lo);
  group.add(rules);
  return plate;
}

// A rail: a bar with a rounded top, the way a machine rail is ground.
export function rail(group, length, y, tones, width = 3.4) {
  const bar = new THREE.Mesh(slabGeometry(length, width, 2.6, 0.6, 1.2), tones.mid);
  bar.position.y = y;
  bar.castShadow = true;
  bar.receiveShadow = true;
  group.add(bar);
  return bar;
}

// A hopper: an open box with a rim and a chute lip.
export function hopper(group, w, d, wallH, tones) {
  const floor = new THREE.Mesh(slabGeometry(w, d, 1.6, 0.4, 1), tones.mid);
  floor.position.y = -wallH;
  floor.receiveShadow = true;
  group.add(floor);
  const wall = (sx, sz, sw, sd) => {
    const m = new THREE.Mesh(slabGeometry(sw, sd, wallH, 0.6, 1), tones.mid);
    m.position.set(sx, -wallH, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  wall(0, -d / 2 + 1, w, 2);
  wall(-w / 2 + 1, 0, 2, d);
  wall(w / 2 - 1, 0, 2, d);
  // the rim: a thin lip round the top
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 1, 4, 4), tones.lo);
  rim.visible = false;
  group.add(rim);
  return group;
}
