'use strict';
// Builds the REVIEW-3 deck (pptx) for the SecureShare project.
//
//   node tools/build-deck.js
//
// The deck follows the client's reference deck section for section. The visual
// language is the Wayfind world the application itself uses: paper, blue-black
// ink, cobalt for what is live, amber for figures, and one monospace face.

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const ROOT = path.resolve(__dirname, '..');
const FIGURES = path.join(ROOT, 'docs', 'figures', 'png');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const OUT = path.join(ROOT, 'report', 'SecureShare-REVIEW-3.pptx');

const PAPER = 'F2F3F5';
const PAPER2 = 'E4E6EA';
const PAPER3 = 'FCFCFD';
const INK = '1C1E28';
const INK2 = '3C3F4E';
const MUTED = '737889';
const ACCENT = '2E4FD8';
const AMBER = 'D9A22B';
const RULE = 'C7CAD2';
const FONT = 'Consolas';

const W = 13.333;
const H = 7.5;

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Pradeesh M, Varun P R, Sugandhan A';
pptx.company = '21ECC402P Computer Communication and Network Security';
pptx.title = 'Secure File Sharing System Using End-to-End Encryption and Access Control';

function inkSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: INK };
  return slide;
}

function paperSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: PAPER };
  return slide;
}

function tab(slide, text, x, y) {
  slide.addText(text, {
    x, y, w: 2.6, h: 0.32,
    fontFace: FONT, fontSize: 11, bold: true, color: PAPER,
    fill: { color: INK }, margin: 0, valign: 'middle', align: 'left',
  });
}

function slideTitle(slide, text) {
  slide.addText(text, {
    x: 0.75, y: 0.55, w: W - 1.5, h: 0.85,
    fontFace: FONT, fontSize: 30, bold: true, color: INK,
    margin: 0, valign: 'middle', charSpacing: -0.5,
  });
}

function caption(slide, text, x, y, w) {
  slide.addText(text, {
    x, y, w, h: 0.4,
    fontFace: FONT, fontSize: 11, color: MUTED, margin: 0, valign: 'top',
  });
}

function bullets(slide, items, options) {
  const rows = items.map((text, index) => ({
    text,
    options: { bullet: { code: '25AA', indent: 14 }, breakLine: index !== items.length - 1 },
  }));
  slide.addText(rows, {
    fontFace: FONT, fontSize: options.fontSize || 14, color: options.color || INK2,
    x: options.x, y: options.y, w: options.w, h: options.h,
    lineSpacingMultiple: 1.25, paraSpaceAfter: 10, margin: 0, valign: 'top',
  });
}

function stat(slide, figure, label, x, y, w, h) {
  slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: INK }, line: { color: INK, width: 2 } });
  slide.addText(figure, {
    x: x + 0.2, y: y + 0.18, w: w - 0.4, h: h * 0.55,
    fontFace: FONT, fontSize: 30, bold: true, color: AMBER, margin: 0, valign: 'middle',
  });
  slide.addText(label, {
    x: x + 0.2, y: y + h * 0.6, w: w - 0.4, h: h * 0.32,
    fontFace: FONT, fontSize: 11, color: PAPER, margin: 0, valign: 'top',
  });
}

function table(slide, rows, x, y, w, colWidths, fontSize) {
  const head = rows[0].map((cell) => ({
    text: cell,
    options: { bold: true, color: INK, fill: { color: PAPER2 }, fontSize: fontSize || 10 },
  }));
  const body = rows.slice(1).map((row) =>
    row.map((cell) => ({ text: cell, options: { color: INK2, fontSize: fontSize || 10 } }))
  );
  slide.addTable([head, ...body], {
    x, y, w, colWidths,
    fontFace: FONT,
    border: { type: 'solid', color: RULE, pt: 0.75 },
    valign: 'top',
    margin: 0.06,
    autoPage: false,
  });
}

