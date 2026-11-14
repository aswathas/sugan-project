// The trip of one file.
//
// Two browsers and one server, with a hard line between each browser and the
// server. The file starts as a readable sheet in the sender's browser, is
// sealed into a capsule there, crosses the line as ciphertext, lands in the
// server's hopper, and comes back out as a readable sheet in the recipient's
// browser. The private keys never leave their boxes.
//
// Built with three.js, served from our own origin. No third party is
// contacted and the page needs no build step.

import * as THREE from '/vendor/three.module.min.js';
import * as P from './parts.js';

const stage = document.getElementById('stage');
const labelLayer = document.getElementById('labels');
const readout = document.getElementById('readout');

const css = getComputedStyle(document.documentElement);
const tone = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);

// The scene is drawn, not rendered. Pale graphite fills, ink outlines, one
// blue pencil for the line that tells the story.
const PALETTE = {
  lo: '#bcbab3',
  mid: '#93928c',
  hi: '#35353b',
  lit: tone('--accent', '#3e63dd'),
  paper: '#fbfbfa',
  brass: '#7d7c77',
};
const GRAPHITE = '#33333a';

/* ---------------- the renderer ---------------- */

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(tone('--paper', '#f2f2ef'), 240, 430);

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.5, 600);
camera.position.set(0, 46, 158);
camera.lookAt(0, 11, 0);

const T = P.toneSet(PALETTE);

// Every surface is matte and carries the same pencil hatching, so the parts
// read as shaded by hand rather than by a lamp.
function hatchTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(60, 60, 66, 0.22)';
  ctx.lineWidth = 1;
  for (let x = -128; x < 256; x += 5) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 128, 128);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

for (const name of ['lo', 'mid', 'hi', 'brass', 'paper', 'lit']) {
  const material = T[name];
  material.roughness = 1;
  material.metalness = 0;
  if (name !== 'lit') material.map = hatchTexture();
  material.needsUpdate = true;
}

/* ---------------- the light ---------------- */

const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(-70, 120, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 40;
sun.shadow.camera.far = 340;
sun.shadow.camera.left = -170;
sun.shadow.camera.right = 170;
sun.shadow.camera.top = 110;
sun.shadow.camera.bottom = -110;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun);
// The light is soft and even: a drawing is described by its lines, not by a
// lamp with one hard shadow in it.
scene.add(new THREE.HemisphereLight(0xffffff, PALETTE.paper, 0.95));
const rim = new THREE.DirectionalLight(0xffffff, 0.22);
rim.position.set(110, 46, -70);
scene.add(rim);

