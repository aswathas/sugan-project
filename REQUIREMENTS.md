# Requirements — secure file-sharing website

Status: draft, gathering from Sugan over WhatsApp. Facts confirmed by Sugan only.

## Confirmed

- Client: Sugan — WhatsApp contact "5UGAN", +91 63809 34581. Friend, college student.
- Aswath builds this for him (2026-11-14).
- All conversation with Sugan: English only.
- **What it is:** a website to share files securely, using end-to-end file encryption.
  (Sugan: "I need a website to share files securely using end to end file encryption, I wanna share
  PDFs securely")
- Deliverable form: website. Primary content: PDFs.
- **Key model:** each user registers and receives a private key and a public key. The file is
  encrypted before it leaves the website and shared to the selected user.
  (Sugan: "Different users registers in our site, while registering they get their private key and
  public key, so before leaving the website only, we havto encrypt the file and share it to the
  selected user")
- **Purpose:** college submission.
- **Deadline:** today, 2026-11-14. ("College submission only, I want it today itself")
- **Deployment:** localhost first, deploy later. ("localhost first reply later")

## Open — asked, awaiting answers

| Hole | Answer |
|---|---|
| Which demo capabilities must exist (register/login, encrypt+send, decrypt+download, shared-with-me list) | asked 2026-11-14 |
| Other submission artifacts (report / PPT) | asked 2026-11-14 |
| Authentication at registration — A password, B email+OTP, C password+keypair challenge, D Google | options sent 2026-11-14, awaiting his pick |
| Multi-recipient sharing (one file to many users) | open |
| File size limit, how long a file lives | open |
| Site name and look | open |
| Names, credits, compliance | open |

## Aswath's choices — built, needs Sugan's nod

| Choice | Why |
|---|---|
| Stack: Node `node:http` + `node:crypto`, no npm dependencies, vanilla JS frontend | Runs on any laptop with `npm start`, nothing to install, nothing to break in the exam hall |
| Private key stored in the browser's IndexedDB, non-extractable `CryptoKey` | It cannot leave the device even if the page is compromised |
| One AES-GCM 256 key per file, wrapped with the recipient's RSA-OAEP 2048 public key | Standard hybrid encryption; the server only ever holds ciphertext |
| Name placeholder "SecureShare" | Rename once Sugan picks a name |
| Sessions: `HttpOnly` cookie, server-side session store, scrypt password hashes | Server never sees a plaintext password |

## Build status

- Server, client and end-to-end self-test written and passing (`npm test`): register → encrypt →
  share → fetch → decrypt round trip, plus a third-party `403` and a wrong-password `401`.
- Browser path (IndexedDB + WebCrypto + fetch) not yet verified automatically — in progress.

## Notes

- Chat register with Sugan: short, casual, one message one topic. He answers in one line, so
  every question goes as numbered options and he replies with codes like "1ABC 2D". He also asks
  for options ("suggest me options") — answer those as a lettered list with a recommendation.
- Messages sent: Tanglish opener (unanswered), English open ask, deliverable-options list, round 1
  (recipients + where encryption happens), round 2 (deadline + deployment), round 3 (demo scope +
  submission artifacts), auth options — all 2026-11-14.
- Last inbound ts from Sugan: 1794643746 ("So we hav to include authentication when user register,
  suggest me options").
- Poll target: chat id `916380934581@s.whatsapp.net` (+91 63809 34581). English only. Never write
  an answer he did not give.
