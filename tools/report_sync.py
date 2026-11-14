import io, os, sys

ROOT = r'C:\Users\ADMIN\Projects\sugan-project\docs\report-draft'
edits = []


def sub(fname, old, new, count=1):
    edits.append((fname, old, new, count))


# ---------------- Chapter 3 ----------------

sub('ch3-system-design.md',
    '| Server-side modules | `node:http`, `node:crypto`, `node:fs`, `node:path` and the built-in `fetch`; `node:crypto` also verifies the RS256 signature on a Google ID token and `fetch` retrieves Google\'s signing keys |',
    '| Server-side modules | `node:http`, `node:crypto`, `node:fs`, `node:path` and the built-in `fetch`; `node:crypto` also verifies the RS256 signature on a Google ID token and computes the RFC 6238 one-time codes, and `fetch` retrieves Google\'s signing keys |')

sub('ch3-system-design.md',
    '| 13 | Documentation | README, decision record, change inventory and this report |',
    '| 13 | Documentation | README, decision record, change inventory and this report |\n'
    '| 14 | Second factor and the anatomy | A time-based one-time password from an authenticator app, and the anatomy of the product written once and mounted on the sign in page and in the workspace |')

sub('ch3-system-design.md',
    'If Google sign-in is configured, the user may instead obtain an ID token from Google, which the server verifies before it links the account and sets the same cookie.',
    'If Google sign-in is configured, the user may instead obtain an ID token from Google, which the server verifies before it links the account and sets the same cookie. '
    'An account may also carry a second factor. When the user turns it on from the interface, the server issues a shared secret and an `otpauth://` address that Google Authenticator and every other authenticator app can read, and the secret stays pending until the user proves the app works by entering a code generated from it. '
    'From that point on the password alone does not open the account: the server answers the sign-in with a challenge, withholds the session, and issues it only when the challenge is met with a valid code.')

sub('ch3-system-design.md',
    'Expressed as an algorithm, the share path is as follows.',
    '**The second factor from an authenticator app.** The factor is a time-based one-time password, computed as RFC 6238 describes it and as every authenticator app expects. The server keeps a 160-bit random secret for the account, encoded in base32, and the app keeps the same secret. '
    'The code is the last six digits of an HMAC-SHA1 over the number of the current thirty-second step, taken from the dynamic truncation of the digest. '
    'The server recomputes the code from the secret and the step, accepts the current step and one step either side of it, so that a clock a little fast or a little slow still works, and compares the candidate codes in constant time so that the time taken does not say which one matched. '
    'A code is six digits and is therefore worth one part in a million, so the challenge behind it is short-lived and can be attempted only a few times. '
    'The interface shows the secret once, in groups of four, together with the `otpauth://` address that an app reads, and the factor is not live until the user has entered a code generated from it. '
    'Turning the factor on and off both require a valid code, so a session that is already open cannot be used to remove it, and the server records both events in the audit trail. '
    'Two properties are worth stating plainly. The factor works with no network and no mail service, because the code is derived from a secret and the clock and not sent by anyone. '
    'And because the secret is shared between the app and the server, a server that holds it could generate a valid code itself; that is true of every authenticator app, and it is why the factor is a second factor and not a second key. '
    'The email one-time code remains in place for the first sign-in, because it proves that the address belongs to the person who registered; the authenticator code proves that the person signing in also holds the device.')

sub('ch3-system-design.md',
    'a verification flag, the Google subject when the account was created through Google sign-in, the time the account was last active and a timestamp. '
    'Session records map an opaque token to a username and an expiry.',
    'a verification flag, the shared secret of the second factor when one has been turned on, the Google subject when the account was created through Google sign-in, the time the account was last active and a timestamp. '
    'Session records map an opaque token to a username and an expiry. '
    'A pending sign-in record holds a challenge token, the account the challenge is for, the moment it stops being valid and the number of wrong codes entered against it, and a pending factor record holds a secret that has been issued but not yet confirmed.')

sub('ch3-system-design.md',
    '| POST /api/login | Sign in with username and password | Public; 403 if unverified, 429 when locked out |',
    '| POST /api/login | Sign in with username and password | Public; 403 if unverified, 429 when locked out; returns a challenge instead of a session when a second factor is on |\n'
    '| POST /api/login/totp | Answer the challenge with the code from the authenticator app | Public; the challenge must be live and the code right |')