/* ---------------- the ground ---------------- */

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(620, 320),
  new THREE.MeshStandardMaterial({ color: '#f4f3f0', roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.userData.smooth = true;
scene.add(ground);

/* ---------------- the benches ---------------- */

const ISLAND = 2.6;

// A bench top: a chamfered plate on four feet, with a groove, corner screws,
// a ruler strip and a label plate. Every bench on this scene is built this way.
function bench(w, d) {
  const group = new THREE.Group();
  P.benchPlate(group, w, d, ISLAND, T, 7);
  P.screwCorners(group, w, d, ISLAND, T, 6, 1.2);
  P.rulerStrip(group, w - 14, 7, ISLAND + 0.1, T, 5, 2.2, 4);
  P.labelPlate(group, 26, 11, ISLAND + 0.1, T);
  scene.add(group);
  return group;
}

const senderBench = bench(84, 50);
senderBench.position.set(-66, ISLAND / 2, 0);
const serverBench = bench(60, 50);
serverBench.position.set(0, ISLAND / 2, 0);
const recipientBench = bench(84, 50);
recipientBench.position.set(66, ISLAND / 2, 0);

const BENCH_TOP = ISLAND;

/* ---------------- the trust boundary ---------------- */

// A low kerb and a row of pointed pickets: the line the server cannot cross.
function boundary(x) {
  const group = new THREE.Group();
  const postGeoms = [];
  for (let z = -22; z <= 22; z += 7.3) {
    const picket = new THREE.BoxGeometry(1.5, 13, 1.5);
    picket.translate(0, 6.5, z);
    postGeoms.push(picket);
    const tip = new THREE.ConeGeometry(1.05, 2.2, 4);
    tip.rotateY(Math.PI / 4);
    tip.translate(0, 14.1, z);
    postGeoms.push(tip);
  }
  const pickets = new THREE.Mesh(P.mergeGeometries(postGeoms), T.hi);
  pickets.castShadow = true;
  group.add(pickets);

  const rail = new THREE.Mesh(P.slabGeometry(3, 48, 2.4, 0.6, 1), T.mid);
  rail.position.y = 11.4;
  rail.castShadow = true;
  group.add(rail);

  // the kerb on the floor, so the line reads where nothing is drawn
  const kerb = new THREE.Mesh(P.slabGeometry(4, 48, 1.1, 0.3, 0.8), T.lo);
  kerb.position.y = 0.55;
  kerb.receiveShadow = true;
  group.add(kerb);

  group.position.x = x;
  scene.add(group);
  return group;
}
const boundaryLeft = boundary(-33);
const boundaryRight = boundary(33);

/* ---------------- the sheet: the readable file ---------------- */

function sheetTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 340;
  const g = c.getContext('2d');
  g.fillStyle = PALETTE.paper;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = PALETTE.hi;
  g.fillRect(34, 38, 190, 14);
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 12; i++) {
    const y = 80 + i * 19;
    const w = 110 + Math.round(rand() * 290);
    g.globalAlpha = i % 4 === 3 ? 0.28 : 0.68;
    g.fillStyle = PALETTE.hi;
    g.fillRect(34, y, w, 6);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const sheetMat = new THREE.MeshStandardMaterial({ map: sheetTexture(), roughness: 0.92, metalness: 0 });
const sheet = new THREE.Mesh(P.slabGeometry(34, 24, 0.9, 0.25, 0.8), sheetMat);
sheet.castShadow = true;
sheet.receiveShadow = true;
scene.add(sheet);

/* ---------------- the capsule: the sealed file ---------------- */

function capsuleTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = PALETTE.hi;
  g.fillRect(0, 0, c.width, c.height);
  let seed = 19;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(rand() * 32) * 8;
    const y = Math.floor(rand() * 16) * 8;
    g.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000';
    g.globalAlpha = 0.04 + rand() * 0.14;
    g.fillRect(x, y, 8, 8);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const capsuleMat = new THREE.MeshStandardMaterial({
  map: capsuleTexture(),
  roughness: 0.42,
  metalness: 0.35,
});

function makeCapsule() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 17, 24, 1, false), capsuleMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(3.7, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), capsuleMat);
    cap.rotation.z = (side * Math.PI) / 2;
    cap.position.x = side * 8.5;
    cap.castShadow = true;
    group.add(cap);
  }
  // the two bands that hold it shut
  for (const x of [-4.4, 4.4]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(3.85, 0.55, 8, 26), T.mid);
    band.rotation.y = Math.PI / 2;
    band.position.x = x;
    band.castShadow = true;
    group.add(band);
  }
  scene.add(group);
  return group;
}
const capsule = makeCapsule();
capsule.visible = false;

// The wrapped key: the tag that rides with the capsule.
const wrappedKey = new THREE.Group();
{
  const tag = new THREE.Mesh(P.slabGeometry(11, 8, 1.4, 0.3, 1), T.mid);
  tag.castShadow = true;
  wrappedKey.add(tag);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.4, 6, 14), T.hi);
  shackle.rotation.x = Math.PI / 2;
  shackle.position.set(0, 0.9, 3.6);
  wrappedKey.add(shackle);
  wrappedKey.visible = false;
  scene.add(wrappedKey);
}

/* ---------------- the press ---------------- */

