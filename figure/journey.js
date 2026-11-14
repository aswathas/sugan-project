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
const PAPER_TONE = tone('--paper', '#f2f2ef');
const PALETTE = {
  lo: '#c4c2bb',
  mid: '#97968f',
  hi: '#52525a',
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
scene.fog = new THREE.Fog(PAPER_TONE, 230, 440);

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.5, 800);
// The scene is a long table, so it is drawn from a corner: a straight-on view
// would hide every part that has depth.
const BASE_ANGLE = 0.3;
camera.position.set(Math.sin(BASE_ANGLE) * 142, 40, Math.cos(BASE_ANGLE) * 142);
camera.lookAt(0, 9, 0);

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

// Subtle pencil paper tooth on the floor so it reads as a surface without
// adding any blueprint grid lines.
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f3f0';
  g.fillRect(0, 0, 256, 256);
  let seed = 313;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 220; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const len = 14 + rand() * 44;
    g.strokeStyle = 'rgba(70, 70, 76, 0.045)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y + (rand() - 0.5) * 3);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(420, 72),
  new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.userData.smooth = true;
scene.add(ground);

// The horizon: a drawn line on the floor where the ground stops, so the
// world does not simply end.
P.horizon(scene, 300, T);

// A drafted runner under the three stations so the machine sits on a place,
// not adrift on empty white.
const runner = new THREE.Mesh(
  new THREE.PlaneGeometry(148, 56),
  new THREE.MeshStandardMaterial({ color: '#ecebe6', roughness: 1, metalness: 0 })
);
runner.rotation.x = -Math.PI / 2;
runner.position.y = 0.015;
runner.receiveShadow = true;
runner.userData.smooth = true;
scene.add(runner);

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 14, 64, 64, 62);
  grad.addColorStop(0, 'rgba(38, 38, 44, 0.42)');
  grad.addColorStop(0.65, 'rgba(38, 38, 44, 0.16)');
  grad.addColorStop(1, 'rgba(38, 38, 44, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const CONTACT_SHADOW_TEX = shadowTexture();

function contactShadow(parent, w, d, y, opacity = 0.72) {
  const mat = new THREE.MeshBasicMaterial({
    map: CONTACT_SHADOW_TEX,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.userData.smooth = true;
  parent.add(mesh);
  return mesh;
}

/* ---------------- the benches ---------------- */

const PLINTH_H = 2.6;
const FOOT_H = 2.4;
const ISLAND = 2.4;
const BENCH_TOP = PLINTH_H + FOOT_H + ISLAND;

// A stepped plinth on the floor, then a chamfered bench plate on four feet
// with corner screws, a ruler strip and a label plate.
function bench(w, d, x) {
  const station = new THREE.Group();
  station.position.x = x;
  contactShadow(station, w + 14, d + 14, 0.03, 0.85);
  P.plinth(station, w, d, T);

  const plateGroup = new THREE.Group();
  plateGroup.position.y = PLINTH_H + FOOT_H;
  P.benchPlate(plateGroup, w, d, ISLAND, T, 5);
  P.screwCorners(plateGroup, w, d, ISLAND, T, 4.2, 0.9);
  const rulerGroup = new THREE.Group();
  rulerGroup.position.z = d / 2 - 2.4;
  P.rulerStrip(rulerGroup, w - 10, 3.2, ISLAND + 0.05, T, 4, 1.4, 2.4);
  plateGroup.add(rulerGroup);
  station.add(plateGroup);

  for (const [fx, fz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const s = contactShadow(station, 7.5, 7.5, PLINTH_H + 0.03, 0.55);
    s.position.set(fx * (w / 2 - 5.5), PLINTH_H + 0.03, fz * (d / 2 - 5.5));
  }

  scene.add(station);
  return station;
}

const senderBench = bench(42, 44, -47);
const serverBench = bench(32, 44, 0);
const recipientBench = bench(42, 44, 47);

/* ---------------- the trust boundary ---------------- */

// A stepped sill kerb and a row of pointed pickets: the line the server cannot cross.
function boundary(x) {
  const group = new THREE.Group();
  contactShadow(group, 8, 52, 0.03, 0.72);

  const sill = new THREE.Mesh(P.slabGeometry(4.4, 48, 0.9, 0.25, 1), T.lo);
  sill.receiveShadow = true;
  group.add(sill);

  const kerb = new THREE.Mesh(P.slabGeometry(4.2, 46, 1.4, 0.3, 0.8), T.mid);
  kerb.position.y = 0.9;
  kerb.castShadow = true;
  kerb.receiveShadow = true;
  group.add(kerb);

  const postGeoms = [];
  for (let z = -20; z <= 20; z += 6.6) {
    const picket = new THREE.BoxGeometry(1.4, 11.2, 1.4);
    picket.translate(0, 7.6, z);
    postGeoms.push(picket);
    const tip = new THREE.ConeGeometry(0.95, 2.0, 4);
    tip.rotateY(Math.PI / 4);
    tip.translate(0, 14.2, z);
    postGeoms.push(tip);
  }
  const pickets = new THREE.Mesh(P.mergeGeometries(postGeoms), T.hi);
  pickets.castShadow = true;
  group.add(pickets);

  const rail = new THREE.Mesh(P.slabGeometry(2.8, 45, 2.0, 0.45, 0.9), T.mid);
  rail.position.y = 11.4;
  rail.castShadow = true;
  group.add(rail);

  group.position.x = x;
  scene.add(group);
  return group;
}
const boundaryLeft = boundary(-21);
const boundaryRight = boundary(21);

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
const sheet = new THREE.Mesh(P.slabGeometry(18, 13, 0.7, 0.2, 0.6), sheetMat);
sheet.castShadow = true;
sheet.receiveShadow = true;
scene.add(sheet);

const movingShadow = contactShadow(scene, 20, 14, BENCH_TOP + 0.04, 0.52);

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
  roughness: 0.9,
  metalness: 0,
});

function makeCapsule() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 10, 20, 1, false), capsuleMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(2.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), capsuleMat);
    cap.rotation.z = (side * Math.PI) / 2;
    cap.position.x = side * 5;
    cap.castShadow = true;
    group.add(cap);
  }
  // the two bands that hold it shut
  for (const x of [-2.8, 2.8]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.42, 8, 22), T.mid);
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
  const tag = new THREE.Mesh(P.slabGeometry(8.5, 6, 1.1, 0.25, 0.8), T.mid);
  tag.castShadow = true;
  wrappedKey.add(tag);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.32, 6, 14), T.hi);
  shackle.rotation.x = Math.PI / 2;
  shackle.position.set(0, 0.65, 2.8);
  wrappedKey.add(shackle);
  wrappedKey.visible = false;
  scene.add(wrappedKey);
}

