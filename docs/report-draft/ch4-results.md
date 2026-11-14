# Chapter 4 Results and Discussion

## 4.1 Functional Verification

The prototype was verified against the objectives stated in Chapter 1 by running the two test layers described in Section 3.8. The first layer, `npm test`, executes the Node self-test and the Google verification test and reports eighteen checks on the server contract. The second layer, `npm run test:browser`, launches headless Chrome and drives the real interface in two separate browser profiles, and reports nine checks. Both layers completed with every check passing. This section reports what was observed, and the raw console output is reproduced in Appendix 2.

The functional verification covered eleven areas: registration and the one-time code, the demo access code, session behaviour, key publication and custody, the encryption and sharing path, the unauthorised-access scenario, expiry and revocation, the audit trail and its chain, the abuse controls, Google sign-in, and the dashboard with its integrity badge. Each area corresponds to one or more test cases in Table 4.1.

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
| TC-16 | Register without the demo access code when one is configured | 403 before any other check | Refused with 403 | Pass |
| TC-17 | Register with the correct demo access code | 201; account created unverified | Account created, code issued | Pass |
| TC-18 | Fetch the blob of an expired share | 410; state reported as expired | Refused with 410; state expired | Pass |
| TC-19 | Sender revokes a share the recipient has not opened | 200; share becomes revoked and its bytes are refused | Revoked; blob refused | Pass |
| TC-20 | Recipient attempts to revoke a share | 403 | Refused with 403 | Pass |
| TC-21 | Sender revokes a share the recipient has already opened | 409 | Refused with 409 | Pass |
| TC-22 | Read the activity trail as sender, recipient and third user | Own events only; third user sees none | Own events only | Pass |
| TC-23 | Call the chain verification endpoint against an untampered trail | Chain reported intact, with the entry count | Intact, entries reported | Pass |
| TC-24 | Attempt to sign in five times with a wrong password, then once more; and submit five wrong one-time codes | 429 once the attempt limit is reached | Locked out with 429 in both cases | Pass |
| TC-25 | Sign out everywhere, then reuse the old session cookie | 200, session ended; old cookie refused with 401 | Session ended; old cookie refused | Pass |
| TC-26 | Present a Google token with a wrong audience, wrong issuer, expired time, tampered payload, forged signature or malformed structure | All refused | All refused | Pass |
| TC-27 | Sign in with a valid Google token and check an existing account's key | Account linked, session started, existing key kept | Linked, session started, key kept | Pass |
| TC-28 | Read the dashboard counts and the evidence panel after a send | Count updated; stored bytes differ from the original | Count updated; bytes differ | Pass |
| TC-29 | Read a card after a send with a permission and a lifetime | Permission badge and self-destruct state shown | Both shown | Pass |
| TC-30 | Recipient views a revoked share and attempts to open it | Card says revoked; open refused | Card says revoked; open refused | Pass |
| TC-31 | Recipient opens a share and the card is read again | Bytes equal the original; card reads verified | Bytes equal; verified shown | Pass |

The distinction between TC-01 to TC-27 and TC-28 to TC-31 is the layer that exercised them. TC-01 to TC-11 and TC-16 to TC-27 were established by the Node layer, which calls the HTTP interface directly; the bulk of them belong to the server self-test and the last two to the Google verification test. TC-12 to TC-15 and TC-28 to TC-31 were established by the headless browser test, which drives the actual forms and buttons. Together they show that the server contract is correct and that the delivered interface reaches it.

## 4.2 Results of the Node Self-Test

`npm test` ran two suites. The server self-test registered three users, verified them, and exercised the share path, the access code, expiry, revocation and the activity trail. The Google verification test then exercised the sign-in path. The eighteen checks that the run printed are reproduced in Table 4.2.

Table 4.2 Results of the Node self-test and the Google verification test