// The seal: a bench press with guide posts, a beam, a head on bearing arms, a
// die that does the sealing, a knurled key dial, a pointer and a return spring.
function makePress() {
  const group = new THREE.Group();
  const base = new THREE.Group();

  const plate = new THREE.Mesh(P.slabGeometry(30, 34, 3.4, 0.9, 2), T.lo);
  plate.castShadow = true;
  plate.receiveShadow = true;
  base.add(plate);
  P.screwCorners(base, 30, 34, 3.4, T, 3.5, 1);
  // the die seat: a raised block the sheet is pressed into
  const seat = new THREE.Mesh(P.slabGeometry(16, 16, 1.8, 0.6, 1.2), T.mid);
  seat.position.y = 4.2;
  seat.castShadow = true;
  seat.receiveShadow = true;
  base.add(seat);
  group.add(base);

  // two guide posts with collars, and the beam they carry
  for (const z of [-12, 12]) {
    const post = P.guidePost(base, 1.9, 30, T);
    post.position.set(-11, 3.4, z);
    const bush = P.bushing(base, 2.6, 4, T);
    bush.position.set(-11, 22, z);
  }
  const beam = new THREE.Mesh(P.slabGeometry(9, 30, 5.5, 0.8, 1.2), T.mid);
  beam.position.set(-11, 33.4, 0);
  beam.castShadow = true;
  base.add(beam);
  const beamTop = new THREE.Mesh(P.slabGeometry(6, 22, 1.2, 0.4, 0.8), T.lo);
  beamTop.position.set(-11, 38.9, 0);
  base.add(beamTop);

  // the head: a block on two bearing arms, with the die under it
  const head = new THREE.Group();
  const block = new THREE.Mesh(P.slabGeometry(11, 15, 7, 1, 1.4), T.hi);
  block.castShadow = true;
  head.add(block);
  for (const z of [-9.5, 9.5]) {
    const arm = new THREE.Mesh(P.slabGeometry(5, 4, 3.6, 0.7, 0.9), T.mid);
    arm.position.set(0, 0.4, z);
    arm.castShadow = true;
    head.add(arm);
  }
  // The die is graphite: the blue pencil belongs to the story line.
  const die = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.4, 3.4, 24), T.hi);
  die.position.y = -5;
  die.castShadow = true;
  head.add(die);
  const dieRing = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.3, 6, 26), T.mid);
  dieRing.rotation.x = Math.PI / 2;
  dieRing.position.y = -3.5;
  head.add(dieRing);
  head.position.set(-11, 25, 0);
  base.add(head);

  // the key dial: a knurled knob with a pointer, on a plinth
  const dial = new THREE.Group();
  const plinth = new THREE.Mesh(P.slabGeometry(14, 8, 3.6, 0.8, 1), T.mid);
  plinth.castShadow = true;
  dial.add(plinth);
  const knob = P.knurledKnob(dial, 4.6, 3.4, T, 34);
  knob.position.set(0, 5.2, 0);
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 6.4), T.hi);
  pointer.position.set(0, 7.1, 2.2);
  pointer.castShadow = true;
  dial.add(pointer);
  dial.position.set(4, 3.4, 13);
  base.add(dial);

  // the return spring under the head
  const spring = P.coilSpring(base, 2.6, 9, 0.42, 9, T);
  spring.position.set(4.6, 5, -13);

  group.position.set(-70, BENCH_TOP, 0);
  scene.add(group);
  return { group, head, dial, pointer };
}
const press = makePress();

/* ---------------- the key boxes ---------------- */

// Where the private key lives: a chamfered box with a hinged lid, a brass
// latch and a key on a ring inside.
function makeKeyBox(x, z) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(P.slabGeometry(18, 13, 9, 0.8, 1.6), T.hi);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const inner = new THREE.Mesh(P.slabGeometry(15, 10, 1, 0.4, 1.2), T.lo);
  inner.position.y = 8.6;
  group.add(inner);

  const lid = new THREE.Group();
  const lidMesh = new THREE.Mesh(P.slabGeometry(18, 13, 1.6, 0.6, 1.6), T.mid);
  lidMesh.position.set(0, 0, -6);
  lidMesh.castShadow = true;
  lid.add(lidMesh);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 16, 10), T.mid);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0.4, -6.4);
  lid.add(hinge);
  lid.position.set(0, 9.6, 6.4);
  group.add(lid);

  const latch = new THREE.Mesh(P.slabGeometry(4, 2.4, 3, 0.4, 0.6), T.brass);
  latch.position.set(0, 7.4, 6.4);
  latch.castShadow = true;
  group.add(latch);

  const key = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 9, 10), T.brass);
  shaft.rotation.z = Math.PI / 2;
  key.add(shaft);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.5, 6, 16), T.brass);
  bow.rotation.y = Math.PI / 2;
  bow.position.x = -5.2;
  key.add(bow);
  const bit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.6), T.brass);
  bit.position.set(4.2, -1.2, 0);
  key.add(bit);
  key.position.set(0, 10.2, 0);
  key.visible = false;
  group.add(key);

  group.position.set(x, BENCH_TOP, z);
  scene.add(group);
  return { group, lid, key };
}
const senderKey = makeKeyBox(-74, 16);
const recipientKey = makeKeyBox(74, 16);

