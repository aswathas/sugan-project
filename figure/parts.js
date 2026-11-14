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

// A slab with a chamfer on its top edge, sitting flush on y = 0.
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
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
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

// A stepped plinth under a bench so it sits firmly on the ground plane.
export function plinth(group, w, d, tones) {
  const lower = new THREE.Mesh(slabGeometry(w + 4, d + 4, 1.5, 0.35, 2.2), tones.lo);
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  const upper = new THREE.Mesh(slabGeometry(w + 1.5, d + 1.5, 1.1, 0.3, 1.8), tones.mid);
  upper.position.y = 1.5;
  upper.castShadow = true;
  upper.receiveShadow = true;
  group.add(upper);
  return group;
}

// A bench plate with a chamfer, a groove and four feet resting on its plinth.
export function benchPlate(group, w, d, h, tones, cornerInset = 5) {
  const plate = new THREE.Mesh(slabGeometry(w, d, h, 0.9, 2.4), tones.lo);
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  // the groove: a sunken line round the inside of the plate
  const groove = new THREE.Mesh(
    new THREE.BoxGeometry(w - cornerInset * 2, 0.16, d - cornerInset * 2),
    tones.mid
  );
  groove.position.y = h - 0.02;
  group.add(groove);

  // four short feet under the bench plate, resting on top of the plinth
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 2.4, 16), tones.mid);
    foot.position.set(x * (w / 2 - 5.5), -1.2, z * (d / 2 - 5.5));
    foot.castShadow = true;
    foot.receiveShadow = true;
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
    g.translate(x, y + 0.48, d / 2 - len / 2);
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
  const wrap = new THREE.Group();
  const bush = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), tones.mid);
  bush.castShadow = true;
  wrap.add(bush);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, height + 0.2, 16), tones.lo);
  wrap.add(inner);
  group.add(wrap);
  return wrap;
}

// A post with a collar at its foot, the way a guide pillar is made.
export function guidePost(group, radius, height, tones) {
  const wrap = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), tones.mid);
  post.position.y = height / 2;
  post.castShadow = true;
  wrap.add(post);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.7, radius * 1.9, height * 0.09, 20), tones.lo);
  collar.position.y = height * 0.055;
  collar.castShadow = true;
  wrap.add(collar);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.25, radius * 1.1, height * 0.04, 20), tones.hi);
  cap.position.y = height;
  wrap.add(cap);
  group.add(wrap);
  return wrap;
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
    g.translate(-w * (0.35 - i * 0.07), y + 0.68, -d * 0.18 + i * d * 0.18);
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

