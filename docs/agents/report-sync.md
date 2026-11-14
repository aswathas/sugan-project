# Brief: bring the SecureShare report in step with the code after the security pass

Work in `C:\Users\ADMIN\Projects\sugan-project`.

**Touch exactly these three files:** `docs/report-draft/ch3-system-design.md`,
`docs/report-draft/ch4-results.md` and `docs/report-draft/appendices.md`.
Do not touch anything else and do not run the builders — the build is run
afterwards by someone else.

## Why

A review of the running code found twelve defects and the fixes changed the
behaviour the report describes. A report that disagrees with its own
repository is worse than no report, so these three files are being brought
back into step. The voice, the structure and the table formats must not
change: the report is written in the third person, in plain measured English,
and the builder parses the Markdown, so the tables must keep their shape.

## Chapter 3, System Design

**The signed string.** The signature now covers the permission and the expiry
as well. Step 7 currently reads:

> 7. Compute SIG = Sign(S_sender, "from|to|filename|size|H|IV").

It must now read:

> 7. Compute SIG = Sign(S_sender, "from|to|filename|size|H|IV|P|EXP").

where P is the permission and EXP is the expiry moment. Say in the prose
around it why: the permission is the field the recipient relies on when it
decides whether the file may be saved, so a server that quietly changed it
would break the signature instead of quietly granting it.

**The expiry is set by the sender.** The sender chooses the moment the file
dies, as an absolute time, and sends it with the share. The server refuses an
expiry that is in the past or more than thirty days away, and stores the value
it was given. This is what makes the expiry signable: the recipient rebuilds
the same string from the metadata and the signature still holds. Step 10 of
the algorithm, and the sentence about the share record, must say this.

**The recipient opens both wraps.** Step 12 currently reads:

> 12. In R's browser, if M is password, prompt for the password, derive K_pw and recover K = AES-KW^-1(K_pw, CK2); otherwise recover K = D(K_priv, CK).

The implementation always recovers K from CK with the recipient's private key,
and when M is password it also recovers K from CK2 with the password, and
checks that the two are the same key. Neither wrap alone opens the file, and
the password is at least ten characters long. Rewrite that step and the
paragraph after the list so they say this.

**The server's share record.** The paragraph that lists what a share record
holds must also mention the second wrapped key, the password salt when there
is one, and the number of bytes the server actually stored, which is the
ciphertext length and not the length of the file that went in.

## Chapter 4, Results

The verification now covers more areas and more checks. The paragraph that
opens the chapter lists the areas covered; extend it with the new ones:

- the trash shows only the shares the reader was a party to, never another
  user's deleted files
- the password protected share is wrapped twice, and the recipient needs both
  the recipient's key and the password
- the signature covers the permission and the expiry
- the details panel shows the whole chain for one file: the fingerprint, the
  signature, the stored bytes and the protection
- the security receipt can be copied
- a file that arrives while the page is open is announced
- the headers and the favicon leave the Google sign-in button working

Add the new test cases to Table 4.1 with the next numbers, TC-46 onwards.
The table has a column for the case, the steps, the expected result, the
result and the verdict. Use these:

| TC-46 | Another user's deleted shares are asked for as the signed in user | The trash list holds only the shares the reader was a party to | Empty | Pass |
| TC-47 | The response headers and the favicon are read | The referrer policy lets Google see the origin, the policy allows the button's stylesheet, the favicon is served | All three hold | Pass |
| TC-48 | The details panel of a received file is opened | The fingerprint, the signature, the stored bytes and the protection are all shown | All four are shown | Pass |
| TC-49 | The security receipt is copied | The receipt for that file is written to the clipboard | A toast confirms the copy | Pass |
| TC-50 | A file is shared while the recipient's page is open | The recipient is told the file arrived | A toast names the file | Pass |