| Check | Result |
|---|---|
| Register and verify with the email one-time code | PASS |
| Unverified account cannot sign in; wrong code rejected | PASS |
| Register, sign in and publish the key pair | PASS |
| Encrypt in the browser; the server stores ciphertext only | PASS |
| Recipient decrypts to the original bytes | PASS |
| Third party cannot list or fetch the share (403) | PASS |
| Wrong password rejected (401) | PASS |
| The demo access code gates registration (403 without it, 201 with it) | PASS |
| An expired share gives up its bytes (410) and says so | PASS |
| The sender can revoke, the recipient cannot, and an opened share is too late | PASS |
| The activity trail records the sends and the revoke, and hides other people | PASS |
| The audit trail is a hash chain and it checks out | PASS |
| Repeated failed sign-ins and wrong codes are locked out | PASS |
| Signing out everywhere ends every session of the account | PASS |
| The client id is published for the browser | PASS |
| A valid Google token signs the user in and stores the key pair | PASS |
| An existing account keeps the key it already published | PASS |
| Wrong audience, wrong issuer, expired, tampered, forged and malformed tokens are all refused | PASS |

Several results are especially significant. The first is that the unverified account is refused at sign-in with 403, which confirms that the verification flag is enforced on the server and not merely in the interface. The second is that the stored blob does not contain the plaintext marker, which confirms that the server disk holds ciphertext. The third is that the third user receives 403 on the blob, which confirms that access is checked per share against the authenticated session and not against a client-supplied identifier.

The access-code result is significant for a different reason. The code is checked before the username is examined, so a stranger who does not hold the code receives 403 whether or not the username exists. The result is therefore evidence about the order of the checks and not only about the code itself. The expiry and revocation results have the same character: the bytes are refused with 410, the recipient is refused with 403 when it attempts a revocation, and the sender is refused with 409 once the share has been opened. These are server decisions, and the test reaches them through the HTTP interface.

The activity result shows that the trail records the events and that it is filtered. Each of the three users read the trail, and the events belonging to one account did not appear in another account's response. The chain check goes one step further: the same run called the verification endpoint and the chain was reported intact, with an entry count that matches the events the other assertions had already seen. That is the only result in the layer that reads the trail as a data structure rather than as a feed, and it is what turns the entries from a log into a chain.

The two abuse controls and the session control are last. The lockout was reached by five wrong passwords against one name, after which the sixth attempt was answered with 429; the same bound was reached on the one-time code with five wrong codes, after which the code was discarded and the attempt answered with 429. Both results are about state that the server keeps between requests, so neither could be proved from the interface alone. The sign-out-everywhere result has the same character: the call reported the number of sessions it ended, and the cookie that had been valid a moment earlier then received 401 at `/api/me`. That is a direct demonstration that the session lives on the server and that the cookie is only a handle to it.

The Google suite is the last group. Its value lies in the negative cases: a token whose payload has been altered, whose signature has been forged, whose audience or issuer is wrong, or whose structure is malformed is refused before any session is created. A check that accepted only well-formed tokens from this application and rejected the rest is what makes the Google path an authentication mechanism rather than a formality.

## 4.3 Results of the Headless Browser Verification

The headless browser test drove the real interface in two separate Chrome profiles. Its console output is reproduced in Table 4.3.

Table 4.3 Results of the headless browser verification

| Check | Result |
|---|---|
| Two users registered in two separate browser profiles | PASS |
| Private key lives in the browser, non-extractable | PASS |
| The dashboard counts the share and the evidence panel shows different bytes | PASS |
| File encrypted in the browser and sent to Bob | PASS |
| Server disk holds ciphertext, not the file | PASS |
| The card carries the permission and the self-destruct timer | PASS |
| The sender revoked the file and the activity panel records what happened | PASS |
| The recipient dashboard shows the incoming shares, one of them revoked | PASS |
| Recipient decrypted in the browser, verified against the sender fingerprint | PASS |

The second of these checks deserves emphasis. The test opened the first user's IndexedDB directly and read the stored `CryptoKey`. It confirmed both that the key was present and that its `extractable` property was `false`. This is a property of the platform: a non-extractable key can be used for decryption but cannot be exported by page script, so the private key cannot be copied out of the browser even by code running in the page. The check is therefore evidence for the fourth objective, that private keys never leave the user's device, and not merely evidence that the application did not choose to send them.

The disk check is the direct evidence for the third objective. The test planted a marker string in the PDF, sent it, found the single blob on disk and asserted that the marker did not appear in the blob. Because the blob is the only place the server stores file content, the check establishes that the server holds ciphertext and not the file.

