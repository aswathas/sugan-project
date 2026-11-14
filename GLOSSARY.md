# Glossary

Terms agreed with the client. Use these words in issues, code, docs and commits — do not drift to
synonyms.

- **User** — a registered person on the site. Each user owns exactly one key pair.
- **Key pair** — a public key and a private key generated in the user's browser at registration.
  Never uploaded to the server.
- **Public key** — the shareable half of a key pair, published so other users can encrypt to this
  user.
- **Private key** — the secret half. Stays on the user's own device, never leaves it. Only its
  owner can decrypt with it.
- **Plaintext** — the original file, before encryption.
- **Ciphertext** — the encrypted file. The only form the server ever holds.
- **Share** — encrypt a file for one selected user in the browser, then upload the ciphertext under
  that user's account.
- **Recipient** — the user a file was shared with.
- **End-to-end encrypted** — the server never sees a private key and never sees plaintext.
  Encryption and decryption both happen in the browser.
- **localhost first** — the demo runs on the developer's machine. Public deployment comes later.
