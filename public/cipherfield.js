'use strict';

// The cipher field: the anatomy's one live piece. A WebGL canvas draws the
// file crossing from ordered bytes to random ones, and the numbers under it
// are the ones this browser really produced a moment earlier - the same
// Web Crypto API the product uses, on a sample payload.
//
// The drawing is decoration; the bytes are not. If WebGL is missing the
// canvas is dropped and the real ciphertext is still shown.

const VERTEX = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_progress;
uniform float u_seed;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float cols = 128.0;
  vec2 g = vec2(floor(uv.x * cols), 0.0);

  // The wave starts at the left and travels right. Behind it the bytes have
  // been encrypted and are random; ahead of it they are still ordered.
  float plain = 0.42 + 0.34 * sin(g.x * 0.22 + 0.6);
  float cipher = hash(g.x * 1.7 + u_seed);
  float edge = u_progress;
  float done = smoothstep(edge + 0.02, edge - 0.02, uv.x);
  float height = mix(plain, cipher, done);

  float base = 0.12;
  float top = base + 0.74 * height;
  float within = fract(uv.x * cols);
  float stroke = step(0.24, within) * step(within, 0.76);
  float bar = step(uv.y, top) * stroke;

  vec3 paper = vec3(0.949, 0.953, 0.961);
  vec3 ink = vec3(0.109, 0.118, 0.157);
  vec3 cobalt = vec3(0.180, 0.310, 0.847);
  vec3 amber = vec3(0.851, 0.635, 0.169);

  vec3 col = paper;
  col = mix(col, mix(ink, cobalt, done), bar);

  // The sweep itself, in amber, and the baseline the bars stand on.
  float sweep = smoothstep(0.009, 0.0, abs(uv.x - edge));
  col = mix(col, amber, sweep);
  float rule = smoothstep(0.004, 0.0, abs(uv.y - base));
  col = mix(col, ink, rule * 0.55);

  // A hairline every sixteen strokes, so the field reads as a grid and not a blur.
  float column = smoothstep(0.0025, 0.0, abs(fract(uv.x * 8.0) - 0.5) - 0.498);
  col = mix(col, ink, column * 0.12);

  gl_FragColor = vec4(col, 1.0);
}
`;

const SAMPLE = 'SecureShare demo payload: the file never leaves the browser.';

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

// Shorten on a byte boundary, so a cut hex string is still whole bytes.
function shortenHex(bytes, limit) {
  const pairs = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  const kept = [];
  for (const pair of pairs) {
    if (kept.join(' ').length + (kept.length ? 1 : 0) + pair.length > limit) break;
    kept.push(pair);
  }
  return kept.join(' ') + (kept.length < pairs.length ? ' …' : '');
}

// The real work: a fresh AES-GCM key and IV, the ciphertext, and the SHA-256
// of the plaintext, all in this browser.
async function encryptSample() {
  const plain = new TextEncoder().encode(SAMPLE);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', plain));
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return { plain, digest, ciphertext, iv };
}

function buildProgram(gl) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  return program;
}

function mount(container) {
  if (!container) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'cipher-field__canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'A drawing of the file crossing from ordered bytes on the left to random bytes on the right, with the real ciphertext below.'
  );
  const frame = document.createElement('div');
  frame.className = 'cipher-field';
  frame.append(canvas);

  const readout = document.createElement('dl');
  readout.className = 'cipher-field__readout';
  const rows = ['plaintext', 'ciphertext', 'sha-256'];
  const cells = {};
  for (const name of rows) {
    const row = document.createElement('div');
    row.className = 'cipher-field__row';
    const dt = document.createElement('dt');
    dt.textContent = name;
    const dd = document.createElement('dd');
    dd.textContent = '…';
    row.append(dt, dd);
    readout.append(row);
    cells[name] = dd;
  }

  const foot = document.createElement('div');
  foot.className = 'cipher-field__foot';
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = 'Produced by this browser with the Web Crypto API, just now.';
  const again = document.createElement('button');
  again.className = 'btn btn--small';
  again.type = 'button';
  again.textContent = 'Run it again';
  foot.append(note, again);

  container.append(frame, readout, foot);

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  const program = gl ? buildProgram(gl) : null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let buffer = null;
  let progress = 0;
  let frameId = 0;
  let seed = Math.random() * 100;
  let visible = true;

  if (program) {
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_pos');
    gl.useProgram(program);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  }

  const draw = () => {
    if (!program) return;
    if (!canvas.clientWidth) return; // hidden: nothing to draw on yet
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(gl.getUniformLocation(program, 'u_res'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(program, 'u_progress'), progress);
    gl.uniform1f(gl.getUniformLocation(program, 'u_seed'), seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const run = async () => {
    const result = await encryptSample();
    cells.plaintext.textContent = shortenHex(result.plain, 72);
    cells.ciphertext.textContent = shortenHex(result.ciphertext, 72);
    cells['sha-256'].textContent = toHex(result.digest);

    if (!program) return;
    seed = Math.random() * 100;
    progress = reduced ? 1 : 0;
    if (reduced) {
      draw();
      return;
    }
    const started = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - started) / 2200);
      progress = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
      draw();
      if (t < 1) frameId = requestAnimationFrame(step);
    };
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(step);
  };

  again.addEventListener('click', run);

  // The drawing stops when it is off the screen, so a long read of the page
  // does not keep a GPU busy.
  if ('IntersectionObserver' in window && program) {
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) draw();
    });
    observer.observe(canvas);
  }

  run();
  return { canvas, run };
}

window.CipherField = { mount };
