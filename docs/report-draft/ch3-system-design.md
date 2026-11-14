# Chapter 3 System Design and Methodology

## 3.1 Proposed System

SecureShare is a web application with two cooperating halves: a Node.js server that stores accounts, share metadata and ciphertext, and a browser client that performs all cryptography. The design is deliberately small. It contains no framework, no database engine and no third-party package; the server is written against the `node:http` and `node:crypto` modules, and the client is plain JavaScript using the Web Cryptography API and IndexedDB. This choice was made so that the system can be run on any machine that has Node.js, without an installation step, and so that nothing in the system depends on a paid service.

The system is organised into six functional modules.

The **registration and authentication module** accepts a username, an email address and a password, hashes the password with scrypt and a per-user salt, and issues a six-digit one-time code. The account is created in an unverified state and cannot be used until the code is verified. Verification creates a server-side session token and sets it in an HttpOnly cookie.

The **key management module** runs in the browser. At registration the browser generates an RSA-OAEP 2048-bit key pair, keeps the private key as a non-extractable CryptoKey in IndexedDB, and sends only the public key, encoded in SPKI form, to the server.

The **sharing module** also runs in the browser. For each share it generates a fresh AES-GCM 256-bit key and a random 96-bit initialisation vector, encrypts the selected file, and wraps the AES key with the recipient's public key. It uploads the ciphertext, the initialisation vector, the wrapped key and the descriptive metadata.

The **access-control module** records, for each share, the permission that the sender chose: view or download. The permission is stored with the share, returned to the sender and the recipient, and reflected in the interface when the share is opened.

The **storage module** is the server's JSON store and blob directory. It holds user records, session records, share records and one ciphertext file per share.

The **presentation module** is the browser interface: the sign-in and registration forms, the verification form, the share panel with its recipient selector, the inbox and the sent list.

Nothing in this list holds a private key, an AES key or plaintext on the server. That is the defining property of the design and the reason the modules are separated as they are.

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
| Storage | A small amount of disk space for the JSON store and the ciphertext blobs, proportional to the files shared |
| Display | A standard display for the browser interface |
| Network | Not required for a localhost demonstration; a local network is sufficient for a two-machine demonstration |
| Test machine | A machine with Chrome or Edge installed, for the headless browser verification |

Because the cryptography runs in the browser and the server performs no cryptographic work beyond password hashing and token generation, the system does not demand a powerful machine. The heaviest operations are the RSA key generation at registration and the AES encryption of the selected file, both of which are performed on the client.

## 3.4 Software Requirements

Table 3.2 lists the software requirements. The list is short by design.

Table 3.2 Software requirements

| Component | Requirement |
|---|---|
| Operating system | Windows, Linux or macOS |
| Runtime | Node.js 18 or later; the prototype was tested on Node 23 |
| Server-side modules | `node:http`, `node:crypto`, `node:fs`, `node:path` and the built-in `fetch` |
| Browser | A current browser with Web Crypto and IndexedDB: Chrome, Edge or Firefox |
| Client-side APIs | Web Cryptography API, IndexedDB, Fetch API, Blob and object URLs |
| Test harness | Node.js for the self-test; Chrome or Edge for the headless test, driven over the DevTools protocol |
| Package manager | None required; there are no npm dependencies |
| External services | None required; the default mailer prints the code locally |

The absence of dependencies is a requirement and not an accident. It means that the demonstration does not fail because a package cannot be installed in an examination hall, and it means that the report's description of the software corresponds exactly to what is on the machine.

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
| 8 | Verification | Node self-test of the server contract and headless Chrome test of the interface |
| 9 | Documentation | README, decision record, change inventory and this report |

The order was chosen so that each stage could be verified against the previous one. The server contract was exercised by the self-test before the browser interface existed, and the interface was exercised by the headless test once it did. This is why the results in Chapter 4 can distinguish a failure of the server from a failure of the client.

## 3.6 Working Principle

The working principle of SecureShare is a sequence of seven steps. Figure 3.2 shows the sequence and indicates which steps run in the sender's browser, on the server and in the recipient's browser.

Figure 3.2 The seven-step working principle of SecureShare

[FIGURE: docs/figures/05-working-principle.svg]

**Step 1 — User authentication.** A user registers with a username, an email address and a password. The browser generates the user's RSA-OAEP key pair during registration and keeps the private key locally. The server hashes the password with scrypt, creates the account in an unverified state and issues a six-digit one-time code through the mailer. The user enters the code; the server verifies it against the stored hash and, if it is correct and unexpired, marks the account verified and sets a session cookie.

**Step 2 — File selection and upload preparation.** The authenticated sender selects a file in the browser and chooses a recipient from the list of registered users. The browser displays a short fingerprint derived from the recipient's public key, so that the sender can see which key the file will be encrypted to.

**Step 3 — Client-side encryption.** The sender's browser generates a fresh AES-GCM 256-bit key and a random 96-bit initialisation vector, encrypts the file, and produces the ciphertext. The plaintext file is not transmitted at any point.

**Step 4 — Authorised sharing.** The browser encrypts the AES key with the recipient's RSA-OAEP public key, producing the wrapped key, and attaches the permission the sender chose for this share: view or download.

