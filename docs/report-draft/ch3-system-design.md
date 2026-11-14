# Chapter 3 System Design and Methodology

## 3.1 Proposed System

SecureShare is a web application with two cooperating halves: a Node.js server that stores accounts, share metadata and ciphertext, and a browser client that performs all cryptography. The design is deliberately small. It contains no framework, no database engine and no third-party package; the server is written against the `node:http` and `node:crypto` modules, and the client is plain JavaScript using the Web Cryptography API and IndexedDB. This choice was made so that the system can be run on any machine that has Node.js, without an installation step, and so that nothing in the system depends on a paid service.

The system is organised into seven functional modules.

The **registration and authentication module** accepts a username, an email address and a password, hashes the password with scrypt and a per-user salt, and issues a six-digit one-time code. The account is created in an unverified state and cannot be used until the code is verified. Verification creates a server-side session token and sets it in an HttpOnly cookie. When an access code is configured, registration requires it before any other field is examined. Where Google sign-in is configured, the module also links a verified Google subject to an account and starts a session by the same token mechanism.

The **identity verification module** is `server/google.js`. It verifies a Google ID token on the server. It checks that the token uses RS256, that its issuer is Google, that its audience is this application's client id and that it has not expired, and it verifies the signature against Google's published signing keys, which are cached for an hour. The verification is placed on the server because a token checked only in the page proves nothing about the party who controls that page. Node's built-in `node:crypto` performs the signature check and the built-in `fetch` retrieves the keys, so the module adds no package.

The **key management module** runs in the browser. At registration the browser generates an RSA-OAEP 2048-bit key pair, keeps the private key as a non-extractable CryptoKey in IndexedDB, and sends only the public key, encoded in SPKI form, to the server.

The **sharing module** also runs in the browser. For each share it generates a fresh AES-GCM 256-bit key and a random 96-bit initialisation vector, encrypts the selected file, and wraps the AES key with the recipient's public key. It also computes a SHA-256 fingerprint of the plaintext, so that the recipient can check the file it recovers. It uploads the ciphertext, the initialisation vector, the wrapped key, the fingerprint and the descriptive metadata.

The **access-control module** records, for each share, the permission that the sender chose: view or download. The permission is stored with the share, returned to the sender and the recipient, and reflected in the interface when the share is opened. The module also records the lifetime the sender chose and any revocation the sender later applies. A share is therefore live, expired, revoked or trashed, and the server refuses its bytes in every state but live while still returning its metadata so that the card can say why. Deleting a share moves it to the trash; from there it can be restored to the ordinary views, or purged, which removes both the record and the ciphertext file.

The **storage module** is the server's JSON store and blob directory. It holds user records, session records, share records, the audit trail and one ciphertext file per share.

The **presentation module** is the browser interface, and it is arranged as a workspace in the shape of a file drive. A left rail carries five sections with their counts: Shared with me, Sent by me, Starred, Recent and Trashed. The same rail shows how much ciphertext the account holds on the server and how that total splits by file type. A search box in the band filters the current view by file name, and a sort control orders the view by name, newest, oldest or size. The cards can be shown as a grid or as a list, and the choice is remembered between visits.

Each card carries the filename, the other party, the size, the time, the permission badge, the self-destruct state, a live mark while a share has not been opened and a checkbox for selection. Selecting one or more cards reveals a bar with the count and the actions Star, Revoke, Delete and Clear, so that the same operation can be applied to a group. Starring is per user: the server records who starred a share, so the sender and the recipient can star the same share differently. Deleting a share moves it to the trash, where it can be restored or purged for good. A New route opens the send panel, and a card can be dragged onto a recipient in the people list to open that route with the file and the person already filled in. Keyboard shortcuts follow the file-drive convention: slash focuses the search box, n opens the New route, j and k move the highlighted card, Enter opens it and Escape clears the selection. A button in the band switches between the paper theme and a dark theme, and the choice is remembered; the dark theme is one override of the colour tokens rather than a second stylesheet. The same page carries the evidence panel and the activity trail.

Nothing in this list holds a private key, an AES key or plaintext on the server. That is the defining property of the design and the reason the modules are separated as they are. The one derived value the server does hold is the SHA-256 fingerprint of the plaintext, and it is treated as a limit in Chapter 4 rather than as a secret.

## 3.2 Logical Architecture

