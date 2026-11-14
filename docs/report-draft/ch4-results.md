# Chapter 4 Results and Discussion

## 4.1 Functional Verification

The prototype was verified against the objectives stated in Chapter 1 by running the two test layers described in Section 3.8. The first layer, `npm test`, executes the Node self-test and reports the server contract. The second layer, `npm run test:browser`, launches headless Chrome and drives the real interface in two separate browser profiles. Both layers completed with every check passing. This section reports what was observed, and the raw console output is reproduced in Appendix 2.

The functional verification covered five areas: registration and the one-time code, session behaviour, key publication and custody, the encryption and sharing path, and the unauthorised-access scenario. Each area corresponds to one or more test cases in Table 4.1.

Table 4.1 Functional test cases and their outcomes

| Test case | Description | Expected result | Observed result | Status |
|---|---|---|---|---|
| TC-01 | Register a new user with username, email, password and public key | 201; account created unverified | Account created, code issued | Pass |
| TC-02 | Attempt to sign in before verifying the account | 403 | Refused with 403 | Pass |
| TC-03 | Verify with the correct six-digit code | 200; session cookie issued | Verified, session started | Pass |
| TC-04 | Verify with a wrong six-digit code | 401 | Rejected with 401 | Pass |
| TC-05 | Sign in with the wrong password | 401 | Rejected with 401 | Pass |
| TC-06 | Compare the published public key with the key supplied at registration | Identical | Identical | Pass |
| TC-07 | List shares for the sender | One sent share, empty inbox | One sent share, empty inbox | Pass |
| TC-08 | List shares for the recipient | One received share with the correct filename | One received share, filename correct | Pass |
| TC-09 | Third user attempts to list the share and fetch its blob | No share listed; 403 on the blob | No share listed; 403 on the blob | Pass |
| TC-10 | Inspect the stored blob for the plaintext marker | Marker absent | Marker absent | Pass |
| TC-11 | Recipient decrypts the ciphertext | Bytes equal to the original | Bytes equal to the original | Pass |
| TC-12 | Inspect the private key stored in the browser | Present and non-extractable | Present and non-extractable | Pass |
| TC-13 | Register two users through the real interface in two profiles | Both signed in, separately | Both signed in, separately | Pass |
| TC-14 | Send a PDF through the real share panel | Exactly one ciphertext blob on disk | Exactly one blob, no plaintext | Pass |
| TC-15 | Recipient opens the inbox and decrypts through the real interface | Original bytes returned | Original bytes returned | Pass |

The distinction between TC-01 to TC-11 and TC-12 to TC-15 is the layer that exercised them. TC-01 to TC-11 were established by the Node self-test, which calls the HTTP interface directly. TC-12 to TC-15 were established by the headless browser test, which drives the actual forms and buttons. Together they show that the server contract is correct and that the delivered interface reaches it.

## 4.2 Results of the Node Self-Test

The Node self-test registered three users, verified them, and exercised the share path end to end. Its console output is reproduced in Table 4.2.

Table 4.2 Results of the Node self-test

| Check | Result |
|---|---|
| Register and verify with the email one-time code | PASS |
| Unverified account cannot sign in; wrong code rejected | PASS |
| Register, sign in and publish the key pair | PASS |
| Encrypt in the browser; the server stores ciphertext only | PASS |
| Recipient decrypts to the original bytes | PASS |
| Third party cannot list or fetch the share (403) | PASS |
| Wrong password rejected (401) | PASS |

Three results are especially significant. The first is that the unverified account is refused at sign-in with 403, which confirms that the verification flag is enforced on the server and not merely in the interface. The second is that the stored blob does not contain the plaintext marker, which confirms that the server disk holds ciphertext. The third is that the third user receives 403 on the blob, which confirms that access is checked per share against the authenticated session and not against a client-supplied identifier.

## 4.3 Results of the Headless Browser Verification

The headless browser test drove the real interface in two separate Chrome profiles. Its console output is reproduced in Table 4.3.

Table 4.3 Results of the headless browser verification

| Check | Result |
|---|---|
| Two users registered in two separate browser profiles | PASS |
| Private key lives in the browser and is non-extractable | PASS |
| File encrypted in the browser and sent to the recipient | PASS |
| Server disk holds ciphertext, not the file | PASS |
| Recipient decrypted in the browser to the original bytes | PASS |

The second of these checks deserves emphasis. The test opened the first user's IndexedDB directly and read the stored `CryptoKey`. It confirmed both that the key was present and that its `extractable` property was `false`. This is a property of the platform: a non-extractable key can be used for decryption but cannot be exported by page script, so the private key cannot be copied out of the browser even by code running in the page. The check is therefore evidence for the fourth objective, that private keys never leave the user's device, and not merely evidence that the application did not choose to send them.

The fourth check is the direct evidence for the third objective. The test planted a marker string in the PDF, sent it, found the single blob on disk and asserted that the marker did not appear in the blob. Because the blob is the only place the server stores file content, the check establishes that the server holds ciphertext and not the file.

## 4.4 Screen Figures

The screenshots below were captured during the headless run. They show the interface that a user actually sees, not a mock-up.

Figure 4.1 Registration and browser-side key generation

[FIGURE: docs/screenshots/00-register.png]

Figure 4.1 shows the registration form. The note beneath the password field states that the key pair is generated in the browser and that the private key is stored on the device only. Submitting the form both creates the account and generates the key pair.

Figure 4.2 Verifying the account with the one-time code

[FIGURE: docs/screenshots/01-verify.png]

