# Secure File Sharing System Using End-to-End Encryption and Access Control

Course: 21ECC402P, Computer Communication and Network Security

Project team: Pradeesh M (RA2311004010278), Varun P R (RA2311004010287), Sugandhan A (RA2311004010297)

System name: SecureShare

## Abstract

File sharing over the public internet has become routine, but most of the systems that carry it treat the storage server as a trusted party. A file uploaded to such a service is normally readable by the service itself, by anyone who administers it and by anyone who compromises it. This project addresses that weakness by moving encryption and decryption into the user's browser. The prototype described in this report, SecureShare, is a web-based file-sharing system in which each user's key pair is generated on the user's own device at registration. The private key is created as a non-extractable Web Crypto key, stored in the browser's IndexedDB and never transmitted. When a file is shared, the sender's browser generates a fresh AES-GCM 256-bit key and a random 96-bit initialisation vector, encrypts the file, and wraps the AES key with the recipient's RSA-OAEP 2048-bit public key. Only the ciphertext, the initialisation vector and the wrapped key reach the server, which therefore never holds a private key, an AES key or plaintext. The sender also records a per-file permission of view or download for the recipient. Authentication uses a username, an email address and a password, with the account held unusable until a six-digit one-time code is verified; passwords are hashed with scrypt and sessions are server-side tokens in an HttpOnly cookie. The implementation uses only Node.js built-in modules and vanilla browser JavaScript, so it installs no packages and costs nothing to run. Verification was carried out in two layers: a Node self-test of the server contract and a headless Chrome test that drives the real interface in two separate browser profiles. The tests confirmed that an unverified account cannot sign in, that a wrong code is rejected, that the stored blob contains no plaintext, that the recipient decrypts to the original bytes and that an unrelated user is refused with 403. The report states plainly where the access-control rule is an interface convention rather than a cryptographic guarantee, and it lists the work that remains before the system could be operated as a public service.

## List of Abbreviations

Table A1.1 Abbreviations used in the report

| Abbreviation | Expansion |
|---|---|
| ABAC | Attribute-Based Access Control |
| AES | Advanced Encryption Standard |
| API | Application Programming Interface |
| CDP | Chrome DevTools Protocol |
| CP-ABE | Ciphertext-Policy Attribute-Based Encryption |
| E2EE | End-to-End Encryption |
| GCM | Galois/Counter Mode |
| HTML | HyperText Markup Language |
| HTTP | HyperText Transfer Protocol |
| HTTPS | HyperText Transfer Protocol Secure |
| IDB | IndexedDB (browser database) |
| IV | Initialisation Vector |
| JSON | JavaScript Object Notation |
| MFA | Multi-Factor Authentication |
| OAEP | Optimal Asymmetric Encryption Padding |
| OTP | One-Time Password |
| PDF | Portable Document Format |
| RSA | Rivest–Shamir–Adleman |
| SPKI | Subject Public Key Information |
| SQL | Structured Query Language |
| UI | User Interface |
| URL | Uniform Resource Locator |
| WebCrypto | Web Cryptography API |

## List of Tables

Table 2.1 Conventional file sharing compared with end-to-end encrypted sharing

Table 2.2 Literature survey of related work

Table 2.3 Cryptographic parameters used in the prototype

Table 3.1 Hardware requirements

Table 3.2 Software requirements

Table 3.3 Stage-wise development of the prototype

Table 3.4 HTTP interface exposed by the server

Table 4.1 Functional test cases and their outcomes

Table 4.2 Results of the Node self-test

Table 4.3 Results of the headless browser verification

Table A1.1 Abbreviations used in the report

Table A2.1 Test environment

## List of Figures

Figure 2.1 The conventional file-sharing model, in which the server can read the file

Figure 2.2 End-to-end encryption for a single share

Figure 2.3 The proposed model, in which only ciphertext is held by the server

Figure 3.1 Logical architecture of the proposed secure file-sharing system

Figure 3.2 The seven-step working principle of SecureShare

Figure 4.1 Registration and browser-side key generation

Figure 4.2 The share panel with recipient selection

Figure 4.3 The recipient inbox after decryption
