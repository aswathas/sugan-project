# Chapter 5 Conclusion

## 5.1 Review of the Work

This report has described the design, implementation and verification of SecureShare, a web-based file-sharing system that keeps the storage server outside the cryptographic path of the files it holds.

Chapter 1 set out the problem: conventional file sharing treats the storage server as a trusted party, so a compromise, an insider or a compelled disclosure exposes the documents themselves rather than an unreadable container. It stated five objectives and fixed the scope of the work, including the honest boundary around the access-control claim.

Chapter 2 placed the work in the literature. The surveyed systems achieve fine-grained access control over encrypted files through attribute-based encryption, sometimes combined with blockchain, provenance or lattice-based constructions. Each is more expressive than the present prototype, and each depends on infrastructure that a zero-cost localhost build cannot provide. The chapter then contrasted the conventional and end-to-end encrypted models, presented the literature survey table, and derived the mathematical relations on which the implementation rests: key generation, the AES-256 key space, the ciphertext relation, the key-wrapping relation, the recovery relation, the authentication-tag forgery bound and the entropy argument for the one-time code.

Chapter 3 described the design: seven modules, including the server-side Google verifier, a three-column logical architecture with two trust boundaries, the hardware and software requirements, the stage-wise development, the seven-step working principle with the lifecycle that follows a send, the data held by the server, the complete HTTP interface, the hardening controls and the two-layer testing procedure. It also described the dashboard as the interface of the system, since the left rail, the search box, the cards, the evidence panel and the activity trail are now part of how a user sees the state of a share.

Chapter 4 reported the results. `npm test` completed with eighteen checks passing and the headless browser test with nine. The tests established that an unverified account cannot sign in, that a wrong code and a wrong password are rejected, that the access code gates registration, that the stored blob contains no plaintext, that the private key in the browser is non-extractable, that the recipient decrypts to the original bytes and that an unrelated user is refused with 403. They further established that an expired share and a revoked share refuse their bytes with 410, that only the sender can revoke, that an opened share cannot be revoked, that the activity trail records the events and hides another account's, and that the chain verification endpoint reports the chain intact. They also established the abuse controls, that repeated failed sign-ins and wrong one-time codes are locked out, and that signing out everywhere ends the account's sessions. The Google suite showed that a valid token signs a user in and that a token with a wrong audience, issuer, expiry, signature or structure is refused. The chapter then discussed what the new features buy and what they cost, and listed the limits of the prototype.

## 5.2 Conclusions

The work supports the following conclusions.

A file-sharing system can be built in which the server is structurally incapable of reading the files it stores. The mechanism is not a promise by the application but a consequence of where the keys live: the private key is generated in the browser, is non-extractable, and never reaches the server; the AES key for each file exists only in wrapped form on the server. The tests confirmed the observable consequence, that the blob on disk contains no plaintext and that only the recipient can decrypt it.

Hybrid encryption is the right construction for this problem. Encrypting the file with AES-GCM 256 and wrapping only the short symmetric key with RSA-OAEP gives the speed of a symmetric cipher for the bulk data and the key-distribution convenience of public-key cryptography for the key. It also gives per-recipient encryption naturally: because the symmetric key is wrapped to the recipient's public key, the same file shared to two recipients produces two different wrapped keys and two independent ciphertexts.

Key custody on the client is both the strength and the cost of the design. It is the strength because it removes the server from the trust boundary entirely. It is the cost because a lost device is a lost private key and therefore a lost archive. The prototype accepts this cost, and the first recommendation below addresses it.

Authentication with a password and a time-limited one-time code is sufficient for the prototype and honest about its mechanism. The password is hashed with scrypt, the code is hashed and discarded, and the session is a server-side token in an HttpOnly cookie. The code is a second factor against a disclosed password, not a substitute for one, and its entropy is adequate only because its validity window is short and its attempts are controlled.

Sender-controlled access control is useful and is implemented, but its guarantee is narrower than its name suggests. The view permission prevents the ordinary interface from offering a saved copy; it cannot prevent a determined recipient from retaining the plaintext, because with end-to-end encryption the recipient necessarily holds the plaintext at the moment of display. This is a property of the architecture and not a defect of the implementation, and it should be stated wherever the feature is described.

The system meets the client's cost constraint without compromise to the security claim. It installs no packages, uses no paid service and runs on a machine with Node.js and a browser. The one-time code is delivered by a mailer that prints it locally by default and can be switched to a free email provider with one environment variable. This is why the demonstration is repeatable without an account anywhere.

## 5.3 Recommendations for Future Work

The following recommendations would take the prototype towards a system that could be operated as a service.

**Integrity verification with digital signatures.** AES-GCM's authentication tag detects modification of the ciphertext, but it does not establish who created it. A digital signature over the ciphertext and the share metadata, made with a signing key belonging to the sender, would give the recipient an independently verifiable proof of origin. This would strengthen the guarantee beyond the forgery bound of the tag.

**Key revocation and recovery.** A lost device currently means a lost archive. A recovery mechanism, such as an encrypted backup of the private key held by the user or a threshold scheme split among trusted parties, would allow an account to be restored without giving the server the ability to read files. Revocation would allow a compromised key to be retired and new shares to be addressed to its replacement.

**Forward secrecy through short-lived session keys.** The present design wraps a long-lived public key. A ratcheting or ephemeral-key protocol would ensure that the compromise of a long-term key does not expose past shares, at the cost of additional key management in the client.

**A public HTTPS deployment.** The prototype runs on localhost over plain HTTP. A deployment with a proper certificate would protect the session cookie and the ciphertext in transit, and it would allow the optional Google sign-in path and multi-user demonstrations to work off the local machine. The OAuth path was designed but is not part of the verified prototype precisely because it requires a public redirect and an internet connection.

**Fine-grained attribute-based policies.** The current access model is a single per-file permission of view or download. The literature reviewed in Chapter 2 shows that attribute-based encryption can express much richer policies over encrypted data. Replacing the single permission with a policy, so that a file is readable only by users holding a specified set of attributes, is the natural extension of the work and the point at which the surveyed literature becomes directly applicable.

**An independent audit of the stored data and the key lifecycle.** The verification in this report was performed by the team that built the system. An independent review of what the server actually stores, and of the full lifecycle of the keys from generation to destruction, would give a stronger assurance than self-verification can.

**HTTPS with a proper certificate.** This is the minimum condition for any deployment beyond localhost. Without it, the confidentiality of the ciphertext is preserved but the session and the transport are not protected, and the system should not be operated in that state.

Taken together, these recommendations describe a path from a verified localhost prototype to a service. The prototype's contribution is to show that the central property, a server that cannot read the files it holds, is achievable with primitives that are already present in every browser and in Node.js, at no cost and without a dependency.