/* ---------------- 1. title ---------------- */
{
  const SERIF = 'Times New Roman';
  const BLACK = '000000';
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  slide.addText('21ECC402P – COMPUTER COMMUNICATION AND NETWORK\nSECURITY', {
    x: 1.4, y: 0.35, w: 9.9, h: 0.95,
    fontFace: SERIF, fontSize: 21, bold: true, color: BLACK,
    align: 'center', valign: 'top', lineSpacingMultiple: 1.2, margin: 0,
  });

  slide.addImage({
    path: path.join(ROOT, 'docs', 'brand', 'srm-logo.jpeg'),
    x: 11.48, y: 0.14, w: 1.7, h: 0.77,
  });

  slide.addText([{ text: 'REVIEW - 3', options: { underline: true } }], {
    x: 0.75, y: 1.7, w: W - 1.5, h: 0.6,
    fontFace: SERIF, fontSize: 26, bold: true, color: BLACK,
    align: 'center', valign: 'middle', margin: 0,
  });

  slide.addText(
    [
      { text: 'SECURE FILE SHARING SYSTEM USING END-TO-END\n', options: { underline: true } },
      { text: 'ENCRYPTION AND ACCESS CONTROL', options: { underline: true } },
    ],
    {
      x: 0.75, y: 2.65, w: W - 1.5, h: 1.2,
      fontFace: SERIF, fontSize: 26, bold: true, color: BLACK,
      align: 'center', valign: 'middle', lineSpacingMultiple: 1.2, margin: 0,
    }
  );

  slide.addText('By', {
    x: 0.75, y: 4.3, w: W - 1.5, h: 0.45,
    fontFace: SERIF, fontSize: 18, italic: true, color: BLACK,
    align: 'center', valign: 'middle', margin: 0,
  });

  const team = [
    ['1. PRADEESH M', '-RA2311004010278'],
    ['2. VARUN P R', '-RA2311004010287'],
    ['3. SUGANDHAN A', '-RA2311004010297'],
  ];
  team.forEach(([name, reg], index) => {
    const y = 5.0 + index * 0.48;
    slide.addText(name, {
      x: 1.4, y, w: 6.0, h: 0.44,
      fontFace: SERIF, fontSize: 22, color: BLACK, margin: 0, valign: 'middle',
    });
    slide.addText(reg, {
      x: 7.75, y, w: 4.2, h: 0.44,
      fontFace: SERIF, fontSize: 22, color: BLACK, margin: 0, valign: 'middle',
    });
  });

  slide.addText('1', {
    x: 11.5, y: 7.0, w: 0.85, h: 0.32,
    fontFace: SERIF, fontSize: 12, bold: true, color: BLACK,
    align: 'right', valign: 'bottom', margin: 0,
  });
}

/* ---------------- 2. outline ---------------- */
{
  const slide = paperSlide();
  slideTitle(slide, 'Presentation outline');
  const items = [
    'Introduction',
    'Abstract',
    'Literature survey',
    'Objectives',
    'Proposed system model',
    'Working principle',
    'Tools used',
    'Conclusion',
    'Timeline',
  ];
  items.forEach((item, index) => {
    const y = 1.75 + index * 0.55;
    slide.addShape(pptx.ShapeType.rect, { x: 0.95, y, w: 0.42, h: 0.42, fill: { color: index < 3 ? ACCENT : INK } });
    slide.addText(String(index + 1), {
      x: 0.95, y, w: 0.42, h: 0.42,
      fontFace: FONT, fontSize: 13, bold: true, color: PAPER, align: 'center', valign: 'middle', margin: 0,
    });
    slide.addText(item, {
      x: 1.55, y, w: 5.2, h: 0.42,
      fontFace: FONT, fontSize: 15, color: INK, margin: 0, valign: 'middle',
    });
  });
  slide.addText('The same nine sections carry the report, so anything asked here is answered there with the same figures and the same numbers.', {
    x: 7.4, y: 2.4, w: 5, h: 2.4,
    fontFace: FONT, fontSize: 14, color: INK2, margin: 0, lineSpacingMultiple: 1.3,
  });
  slide.addShape(pptx.ShapeType.rect, { x: 7.4, y: 4.95, w: 5, h: 0.06, fill: { color: PAPER2 } });
  slide.addText('Live prototype, private GitHub repository, full report.', {
    x: 7.4, y: 5.15, w: 5, h: 0.5,
    fontFace: FONT, fontSize: 13, color: MUTED, margin: 0,
  });
}