Figure 3.1 shows the logical architecture. The diagram has three columns: the sender's browser on the left, the server in the centre, and the recipient's browser on the right.

Figure 3.1 Logical architecture of the proposed secure file-sharing system

[FIGURE: docs/figures/01-architecture.svg]

The sender's browser holds the file that is to be shared, the user's key pair, and the encryption functions. Its key pair has two parts with different fates: the private key remains in IndexedDB on the device, and the public key has been published to the server. When a share is made, the sender's browser runs AES-GCM encryption under a newly generated key, then runs RSA-OAEP wrapping of that key under the recipient's public key. The values that leave this column are the ciphertext, the initialisation vector and the wrapped key.

The server column holds three things: accounts and public keys, share metadata, and ciphertext blobs. It holds no private key, no AES key and no plaintext. The server's role is to authenticate sessions, to keep the directory of public keys so that a sender can address a recipient, to record who shared what with whom under which permission, and to return a ciphertext blob to a user who is entitled to it. The marker on the server in Figure 3.1 states this limitation explicitly.

The recipient's browser column holds the recipient's private key in IndexedDB, the unwrap and decrypt functions, and the download or view step. The recipient's browser receives the ciphertext, the initialisation vector and the wrapped key, recovers the AES key with the private key, decrypts the ciphertext, and presents the file.

Two trust boundaries are visible in this arrangement. The first separates each user's browser from the server: the private key and the plaintext never cross it. The second separates the two browsers from each other: the recipient obtains the file only by decrypting with the private key that belongs to the addressed account. The server is inside neither boundary with respect to file content; it is a relay.

## 3.3 Hardware Requirements

The prototype was developed and demonstrated on ordinary hardware. Table 3.1 lists the requirements.

Table 3.1 Hardware requirements

| Component | Requirement |
|---|---|
| Processor | Any 64-bit processor capable of running a current browser and Node.js |
| Memory | Sufficient for the operating system and one browser with two profiles; no special requirement |
| Storage | A small amount of disk space for the JSON store and the ciphertext blobs, proportional to the files shared; the interface accepts files up to 25 MB |
| Display | A standard display for the browser interface |
| Network | Not required for a localhost demonstration; a local network or a development tunnel is sufficient for a two-machine demonstration |
| Test machine | A machine with Chrome or Edge installed, for the headless browser verification |

Because the cryptography runs in the browser and the server performs no cryptographic work beyond password hashing and token generation, the system does not demand a powerful machine. The heaviest operations are the RSA key generation at registration and the AES encryption of the selected file, both of which are performed on the client.

## 3.4 Software Requirements

Table 3.2 lists the software requirements. The list is short by design.

Table 3.2 Software requirements