/* ---------------- the server ---------------- */

// The public key plate, engraved.
const plate = new THREE.Group();
{
  const plateMesh = new THREE.Mesh(P.slabGeometry(24, 15, 0.9, 0.3, 1.2), T.mid);
  plateMesh.castShadow = true;
  plateMesh.receiveShadow = true;
  plate.add(plateMesh);

  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = PALETTE.hi;
  g.lineWidth = 9;
  g.beginPath();
  g.arc(120, 160, 46, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(166, 160);
  g.lineTo(340, 160);
  g.stroke();
  g.beginPath();
  g.moveTo(306, 160);
  g.lineTo(306, 212);
  g.moveTo(340, 160);
  g.lineTo(340, 202);
  g.stroke();
  g.fillStyle = PALETTE.hi;
  g.font = '600 34px ui-monospace, Menlo, monospace';
  g.fillText('PUBLIC KEY', 182, 118);
  g.font = '24px ui-monospace, Menlo, monospace';
  g.globalAlpha = 0.6;
  g.fillText('SHA-256  9f2c…a41d', 182, 268);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const engraving = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 15),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8 })
  );
  engraving.rotation.x = -Math.PI / 2;
  engraving.position.y = 0.95;
  // The engraving is ink on the plate, not a part: it takes no outline.
  engraving.userData.smooth = true;
  plate.add(engraving);
  P.screwCorners(plate, 24, 15, 0.9, T, 2, 0.9);
  plate.position.set(0, BENCH_TOP + 0.9, 16);
  scene.add(plate);
}

// The hopper: the store. An open box with a rim, a chute lip and a card slot
// that shows the share record, the way a server would show one.
const hopper = new THREE.Group();
{
  const walls = new THREE.Group();
  P.hopper(walls, 46, 30, 15, T);
  hopper.add(walls);

  // the chute lip the capsule comes in over
  const lip = new THREE.Mesh(P.slabGeometry(10, 30, 3.4, 0.8, 1.2), T.mid);
  lip.position.set(-25, 0, 0);
  lip.castShadow = true;
  hopper.add(lip);

  // the card slot: the record of what is held
  const card = new THREE.Mesh(P.slabGeometry(20, 9, 0.5, 0.2, 0.6), T.paper);
  card.position.set(6, 15.4, 12.5);
  card.rotation.x = -0.35;
  hopper.add(card);
  const cardGeoms = [];
  for (let i = 0; i < 4; i++) {
    const line = new THREE.BoxGeometry(13 - i * 2.4, 0.12, 0.7);
    line.translate(-2, 15.7, 12.5 - 1.6 + i * 1.6);
    cardGeoms.push(line);
  }
  const cardLines = new THREE.Mesh(P.mergeGeometries(cardGeoms), T.lo);
  hopper.add(cardLines);

  hopper.position.set(0, BENCH_TOP, 0);
  scene.add(hopper);
}

// The capsules the server already holds.
const stored = [];
for (let i = 0; i < 3; i++) {
  const c = makeCapsule();
  c.scale.setScalar(0.8);
  c.position.set(-8 + i * 8.5, BENCH_TOP + 2.4 + i * 0.4, -5);
  c.rotation.y = 0.18 * i - 0.18;
  stored.push(c);
}

/* ---------------- the pencil pass ---------------- */