/* ---------------- 3. introduction ---------------- */
{
  const slide = paperSlide();
  slideTitle(slide, 'Introduction');
  bullets(
    slide,
    [
      'Conventional file-sharing systems expose sensitive files during transmission and while they sit on the server.',
      'A secure sharing mechanism must protect confidentiality and integrity while letting only the intended recipient read the file.',
      'This project proposes a web-based file-sharing system that combines end-to-end encryption, user authentication and sender-controlled access control.',
      'Every cryptographic operation happens in the browser, so the server stores ciphertext and nothing else.',
    ],
    { x: 0.9, y: 1.85, w: 7.3, h: 3.6, fontSize: 14 }
  );
  stat(slide, '0', 'bytes of plaintext on the server', 8.7, 1.85, 3.7, 1.5);
  stat(slide, '1', 'file key per share, wrapped to the recipient', 8.7, 3.55, 3.7, 1.5);
  slide.addShape(pptx.ShapeType.rect, { x: 8.7, y: 5.25, w: 3.7, h: 1.5, fill: { color: PAPER3 }, line: { color: INK, width: 2 } });
  slide.addText('The private key is generated in the browser at registration and never leaves the device that made it.', {
    x: 8.9, y: 5.45, w: 3.3, h: 1.1,
    fontFace: FONT, fontSize: 12, color: INK2, margin: 0, lineSpacingMultiple: 1.2,
  });
}

/* ---------------- 4. abstract ---------------- */
{
  const slide = paperSlide();
  slideTitle(slide, 'Abstract');
  bullets(
    slide,
    [
      'SecureShare is a web system for handing a file to one person while keeping it unreadable to everyone else, including the storage server.',
      'At registration the browser generates an RSA-OAEP 2048-bit key pair; the private key is non-extractable and stays in IndexedDB.',
      'Each share gets a fresh AES-GCM 256-bit key and a random 96-bit IV; the file key is wrapped with the recipient’s public key.',
      'Authentication is a Google sign-in verified on the server against Google’s published keys, with an email one-time code as the offline path.',
      'The sender sets the permission and a self-destruct timer, and can call the share off before it is opened.',
      'The implementation uses only Node.js built-in modules and vanilla browser JavaScript, so it installs nothing and costs nothing to run.',
    ],
    { x: 0.9, y: 1.8, w: 7.6, h: 4.6, fontSize: 13 }
  );
  slide.addImage({ path: path.join(SHOTS, '04-inbox.png'), x: 8.75, y: 1.85, w: 3.85, h: 2.71 });
  caption(slide, 'The recipient’s dashboard: a share that has not been opened yet carries the live mark.', 8.75, 4.62, 3.85);
  slide.addShape(pptx.ShapeType.rect, { x: 8.75, y: 5.25, w: 3.85, h: 1.35, fill: { color: INK } });
  slide.addText('Verified in two layers: 18 checks in the Node suite and 9 checks in a headless Chrome test that drives the real interface in two separate browser profiles.', {
    x: 8.95, y: 5.42, w: 3.45, h: 1.05,
    fontFace: FONT, fontSize: 11, color: PAPER, margin: 0, lineSpacingMultiple: 1.15,
  });
}

/* ---------------- 5-7. literature survey ---------------- */
const papers = [
  ['1', 'Secure Remote Cloud File Sharing With Attribute-Based Access Control and Performance Optimization', 'E. Chen, Y. Zhu, K. Liang, H. Yin, IEEE TCC, 2023', 'ABAC with XACML and CP-ABE', 'Policy-matrix size, not the cipher, is the real bottleneck'],
  ['2', 'How to Implement Secure Cloud File Sharing Using Optimized ABAC with Small Policy Matrix and Minimized Cumulative Errors', 'E. Chen, Y. Zhu, G. Zhu, K. Liang, R. Feng, Computers & Security, 2021', 'ABAC with XACML and lattice CP-ABE', 'Better policy efficiency at the cost of advanced cryptography'],
  ['3', 'Secure cloud file sharing scheme using blockchain and attribute-based encryption', 'M. Almasian, A. Shafieinejad, Computer Standards & Interfaces, 2024', 'Blockchain smart contract with ABE', 'Fast revocation and auditable access; infrastructure complexity'],
  ['4', 'Attribute-based cloud storage with secure provenance over encrypted data', 'H. Cui, R. H. Deng, Y. Li, Future Generation Computer Systems, 2018', 'Encryption, fine-grained access control, provenance', 'Traceability and provenance increase system complexity'],
  ['5', 'Decentralized Secure Data Sharing with Attribute-Based Encryption: A Resource Consumption Analysis', 'H. Kuehner, H. Hartenstein, ACM SCC, 2016', 'ABE-based secure data sharing', 'Large-group key management does not fit a mobile budget'],
  ['6', 'Efficient Lattice-Based Revocable ABE Against Decryption Key Exposure for Cloud File Sharing', 'B. Huang, J. Gao, X. Li, Journal of Cloud Computing, 2023', 'Ring-LWE CP-ABE with revocation', 'Post-quantum CP-ABE is practical; multi-authority is costly'],
  ['7', 'Client-side Encryption for Privacy-sensitive Applications on the Cloud', 'S. M. P. C. Souza, R. Puttini, Procedia Computer Science, 2016', 'Homomorphic and order-preserving encryption', 'Client-side encryption costs server-side functionality'],
  ['8', 'Web Cryptography API: Prevalence and Possible Developer Mistakes', 'P. Wichmann, M. Blochberger, H. Federrath, ARES 2022', 'Empirical study of Web Crypto API use and misuse', 'Browser cryptography is real but easy to misuse'],
  ['9', 'Towards Enabling Secure Web-Based Cloud Services using Client-Side Encryption', 'M. Johns, A. Dirksen, ACM CCSW 2020', 'CryptoMembranes: isolated native client components', 'In a web app the client is the attacker’s target'],
  ['10', 'OmniShare: Encrypted Cloud Storage for the Multi-Device Era', 'A. Paverd et al., IEEE Internet Computing, 2018', 'Client-side encryption with out-of-band enrolment', 'Key distribution is the blocker, not the cipher'],
  ['11', 'Design and Optimization of Hybrid End-to-end Encryption for a Secure Web Application System', 'X. Ma, J. Hur, M. Gu, N. Du, Journal of Web Engineering, 2025', 'ECDH and HKDF key derivation with AES-GCM', 'Hybrid end-to-end encryption in the browser is practical'],
  ['12', 'Securing End-to-End Encrypted File Sharing Services With the Messaging Layer Security Protocol', 'R. Helmich, L. Braubach, Concurrency and Computation, 2025', 'MLS group key exchange with attribute-based access control', 'End-to-end sharing survives a fully compromised server'],
];

