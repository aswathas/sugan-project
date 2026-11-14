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

const stage = document.getElementById('stage');
const labelLayer = document.getElementById('labels');
const readout = document.getElementById('readout');
const stepBar = document.getElementById('steps');

const css = getComputedStyle(document.documentElement);
const tone = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);

const PAPER = tone('--paper', '#f2f2ef');
const INK = tone('--ink', '#26262a');
const MUTED = tone('--muted', '#8c8c90');
const RULE = tone('--rule', '#d4d4d6');
const FACE = tone('--face', '#ffffff');
const TOP = tone('--top', '#f7f7f4');
const SHADE = tone('--shade', '#dcdcd9');
const ACCENT = tone('--accent', '#3e63dd');

/* ---------------- the renderer ---------------- */

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAPER, 230, 420);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 600);
camera.position.set(0, 50, 168);
camera.lookAt(0, 7, 0);

/* ---------------- the light ---------------- */

const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.position.set(-60, 110, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 320;
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffffff, SHADE, 1.15));
const fill = new THREE.DirectionalLight(0xffffff, 0.5);
fill.position.set(90, 40, -60);
scene.add(fill);

/* ---------------- the materials ---------------- */

const paperMat = new THREE.MeshStandardMaterial({ color: FACE, roughness: 0.92, metalness: 0 });
const groundMat = new THREE.MeshStandardMaterial({ color: SHADE, roughness: 1, metalness: 0 });
const islandMat = new THREE.MeshStandardMaterial({ color: FACE, roughness: 0.88, metalness: 0 });
const inkMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.55, metalness: 0.15 });
const midMat = new THREE.MeshStandardMaterial({ color: MUTED, roughness: 0.6, metalness: 0.25 });
const ruleMat = new THREE.MeshStandardMaterial({ color: RULE, roughness: 0.9, metalness: 0 });
const accentMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.4, metalness: 0.2 });

/* ---------------- the textures ---------------- */

// A number the seed makes repeatable, so every reload draws the same scene.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// The readable sheet: a page of a document.
function sheetTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 340;
  const g = c.getContext('2d');
  g.fillStyle = FACE;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = INK;
  g.fillRect(36, 40, 210, 16);
  g.fillStyle = MUTED;
  const rand = seeded(7);
  for (let i = 0; i < 13; i++) {
    const y = 84 + i * 19;
    const w = 120 + Math.round(rand() * 300);
    g.fillStyle = i % 4 === 3 ? MUTED : INK;
    g.globalAlpha = i % 4 === 3 ? 0.35 : 0.72;
    g.fillRect(36, y, w, 7);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// The capsule: ciphertext, which is not readable.
function capsuleTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = INK;
  g.fillRect(0, 0, c.width, c.height);
  const rand = seeded(19);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * 32) * 8;
    const y = Math.floor(rand() * 16) * 8;
    g.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000';
    g.globalAlpha = 0.05 + rand() * 0.18;
    g.fillRect(x, y, 8, 8);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The public key plate: a key and a fingerprint, engraved.
function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#00000000';
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = INK;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(120, 160, 44, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(164, 160);
  g.lineTo(330, 160);
  g.stroke();
  g.beginPath();
  g.moveTo(300, 160);
  g.lineTo(300, 208);
  g.moveTo(334, 160);
  g.lineTo(334, 200);
  g.stroke();
  g.fillStyle = INK;
  g.font = '600 30px ui-monospace, Menlo, monospace';
  g.fillText('PUBLIC KEY', 176, 120);
  g.font = '22px ui-monospace, Menlo, monospace';
  g.globalAlpha = 0.6;
  g.fillText('SHA-256  9f2c…a41d', 176, 260);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------------- the parts ---------------- */

function box(w, h, d, material, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// The ground everything stands on.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 260), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// The three islands: the sender's browser, the server, the recipient's browser.
const ISLAND_Y = 2.2;
const senderIsland = box(78, ISLAND_Y, 46, islandMat, -62, ISLAND_Y / 2, 0);
const serverPlinth = box(56, ISLAND_Y, 46, islandMat, 0, ISLAND_Y / 2, 0);
const recipientIsland = box(78, ISLAND_Y, 46, islandMat, 62, ISLAND_Y / 2, 0);

// The trust boundary: a fence between each browser and the server.
// A hatch on the floor, so the boundary reads even where it is not drawn.
function hatchTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = INK;
  g.globalAlpha = 0.5;
  g.lineWidth = 5;
  for (let i = -64; i < 128; i += 16) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 64, 64);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 12);
  return tex;
}