Figure 4.2 shows the verification step that follows registration. The account exists but cannot be used until the six-digit code is entered. In the default configuration no mail service is involved, so the server prints the code in its terminal and the interface states that it is being shown because none is configured.

Figure 4.3 The share panel with recipient selection and the access-control choice

[FIGURE: docs/screenshots/02-share-panel.png]

Figure 4.3 shows the signed-in view. The share panel is arranged as a route: a file selector, a recipient selector, the access-control choice and the button that performs the encryption. Beneath the recipient selector the interface displays the fingerprint of the selected recipient's public key, so that the sender can see which key the file will be encrypted to before pressing the button. The access control is presented as two cells rather than a dropdown: the chosen cell is the one that will be recorded with the share. The column on the right carries the two boards, the shares received and the shares sent.

Figure 4.4 The sender's sent list

[FIGURE: docs/screenshots/03-sent.png]

Figure 4.4 shows the sender's own board after the file has been sent. The row records the recipient, the size, the time and the permission that was attached to the share. The interface confirms that the server holds ciphertext only.

Figure 4.5 The recipient's inbox with the live mark on an unopened share

[FIGURE: docs/screenshots/04-inbox.png]

Figure 4.5 shows the recipient's inbox after the shared file has arrived. The entry records the sender, the size, the time and the permission, and carries a live mark because the share has not been opened on this device yet. The action opens the share: for a download share it saves the file, and for a view share it opens the decrypted content without a save affordance.

Figure 4.6 The inbox after decryption

[FIGURE: docs/screenshots/05-decrypted.png]

Figure 4.6 shows the same inbox after the recipient has opened the share. The live mark has been retired, because the share is no longer unread on this device, and the status line below the send panel records what the decryption produced.

## 4.5 Discussion

The results establish the central claim of the project in a direct way. The server was shown to hold ciphertext, and the recipient was shown to recover the original bytes without the server's participation. Since the private key was shown to be non-extractable and present only in the recipient's browser, and since the AES key exists only in wrapped form on the server, there is no operation available to the server that would recover the plaintext. The claim is not that the server is trustworthy; it is that the server is not needed for decryption at all.

The authentication results establish the second objective in its narrower sense. The password is hashed with scrypt, and a wrong password is rejected with 401. The one-time code is required before the account can be used: an unverified account receives 403 at sign-in, and a wrong code receives 401. The code is stored as a hash and discarded once the account is verified. The session is a server-side token in an HttpOnly cookie, so page script cannot read it.

The access-control result is more modest, and it is important to state it accurately. The share record carries a permission, chosen by the sender, of view or download, and the interface reflects that permission when the share is opened. For a view share the decrypted content is presented with no save affordance; for a download share the file is saved. This is a real and useful behaviour, and it matches the client's requirement, but it is an interface-level rule. Because the file is decrypted in the recipient's browser, the plaintext necessarily exists in the recipient's browser at the moment it is displayed. A recipient who is determined to retain a copy can use the browser's developer tools, its print function or a screen capture, and no cryptographic mechanism in this design prevents that. The permission governs the ordinary path through the interface, not the determined recipient. This limit is stated again in the conclusions.

The zero-dependency requirement was also met, and it has a practical consequence that the results demonstrate. The whole system was exercised on a machine with Node.js and a browser and nothing else installed. There was no package to fetch, no database to configure and no external service to reach; the one-time code was printed by the default mailer and shown on screen. This is what makes the demonstration repeatable on an arbitrary laptop.

## 4.6 Limits of the Prototype

The prototype has limits that follow from its scope, and they are recorded here so that the conclusions are not read as broader than the evidence.

The first limit is the access-control semantics described above. The view permission is an interface convention, not a cryptographic guarantee, because the recipient holds the plaintext after decryption.

The second limit is key custody. The private key exists only in one browser profile on one device. If that device is lost or the browser's storage is cleared, the private key is lost and the files addressed to that account can no longer be decrypted by anyone, including the server. There is no key backup, no recovery mechanism and no way to re-issue a key pair for an account.

The third limit is that there is no revocation. A share that has been made remains available to its recipient for as long as the recipient's key exists and the blob is on disk. The sender cannot withdraw it, and there is no mechanism to invalidate a recipient's access after the fact.

The fourth limit is that there is no audit trail. The server records when a share was created, but it does not record when a share was opened or by whom beyond the identity of the session that fetched the blob. There is no log of access events that an administrator could inspect.

The fifth limit is storage. The server uses a single JSON file and a single blob directory on one machine. This is adequate for a prototype and for the demonstration, but it is not a service: it has no replication, no backup and no concurrency control beyond what a single Node.js process provides.

The sixth limit is transport security. The prototype runs over plain HTTP on localhost. It does not present a certificate, and it does not therefore protect the session cookie or the ciphertext in transit against an attacker on the network. In the localhost demonstration this is acceptable because there is no network segment to attack. A public deployment would require HTTPS with a proper certificate, which is listed as future work.

The seventh limit is that the optional Google sign-in path is designed but not part of the verified prototype. The verified authentication path is the username, password and email one-time code described above.

The eighth limit concerns integrity. AES-GCM authenticates the ciphertext with a tag, and a modified ciphertext will fail to decrypt. There is, however, no separate digital signature over the share, so there is no independently verifiable proof of who created a given ciphertext. The authentication tag detects accidental or malicious modification, but it does not establish origin. A signature is listed as future work.

These limits do not undermine the results. They define what the results are results about: a working prototype of end-to-end encrypted sharing with a per-file permission, verified against the running system, on a single machine, with no external dependency.