for (let slideIndex = 0; slideIndex < 3; slideIndex += 1) {
  const slide = paperSlide();
  slideTitle(slide, slideIndex === 0 ? 'Literature survey (1 of 3)' : slideIndex === 1 ? 'Literature survey (2 of 3)' : 'Literature survey (3 of 3)');
  const slice = papers.slice(slideIndex * 4, slideIndex * 4 + 4);
  table(
    slide,
    [['S.No', 'Title of paper', 'Paper details', 'Methodology', 'Inference'], ...slice.map((p) => [p[0], p[1], p[2], p[3], p[4]])],
    0.75, 1.7, 11.9, [0.6, 3.5, 2.6, 2.4, 2.8],
    9
  );
  if (slideIndex === 2) {
    slide.addText('Every citation above was checked against Crossref, OpenAlex, DBLP and Semantic Scholar. Two titles in the earlier reference were corrected: a truncated title and a venue listed as "Peer-Reviewed Research".', {
      x: 0.75, y: 6.35, w: 11.9, h: 0.6,
      fontFace: FONT, fontSize: 11, color: MUTED, margin: 0,
    });
  }
}

/* ---------------- 8. objectives ---------------- */
{
  const slide = paperSlide();
  slideTitle(slide, 'Objectives');
  bullets(
    slide,
    [
      'To develop a web-based file-sharing system that supports file uploading, sharing and downloading.',
      'To implement user authentication and sender-controlled access control for secure file access.',
      'To integrate end-to-end encryption so that the storage server cannot read the original content.',
      'To implement secure key management so that private keys never leave the user’s device.',
      'To add a self-destruct timer, revocation, an end-to-end integrity check and an audit trail.',
      'To validate the main workflows of the prototype, including the unauthorised-access scenario.',
    ],
    { x: 0.9, y: 1.85, w: 7.5, h: 3.9, fontSize: 14 }
  );
  slide.addImage({ path: path.join(FIGURES, '01-architecture.png'), x: 8.7, y: 1.9, w: 3.9, h: 2.19 });
  caption(slide, 'Figure 3.1 Logical architecture of the proposed secure file-sharing system', 8.7, 4.16, 3.9);
  slide.addShape(pptx.ShapeType.rect, { x: 8.7, y: 4.75, w: 3.9, h: 1.6, fill: { color: PAPER3 }, line: { color: INK, width: 2 } });
  slide.addText('The private key and the plaintext file never cross the browser boundary. The server is a relay.', {
    x: 8.9, y: 4.95, w: 3.5, h: 1.2,
    fontFace: FONT, fontSize: 12, color: INK2, margin: 0, lineSpacingMultiple: 1.2,
  });
}