/* ---------------- the press ---------------- */

// The head rides on the posts. Up, the die hangs clear of the sheet; down, it
// rests on the paper it is sealing.
const HEAD_UP = 12.15;
const HEAD_DOWN = 5.95;
const HEAD_STROKE = HEAD_UP - HEAD_DOWN;
const BEAM_UNDER = 25.8;
const SPRING_LEN = BEAM_UNDER - (HEAD_UP + 5.4);

// The seal: a bench press with guide posts, a beam, a head on bearing arms, a
// die that does the sealing, a knurled key dial, a pointer and a return spring.
// The frame straddles the sheet: two rails with the sheet running between
// them, so the die comes down on the paper and not beside it.
function makePress() {
  const group = new THREE.Group();
  const base = new THREE.Group();
  contactShadow(group, 30, 32, 0.04, 0.65);

  P.pressFrame(base, 26, 22, T);
  group.add(base);

  // two guide posts with collars, and the beam they carry
  for (const z of [-11, 11]) {
    const post = P.guidePost(base, 1.4, 23, T);
    post.position.set(-5.5, 2.8, z);
  }
  const beam = new THREE.Mesh(P.slabGeometry(7, 26, 4.2, 0.6, 1), T.mid);
  beam.position.set(-5.5, 25.8, 0);
  beam.castShadow = true;
  base.add(beam);
  const beamTop = new THREE.Mesh(P.slabGeometry(4.8, 19, 1.0, 0.3, 0.7), T.lo);
  beamTop.position.set(-5.5, 30, 0);
  base.add(beamTop);

  // the head: a block on two bearing arms with bushings riding the guide posts
  const head = new THREE.Group();
  const block = new THREE.Mesh(P.slabGeometry(9, 12, 5.4, 0.8, 1.1), T.hi);
  block.castShadow = true;
  head.add(block);
  for (const z of [-11, 11]) {
    const arm = new THREE.Mesh(P.slabGeometry(6.5, 3.4, 2.8, 0.45, 0.7), T.mid);
    arm.position.set(-2.8, 1.3, z);
    arm.castShadow = true;
    head.add(arm);
    const bush = P.bushing(head, 2.0, 3.6, T);
    bush.position.set(-5.5, 2.7, z);
  }
  // The die is graphite: the blue pencil belongs to the story line.
  const die = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 2.8, 22), T.hi);
  die.position.y = -3.8;
  die.castShadow = true;
  head.add(die);
  const dieRing = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.25, 6, 22), T.mid);
  dieRing.rotation.x = Math.PI / 2;
  dieRing.position.y = -2.6;
  head.add(dieRing);
  head.position.set(0, HEAD_UP, 0);
  base.add(head);

  // the key dial: a knurled knob with a pointer, on the far rail
  const dial = new THREE.Group();
  const plinth = new THREE.Mesh(P.slabGeometry(7, 5, 2.8, 0.6, 0.9), T.mid);
  plinth.castShadow = true;
  dial.add(plinth);
  const knob = P.knurledKnob(dial, 3.2, 2.6, T, 28);
  knob.position.set(0, 4.1, 0);
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 4.6), T.hi);
  pointer.position.set(0, 5.6, 1.6);
  pointer.castShadow = true;
  dial.add(pointer);
  dial.position.set(6, 2.8, 11);
  base.add(dial);

  // the return spring: it stands between the head and the beam, and stretches
  // as the head comes down
  const spring = P.coilSpring(base, 1.9, 8, 0.34, SPRING_LEN, T);
  spring.position.set(-5.5, HEAD_UP + 5.4, 0);

  group.position.set(-39, BENCH_TOP, -4);
  scene.add(group);
  return { group, head, dial, pointer, spring };
}
const press = makePress();