// A drawn line has a hand in it. Every vertex of every part is nudged a
// little, so the outlines that come off them are not machine straight.
function roughen(root, amount = 0.34) {
  let seed = 20261115;
  const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  root.traverse((object) => {
    if (!object.isMesh || object.userData.smooth) return;
    const position = object.geometry?.attributes?.position;
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      position.setXYZ(
        i,
        position.getX(i) + (random() - 0.5) * amount,
        position.getY(i) + (random() - 0.5) * amount,
        position.getZ(i) + (random() - 0.5) * amount
      );
    }
    position.needsUpdate = true;
    object.geometry.computeVertexNormals();
  });
}

// The outline: each part is drawn over with its own edges in graphite. The
// edges ride on the part, so a head that moves is still drawn where it is.
function outline(root) {
  const material = new THREE.LineBasicMaterial({
    color: GRAPHITE,
    transparent: true,
    opacity: 0.88,
  });
  root.traverse((object) => {
    if (!object.isMesh || object.userData.smooth) return;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry, 22), material);
    lines.position.set(0, 0, 0);
    lines.rotation.set(0, 0, 0);
    lines.scale.set(1, 1, 1);
    object.add(lines);
  });
}

roughen(scene);
outline(scene);

/* ---------------- the labels ---------------- */

const labels = [];
function addLabel(text, sub, kind, anchor, offset) {
  const el = document.createElement('div');
  el.className = `label label--${kind}`;
  el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
  labelLayer.appendChild(el);
  labels.push({ el, anchor, offset: offset || 0 });
  return el;
}

function marker(x, y, z) {
  const m = new THREE.Object3D();
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}

addLabel('Your browser', '', 'zone', marker(-66, BENCH_TOP, 26), 6);
addLabel('The server', '', 'zone', marker(0, BENCH_TOP, 26), 6);
addLabel("Their browser", '', 'zone', marker(66, BENCH_TOP, 26), 6);
const labelSheet = addLabel('the file, readable', 'it only exists here', 'key', sheet, 22);
const labelCapsule = addLabel('ciphertext', 'sealed, unreadable', 'key', capsule, 16);
addLabel('the private key', 'never leaves this device', 'key', senderKey.group, 22);
addLabel('the private key', 'never leaves this device', 'key', recipientKey.group, 22);
addLabel('the public key', 'the server holds this too', 'key', plate, 18);
addLabel('the trust boundary', 'only ciphertext crosses this', 'wall', marker(-33, BENCH_TOP, 25), 8);
addLabel('the trust boundary', '', 'wall', marker(33, BENCH_TOP, 25), 8);