/* ---------------- 9-11. model figures ---------------- */
const modelSlides = [
  ['02-without-e2ee.png', 'Without end-to-end encryption', 'Figure 2.1 The conventional file-sharing model, in which the server can read the file'],
  ['03-e2ee.png', 'End-to-end encryption', 'Figure 2.2 How one share is encrypted, wrapped and delivered'],
  ['04-with-e2ee.png', 'With end-to-end encryption', 'Figure 2.3 The proposed model, in which the server holds ciphertext only'],
];
for (const [file, title, cap] of modelSlides) {
  const slide = paperSlide();
  slideTitle(slide, title);
  slide.addImage({ path: path.join(FIGURES, file), x: 1.6, y: 1.7, w: 10.1, h: 5.08 });
  caption(slide, cap, 1.6, 6.85, 10.1);
}

/* ---------------- 12. working principle ---------------- */
{
  const slide = paperSlide();
  slideTitle(slide, 'Working principle');
  const steps = [
    'User authentication',
    'File selection and upload',
    'Client-side encryption',
    'Authorised sharing',
    'Secure transmission',
    'Recipient authentication',
    'Decryption and file access',
  ];
  steps.forEach((step, index) => {
    const y = 1.75 + index * 0.62;
    slide.addShape(pptx.ShapeType.rect, { x: 0.9, y, w: 0.42, h: 0.42, fill: { color: INK } });
    slide.addText(String(index + 1), {
      x: 0.9, y, w: 0.42, h: 0.42,
      fontFace: FONT, fontSize: 13, bold: true, color: PAPER, align: 'center', valign: 'middle', margin: 0,
    });
    slide.addText(step, {
      x: 1.5, y, w: 3.4, h: 0.42,
      fontFace: FONT, fontSize: 13, color: INK, margin: 0, valign: 'middle',
    });
  });
  slide.addImage({ path: path.join(FIGURES, '05-working-principle.png'), x: 5.35, y: 1.8, w: 7.3, h: 4.11 });
  caption(slide, 'Figure 2.4 The seven steps, coloured by where each one runs', 5.35, 6.05, 7.3);
  slide.addText('Steps 1 to 4 and 6 to 7 run in a browser. Step 5 is the only one the server sees, and it carries ciphertext.', {
    x: 5.35, y: 6.45, w: 7.3, h: 0.5,
    fontFace: FONT, fontSize: 12, color: MUTED, margin: 0,
  });
}

/* ---------------- 13. what the prototype now does ---------------- */
{
  const slide = paperSlide();
  slideTitle(slide, 'What the prototype now does');
  bullets(
    slide,
    [
      'A dashboard in the shape of a file drive: shared with me, sent by me, recent, a search box and a card per file.',
      'Google sign-in, with the identity token verified on the server against Google’s published keys.',
      'A self-destruct timer on every share; when the time is up the server gives up the bytes.',
      'Revocation: the sender can call a share off before the recipient opens it.',
      'An end-to-end integrity check: the sender’s SHA-256 fingerprint of the file, recomputed after decryption.',
      'An audit trail whose entries are chained by hash, so an edited entry breaks the chain.',
      'Hardening: a content security policy, a lockout after repeated failed sign-ins, and sign-out everywhere.',
    ],
    { x: 0.9, y: 1.8, w: 7.3, h: 4.7, fontSize: 13 }
  );
  slide.addImage({ path: path.join(SHOTS, '03-sent.png'), x: 8.6, y: 1.85, w: 3.95, h: 2.52 });
  caption(slide, 'After a send: the file’s own first bytes next to the bytes the server holds.', 8.6, 4.45, 3.95);
  slide.addShape(pptx.ShapeType.rect, { x: 8.6, y: 5.05, w: 3.95, h: 1.55, fill: { color: INK } });
  slide.addText('The two byte strings are never the same. That is the proof, on screen, that the server stores ciphertext and not the file.', {
    x: 8.8, y: 5.25, w: 3.55, h: 1.2,
    fontFace: FONT, fontSize: 11, color: PAPER, margin: 0, lineSpacingMultiple: 1.2,
  });
}

