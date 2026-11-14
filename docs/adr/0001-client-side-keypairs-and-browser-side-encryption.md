# ADR 0001 — Client-side key pairs and browser-side encryption

Status: Accepted — agreed with the client on 2026-11-14.

## Context

Sugan needs a website to share PDF files securely, with end-to-end file encryption. Different
users register on the site. On registration each user receives a private key and a public key. A
file must be encrypted before it leaves the website, and then shared to a selected user.

## Decision

- Each user generates a key pair **in the browser** at registration. The private key is kept on the
  user's device and is never uploaded. The public key is published so other users can encrypt to
  them.
- **Sharing** encrypts the file in the browser with the recipient's public key and uploads only
  the ciphertext.
- **Opening** decrypts in the recipient's browser with their private key. The server is never
  involved in decryption.

## Consequences

- The server holds ciphertext and public keys only. It cannot read a shared file, and a server
  compromise does not leak file contents.
- A lost device means a lost private key and unreadable files. Key backup and recovery are not
  specified yet — open hole in `REQUIREMENTS.md`.
- Encryption is per recipient. Sharing one file to several users means encrypting it once per
  user, and the ciphertext differs per recipient.
- The client's identity (password) and the file encryption key are separate concerns; the account
  only proves who may fetch which ciphertext.