function fence(x) {
  const group = new THREE.Group();
  const slatMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6, metalness: 0.2 });
  for (let z = -21; z <= 21; z += 6) {
    const slat = box(1.1, 15, 1.1, slatMat, 0, ISLAND_Y + 7.5, z, group);
    slat.castShadow = false;
  }
  const rail = box(1.5, 1.4, 48, inkMat, 0, ISLAND_Y + 14.6, 0, group);
  rail.castShadow = false;
  group.position.x = x;
  scene.add(group);

  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 46),
    new THREE.MeshStandardMaterial({ map: hatchTexture(), transparent: true, roughness: 1 })
  );
  band.rotation.x = -Math.PI / 2;
  band.position.set(x, 0.06, 0);
  scene.add(band);
  return group;
}
const fenceLeft = fence(-31);
const fenceRight = fence(31);

// The sheet: the file, readable.
const sheetMat = new THREE.MeshStandardMaterial({ map: sheetTexture(), roughness: 0.9, metalness: 0 });
const sheet = box(34, 0.9, 24, sheetMat, -92, ISLAND_Y + 0.45, 0);
sheet.rotation.y = -0.06;

// The capsule: the sealed file.
function makeCapsule() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: capsuleTexture(), roughness: 0.45, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 17, 20, 1, false), mat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(3.7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    cap.rotation.z = (side * Math.PI) / 2;
    cap.position.x = side * 8.5;
    cap.castShadow = true;
    group.add(cap);
  }
  // the band that holds it shut
  const band = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.5, 8, 24), accentMat);
  band.rotation.y = Math.PI / 2;
  band.castShadow = true;
  group.add(band);
  scene.add(group);
  return group;
}
const capsule = makeCapsule();
capsule.visible = false;

// The wrapped key: the tag that rides with the capsule.
const wrappedKey = box(11, 1.6, 8, midMat, 0, 0, 0);
wrappedKey.visible = false;

// The seal: the press that makes the capsule.
function makePress() {
  const group = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(5, 34, 5);
  for (const z of [-13, 13]) {
    const post = new THREE.Mesh(postGeo, midMat);
    post.position.set(0, 17, z);
    post.castShadow = true;
    group.add(post);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(11, 2.6, 11), ruleMat);
    foot.position.set(0, 1.3, z);
    foot.castShadow = true;
    group.add(foot);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 32), midMat);
  beam.position.set(0, 35, 0);
  beam.castShadow = true;
  group.add(beam);
  const head = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 11), inkMat);
  block.castShadow = true;
  head.add(block);
  const die = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 3, 20), accentMat);
  die.position.y = -4.5;
  die.castShadow = true;
  head.add(die);
  head.position.set(0, 27, 0);
  group.add(head);
  group.position.set(-62, ISLAND_Y, 0);
  scene.add(group);
  return { group, head };
}
const press = makePress();

// The key box: where the private key lives.
function makeKeyBox(x, z) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(17, 9, 13), inkMat);
  body.position.y = 4.5;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const lid = new THREE.Group();
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(17, 1.6, 13), midMat);
  lidMesh.position.set(0, 0, -6.4);
  lidMesh.castShadow = true;
  lid.add(lidMesh);
  lid.position.set(0, 9, 6.4);
  group.add(lid);
  const key = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 9, 12), accentMat);
  key.rotation.z = Math.PI / 2;
  key.position.set(0, 9.6, 0);
  key.visible = false;
  group.add(key);
  group.position.set(x, ISLAND_Y, z);
  scene.add(group);
  return { group, lid, key };
}
const senderKey = makeKeyBox(-72, 17);
const recipientKey = makeKeyBox(72, 17);

