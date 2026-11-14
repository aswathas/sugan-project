# Report update: the three extra keys

You are updating the project report draft of **SecureShare** in
`C:\Users\ADMIN\Projects\sugan-project\docs\report-draft\`.

Work only on these files: `ch3-system-design.md`, `ch4-results.md`, `ch5-conclusion.md`.
Keep the existing voice, section numbering, heading style, table style and level of formality.
Extend what is there; do not rewrite chapters that are still correct. Do not touch any other
file. Do not invent numbers, papers, citations or results. The file drive workspace, the star,
the trash and the presence note are already described in the draft. Do not describe them again.

## What is new: three extra keys, all in the browser, with Web Crypto and no dependency

### 1. A signing key per user

Every account now has an ECDSA P-256 key pair beside its RSA-OAEP key pair. The private half is
non-extractable and lives in the browser with the RSA private key; the public half is published
with the account and returned by `GET /api/users` as `signingKey`.

When the sender creates a share, the browser signs the string

```
from|to|filename|size|sha256 of the plaintext|iv
```

with that key and sends the signature with the share. The server stores it and returns it with the
share metadata.

When the recipient opens the file, the browser rebuilds exactly that string from the share
metadata and verifies the signature against the sender's public key. The interface says whether
the signature checks out.

**The chain this creates is the point, and the report must explain it.** The signature covers the
plaintext fingerprint, and the fingerprint covers the bytes that arrived after decryption. So the
signature proves who vouched for the file, and the fingerprint proves the file is the one that
was vouched for. One check alone would not answer both questions.

The signature is over metadata, not over the ciphertext, so an attacker who holds the server's
data cannot forge a different file under the same signature, but the server can still refuse to
deliver a share it has been told to refuse. Say that plainly.

### 2. A password on a share

The sender can choose, when sending, that the file is protected with a password as well as with
the recipient's key. In that case the file key is wrapped twice: once with the recipient's RSA
public key and once with a key derived from the password, using PBKDF2 with SHA-256 and 210,000
iterations over a random 16-byte salt. The wrap uses AES-KW.

The password never reaches the server. The server stores the salt and the wrapped key. The
recipient is asked for the password when they open the file, in a panel in the interface.

**This changes a stated limit.** Until now the report says that view only is an interface rule
rather than a cryptographic one, because once the recipient decrypts, the plaintext is theirs.
That is still true for a share protected only by the key. For a password protected share it is no
longer true at the point of decryption: without the password the file cannot be decrypted at
all. The report must now say this precisely: the interface rule still applies to the download
button, and the password closes the gap at the point of decryption, but the recipient who holds
the password and the plaintext can still keep a copy. Be exact, do not oversell.

The share metadata gains `protected`, which is `key` or `password`, and `passwordSalt`.

### 3. A recovery phrase

At registration, in the browser:

1. the RSA key pair is generated extractable, once;
2. a recovery phrase of twelve words is generated from a built-in list of 128 words;
3. a key is derived from that phrase with PBKDF2, SHA-256, 210,000 iterations and a random salt;
4. the private key is exported as PKCS#8 and encrypted with that key under AES-GCM;
5. the encrypted form, with its salt and its IV, is uploaded to the server and also kept in the
   browser;
6. the device keeps a **non-extractable** copy of the private key for daily use, made by importing
   the same PKCS#8 bytes with `extractable` false.

The phrase is shown to the user once, on a panel, and offered on the sign in screen for a new
device. The flow on a new device is: sign in with the password, then enter the phrase, and the
browser fetches the encrypted blob, unwraps it locally and installs the private key.

`POST /api/keys/backup` stores the blob for the signed in account, `GET /api/keys/backup` returns
it, and `POST /api/keys/recover` returns it for a named account **before** there is a session, so
that a new device can fetch it. The server cannot read the blob, and the server cannot reset the
phrase.

**State the honest limits of the phrase.** Twelve words drawn from a 128 word list gives 84 bits
of entropy, which is strong against an online guess and weaker than a modern password manager,
and the phrase is only as safe as the paper it is written on. The server holding the encrypted
blob means that a server compromise exposes the blob to an offline attack on the phrase, which is
exactly why the derivation is deliberately slow.

## The interface changes

- The send route gains an **Extra protection** choice: *Key only* or *Password too*, with the
  password field appearing when the second is chosen.
- A **password panel** appears when a protected file is opened, and the file cannot be decrypted
  without it.
- A **recovery phrase panel** shows the twelve words after registration, with a copy button.
- The sign in screen gains a **restore my key on a new device** line that reveals a phrase field.
- The status line after a file is opened now reports both the fingerprint check and the signature
  check.

## The new endpoints and fields

| Method and path | Purpose |
|---|---|
| `POST /api/keys/backup` | stores the wrapped private key for the signed in account |
| `GET /api/keys/backup` | returns the wrapped private key |
| `POST /api/keys/recover` | returns the wrapped private key for a named account, before there is a session |

`GET /api/users` returns `signingKey` beside `publicKey`. `POST /api/register` and
`POST /api/google-signin` accept `signingKey`. `POST /api/shares` accepts `signature`, `protected`
and `passwordSalt`, and the share metadata returns all three.

## The check counts, to be exact

`npm test` reports **19 checks**. `npm run test:browser` reports **13 checks**, and the browser
test now also asserts that each account has a twelve word recovery phrase and a wrapped key on
the server, that the sender's signature checks out when the recipient opens the file, and that a
password protected share refuses the wrong password and opens with the right one.

## What to change

**ch3-system-design.md**
- Add the three keys to the section that describes the modules and the data the server holds: the
  signing key on the account record, the wrapped private key on the account record, the signature
  on the share record, and the protection mode and its salt.
- Extend the working principle with the three flows: signing at the moment of the share,
  wrapping the file key twice when a password is set, and the recovery flow on a new device.
- Extend the interface table with the three key endpoints.
- Extend the testing procedure with the three new areas.

**ch4-results.md**
- Add the three areas to the functional verification and to the test case table: the signature,
  the password protected share, and the recovery phrase.
- Extend the discussion with what the three keys buy: a file that is provably from the person who
  sent it, a file that cannot be opened without the password, and a device that can be replaced.
- Correct the limits. The view only limit now has the password exception, stated exactly as above.
  The key custody limit now has the recovery phrase as the answer, with its own honest limit: a
  phrase that is written down is a secret on paper.

**ch5-conclusion.md**
- Extend the conclusions to cover the three keys.
- Update the future work: key recovery is no longer missing, so it comes out and is replaced by
  what is still missing, which is a signing key that is hardware backed, a recovery scheme that
  does not depend on a written phrase, and forward secrecy.

## Rules

- British spelling, as the existing draft uses.
- No em dashes in body text. Use a comma, a full stop or a colon.
- Every table needs a caption line above it, in the style the file already uses.
- Do not cite any source that is not already in `references.md`.
- Do not add a bibliography, an appendix or a chapter; you are editing three chapters only.
- When you are done, reply with a short list of the sections you changed, in one paragraph.