The dashboard and evidence check ties the interface to that storage. After the send, the rail count and the card agree that one file has been sent, and the evidence panel shows the sender's first bytes beside the bytes the server really holds, which are not the same. The panel also names the blob file on disk, so the comparison can be repeated by hand or with `npm run show:ciphertext`. A claim about ciphertext on disk is usually an assertion about code; here it is an observation about the running system.

The permission and self-destruct check reads the card after the send and finds the permission badge and the lifetime that the sender chose. The revocation check then has the sender call the share off and reads the activity panel, which records the event. The recipient's dashboard is read afterwards: it shows the incoming shares and marks one of them revoked, with its action disabled. Together these establish that the card state is derived from the server's record and not from a local guess. The final check is the evidence for the integrity feature. The recipient decrypts through the interface, the recovered bytes equal the original, and the card then reads verified against the sender's fingerprint; for a view-only share the status line also states that there is no save button.

## 4.4 Screen Figures

The screenshots below were captured during the headless run. They show the interface that a user actually sees, not a mock-up.

Figure 4.1 Registration and browser-side key generation

[FIGURE: docs/screenshots/00-register.png]

Figure 4.1 shows the registration form, with the Sign in and Register tabs and the username, email and password fields. The note beneath the password field states that the key pair is generated in this browser and that the private key is stored on the device and never sent to the server. Submitting the form both creates the account and generates the key pair.

Figure 4.2 Verifying the account with the one-time code

[FIGURE: docs/screenshots/01-verify.png]

Figure 4.2 shows the verification step that follows registration. The account exists but cannot be used until the six-digit code is entered. In the default configuration no mail service is configured, so the screen states that the code is shown in demo mode and that it would arrive by email if a mail service were set up. This is the path that remains the verified one in the demonstration.

Figure 4.3 The New route of the dashboard with the file field, recipient selection and permission

[FIGURE: docs/screenshots/02-share-panel.png]

Figure 4.3 shows the New route of the dashboard. The left rail carries the New button, the counts for Shared with me, Sent by me and Recent, and the total number of ciphertext bytes the account holds on the server, which is zero before the first send. The search box beside the wordmark filters the cards by file name. The route is a sequence of steps: the file field, which states that a file may be dropped on it and that the limit is 25 MB; the recipient selector, with the fingerprint of the selected recipient's public key beneath it; and the two permission cells, View only and View and download. The four self-destruct cells, Never, 1 hour, 1 day and 7 days, and the button that performs the encryption follow immediately below the visible area, and are described in Section 3.6.

Figure 4.4 The Sent by me view after a send, with the evidence panel

[FIGURE: docs/screenshots/03-sent.png]

Figure 4.4 shows the dashboard after the file has been sent. The rail counts have moved to one for Sent by me and one for Recent, and the ciphertext total shows the size the server now holds. The card records the recipient, the size, the time and the view-only badge, and offers the Revoke action. Beneath the cards the evidence panel shows the sender's first bytes beside the bytes the server really holds on disk and names the blob file, so that the comparison can be repeated outside the browser.

Figure 4.5 The Shared with me view with live marks, a self-destruct timer and a revoked share

[FIGURE: docs/screenshots/04-inbox.png]

Figure 4.5 shows the recipient's dashboard after two files have arrived. The rail counts two files in Shared with me and in Recent, and the heading states that two are unopened, which is what the live marks on the cards record. One card carries the self-destruct state, expires in 60 min. The other is marked revoked and its action is disabled, because the sender called it off before it was opened. Neither card offers a save action, because both were sent view only.

Figure 4.6 The same view after the recipient has opened one share

[FIGURE: docs/screenshots/05-decrypted.png]

Figure 4.6 shows the same dashboard after the recipient has opened one of the two files. The unopened count has fallen from two to one and the opened card has lost its live mark. The card now carries the opened and verified badges, and the status line above the cards states that the file was verified against the sender fingerprint, that it was opened in a new tab and that it has no save button because the sender marked it view only. The revoked share is unchanged and still cannot be opened.

The activity panel is part of the same dashboard, below the evidence panel. It lists the sends, opens and revocations in the order they occurred and states whether the chain verifies. It falls below the captured viewport in these figures, so it is read by the browser test rather than shown here.