sub('ch3-system-design.md',
    '| GET /api/me | Return the signed-in account | Signed in |',
    '| GET /api/me | Return the signed-in account | Signed in |\n'
    '| GET /api/totp | Say whether the signed-in account has a second factor | Signed in |\n'
    '| POST /api/totp/enroll | Issue a secret and an `otpauth://` address for a new factor | Signed in; the secret is not live until confirmed |\n'
    '| POST /api/totp/confirm | Confirm the factor with a code from the app and turn it on | Signed in |\n'
    '| POST /api/totp/disable | Turn the factor off with a code from the app | Signed in |')

sub('ch3-system-design.md',
    'Every response also carries the security headers listed in Table 3.2,',
    'The second factor is a further control on the same line: the password is checked first, the session is withheld until the challenge is answered, the challenge expires after five minutes, and five wrong codes against it end it. '
    'Every response also carries the security headers listed in Table 3.2,')

sub('ch3-system-design.md',
    'and reports twenty checks.',
    'and reports twenty-one checks.')

# ---------------- Chapter 4 ----------------

sub('ch4-results.md',
    'reports twenty checks on the server contract. The second layer, `npm run test:browser`, launches headless Chrome and drives the real interface in two separate browser profiles, and reports twenty-three checks.',
    'reports twenty-one checks on the server contract. The second layer, `npm run test:browser`, launches headless Chrome and drives the real interface in two separate browser profiles, and reports twenty-five checks.')

sub('ch4-results.md',
    'The functional verification covered twenty-five areas:',
    'The functional verification covered twenty-seven areas:')

sub('ch4-results.md',
    'the announcement of an arriving share, and the workspace with its integrity badge.',
    'the announcement of an arriving share, the workspace with its integrity badge, the second factor from an authenticator app, and the anatomy of the product mounted in two places.')

sub('ch4-results.md',
    '| TC-50 | A file is shared while the recipient\'s page is open | The recipient is told the file arrived | A toast names the file | Pass |',
    '| TC-50 | A file is shared while the recipient\'s page is open | The recipient is told the file arrived | A toast names the file | Pass |\n'
    '| TC-51 | Enrol a second factor, then sign in with the password alone, with a wrong code and with the right code, and turn the factor off | The password alone is refused a session and returns a challenge; a wrong code is refused; the right code issues the session; the factor can then be turned off | Challenge issued with no session, wrong code refused with 401, right code issued the session, factor turned off | Pass |\n'
    '| TC-52 | Open the how-it-works panel inside the workspace | The panel carries the three moments, the real code sample and the questions | All three are present | Pass |\n'
    '| TC-53 | Turn the second factor on from the interface | The panel shows a secret and an `otpauth://` address, and the account asks for a code afterwards | Secret and address shown; the account then requires a code | Pass |')

sub('ch4-results.md',
    'These five cases extend the verification from the file and its decryption to the record around it.',
    'These eight cases extend the verification from the file and its decryption to the record around it.')

sub('ch4-results.md',
    'TC-50 establishes that a share is announced when it arrives, because a recipient whose page is already open is told the file has arrived by name.',
    'TC-50 establishes that a share is announced when it arrives, because a recipient whose page is already open is told the file has arrived by name. '
    'TC-51 establishes that the second factor holds the sign-in, because the password alone returned a challenge and no cookie at all, a wrong code was refused, and only the right code produced a session. '
    'TC-52 establishes that the anatomy of the product is one component rather than two copies of a page, because the panel inside the workspace carries the same three moments, the same code sample and the same questions as the sign in page. '
    'TC-53 establishes that the factor can be set up from the interface, because the panel showed a secret and an `otpauth://` address, and the account then refused the password on its own.')

sub('ch4-results.md',
    'TC-48 to TC-50 belong to the browser layer, because they are about what the interface reports about a share and about what it says when a share arrives.',
    'TC-48 to TC-50 belong to the browser layer, because they are about what the interface reports about a share and about what it says when a share arrives. '
    'TC-51 belongs to the Node layer, because it is about which cookies the server issues and not about a screen, and TC-52 and TC-53 belong to the browser layer, because the anatomy and the factor setup are both reached through the interface.')

sub('ch4-results.md',
    'The server self-test registered three users, verified them, and exercised the share path, the access code, expiry, revocation, starring, the trash and its scope to the reader, the activity trail and the response headers. The Google verification test then exercised the sign-in path. The twenty checks that the run printed are reproduced in Table 4.2.',
    'The server self-test registered three users, verified them, and exercised the share path, the access code, expiry, revocation, starring, the trash and its scope to the reader, the activity trail, the response headers and the second factor. The Google verification test then exercised the sign-in path. The twenty-one checks that the run printed are reproduced in Table 4.2.')

