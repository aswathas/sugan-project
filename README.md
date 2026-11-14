# SecureShare — end-to-end encrypted file sharing

A website for sharing files securely. Each user registers and receives a **key pair generated in
their browser**. A file is encrypted **before it leaves the browser**, using the recipient's public
key, and only that recipient can decrypt it. The server stores ciphertext and public keys — never
a private key, never plaintext.

Client: Sugan. College submission. Runs on `localhost`; deployment comes later.

## Run it

```
npm start
```

Then open <http://127.0.0.1:3000>. There is nothing to install — no dependencies, no build step.
Node 18+ is enough (tested on Node 23).

## Demo script (two browsers)

1. Open the site in **two different browsers or profiles** (or one normal window and one private
   window — cookies and key storage are per browser).
2. **Alice** registers. Her browser generates her key pair; the private key is stored in
   IndexedDB on her device and never leaves it.
3. **Bob** registers in the other browser. Same thing, on his device.
4. Alice picks a PDF, picks Bob as the recipient, and presses **Encrypt in browser & send**. The
   UI shows the fingerprint of Bob's public key that the file is encrypted to.
5. Bob sees it under **Shared with me**, presses **Decrypt & download**, and gets the original
   PDF back.
6. Proof for the demo: the file on disk (`data/blobs/`) is ciphertext, and the API never returns
   the file to anyone except the sender and the recipient.

## How the encryption works

Per share, in the sender's browser:

1. A fresh AES-GCM 256 key is generated for that one file.
2. The file is encrypted with AES-GCM (a random 96-bit IV per share).
3. The AES key is wrapped with the recipient's RSA-OAEP 2048 public key.
4. Only the ciphertext, the IV and the wrapped key are uploaded.

On the recipient's side, the private key in IndexedDB unwraps the AES key, which decrypts the
file. The server is never involved in either step.

## Layout

```
server/index.js   HTTP server, API, static files
server/store.js   JSON store + ciphertext blobs on disk (data/, gitignored)
server/crypto.js  password hashing (scrypt), session tokens
public/           the site: index.html, app.js, style.css
test/selftest.js  end-to-end check of the whole share flow
docs/             agent skills config, ADRs, decision log, change inventory
REQUIREMENTS.md   the brief agreed with the client
```

## Check it

```
npm test
```

Registers three users, encrypts a file for one of them, proves the server holds only ciphertext,
proves the recipient decrypts to the original bytes, and proves a third user gets `403`.