/* ---------------- the key boxes ---------------- */

// Where the private key lives: a chamfered box with a hinged lid, a brass
// latch and a key on a ring inside.
function makeKeyBox(x, z) {
  const group = new THREE.Group();
  contactShadow(group, 17, 13, 0.04, 0.65);

  const body = new THREE.Mesh(P.slabGeometry(14, 10, 6.8, 0.6, 1.3), T.hi);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const inner = new THREE.Mesh(P.slabGeometry(11.5, 7.5, 0.8, 0.3, 1), T.lo);
  inner.position.y = 6.3;
  group.add(inner);

  const lid = new THREE.Group();
  const lidMesh = new THREE.Mesh(P.slabGeometry(14, 10, 1.3, 0.45, 1.3), T.mid);
  lidMesh.position.set(0, 0, -4.8);
  lidMesh.castShadow = true;
  lid.add(lidMesh);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 12.4, 10), T.mid);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0.3, -5);
  lid.add(hinge);
  lid.position.set(0, 7.1, 4.9);
  group.add(lid);

  const latch = new THREE.Mesh(P.slabGeometry(3.2, 1.9, 2.4, 0.3, 0.5), T.brass);
  latch.position.set(0, 5.2, 5);
  latch.castShadow = true;
  group.add(latch);

  const key = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 7, 10), T.brass);
  shaft.rotation.z = Math.PI / 2;
  key.add(shaft);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.4, 6, 14), T.brass);
  bow.rotation.y = Math.PI / 2;
  bow.position.x = -4;
  key.add(bow);
  const bit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.5), T.brass);
  bit.position.set(3.2, -0.9, 0);
  key.add(bit);
  key.position.set(0, 7.6, 0);
  key.visible = false;
  group.add(key);

  group.position.set(x, BENCH_TOP, z);
  scene.add(group);
  return { group, lid, key };
}
const senderKey = makeKeyBox(-54, 14);
const recipientKey = makeKeyBox(39, 14);