// A hopper: an open box sitting on y = 0 with three walls and a top rim.
export function hopper(group, w, d, wallH, tones) {
  const floor = new THREE.Mesh(slabGeometry(w, d, 1.6, 0.4, 1), tones.lo);
  floor.receiveShadow = true;
  group.add(floor);
  const wall = (sx, sz, sw, sd) => {
    const m = new THREE.Mesh(slabGeometry(sw, sd, wallH, 0.45, 0.9), tones.mid);
    m.position.set(sx, 0, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  wall(0, -d / 2 + 1, w, 2);
  wall(-w / 2 + 1, 0, 2, d);
  wall(w / 2 - 1, 0, 2, d);

  // the rim: a chamfered top lip round the three walls
  const rim = (sx, sz, sw, sd) => {
    const m = new THREE.Mesh(slabGeometry(sw, sd, 1.0, 0.25, 0.8), tones.hi);
    m.position.set(sx, wallH, sz);
    m.castShadow = true;
    group.add(m);
  };
  rim(0, -d / 2 + 1, w + 1.2, 2.8);
  rim(-w / 2 + 1, 0, 2.8, d + 0.6);
  rim(w / 2 - 1, 0, 2.8, d + 0.6);
  return group;
}

// A receiver tray: a sloped intake cradle leading onto a recessed paper bed
// where the unwrapped readable file settles and is checked.
export function receiverTray(group, w, d, tones) {
  const base = new THREE.Mesh(slabGeometry(w, d, 1.6, 0.45, 1.4), tones.lo);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // intake lip on the left where the capsule crosses in
  const intake = new THREE.Mesh(slabGeometry(4.5, d - 2, 2.4, 0.4, 1), tones.mid);
  intake.position.set(-w / 2 + 1.6, 0, 0);
  intake.castShadow = true;
  intake.receiveShadow = true;
  group.add(intake);

  // side guide rails keeping the unwrapped sheet aligned on the bed
  for (const sz of [-(d / 2 - 1.6), d / 2 - 1.6]) {
    const sideRail = new THREE.Mesh(slabGeometry(w - 3, 1.8, 2.8, 0.35, 0.8), tones.mid);
    sideRail.position.set(1.2, 0, sz);
    sideRail.castShadow = true;
    sideRail.receiveShadow = true;
    group.add(sideRail);
  }

  // backstop rim on the far right
  const stop = new THREE.Mesh(slabGeometry(2, d - 2, 3.2, 0.35, 0.8), tones.hi);
  stop.position.set(w / 2 - 1.2, 0, 0);
  stop.castShadow = true;
  group.add(stop);

  // recessed paper bed inside the tray
  const bed = new THREE.Mesh(slabGeometry(w - 7.5, d - 5.2, 0.5, 0.15, 0.8), tones.paper);
  bed.position.set(1.8, 1.55, 0);
  bed.receiveShadow = true;
  group.add(bed);

  // verification stamp block on the front-left corner of the tray
  const stamp = new THREE.Mesh(slabGeometry(4.2, 4.2, 1.4, 0.25, 0.7), tones.hi);
  stamp.position.set(-w / 2 + 3.2, 1.6, d / 2 - 3.6);
  stamp.castShadow = true;
  group.add(stamp);
  return group;
}

// A press frame: two side rails and a back member, so a sheet can slide in
// between them and be pressed from above instead of passing through a solid
// plate.
export function pressFrame(group, w, d, tones) {
  const railWidth = 5;
  for (const sz of [-(d / 2 - railWidth / 2), d / 2 - railWidth / 2]) {
    const rail = new THREE.Mesh(slabGeometry(w, railWidth, 2.8, 0.6, 1.2), tones.lo);
    rail.position.set(0, 0, sz);
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
    // a rib along the top of each rail, so the frame is not a plain box
    const rib = new THREE.Mesh(slabGeometry(w - 2, railWidth - 1.8, 0.6, 0.2, 0.8), tones.mid);
    rib.position.set(0, 2.8, sz);
    rib.castShadow = true;
    group.add(rib);
  }
  const back = new THREE.Mesh(slabGeometry(3.4, d, 2.8, 0.6, 1), tones.lo);
  back.position.set(w / 2 - 1.7, 0, 0);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);
  return group;
}

// The horizon: a drawn line on the floor where the ground stops, so the world
// does not simply end. It is a pencil line, so the weather does not touch it.
export function horizon(group, radius, tones) {
  const line = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.9, 5, 180),
    new THREE.MeshBasicMaterial({
      color: tones.hi.color,
      transparent: true,
      opacity: 0.45,
      fog: false,
    })
  );
  line.rotation.x = Math.PI / 2;
  line.position.y = 0.08;
  // the line is drawn by hand, so it wanders a little
  const position = line.geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const drift = Math.sin(Math.atan2(z, x) * 7.0) * 2.4 + Math.cos(Math.atan2(z, x) * 3.0) * 1.6;
    const scale = 1 + drift / radius;
    position.setXYZ(i, x * scale, y + Math.sin(Math.atan2(z, x) * 11.0) * 0.5, z * scale);
  }
  position.needsUpdate = true;
  line.userData.smooth = true;
  group.add(line);
  return line;
}