// The public key plate on the server.
const plateTex = plateTexture();
const plate = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 13),
  new THREE.MeshStandardMaterial({ map: plateTex, transparent: true, roughness: 0.7 })
);
plate.rotation.x = -Math.PI / 2;
plate.position.set(0, ISLAND_Y + 0.05, 15);
scene.add(plate);

// The hopper: the server's store, open at the top.
function makeHopper() {
  const group = new THREE.Group();
  const wallH = 15;
  const w = 44;
  const d = 30;
  const wall = (x, z, sw, sd) => {
    const m = box(sw, wallH, sd, midMat, x, wallH / 2, z, group);
    m.receiveShadow = true;
  };
  wall(0, -d / 2, w, 1.6);
  wall(-w / 2, 0, 1.6, d);
  wall(w / 2, 0, 1.6, d);
  const floor = box(w, 1.6, d, paperMat, 0, 0.8, 0, group);
  floor.receiveShadow = true;
  group.position.set(0, ISLAND_Y, 0);
  scene.add(group);
  return group;
}
const hopper = makeHopper();

// The capsules the server already holds.
const stored = [];
for (let i = 0; i < 3; i++) {
  const c = makeCapsule();
  c.scale.setScalar(0.82);
  c.position.set(-8 + i * 8, ISLAND_Y + 2.6 + i * 0.6, -6);
  c.rotation.y = 0.2 * i - 0.2;
  stored.push(c);
}

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

// A marker on the bench, so a label can sit where the drawing is clear.
function marker(x, y, z) {
  const m = new THREE.Object3D();
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}

const zoneSender = addLabel('Your browser', '', 'zone', marker(-62, ISLAND_Y, 25), 4);
const zoneServer = addLabel('The server', '', 'zone', marker(0, ISLAND_Y, 25), 4);
const zoneRecipient = addLabel("Their browser", '', 'zone', marker(62, ISLAND_Y, 25), 4);
const labelSheet = addLabel('the file, readable', 'it only exists here', 'key', sheet, 26);
const labelCapsule = addLabel('ciphertext', 'sealed, unreadable', 'key', capsule, 18);
const labelKeyBox = addLabel('the private key', 'never leaves this device', 'key', senderKey.group, 22);
const labelKeyBox2 = addLabel('the private key', 'never leaves this device', 'key', recipientKey.group, 22);
const labelPlate = addLabel('the public key', 'the server holds this too', 'key', plate, 20);
const labelWallL = addLabel('the trust boundary', 'only ciphertext crosses this', 'wall', marker(-31, ISLAND_Y, 25), 10);
const labelWallR = addLabel('the trust boundary', '', 'wall', marker(31, ISLAND_Y, 25), 10);

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
    const behind = p.z > 1;
    item.el.style.opacity = behind ? '0' : '1';
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
const stepEl = document.createElement('div');
stepEl.className = 'steps';
const stepMarks = STEPS.map(() => {
  const i = document.createElement('i');
  stepEl.appendChild(i);
  return i;
});
document.getElementById('steps').appendChild(stepEl);

const LOOP = 17;
let step = 0;
function setStep(index) {
  if (index === step) return;
  step = index;
  readout.innerHTML = `<em>${index + 1}/6</em> &nbsp;${STEPS[index]}`;
  stepMarks.forEach((mark, i) => mark.classList.toggle('on', i <= index));
}
setStep(0);

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const span = (t, from, to) => clamp01((t - from) / (to - from));