/* ---------------- the server ---------------- */

// The public key plate, engraved.
const plate = new THREE.Group();
{
  contactShadow(plate, 21, 14, 0.04, 0.55);
  const plateMesh = new THREE.Mesh(P.slabGeometry(18, 11, 0.8, 0.25, 1), T.mid);
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
  g.globalAlpha = 0.65;
  g.fillText('SHA-256  9f2c…a41d', 182, 268);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const engraving = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 11),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.85 })
  );
  engraving.rotation.x = -Math.PI / 2;
  engraving.position.y = 0.85;
  // The engraving is ink on the plate, not a part: it takes no outline.
  engraving.userData.smooth = true;
  plate.add(engraving);
  P.screwCorners(plate, 18, 11, 0.8, T, 1.6, 0.7);
  plate.position.set(0, BENCH_TOP, 14);
  scene.add(plate);
}

// The hopper: the store. An open box with a rim, a chute lip and a card slot
// mounted on its back rim so the share record sits solidly on the machine.
const hopper = new THREE.Group();
{
  contactShadow(hopper, 33, 27, 0.04, 0.72);
  const walls = new THREE.Group();
  P.hopper(walls, 28, 22, 12, T);
  hopper.add(walls);

  // the chute lip the capsule comes in over
  const lip = new THREE.Mesh(P.slabGeometry(5, 20, 2.4, 0.5, 1), T.mid);
  lip.position.set(-14.5, 0, 0);
  lip.castShadow = true;
  lip.receiveShadow = true;
  hopper.add(lip);

  // the card slot resting on the back rim: the record of what is held
  const cardHolder = new THREE.Group();
  cardHolder.position.set(4, 12.8, -9.8);
  cardHolder.rotation.x = 0.35;
  const card = new THREE.Mesh(P.slabGeometry(13, 6.2, 0.45, 0.15, 0.5), T.paper);
  card.castShadow = true;
  cardHolder.add(card);
  const cardGeoms = [];
  for (let i = 0; i < 4; i++) {
    const line = new THREE.BoxGeometry(8.6 - i * 1.6, 0.1, 0.45);
    line.translate(-1.2, 0.45, -1.3 + i * 1.1);
    cardGeoms.push(line);
  }
  const cardLines = new THREE.Mesh(P.mergeGeometries(cardGeoms), T.lo);
  cardHolder.add(cardLines);
  hopper.add(cardHolder);

  hopper.position.set(0, BENCH_TOP, -4);
  scene.add(hopper);
}

// The capsules the server already holds, resting on the hopper floor.
const stored = [];
for (let i = 0; i < 3; i++) {
  const c = makeCapsule();
  c.scale.setScalar(0.56);
  c.position.set(-5.2 + i * 5.4, BENCH_TOP + 3.0 + i * 0.25, -7.2);
  c.rotation.y = 0.2 * i - 0.2;
  stored.push(c);
}

/* ---------------- the receiver tray ---------------- */

// Where the unwrapped file lands and is verified on the recipient's bench.
const receiverTray = new THREE.Group();
{
  contactShadow(receiverTray, 30, 26, 0.04, 0.65);
  P.receiverTray(receiverTray, 26, 22, T);
  receiverTray.position.set(49, BENCH_TOP, -4);
  scene.add(receiverTray);
}

/* ---------------- the pencil pass ---------------- */