/* ---------------- 14. tools used ---------------- */
{
  const slide = paperSlide();
  slideTitle(slide, 'Tools used');
  table(
    slide,
    [
      ['Software / technology', 'Purpose'],
      ['Node.js node:http and node:crypto', 'Server, password hashing, session tokens and the hash-chained audit trail; no framework and no package'],
      ['Web Cryptography API', 'RSA-OAEP key pairs, AES-GCM encryption and SHA-256 fingerprints, in the browser'],
      ['Google Identity Services and the JWKS', 'Sign-in by Google; the identity token is verified on the server with node:crypto'],
      ['IndexedDB', 'Non-extractable private key, stored on the user’s own device'],
      ['JSON store and blob directory', 'Accounts, share metadata and ciphertext on disk'],
      ['Vanilla JavaScript front end', 'Register, verify, send, open; a dashboard, no build step'],
      ['Headless Chrome over the DevTools protocol', 'Automated verification of the real interface in two profiles'],
      ['Git and GitHub', 'Version control and the public repository'],
    ],
    0.9, 1.8, 11.6, [4.6, 7.0], 11
  );
  slide.addText('No paid service, no dependency to install and no network access is required for the demonstration.', {
    x: 0.9, y: 6.5, w: 11.6, h: 0.4,
    fontFace: FONT, fontSize: 12, color: MUTED, margin: 0,
  });
}

/* ---------------- 14. conclusions ---------------- */
{
  const slide = paperSlide();
  slideTitle(slide, 'Conclusions');
  bullets(
    slide,
    [
      'The proposed system provides a web-based file-sharing platform that supports uploading, sharing and downloading between users.',
      'Authentication and sender-controlled access control ensure that only the intended recipient can open a shared file.',
      'End-to-end encryption protects confidentiality by encrypting files before transmission, so the storage server cannot read them.',
      'Key management keeps the private key on the device, so a compromise of the server does not compromise the files.',
      'A self-destruct timer, revocation, an integrity fingerprint and a tamper-evident audit trail now guard each share.',
      'The prototype is a practical, free system that runs on any laptop with no installation and no paid service.',
    ],
    { x: 0.9, y: 1.8, w: 7.6, h: 4.4, fontSize: 13 }
  );
  slide.addShape(pptx.ShapeType.rect, { x: 8.85, y: 1.8, w: 3.6, h: 3.5, fill: { color: INK } });
  slide.addText('STATED LIMITS', { x: 9.05, y: 2.0, w: 3.2, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: AMBER, margin: 0 });
  slide.addText(
    'View-only is an interface rule, not a cryptographic one: once a recipient decrypts, the plaintext is theirs.\n\nThe server holds a SHA-256 fingerprint of the plaintext, which is a content fingerprint.\n\nRevocation cannot un-download a file the recipient already has.\n\nA lost device means a lost private key and unreadable files.',
    { x: 9.05, y: 2.35, w: 3.2, h: 2.85, fontFace: FONT, fontSize: 10, color: PAPER, margin: 0, lineSpacingMultiple: 1.12 }
  );
  slide.addText('Future work: digital signatures, key recovery, forward secrecy, attribute-based policies, and a deployment that survives the loss of the single node.', {
    x: 8.85, y: 5.55, w: 3.6, h: 1.3, fontFace: FONT, fontSize: 11, color: MUTED, margin: 0, lineSpacingMultiple: 1.15,
  });
}

/* ---------------- 15. timeline ---------------- */
{
  const slide = paperSlide();
  slideTitle(slide, 'Timeline');
  table(
    slide,
    [
      ['Stage', 'Phase', 'Tasks', 'Output / goal'],
      ['1', 'System and security design', 'Define users, access rules, encryption workflow and architecture', 'Confirmed requirements, the security claim and the stated limits'],
      ['2', 'Web application development', 'Server, storage, browser client, registration and sharing modules', 'A working local prototype'],
      ['3', 'Encryption and access control', 'Key pairs in the browser, AES-GCM encryption, RSA-OAEP wrapping, per-share permission', 'Secure file protection and controlled access'],
      ['4', 'Testing and finalisation', 'Self-test and headless browser test, report and deck, repository', 'A validated prototype ready for review'],
    ],
    0.9, 1.9, 11.6, [0.8, 3.0, 4.2, 3.6], 11
  );
  slide.addText('Stages 1 to 3 are complete. Stage 4 is the verification, the written report and this deck.', {
    x: 0.9, y: 5.6, w: 11.6, h: 0.4, fontFace: FONT, fontSize: 12, color: MUTED, margin: 0,
  });
  slide.addShape(pptx.ShapeType.rect, { x: 0.9, y: 6.15, w: 11.6, h: 0.5, fill: { color: PAPER2 } });
  slide.addText('Working prototype, public repository, full report: aswathas.github.io  |  github.com/aswathas/sugan-project', {
    x: 1.1, y: 6.15, w: 11.2, h: 0.5, fontFace: FONT, fontSize: 11, color: INK2, margin: 0, valign: 'middle',
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
pptx.writeFile({ fileName: OUT }).then(() => {
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes');
});