## 4.5 Discussion

The results establish the central claim of the project in a direct way. The server was shown to hold ciphertext, and the recipient was shown to recover the original bytes without the server's participation. Since the private key was shown to be non-extractable and present only in the recipient's browser, and since the AES key exists only in wrapped form on the server, there is no operation available to the server that would recover the plaintext. The claim is not that the server is trustworthy; it is that the server is not needed for decryption at all.

The authentication results establish the second objective in its narrower sense. The password is hashed with scrypt, and a wrong password is rejected with 401. The one-time code is required before the account can be used: an unverified account receives 403 at sign-in, and a wrong code receives 401. The code is stored as a hash and discarded once the account is verified. The session is a server-side token in an HttpOnly cookie, so page script cannot read it.

Two additions widen this result. The demo access code puts a shared secret in front of registration and is checked before the username is examined, so it both keeps strangers out and prevents the form from being used to test which accounts exist. The Google path adds a second route in which the identity is asserted by a third party and verified on the server. The test showed that a token with a wrong audience, a wrong issuer, an expired time, a tampered payload, a forged signature or a malformed structure is refused, and that is the behaviour that makes the route worth having. Its cost is an external dependency and a client id in the configuration; the one-time code remains the path that works with nothing configured, which is why it remains the demonstrated one.

The access-control result is more modest, and it is important to state it accurately. The share record carries a permission, chosen by the sender, of view or download, and the interface reflects that permission when the share is opened. For a view share the decrypted content is presented with no save affordance; for a download share the file is saved. This is a real and useful behaviour, and it matches the client's requirement, but it is an interface-level rule. Because the file is decrypted in the recipient's browser, the plaintext necessarily exists in the recipient's browser at the moment it is displayed. A recipient who is determined to retain a copy can use the browser's developer tools, its print function or a screen capture, and no cryptographic mechanism in this design prevents that. The permission governs the ordinary path through the interface, not the determined recipient. This limit is stated again in the conclusions.

Expiry and revocation are stronger, because they are enforced where the bytes are served rather than where they are displayed. Revocation is refused once the share has been opened, which matches its purpose: it is a way to call back a file that has not been collected, not a way to retract one that has. Expiry is enforced on every request for the blob, so a share whose time has passed cannot be fetched even by a recipient who still holds its card. Both are server decisions, both leave the metadata in place so that the interface can explain the state, and neither deletes the ciphertext from disk.

The integrity check buys a different property. AES-GCM already fails to decrypt altered ciphertext, but it does not say whether the plaintext recovered is the file the sender selected; the fingerprint does. The recipient's browser recomputes it and the card reads verified only when the two agree. The cost is recorded in the limits: the server stores the fingerprint, so it holds a content hash of the plaintext. That is a small leak, but it is a real one, because a party who can guess the file can confirm the guess. The check also depends on the server returning the fingerprint it stored, so it detects corruption and accidental mismatch more readily than a server that rewrites its own record. It is not a signature and does not establish origin.

The audit trail turns a set of state changes into a history. Every send, open and revocation is appended with a timestamp, the account and the share, and each entry carries the hash of the one before it, so an entry that is altered or removed breaks the chain. `GET /api/activity/verify` reports whether the chain holds, and the trail is filtered so that an account sees only the events attached to its own shares. What this buys is tamper evidence and a per-account account of what happened. What it costs is that the trail is produced and stored by the same server it describes: an operator who rewrites the whole chain from the first entry produces a chain that verifies. It is evidence of what the server recorded, not independent proof of what the server did.

The dashboard is not decoration. The earlier interface exposed the same operations but not the state: a sender could not see at a glance which cards were unopened, which had expired, which were revoked or what permission each carried. The rail counts, the permission badge, the live marks and the evidence panel make those states visible, and the search box keeps a longer list usable. The cost is more client code in the same single script and no framework to organise it; the browser test exists partly because that code is now large enough to be worth driving end to end.