// A drawn line has a hand in it. Coincident vertices share the same nudge so
// faces stay watertight, and tiny details take a gentler touch.
function roughen(root, amount = 0.16) {
  let seed = 20261115;
  const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  root.traverse((object) => {
    if (!object.isMesh || object.userData.smooth) return;
    const geo = object.geometry;
    const position = geo?.attributes?.position;
    if (!position) return;
    geo.computeBoundingBox();
    const size = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    const diag = size.length();
    if (diag < 3.2) return;
    const step = Math.min(amount, diag * 0.006);
    const offsets = new Map();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const key = `${Math.round(x * 200)},${Math.round(y * 200)},${Math.round(z * 200)}`;
      let d = offsets.get(key);
      if (!d) {
        d = [(random() - 0.5) * step, (random() - 0.5) * step, (random() - 0.5) * step];
        offsets.set(key, d);
      }
      position.setXYZ(i, x + d[0], y + d[1], z + d[2]);
    }
    position.needsUpdate = true;
    geo.computeVertexNormals();
  });
}

// The outline: each part is drawn over with its own edges in graphite. The
// edges ride on the part, so a head that moves is still drawn where it is.
function outline(root) {
  const material = new THREE.LineBasicMaterial({
    color: GRAPHITE,
    transparent: true,
    opacity: 0.82,
  });
  root.traverse((object) => {
    if (!object.isMesh || object.userData.smooth) return;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry, 28), material);
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
function addLabel(text, sub, kind, anchor, offset, align = 'above') {
  const el = document.createElement('div');
  el.className = `label label--${kind}`;
  el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
  labelLayer.appendChild(el);
  labels.push({ el, anchor, offset: offset || 0, align, visible: true });
  return el;
}

function marker(x, y, z) {
  const m = new THREE.Object3D();
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}

addLabel('Your browser', '', 'zone', marker(-47, 0, 29), 0, 'below');
addLabel('The server', '', 'zone', marker(0, 0, 29), 0, 'below');
addLabel('Their browser', '', 'zone', marker(47, 0, 29), 0, 'below');
const labelSheet = addLabel('the file, readable', 'it only exists here', 'key', sheet, 13);
const labelCapsule = addLabel('ciphertext', 'sealed, unreadable', 'key', capsule, 14);
addLabel('the private key', 'never leaves this device', 'key', senderKey.group, 11);
addLabel('the private key', 'never leaves this device', 'key', recipientKey.group, 11);
addLabel('the public key', 'the server holds this too', 'key', marker(0, BENCH_TOP + 0.6, 19), 0.4);
addLabel('the trust boundary', 'only ciphertext crosses this', 'wall', marker(-21, 16, -15), 2);
addLabel('the trust boundary', '', 'wall', marker(21, 16, -15), 2);

function placeLabels() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const padX = w < 640 ? 48 : 88;
  const topMin = w < 640 ? 54 : 64;
  const bottomMax = h - (w < 640 ? 94 : 74);
  const placed = [];

  for (const item of labels) {
    const p = new THREE.Vector3();
    item.anchor.getWorldPosition(p);
    p.y += item.offset;
    p.project(camera);
    const hidden = p.z > 1 || !item.visible;
    if (hidden) {
      item.el.style.opacity = '0';
      continue;
    }
    const rawX = (p.x * 0.5 + 0.5) * w;
    const rawY = (-p.y * 0.5 + 0.5) * h;
    const bw = item.el.offsetWidth || 80;
    const bh = item.el.offsetHeight || 24;
    const halfW = Math.min(bw / 2 + 6, w / 2 - 8);
    const x = Math.max(Math.max(padX * 0.5, halfW), Math.min(w - Math.max(padX * 0.5, halfW), rawX));
    const y = item.align === 'below'
      ? Math.max(topMin, Math.min(bottomMax - bh, rawY + 6))
      : Math.max(topMin + bh, Math.min(bottomMax, rawY));
    const top = item.align === 'below' ? y : y - bh;
    placed.push({ item, x, y, top, bottom: top + bh, left: x - bw / 2, right: x + bw / 2, bh });
  }

  // Push any colliding non-zone labels upward gently so text stays legible.
  placed.sort((a, b) => b.top - a.top);
  for (let i = 0; i < placed.length; i++) {
    const cur = placed[i];
    for (let j = 0; j < i; j++) {
      const other = placed[j];
      const overlapX = cur.left < other.right + 8 && cur.right + 8 > other.left;
      const overlapY = cur.top < other.bottom + 4 && cur.bottom + 4 > other.top;
      if (overlapX && overlapY) {
        const shift = cur.bottom - other.top + 4;
        cur.top -= shift;
        cur.bottom -= shift;
        cur.y -= shift;
      }
    }
  }

  for (const box of placed) {
    box.item.el.style.opacity = '1';
    const anchorY = box.item.align === 'below' ? '0%' : '-100%';
    box.item.el.style.transform = `translate(-50%, ${anchorY}) translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
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

const SHEET_START = -57;
const PRESS_X = -39;
const Z_PATH = -4;

function sheetX(t) {
  return SHEET_START + (PRESS_X - SHEET_START) * ease(span(t, 1.4, 2.8));
}
function capsuleX(t) {
  if (t < 3.0) return PRESS_X - 2;
  if (t < 5.4) return PRESS_X - 2 + (0 - (PRESS_X - 2)) * ease(span(t, 3.0, 5.4));
  if (t < 6.6) return 0;
  if (t < 9.4) return 39.5 * ease(span(t, 7.6, 9.4));
  return 39.5;
}
function capsuleY(t) {
  if (t < 5.4) return BENCH_TOP + 4.4;
  if (t < 6.6) return BENCH_TOP + 4.4 - 0.8 * ease(span(t, 5.4, 6.2));
  if (t < 7.6) return BENCH_TOP + 3.6;
  if (t < 9.4) return BENCH_TOP + 3.6 + 0.8 * ease(span(t, 7.6, 8.4));
  return BENCH_TOP + 4.4;
}

function update(t) {
  const time = t % 17;

  // the sheet is readable until the press closes on it, then again in the tray
  const sealing = span(time, 1.4, 2.8);
  const isSending = time < 3.0;
  const isOpen = time >= 10.2 && time < 14.2;
  sheet.visible = isSending || isOpen;
  if (isSending) {
    sheet.position.set(sheetX(time), BENCH_TOP + 0.08, Z_PATH);
    sheet.rotation.y = -0.05 * (1 - sealing);
  } else if (isOpen) {
    sheet.position.set(43 + 10.5 * ease(span(time, 10.2, 10.9)), BENCH_TOP + 2.1, Z_PATH);
    sheet.rotation.y = 0.04;
  }

  // the head comes down on the sheet, and the key dial turns with it
  const headDown = span(time, 2.5, 2.95);
  const headUp = time > 3.4 ? span(time, 3.4, 4.0) : 0;
  press.head.position.y = HEAD_UP - HEAD_STROKE * ease(headDown) + HEAD_STROKE * ease(headUp);
  press.dial.rotation.y = -ease(sealing) * Math.PI * 1.5;
  press.pointer.rotation.y = -ease(sealing) * Math.PI * 1.5;
  // the return spring stretches as the head comes down
  const springBottom = press.head.position.y + 5.4;
  press.spring.position.y = springBottom;
  press.spring.scale.y = (BEAM_UNDER - springBottom) / SPRING_LEN;

  // the capsule exists from the moment the seal closes
  capsule.visible = time >= 2.9 && time < 12.4;
  if (capsule.visible) {
    capsule.position.set(capsuleX(time), capsuleY(time), Z_PATH);
    capsule.rotation.y = time * 0.35;
    const tag = time > 3.4 && time < 9.6;
    wrappedKey.visible = tag;
    if (tag) {
      wrappedKey.position.set(capsule.position.x, capsule.position.y - 3.8, Z_PATH);
      wrappedKey.rotation.y = capsule.rotation.y;
    }
  }

  // keep the moving contact shadow directly beneath the active token
  if (capsule.visible) {
    movingShadow.visible = true;
    movingShadow.position.set(capsule.position.x, BENCH_TOP + 0.06, Z_PATH);
  } else if (sheet.visible) {
    movingShadow.visible = true;
    movingShadow.position.set(sheet.position.x, sheet.position.y + 0.02, Z_PATH);
  } else {
    movingShadow.visible = false;
  }

  // the recipient's key box opens when the capsule arrives
  const openAmount = ease(span(time, 9.6, 10.4));
  recipientKey.lid.rotation.x = -openAmount * 1.9;
  recipientKey.key.visible = openAmount > 0.05;
  recipientKey.key.position.y = 7.6 + openAmount * 2.8;
  recipientKey.key.rotation.y = openAmount * 0.8;

  if (time < 1.4) setStep(0);
  else if (time < 3.4) setStep(1);
  else if (time < 5.4) setStep(2);
  else if (time < 7.6) setStep(3);
  else if (time < 10.2) setStep(4);
  else setStep(5);

  labels[3].visible = sheet.visible;
  labels[4].visible = capsule.visible;
  updateStoryLine(time);
}

/* ---------------- the story line ---------------- */

// The route the file takes, drawn as one blue pencil stroke that grows as the
// file moves along it.
const ROUTE_STEP = 0.05;
const routePoints = [];
for (let t = 0; t <= 14.2; t += ROUTE_STEP) {
  let x;
  let y;
  if (t < 2.9) {
    x = sheetX(t);
    y = BENCH_TOP + 1.2;
  } else if (t < 10.2) {
    x = capsuleX(t);
    y = capsuleY(t);
  } else {
    x = 43 + 10.5 * ease(span(t, 10.2, 10.9));
    y = BENCH_TOP + 2.5;
  }
  routePoints.push(new THREE.Vector3(x, y, Z_PATH - 3.6));
}

// A smooth hand-drawn stroke in the plane of the paper.
function strokeGeometry(points, width) {
  const positions = [];
  const uvs = [];
  const indices = [];
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
    const half = width * (0.42 + 0.48 * (i / last));
    const wobble = (Math.sin(i * 0.34) * 0.6 + Math.cos(i * 0.16) * 0.4) * width * 0.22;
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

const routeGeometry = strokeGeometry(routePoints, 2.2);
const route = new THREE.Mesh(
  routeGeometry,
  new THREE.MeshBasicMaterial({
    color: PALETTE.lit,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  })
);
route.renderOrder = 6;
scene.add(route);

// The arrowhead: a blue pencil pyramid at the point of the stroke, always over
// the scene so the pen is never hidden behind the machine.
const arrowhead = new THREE.Mesh(
  new THREE.ConeGeometry(2.6, 7.0, 4),
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
  arrowhead.position.copy(point).addScaledVector(tangent, 3.0);
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

// Fit the full 3-station width on narrow or portrait screens while keeping
// the default desktop orbit close in, so the machine fills the frame.
function fitRadius(aspect) {
  if (aspect >= 1.35) return 165;
  const halfTan = Math.tan(THREE.MathUtils.degToRad(18));
  return Math.max(165, 72 / (halfTan * Math.max(0.42, aspect)));
}

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

  // The scene is a long table, so it is drawn from a corner: a straight-on
  // view would hide every part that has depth.
  const angle = BASE_ANGLE + dragX + (still ? 0 : Math.sin(t * 0.05) * 0.13);
  const radius = fitRadius(camera.aspect);
  const elev = radius > 200 ? 52 : 40;
  scene.fog.near = radius + 80;
  scene.fog.far = radius + 290;
  camera.position.set(Math.sin(angle) * radius, elev + dragY * 36, Math.cos(angle) * radius);
  camera.lookAt(0, 9, 0);

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
