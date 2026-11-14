# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are college students and professionals who need to hand one specific person a
confidential document — a syllabus, a result, a marked assignment, a signed form — and need that
person, and only that person, to be able to read it. The client for this build is a college
student (SRM, course 21ECC402P) and his two teammates, who will demo the system live on one or two
laptops.

Secondary situation: the same user, days later, opening the inbox to find a file somebody sent
them.

## Product Purpose

Share a file so that it stays unreadable to everyone except its intended recipient, including the
server that stores it. Success is the recipient decrypting the original bytes, and the server
holding nothing but ciphertext.

## Positioning

The key material never leaves the user's device: a non-extractable private key in the browser's
IndexedDB, and a per-file AES key that exists only inside the sender's browser at the moment of
sending. The server is a ciphertext relay with no ability to read what it stores. Per-file
sender-set permission (view-only or view-and-download) is attached to the share itself, so access
travels with the file rather than with a role.

## Operating Context

- Runs on `localhost` with one command (`npm start`). No packages to install, no external
  service, no cost.
- The live demo is two people on two laptops on the same network, or one person showing both
  sides of the flow on one machine.
- The system is being reviewed as a course project (21ECC402P, review 3). A report and a
  15-slide deck accompany the working site, and the report has to describe exactly what the code
  does.
- Files in practice are PDFs, shared one-to-one.

## Capabilities and Constraints

- End-to-end encryption: RSA-OAEP 2048 key pair per user, generated in the browser at
  registration; the private key is non-extractable and stays in IndexedDB; the public key is
  published to the server.
- Per share: a fresh AES-GCM 256 key and a random 96-bit IV; the AES key is wrapped with the
  recipient's public key. Only ciphertext, IV and wrapped key are uploaded.
- Access control per share, chosen by the sender at send time: `view` or `download`.
- Authentication: username, email and password, plus a 6-digit one-time code that must be
  verified before the account can be used. The code is delivered by a pluggable mailer; the
  default mode prints it in the server terminal and shows it on screen, so the demo needs no
  email account and no internet. Google sign-in is designed as an additional method and is off
  until a client id is configured.
- Passwords are hashed with scrypt; sessions are server-side tokens in an HttpOnly cookie.
- Server storage is a JSON file and a directory of ciphertext blobs. Single node, no clustering.
- No dependency on any paid service, API or tier.
- Not present, and stated as absent in the report: role-based access control, key revocation,
  audit logging, forward secrecy, key backup or recovery, multi-recipient sharing, integrity
  verification beyond AES-GCM's own authentication tag, and any public deployment.
- The "view only" permission is enforced in the interface. With end-to-end encryption the
  recipient holds plaintext once decrypted, so it is not a cryptographic boundary.

## Brand Commitments

- The system name is **SecureShare** (client-confirmed). It appears in the interface, the report
  and the deck.
- The project title in the report and the deck is "Secure File Sharing System Using End-to-End
  Encryption and Access Control", under course 21ECC402P.
- Title slide carries Pradeesh M (RA2311004010278), Varun P R (RA2311004010287) and Sugandhan A
  (RA2311004010297).
- Voice: plain, technical, short sentences. No marketing language. No invented metrics, quotes,
  testimonials or logos.

## Evidence on Hand

- Real screenshots of the running interface, captured by the headless Chrome test
  (`docs/screenshots/`).
- Two passing test suites that prove the share flow end to end and the unauthorised-access
  refusal (`npm test`, `npm run test:browser`).
- The client's reference deck and reference report, which fix the structure of the deliverables.
- Six verified literature-survey papers (see the report draft).
- Absent, and not to be fabricated: hosted deployment, third-party logos, customer quotes,
  performance benchmarks, published papers.

## Product Principles

1. The server is never trusted with plaintext. If a feature would require the server to read a
   file, the feature is wrong.
2. Keys belong to the device. Anything that asks a user to hand their private key to a server has
   failed.
3. Free and install-free is a feature: a classroom laptop with no network and no admin rights must
   still run the demo.
4. Say what the system does not do. Limits belong in the interface and in the report, not in a
   footnote.
5. No invented proof. Every number on screen came from a test run.

## Accessibility & Inclusion

Every control is reachable and operable by keyboard with a visible focus ring, form fields carry
real labels, body text meets WCAG AA contrast, motion respects `prefers-reduced-motion`, and the
interface stays usable at 1280 x 800 and on a narrow laptop screen.