Add a short paragraph after the table, in the same voice as the paragraphs
already there, that says what these five cases establish: that the trash is
scoped to the reader, that the headers do not break the third-party sign-in,
that the details panel and the receipt report the real state of a share, and
that a share is announced when it arrives. Do not use the word "additionally".

## Appendices 1 and 2

**The counts changed.** The suites grew while the report was being written.

- `npm test` now prints **20** lines, not 19: sixteen from the server contract
  and four from the Google verification.
- `npm run test:browser` now prints **23** lines, not 22.
- `npm run test:live` still prints **15** lines.
- `npm run test:all` still runs **10** steps.

Fix the counts everywhere they appear in Appendix 1 and Appendix 2, including
the sentences that tie the lines to Table 4.1 and the line range references.
The test case table in Chapter 4 now runs to TC-50, so the ranges in the
appendix must be updated to match.

**The reproduced output must be the real output.** Replace the blocks with
these, exactly.

`npm test`:

```
PASS  register + email one-time code verification
PASS  unverified account cannot sign in, wrong code rejected
PASS  register + login + keypair publish
PASS  encrypt in browser, server stores ciphertext only
PASS  recipient decrypts to the original bytes
PASS  third party cannot list or fetch the share (403)
PASS  wrong password rejected (401)
PASS  the demo access code gates registration (403 without it, 201 with it)
PASS  an expired share gives up its bytes (410) and says so
PASS  the sender can revoke, the recipient cannot, and an opened share is too late
PASS  the activity trail records the sends and the revoke, and hides other people
PASS  the audit trail is a hash chain and it checks out
PASS  repeated failed sign-ins and wrong codes are locked out
PASS  signing out everywhere ends every session of the account
PASS  starring is per user, and delete, restore and purge behave
PASS  the headers and the favicon leave the Google button working
PASS  the client id is published for the browser
PASS  a valid Google token signs the user in and stores the key pair
PASS  an existing account keeps the key it already published
PASS  wrong audience, wrong issuer, expired, tampered, forged and malformed tokens are all refused
```

`npm run test:browser`:

```
PASS  alice has a twelve word recovery phrase and a wrapped key on the server
PASS  bob has a twelve word recovery phrase and a wrapped key on the server
PASS  two users registered in two separate browser profiles
PASS  the Google sign-in button is wired to the client id and the origin the server publishes
PASS  private key lives in the browser, non-extractable
PASS  the dashboard counts the share and the evidence panel shows different bytes
PASS  file encrypted in the browser and sent to bob
PASS  server disk holds ciphertext, not the file
PASS  the card carries the permission and the self-destruct timer
PASS  the sender revoked the file and the activity panel records what happened
PASS  the recipient dashboard shows the incoming shares, one of them revoked
PASS  recipient decrypted in the browser, verified and signed
PASS  a password protected share refuses the wrong password and opens with the right one
PASS  the sign in screen explains how the encryption works
PASS  the card carries a file type chip
PASS  the actions give a toast
PASS  the filter chips narrow the view
PASS  the bulk bar appears with the count
PASS  a card has a context menu that closes on Escape
PASS  the shortcut list opens and names the keys
PASS  the details panel shows the whole chain for a file
PASS  the security receipt can be copied
PASS  a file that arrives is announced

ALL BROWSER CHECKS PASSED
```

**The sign in screen.** Appendix 1 describes the interface. It must now
describe the sign-in page as it is: a hero with the action and the terms in
one line under it, the workspace as a captured screen, three named moments
from send to receipt with the real screens, the real encryption code, the
questions a visitor asks, and the action again at the close. No newsletter.

## The bar

- Read each file before you write it, and keep its voice.
- Do not claim a check that is not in the output above.
- Do not change the table formats; the builder reads them.
- Do not add new headings above `## Appendix 1`.
- The three files must agree with each other about the counts and the test
  case numbers.

## Report back

- The changed passages of Chapter 3, quoted.
- The new Table 4.1 rows and the paragraph after the table.
- The new counts in the appendices.
- The word count of each file before and after.