function placeLabels() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const item of labels) {
    const p = new THREE.Vector3();
    item.anchor.getWorldPosition(p);
    p.y += item.offset;
    p.project(camera);
    const x = (p.x * 0.5 + 0.5) * w;
    const y = (-p.y * 0.5 + 0.5) * h;
    item.el.style.opacity = p.z > 1 ? '0' : '1';
    item.el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

/* ---------------- the story ---------------- */

const STEPS = [
  'You pick a file. It is readable, here, in your browser.',
  'Your browser seals it. The server never sees it readable.',
  'The file key is wrapped with their public key. Only the wrapped form travels.',
  'The server stores a capsule and a wrapped key. It cannot open either.',
  'The capsule comes back out. The server had no way to read it.',
  'Their private key unwraps it. The fingerprint matches. It is the file you sent.',
];
const stepBar = document.getElementById('steps');
const stepMarks = STEPS.map(() => {
  const i = document.createElement('i');
  stepBar.appendChild(i);
  return i;
});

let step = -1;
function setStep(index) {
  if (index === step) return;
  step = index;
  readout.innerHTML = `<em>${index + 1}/6</em> &nbsp;${STEPS[index]}`;
  stepMarks.forEach((mark, i) => mark.classList.toggle('on', i <= index));
}
setStep(0);

const ease = (t) => t * t * (3 - 2 * t);
const span = (t, from, to) => Math.min(1, Math.max(0, (t - from) / (to - from)));

const SHEET_START = -92;
const PRESS_X = -70;

function sheetX(t) {
  return SHEET_START + (PRESS_X - SHEET_START) * ease(span(t, 1.4, 2.8));
}
function capsuleX(t) {
  if (t < 3.0) return PRESS_X - 8;
  if (t < 5.4) return PRESS_X - 8 + (0 - (PRESS_X - 8)) * ease(span(t, 3.0, 5.4));
  if (t < 6.6) return 0;
  if (t < 9.4) return 56 * ease(span(t, 7.6, 9.4));
  return 56;
}
function capsuleY(t) {
  if (t < 5.4) return BENCH_TOP + 5.4;
  if (t < 6.6) return BENCH_TOP + 5.4 - 3 * ease(span(t, 5.4, 6.2));
  if (t < 7.6) return BENCH_TOP + 2.4;
  if (t < 9.4) return BENCH_TOP + 2.4 + 3 * ease(span(t, 7.6, 8.4));
  return BENCH_TOP + 5.4;
}

let sealed = false;
let opened = false;

function update(t) {
  const time = t % 17;

  // the sheet is readable until the press closes on it
  const sealing = span(time, 1.4, 2.8);
  sheet.visible = time < 3.0;
  if (sheet.visible) {
    sheet.position.set(sheetX(time), BENCH_TOP + 0.45, 0);
    sheet.rotation.y = -0.05 * (1 - sealing);
  }

  // the head comes down on the sheet, and the key dial turns with it
  const headDown = span(time, 2.2, 2.7);
  const headUp = time > 3 ? span(time, 3.0, 3.6) : 0;
  press.head.position.y = 25 - 8 * ease(headDown) + 8 * ease(headUp);
  press.dial.rotation.y = -ease(sealing) * Math.PI * 1.5;
  press.pointer.rotation.y = -ease(sealing) * Math.PI * 1.5;

  // the capsule exists from the moment the seal closes
  const isSealed = time >= 2.9 && time < 12.4;
  if (isSealed !== sealed) {
    sealed = isSealed;
    capsule.visible = sealed;
  }
  if (capsule.visible) {
    capsule.position.set(capsuleX(time), capsuleY(time), 0);
    capsule.rotation.y = time * 0.35;
    const tag = time > 3.4 && time < 9.6;
    wrappedKey.visible = tag;
    if (tag) {
      wrappedKey.position.set(capsule.position.x, capsule.position.y - 5.6, 0);
      wrappedKey.rotation.y = capsule.rotation.y;
    }
  }

  // the recipient's key box opens when the capsule arrives
  const openAmount = ease(span(time, 9.6, 10.4));
  recipientKey.lid.rotation.x = -openAmount * 1.9;
  recipientKey.key.visible = openAmount > 0.05;
  recipientKey.key.position.y = 10.2 + openAmount * 3.4;
  recipientKey.key.rotation.y = openAmount * 0.8;

  // at the end the capsule opens into a readable sheet again
  const isOpen = time >= 10.2 && time < 14.2;
  if (isOpen !== opened) {
    opened = isOpen;
    sheet.visible = isOpen;
  }
  if (isOpen) {
    sheet.position.set(56 + 12 * ease(span(time, 10.2, 10.9)), BENCH_TOP + 0.45, 0);
    sheet.rotation.y = 0.05;
  }

  if (time < 1.4) setStep(0);
  else if (time < 3.4) setStep(1);
  else if (time < 5.4) setStep(2);
  else if (time < 7.6) setStep(3);
  else if (time < 10.2) setStep(4);
  else setStep(5);

  labelSheet.style.opacity = sheet.visible ? '1' : '0';
  labelCapsule.style.opacity = capsule.visible ? '1' : '0';
  updateStoryLine(time);
}

/* ---------------- the story line ---------------- */

// The route the file takes, drawn as a single stroke that grows as the file
// moves along it. The arrowhead is the pen: it sits at the point of the
// stroke, so the line and the file are always the same story.
const ROUTE_STEP = 0.05;
const routePoints = [];
for (let t = 0; t <= 14.2; t += ROUTE_STEP) {
  let x;
  let y;
  if (t < 2.9) {
    x = sheetX(t);
    y = BENCH_TOP + 0.45;
  } else if (t < 10.2) {
    x = capsuleX(t);
    y = capsuleY(t);
  } else {
    x = 56 + 12 * ease(span(t, 10.2, 10.9));
    y = BENCH_TOP + 0.45;
  }
  routePoints.push(new THREE.Vector3(x, y, -3.5));
}

// A stroke in the plane of the paper, with the width across it and a hand in
// the line.
function strokeGeometry(points, width) {
  const positions = [];
  const uvs = [];
  const indices = [];
  let seed = 991;
  const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const facing = new THREE.Vector3(0, 0, 1);
  let side = new THREE.Vector3(0, 1, 0);
  const last = points.length - 1;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const before = points[Math.max(i - 1, 0)];
    const after = points[Math.min(i + 1, last)];
    const tangent = after.clone().sub(before);
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
    tangent.normalize();
    const candidate = new THREE.Vector3().crossVectors(tangent, facing);
    if (candidate.lengthSq() > 1e-6) side = candidate.normalize();
    const half = width * (0.45 + 0.55 * (i / last));
    const wobble = (random() - 0.5) * width * 0.55;
    const centre = point.clone().addScaledVector(side, wobble);
    positions.push(centre.x + side.x * half, centre.y + side.y * half, centre.z + side.z * half);
    positions.push(centre.x - side.x * half, centre.y - side.y * half, centre.z - side.z * half);
    uvs.push(i / last, 0, i / last, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const routeGeometry = strokeGeometry(routePoints, 3.2);
const route = new THREE.Mesh(
  routeGeometry,
  new THREE.MeshBasicMaterial({
    color: GRAPHITE,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
  })
);
route.renderOrder = 6;
scene.add(route);

// The arrowhead: a pencil pyramid at the point of the stroke. It is drawn
// over the scene, because the pen is never hidden behind the machine.
const arrowhead = new THREE.Mesh(
  new THREE.ConeGeometry(3.2, 8.4, 4),
  new THREE.MeshBasicMaterial({ color: PALETTE.lit, depthTest: false })
);
arrowhead.renderOrder = 7;
scene.add(arrowhead);

const STROKE_UP = new THREE.Vector3(0, 1, 0);

function updateStoryLine(time) {
  const progress = span(time, 0, 14.2);
  const last = routePoints.length - 1;
  const shown = Math.floor(progress * last);
  routeGeometry.setDrawRange(0, shown * 6);
  const index = Math.min(Math.max(shown, 0), last - 1);
  const point = routePoints[index];
  const after = routePoints[Math.min(index + 1, last)];
  const tangent = after.clone().sub(point);
  if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
  tangent.normalize();
  arrowhead.position.copy(point).addScaledVector(tangent, 3.6);
  arrowhead.quaternion.setFromUnitVectors(STROKE_UP, tangent);
  arrowhead.visible = progress > 0.002;
}

/* ---------------- the camera ---------------- */

let dragX = 0;
let dragY = 0;
let dragging = false;
let lastX = 0;
let lastY = 0;

stage.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  dragX += (event.clientX - lastX) * 0.005;
  dragY = Math.max(-0.4, Math.min(0.6, dragY + (event.clientY - lastY) * 0.003));
  lastX = event.clientX;
  lastY = event.clientY;
});
const stopDrag = () => {
  dragging = false;
};
stage.addEventListener('pointerup', stopDrag);
stage.addEventListener('pointercancel', stopDrag);
stage.addEventListener('pointerleave', stopDrag);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------- the loop ---------------- */

const timer = new THREE.Timer();
timer.connect(document);
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function frame() {
  timer.update();
  const t = timer.getElapsed();
  update(still ? 11.4 : t);

  const angle = dragX + (still ? 0 : Math.sin(t * 0.05) * 0.13);
  const radius = 158;
  camera.position.set(Math.sin(angle) * radius, 46 + dragY * 40, Math.cos(angle) * radius);
  camera.lookAt(0, 11, 0);

  placeLabels();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(frame);

// A small window into the scene, for the browser test.
window.__journey = {
  step: () => step,
  capsuleX: () => capsule.position.x,
  capsuleVisible: () => capsule.visible,
  labels: () => labels.length,
};