// Where things are at a point in the loop.
function sheetX(t) {
  return -92 + (-62 + 92) * ease(span(t, 1.4, 2.8));
}
function capsuleX(t) {
  if (t < 3.0) return -62;
  if (t < 5.4) return -62 + (0 + 62) * ease(span(t, 3.0, 5.4));
  if (t < 6.6) return 0;
  if (t < 9.4) return 0 + (56 - 0) * ease(span(t, 7.6, 9.4));
  return 56;
}
function capsuleY(t) {
  if (t < 5.4) return ISLAND_Y + 4.6;
  if (t < 6.6) return ISLAND_Y + 4.6 - (4.6 - 2.6) * ease(span(t, 5.4, 6.2));
  if (t < 7.6) return ISLAND_Y + 2.6;
  if (t < 9.4) return ISLAND_Y + 2.6 + 2 * ease(span(t, 7.6, 8.4));
  return ISLAND_Y + 4.6;
}

let sealed = false;
let opened = false;

function update(t) {
  const time = t % LOOP;

  // The sheet is readable until the press closes on it.
  const sealing = span(time, 1.4, 2.8);
  sheet.visible = time < 3.0;
  if (sheet.visible) {
    sheet.position.x = sheetX(time);
    sheet.position.y = ISLAND_Y + 0.45;
    sheet.rotation.z = -0.05 * (1 - sealing);
  }

  // The press head comes down while the sheet is under it.
  const headDown = span(time, 2.2, 2.7);
  press.head.position.y = 27 - 8 * ease(headDown) + (time > 3 ? 8 * ease(span(time, 3.0, 3.6)) : 0);

  // The capsule exists from the moment the seal closes.
  const isSealed = time >= 2.9 && time < 12.4;
  if (isSealed !== sealed) {
    sealed = isSealed;
    capsule.visible = sealed;
    wrappedKey.visible = sealed && time > 3.4;
  }
  if (capsule.visible) {
    capsule.position.set(capsuleX(time), capsuleY(time), 0);
    capsule.rotation.y = time * 0.35;
    const tag = time > 3.4 && time < 9.6;
    wrappedKey.visible = tag;
    if (tag) {
      wrappedKey.position.set(capsule.position.x, capsule.position.y - 5.4, 0);
      wrappedKey.rotation.y = capsule.rotation.y;
    }
  }

  // The recipient's key box opens when the capsule arrives.
  const openAmount = ease(span(time, 9.6, 10.4));
  recipientKey.lid.rotation.x = -openAmount * 1.9;
  recipientKey.key.visible = openAmount > 0.05;
  recipientKey.key.position.y = 9.6 + openAmount * 3;
  senderKey.lid.rotation.x = -0.25;

  // At the end the capsule opens into a readable sheet again.
  const isOpen = time >= 10.2 && time < 14.2;
  if (isOpen !== opened) {
    opened = isOpen;
    sheet.visible = isOpen;
  }
  if (isOpen) {
    sheet.position.x = 56 + 10 * ease(span(time, 10.2, 10.9));
    sheet.position.y = ISLAND_Y + 0.45;
    sheet.rotation.y = 0.05;
  }

  // The readout follows the machine.
  if (time < 1.4) setStep(0);
  else if (time < 3.4) setStep(1);
  else if (time < 5.4) setStep(2);
  else if (time < 7.6) setStep(3);
  else if (time < 10.2) setStep(4);
  else setStep(5);

  labelSheet.style.opacity = sheet.visible ? '1' : '0';
  labelCapsule.style.opacity = capsule.visible ? '1' : '0';
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
  dragX += (event.clientX - lastX) * 0.006;
  dragY = Math.max(-0.5, Math.min(0.7, dragY + (event.clientY - lastY) * 0.004));
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

  const angle = dragX + (still ? 0 : Math.sin(t * 0.06) * 0.16);
  const radius = 168;
  camera.position.set(Math.sin(angle) * radius, 50 + dragY * 44, Math.cos(angle) * radius);
  camera.lookAt(0, 7, 0);

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