The hardening measures raise the cost of the ordinary attacks. The content security policy narrows where script may be loaded from, the framing and sniffing headers close two well-known routes, the sign-in lockout and the one-time-code attempt limit slow a guessing attack, the password minimum raises the floor, and the share cap stops one account from filling the disk. Two of these were reached by the tests rather than merely asserted: the lockout answered 429 at the sixth wrong password, and the one-time code was discarded after five wrong attempts. Signing out everywhere was demonstrated by ending the account's sessions and then being refused with 401 by the endpoint that had answered a moment earlier, which is what distinguishes a session on the server from a claim in the cookie. Each control is a bound on abuse rather than a proof of safety, and the limits below record where the bounds stop: the lockout covers sign-in and codes, not the download endpoint, and the access code is one secret shared by everyone who is admitted.

The zero-dependency requirement was also met, and it has a practical consequence that the results demonstrate. The whole system was exercised on a machine with Node.js and a browser and nothing else installed. There was no package to fetch, no database to configure and no external service to reach; the one-time code was printed by the default mailer and shown on screen. The Google verifier is part of this result: it was written against `node:crypto` and the built-in `fetch` rather than an identity library. This is what makes the demonstration repeatable on an arbitrary laptop.

## 4.6 Limits of the Prototype

The prototype has limits that follow from its scope, and they are recorded here so that the conclusions are not read as broader than the evidence.

The first limit is the access-control semantics described above. The view permission is an interface convention, not a cryptographic guarantee, because the recipient holds the plaintext after decryption.

The second limit is key custody. The private key exists only in one browser profile on one device. If that device is lost or the browser's storage is cleared, the private key is lost and the files addressed to that account can no longer be decrypted by anyone, including the server. There is no key backup, no recovery mechanism and no way to re-issue a key pair for an account.

The third limit is that revocation is a refusal to serve and not a retraction. If the recipient has already opened or downloaded the file, the copy is beyond the system's reach, and once a share has been opened it can no longer be revoked at all. Neither revocation nor expiry deletes the blob from disk; the server stops handing it over. Revocation is therefore a way to call back an uncollected file, not a way to unshare one that has been collected.

The fourth limit concerns the integrity fingerprint. The server holds the SHA-256 hash of the plaintext, so it holds a content fingerprint. A party who can guess the file can confirm the guess, and because the server supplies both the blob and the fingerprint, a server that rewrites its record can present a different file together with a matching fingerprint. AES-GCM still detects alteration of the ciphertext, but there is no signature over the share made with a sender's signing key, so there is no independently verifiable proof of origin. The fingerprint establishes integrity relative to the sender's recorded value, not authorship.

The fifth limit is the audit trail. It is produced and stored by the server, and the chain is computed by the same process that writes the entries. The chain detects an edit or a deletion made without recomputing it, but an operator who rewrites the whole chain from the first entry produces a chain that verifies. The trail is tamper-evident, not tamper-proof, and it is not independent evidence of what the server did.

The sixth limit is deployment. The server uses a single JSON file and a single blob directory on one machine. This is adequate for a prototype and for the demonstration, but it is not a service: it has no replication, no backup and no concurrency control beyond what a single Node.js process provides. When the demonstration is shown remotely it is reached through a development tunnel whose public address rotates on each start, and the system terminates no TLS itself. It therefore has no stable endpoint and no certificate of its own, and any transport protection comes from the tunnel rather than from the system.

The seventh limit is the absence of roles. Every account is an ordinary user. There is no administrator role, no separation between the person who operates the server and the people who use it, and no policy layer of the kind the attribute-based schemes in Chapter 2 provide.

The eighth limit is rate limiting. The lockout covers sign-in and the attempt limit covers one-time codes, but the download endpoint is not rate limited. A recipient, or anyone holding a stolen session, can fetch a share's blob repeatedly, and the server keeps no per-account request or bandwidth budget.

The ninth limit is that the Google path is optional. It is verified when a client id is configured, and the button is absent when none is. The demonstrated authentication path is the username, password and email one-time code; the Google route is an addition to it and depends on an external identity provider.

These limits do not undermine the results. They define what the results are results about: a working prototype of end-to-end encrypted sharing with a per-file permission, a self-destruct timer, sender revocation, an integrity check and a tamper-evident trail, verified against the running system, on a single machine, with no external dependency in the demonstrated path.