**Step 5 — Secure transmission.** The browser uploads the ciphertext, the initialisation vector, the wrapped key, the recipient name, the filename, the size and the permission. The server writes the ciphertext to a blob file on disk and records the share metadata in the JSON store.

**Step 6 — Recipient authentication.** The recipient signs in with the verified account and lists the shares addressed to that account. The server returns the share metadata only to the sender and the recipient; any other user receives 403.

**Step 7 — Decryption and file access.** The recipient's browser reads the private key from IndexedDB, unwraps the AES key with RSA-OAEP, and decrypts the ciphertext with AES-GCM. If the permission is download, the browser saves the file. If the permission is view, the browser opens the decrypted content without offering a save action. The server is not involved in this step.

Expressed as an algorithm, the share path is as follows.

1. Input: file F, recipient R with public key K_R, permission P.
2. Generate K, a fresh AES-GCM 256-bit key.
3. Generate IV, a random 96-bit initialisation vector.
4. Compute CF = E(K, F) under AES-GCM with IV.
5. Compute CK = E(K_R, K) under RSA-OAEP.
6. Send CF, IV, CK, R, filename, size and P to the server.
7. The server stores CF as a blob and records the share.
8. On the recipient's request, return CF, IV and CK to R only.
9. In R's browser, recover K = D(K_priv, CK).
10. Compute F = D(K, CF, IV) and present F according to P.

The decryption path in step 9 and step 10 is the inverse of the encryption path, and it is the point at which the design's central claim is either true or false. Because the private key never leaves the recipient's device and the server never receives the AES key, the server cannot perform these steps. The verification in Chapter 4 tests exactly this.

## 3.7 Data Held by the Server and the HTTP Interface

The server's state is deliberately small and can be inspected directly. User records contain the username, the email address, the scrypt salt and hash, the public key, a verification flag and a timestamp. Session records map an opaque token to a username and an expiry. Share records contain the identifier, the sender, the recipient, the filename, the size, the initialisation vector, the wrapped key, the permission, the name of the blob file and a timestamp. The ciphertext itself is stored as a separate binary file, one per share. There is no field anywhere in this state for a private key, an AES key or plaintext.

Table 3.4 lists the HTTP interface.

Table 3.4 HTTP interface exposed by the server

| Method and path | Purpose | Access |
|---|---|---|
| POST /api/register | Create an account and issue a one-time code | Public |
| POST /api/verify-otp | Verify the code, mark the account verified, start a session | Public |
| POST /api/login | Sign in with username and password | Public; 403 if unverified |
| POST /api/logout | End the session | Signed in |
| GET /api/me | Return the current username | Signed in |
| GET /api/users | List usernames and public keys | Signed in |
| POST /api/shares | Store a new share | Signed in |
| GET /api/shares | List the caller's inbox and sent shares | Signed in |
| GET /api/shares/:id | Return metadata for one share | Sender or recipient only |
| GET /api/shares/:id/blob | Return the ciphertext for one share | Sender or recipient only |

The access column is the enforcement point for the unauthorised-access scenario. A request for a share or its blob is accepted only when the authenticated session belongs to the sender or the recipient; otherwise the server returns 403. Static files under the public directory are served without authentication, because they contain only the interface and no user data.

## 3.8 Testing Procedure

Verification was carried out in two independent layers, because each layer can catch a class of defect that the other cannot.

The first layer is a **Node self-test** that exercises the server contract directly. It uses Node's built-in Web Crypto implementation, which is the same API the browser uses, so the cryptographic operations in the test are the same operations that run in the client. The test registers three users, one of whom is the intended third party. It asserts that an unverified account cannot sign in and that a wrong one-time code is rejected with 401. It verifies the three accounts, then encrypts a file for one user and uploads it. It asserts that the stored blob contains no plaintext, that the recipient decrypts the ciphertext back to the original bytes, that the sender and recipient each see the share in the correct list, and that the third user neither sees the share nor can fetch its blob, receiving 403. The test runs against a temporary data directory that is removed afterwards, so it cannot disturb a demonstration's data.

The second layer is a **headless browser test**. It launches Chrome or Edge in headless mode and drives the real interface over the DevTools protocol, using Node's built-in WebSocket so that no test dependency is added. Two separate browser profiles are launched, one for each user, so that cookies and IndexedDB are genuinely separate; a test that used two tabs in one profile would share the key store and would not prove anything about isolation. The test registers two users through the real forms, asserts that the private key stored in the first user's IndexedDB is present and non-extractable, refreshes the recipient list, sends a PDF through the share panel, asserts that exactly one blob exists on disk and that it does not contain the marker string planted in the file, then has the recipient open the inbox, decrypt, and return the original bytes. Screenshots are captured during the run and are the figures in Chapter 4.

Both layers were run on the same machine. The self-test establishes the server contract in isolation; the browser test establishes that the contract is reached through the actual interface and that the client performs its cryptographic steps. A defect in either layer is therefore localised: a failure confined to the self-test points at the server or the HTTP interface, while a failure confined to the browser test points at the client script or the interaction between the two.