| Component | Requirement |
|---|---|
| Operating system | Windows, Linux or macOS |
| Runtime | Node.js 18 or later; the prototype was tested on Node 23 |
| Server-side modules | `node:http`, `node:crypto`, `node:fs`, `node:path` and the built-in `fetch`; `node:crypto` also verifies the RS256 signature on a Google ID token and `fetch` retrieves Google's signing keys |
| Browser | A current browser with Web Crypto and IndexedDB: Chrome, Edge or Firefox |
| Client-side APIs | Web Cryptography API, IndexedDB, Fetch API, Blob and object URLs; Google Identity Services when the Google path is configured |
| Response headers | A content security policy, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer` on every response |
| Test harness | Node.js for the self-test and the Google verification test; Chrome or Edge for the headless test, driven over the DevTools protocol |
| Package manager | None required; there are no npm dependencies |
| External services | None required; the default mailer prints the code locally. Google sign-in and email delivery are optional and enabled only by configuration |

The absence of dependencies is a requirement and not an accident. It means that the demonstration does not fail because a package cannot be installed in an examination hall, and it means that the report's description of the software corresponds exactly to what is on the machine. The security headers are delivered by the server itself rather than by a proxy, so the policy that protects the page is part of the code the report describes. The same code enforces the controls listed in Section 3.7: the sign-in lockout, the attempt limit on one-time codes, the eight-character password minimum, the per-account share cap and the "sign out everywhere" route. Each of them is therefore part of the software the report describes and not a setting on a proxy or a platform.

## 3.5 Stages of Development

The prototype was built in stages, each of which produced something that could be checked. Table 3.3 records the stages and their outputs.

Table 3.3 Stage-wise development of the prototype

| Stage | Activity | Output |
|---|---|---|
| 1 | Requirement capture and threat model | Confirmed requirements, the security claim and the stated limits |
| 2 | Architecture decision | Recorded decision on browser-side key pairs and browser-side encryption |
| 3 | Server and storage skeleton | HTTP server, JSON store, blob directory, static file serving |
| 4 | Registration and authentication | Account creation, scrypt password hashing, one-time-code verification, sessions |
| 5 | Client key management | RSA-OAEP key pair generated in the browser, non-extractable private key in IndexedDB, public key published |
| 6 | Hybrid encryption and sharing | AES-GCM file encryption, RSA-OAEP key wrapping, upload of ciphertext, initialisation vector and wrapped key |
| 7 | Access control | Per-share permission of view or download, recorded and reflected in the interface |
| 8 | Dashboard and interface | Left rail with counts, search by file name, file cards, the New route and the evidence panel |
| 9 | Expiry, revocation and integrity | Self-destruct lifetimes, sender revocation, the plaintext fingerprint and the verified badge |
| 10 | Audit trail | Chained activity entries for every send, open and revocation, and the chain verification endpoint |
| 11 | Hardening and Google sign-in | Security headers, sign-in lockout, the access code, the share cap and server-side Google token verification |
| 12 | Verification | Node self-test, Google verification test and headless Chrome test of the interface |
| 13 | Documentation | README, decision record, change inventory and this report |

The order was chosen so that each stage could be verified against the previous one. The server contract was exercised by the self-test before the browser interface existed, and the interface was exercised by the headless test once it did. The later stages follow the same rule: each new endpoint was added to the server test before it was offered in the interface, and each new card state was checked in the browser test. This is why the results in Chapter 4 can distinguish a failure of the server from a failure of the client.

## 3.6 Working Principle

The working principle of SecureShare is a sequence of seven steps, followed by the lifecycle that a share can enter after it has been sent. Figure 3.2 shows the sequence and indicates which steps run in the sender's browser, on the server and in the recipient's browser.

Figure 3.2 The seven-step working principle of SecureShare

[FIGURE: docs/figures/05-working-principle.svg]

**Step 1: User authentication.** A user registers with a username, an email address and a password. The browser generates the user's RSA-OAEP key pair during registration and keeps the private key locally. The server hashes the password with scrypt, creates the account in an unverified state and issues a six-digit one-time code through the mailer. When an access code is configured, registration requires it before the username is examined. The user enters the code; the server verifies it against the stored hash and, if it is correct and unexpired, marks the account verified and sets a session cookie. If Google sign-in is configured, the user may instead obtain an ID token from Google, which the server verifies before it links the account and sets the same cookie.

**Step 2: File selection and upload preparation.** The authenticated sender selects a file in the browser, either through the file field or by dragging it onto the field, and chooses a recipient from the list of registered users. The interface accepts files up to 25 MB and shows the upload progress. The sender also chooses the permission and the self-destruct lifetime: never, one hour, one day or seven days. The browser displays a short fingerprint derived from the recipient's public key, so that the sender can see which key the file will be encrypted to.

**Step 3: Client-side encryption.** The sender's browser generates a fresh AES-GCM 256-bit key and a random 96-bit initialisation vector, encrypts the file, and produces the ciphertext. It also computes a SHA-256 fingerprint of the plaintext. The plaintext file is not transmitted at any point.

**Step 4: Authorised sharing.** The browser encrypts the AES key with the recipient's RSA-OAEP public key, producing the wrapped key, and attaches the permission and the lifetime the sender chose for this share.

**Step 5: Secure transmission.** The browser uploads the ciphertext, the initialisation vector, the wrapped key, the recipient name, the filename, the size, the permission, the lifetime and the plaintext fingerprint. The server writes the ciphertext to a blob file on disk, records the share metadata in the JSON store with an expiry time and a live state, and appends a send event to the audit trail.

**Step 6: Recipient authentication.** The recipient signs in with the verified account and lists the shares addressed to that account. The server returns the share metadata, including its state, only to the sender and the recipient; any other user receives 403. The metadata is returned even when the bytes are no longer served, so that a card can state that a share has expired or been revoked.

**Step 7: Decryption and integrity check.** The recipient's browser reads the private key from IndexedDB, unwraps the AES key with RSA-OAEP, and decrypts the ciphertext with AES-GCM. It then recomputes the SHA-256 fingerprint of the recovered bytes and compares it with the fingerprint that travelled with the share. If the two agree, the card reads verified; if they differ, the browser reports that the recovered file is not the one that was sent. The first open is recorded with the server, which appends an open event to the audit trail. If the permission is download, the browser saves the file. If the permission is view, the browser opens the decrypted content without offering a save action. The server is not involved in this step.

Three lifecycle events can occur after a share has been sent. The sender may revoke a share that the recipient has not opened: the server records the revocation, appends a revoke event to the trail, and thereafter refuses the bytes with 410. The recipient cannot revoke a share and receives 403, and a share that has already been opened can no longer be revoked and receives 409. Separately, when the self-destruct time chosen in step 2 passes, the share becomes expired and the bytes are refused with 410 in the same way. Third, the sender or the recipient may delete a share, which moves it to the trash: its bytes are refused exactly as they are for a revoked or an expired share, and the record stays in place so that the trash view can offer a restore. A restored share returns to the ordinary views, and its bytes are served again if it is still live. The sender alone may purge a trashed share, which removes the record and deletes the ciphertext file for good; this is the one operation that actually deletes stored ciphertext. A share therefore moves from live to one of three resting states, revoked, expired or trashed, and in each of them the server refuses the bytes while the metadata stays visible so that the card can state the reason. The server refuses to hand over the bytes; it does not claim to have erased them except at a purge.

Every send, open, revocation, delete, restore and purge appends an entry to the audit trail. Each entry carries the SHA-256 of the entry before it, so an entry cannot be altered or removed without breaking the chain that follows it. `GET /api/activity/verify` walks the chain and reports whether it is intact. The trail is filtered per account: an account sees the events attached to shares it sent or received, and never another account's events.

Expressed as an algorithm, the share path is as follows.

1. Input: file F, recipient R with public key K_R, permission P, lifetime L.
2. Generate K, a fresh AES-GCM 256-bit key.
3. Generate IV, a random 96-bit initialisation vector.
4. Compute H = SHA-256(F), the fingerprint of the plaintext.
5. Compute CF = E(K, F) under AES-GCM with IV.
6. Compute CK = E(K_R, K) under RSA-OAEP.
7. Send CF, IV, CK, R, filename, size, P, L and H to the server.
8. The server stores CF as a blob, records the share with its expiry and fingerprint, and appends a send event to the trail.
9. On the recipient's request, return CF, IV, CK and H to R only, and only while the share is live.
10. In R's browser, recover K = D(K_priv, CK).
11. Compute F' = D(K, CF, IV).
12. Compute H' = SHA-256(F'). Present F' as verified when H' = H, and record the first open.
13. If the sender revokes the share before step 12, or if L has elapsed, or if either party has moved the share to the trash, step 9 refuses with 410 and the metadata reports the state.

The decryption path in step 10 and step 11 is the inverse of the encryption path, and it is the point at which the design's central claim is either true or false. Because the private key never leaves the recipient's device and the server never receives the AES key, the server cannot perform these steps. The comparison in step 12 adds a second, narrower check: it establishes that the bytes the recipient recovered are the bytes the sender fingerprinted, not merely that they decrypt. The verification in Chapter 4 tests both.

## 3.7 Data Held by the Server and the HTTP Interface

The server's state is deliberately small and can be inspected directly. User records contain the username, the email address, the scrypt salt and hash, the public key, a verification flag, the Google subject when the account was created through Google sign-in, the time the account was last active and a timestamp. Session records map an opaque token to a username and an expiry. Share records contain the identifier, the sender, the recipient, the filename, the size, the initialisation vector, the wrapped key, the permission, the expiry time, the revocation time, the time of the first open, the plaintext fingerprint, the name of the blob file, the list of accounts that have starred the share, the time it was moved to the trash, the account that moved it, a timestamp and a derived state of live, expired, revoked or trashed. Activity records contain a timestamp, an event type, the actor, the share, the filename, the other party, an optional detail and the hash of the entry before them. The ciphertext itself is stored as a separate binary file, one per share. There is no field anywhere in this state for a private key, an AES key or plaintext.

Table 3.4 lists the HTTP interface.

Table 3.4 HTTP interface exposed by the server

| Method and path | Purpose | Access |
|---|---|---|
| GET /api/config | Publish the Google client id and whether an access code is required | Public |
| POST /api/google-signin | Verify the Google ID token, link the account, start a session | Public; 503 when not configured |
| POST /api/register | Create an account and issue a one-time code | Public; access code when configured |
| POST /api/verify-otp | Verify the code, mark the account verified, start a session | Public |
| POST /api/login | Sign in with username and password | Public; 403 if unverified, 429 when locked out |
| POST /api/logout | End the session | Signed in |
| POST /api/logout-all | End every session of the signed-in account | Signed in |
| GET /api/me | Return the signed-in account | Signed in |
| GET /api/users | List accounts, public keys and the time each was last active | Signed in |
| POST /api/shares | Store a new share | Signed in; 429 at the share cap |
| GET /api/shares | List the caller's inbox, sent, starred and trashed shares | Signed in |
| GET /api/shares/:id | Return metadata for one share | Sender or recipient only |
| GET /api/shares/:id/blob | Return the ciphertext for one share | Sender or recipient only; 410 when expired, revoked or trashed |
| GET /api/shares/:id/cipher-head | Return the first bytes the server holds, for the evidence panel | Sender or recipient only |
| POST /api/shares/:id/revoke | Call the share off | Sender only; 409 once opened |
| POST /api/shares/:id/opened | Record the first open | Recipient only |
| POST /api/shares/:id/star | Toggle the star for the signed-in user | Sender or recipient only |
| POST /api/shares/:id/delete | Move the share to the trash | Sender or recipient only |
| POST /api/shares/:id/restore | Bring the share back out of the trash | Sender or recipient only |
| POST /api/shares/:id/purge | Delete the record and the ciphertext file for good | Sender only; 409 unless trashed |
| GET /api/activity | Return the audit trail of the signed-in account | Signed in |
| GET /api/activity/verify | Walk the hash chain and report whether it is intact | Signed in |

The shares endpoint returns four lists, `inbox`, `sent`, `starred` and `trashed`, and each entry carries `starred`, `deletedAt`, `deletedBy` and a `state` of `live`, `revoked`, `expired` or `trashed`. A live starred share appears in the starred list as well as in the inbox or sent list it came from, and a share in the trash appears only in the trash.

The access column is the enforcement point for the unauthorised-access scenario. A request for a share or its blob is accepted only when the authenticated session belongs to the sender or the recipient; otherwise the server returns 403. The blob is refused with 410 when the share has expired, been revoked or been moved to the trash, while the metadata is still returned so that the card can state the reason. Revocation is restricted to the sender and is refused with 409 once the recipient has opened the share. A star, a delete and a restore are accepted from either party to the share, while a purge is accepted only from the sender and only once the share is in the trash. The cipher-head endpoint returns only the first bytes the server really holds, and only to the two parties, so that the evidence panel can compare them with the sender's file without exposing the rest of the blob.

Static files under the public directory are served without authentication, because they contain only the interface and no user data. `GET /api/config` is public in the same way: the Google client id is public by design and the client secret never leaves the server.

The Google path is the only place where the server accepts an identity from outside. `POST /api/google-signin` passes the token to `server/google.js` before any account is linked. The check is on the server because a token accepted by the page would be accepted on the word of the page, and the page is controlled by the party whose identity is in question. The module verifies the algorithm, the issuer, the audience and the expiry, then the signature against Google's published keys. It uses `node:crypto` and the built-in `fetch` only, so the zero-dependency property is preserved.

Three further controls are visible at this layer. Sign-in is locked for fifteen minutes after five failed attempts and answers 429 while the lock holds; a one-time code is limited to five attempts; and an account may hold at most two hundred shares, beyond which the server answers 429. The password minimum is eight characters, and `/api/logout-all` ends every session of the account. Every response also carries the security headers listed in Table 3.2, and the content security policy names the site's own script and styles, together with Google's identity script when that path is configured, as the only permitted sources. When `ACCESS_CODE` is set, registration requires it and the comparison is made before any other validation, so a stranger cannot learn which usernames exist.

Presence is a last-seen note rather than a live connection. When a signed-in account makes a request, the server records the time in `lastSeen`, and `GET /api/users` returns it with the public key, so that the people list can say when someone was last seen. The design stops there on purpose. A live indicator would need a websocket or a polling loop, and either would add a connection that the zero-dependency, zero-cost constraint cannot carry. A stored time costs nothing beyond a field and a write, and it answers the useful question, which is whether a person has been around recently, without pretending to know whether they are at the keyboard this second. The record is written at most every thirty seconds so that a busy session does not rewrite the store on every request.

## 3.8 Testing Procedure

Verification was carried out in two independent layers, because each layer can catch a class of defect that the other cannot.

The first layer is a **Node self-test** that exercises the server contract directly. `npm test` runs two suites in this layer, the server self-test and the Google verification test, and reports nineteen checks. The suites use Node's built-in Web Crypto implementation, which is the same API the browser uses, so the cryptographic operations in the test are the same operations that run in the client. The test registers three users, one of whom is the intended third party. It asserts that an unverified account cannot sign in and that a wrong one-time code is rejected with 401. It verifies the three accounts, then encrypts a file for one user and uploads it. It asserts that the stored blob contains no plaintext, that the recipient decrypts the ciphertext back to the original bytes, that the sender and recipient each see the share in the correct list, and that the third user neither sees the share nor can fetch its blob, receiving 403. It then asserts that the demo access code is required at registration, that an expired share refuses its bytes with 410 and reports its state, that the sender can revoke while the recipient cannot, and that a share which has already been opened can no longer be revoked. It reads the activity trail as each user and asserts that the events are recorded and that another account's events are hidden, and it calls the chain verification endpoint and asserts that the chain is intact. It asserts the two abuse controls as well: repeated failed sign-ins are locked out with 429, and repeated wrong one-time codes are refused in the same way. It asserts that signing out everywhere ends every session of the account, so that the token used after the call is refused with 401. It asserts the share lifecycle as well: starring is per user and the starred list follows it, a deleted share leaves the sent list and enters the trash, a share in the trash refuses its bytes with 410, a restore brings the share back, and a purge removes it for good. The Google suite asserts that the client id is published, that a valid token signs a user in and preserves a key that the account had already published, and that a token with a wrong audience, a wrong issuer, an expired time, a tampered payload, a forged signature or a malformed structure is refused. The test runs against a temporary data directory that is removed afterwards, so it cannot disturb a demonstration's data.

The second layer is a **headless browser test**. `npm run test:browser` launches Chrome or Edge in headless mode and drives the real interface over the DevTools protocol, using Node's built-in WebSocket so that no test dependency is added. Two separate browser profiles are launched, one for each user, so that cookies and IndexedDB are genuinely separate; a test that used two tabs in one profile would share the key store and would not prove anything about isolation. The test registers two users through the real forms and asserts that the private key stored in the first user's IndexedDB is present and non-extractable. It sends a PDF through the share panel, asserts that the dashboard counts the share, that the evidence panel shows bytes different from the sender's, that exactly one blob exists on disk, and that the blob does not contain the marker string planted in the file. It sends a second file with a one-hour lifetime, and asserts that the card carries the permission and the self-destruct timer. It revokes that second share, asserts that the revoked badge appears, and reads the activity panel to confirm that the sends were recorded. It then reads the recipient's dashboard and asserts that both shares are listed, that both are marked unopened, that the revoked share is marked and cannot be opened, and that the heading names the inbox. Finally it decrypts the PDF through the interface, asserts that the recovered bytes equal the original, and asserts that the card then carries the verified badge and that the activity panel records the open. It also drives the file-drive workspace: it asserts that the rail shows the Starred and Trashed sections with their counts, that selecting a card shows the bulk bar, that starring a share puts it in the starred list, that deleting a share moves it to the trash and that the recipient cannot open it, and that restoring brings it back. Because the whole run is made against the real server, it also exercises the security headers: the page and its script are loaded under the content security policy, so a policy that blocked the site's own script or styles would stop the run. Screenshots are captured during the run and are the six figures in Chapter 4.

Both layers were run on the same machine. The self-test establishes the server contract in isolation, including the endpoints for expiry, revocation, starring, the trash, the activity trail and Google sign-in; the browser test establishes that the contract is reached through the actual interface and that the client performs its cryptographic steps and its integrity check. A defect in either layer is therefore localised: a failure confined to the self-test points at the server or the HTTP interface, while a failure confined to the browser test points at the client script or the interaction between the two.