sub('ch4-results.md',
    '| The headers and the favicon leave the Google button working | PASS |\n'
    '| The client id is published for the browser | PASS |',
    '| The headers and the favicon leave the Google button working | PASS |\n'
    '| The second factor holds the sign-in until the code is given | PASS |\n'
    '| The client id is published for the browser | PASS |')

sub('ch4-results.md',
    '| A file that arrives is announced | PASS |\n'
    '\n'
    'The fifth of these checks deserves emphasis.',
    '| A file that arrives is announced | PASS |\n'
    '| The anatomy is one component, on the sign in page and in the app | PASS |\n'
    '| The authenticator app turns on the second factor from the page | PASS |\n'
    '\n'
    'The fifth of these checks deserves emphasis.')

sub('ch4-results.md',
    'The last three checks read the record around the file.',
    'The last two checks read the anatomy and the second factor. '
    'The anatomy is written once, as data, and mounted in two places: on the sign in page, where it introduces the product, and in the how-it-works panel inside the workspace, where it explains the product to a signed-in user. '
    'The check opens the panel and finds the same three moments, the same code sample and the same questions there, which is the evidence that there is one component and not two pages that happen to agree. '
    'The last check turns the second factor on from the interface: the panel shows a secret in groups of four and an `otpauth://` address that an authenticator app reads, the code computed from that secret is accepted, and the account then refuses to open on the password alone. '
    'Both checks concern what the interface offers rather than what the server holds, which is why they sit in this layer.\n\n'
    'The three checks before them read the record around the file.')

# ---------------- Appendices ----------------

sub('appendices.md',
    'prints the following twenty lines on success.',
    'prints the following twenty-one lines on success.')

sub('appendices.md',
    'PASS  the headers and the favicon leave the Google button working\n'
    'PASS  the client id is published for the browser',
    'PASS  the headers and the favicon leave the Google button working\n'
    'PASS  the second factor holds the sign-in until the code is given\n'
    'PASS  the client id is published for the browser')

sub('appendices.md',
    'TC-01 to TC-11, TC-16 to TC-27, TC-32 to TC-37 and TC-46 to TC-47.',
    'TC-01 to TC-11, TC-16 to TC-27, TC-32 to TC-37, TC-46 to TC-47 and TC-51.')

sub('appendices.md',
    'prints the following twenty-three lines on success.',
    'prints the following twenty-five lines on success.')

sub('appendices.md',
    'PASS  the sign in screen explains how the encryption works\n'
    'PASS  the card carries a file type chip',
    'PASS  the sign in screen explains how the encryption works\n'
    'PASS  the anatomy is one component, on the sign in page and in the app\n'
    'PASS  the card carries a file type chip')

sub('appendices.md',
    'PASS  a file that arrives is announced\n',
    'PASS  a file that arrives is announced\n'
    'PASS  the authenticator app turns on the second factor from the page\n')

sub('appendices.md',
    'These checks correspond to TC-12 to TC-15, TC-28 to TC-31, TC-38 to TC-45 and TC-48 to TC-50 in Table 4.1,',
    'These checks correspond to TC-12 to TC-15, TC-28 to TC-31, TC-38 to TC-45, TC-48 to TC-50, TC-52 and TC-53 in Table 4.1,')

# ---------------- Chapter 5 ----------------

sub('ch5-conclusion.md',
    '`npm test` completed with nineteen checks passing and the headless browser test with thirteen.',
    '`npm test` completed with twenty-one checks passing and the headless browser test with twenty-five.')

sub('ch5-conclusion.md',
    'the seven-step working principle with the lifecycle that follows a send and the three flows for signing, password wrapping and recovery,',
    'the seven-step working principle with the lifecycle that follows a send and the four flows for signing, password wrapping, recovery and the second factor,')

sub('ch5-conclusion.md',
    'that the sender\'s signature verifies when the recipient opens the file, and that a password-protected share refuses the wrong password and opens with the right one.',
    'that the sender\'s signature verifies when the recipient opens the file, and that a password-protected share refuses the wrong password and opens with the right one. '
    'They also established that an account with a second factor cannot be opened by the password alone, that the factor can be turned on from the interface and read by any authenticator app, and that the anatomy of the product is one component mounted on the sign in page and inside the workspace.')


# ---------------- apply ----------------

for fname, old, new, count in edits:
    path = os.path.join(ROOT, fname)
    text = io.open(path, encoding='utf-8').read()
    found = text.count(old)
    if found != count:
        print(f'MISS {fname}: expected {count} occurrence(s), found {found}\n  --- {old[:110]}')
        sys.exit(1)
    text = text.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(text)
    print(f'ok   {fname}: {old[:60]}')
print(f'\n{len(edits)} edits applied')
