# Chapter 2 Literature Review

## 2.1 Related Work

The problem of sharing files securely through an untrusted store has a long literature, and most of it approaches the problem through access control on encrypted data. The dominant family of solutions is attribute-based encryption, in which a file is encrypted under a policy expressed over attributes and a user can decrypt only if the user's attributes satisfy that policy. The appeal of the approach is that the storage server can remain untrusted while access is still decided centrally by policy, without the sender having to encrypt separately for each recipient.

Chen, Zhu, Liang and Yin proposed a secure remote cloud file-sharing scheme that combines attribute-based access control with ciphertext-policy attribute-based encryption and adds performance optimisation. Their work shows that fine-grained policy can be applied to files that the cloud cannot read, and it identifies policy processing as the principal source of overhead. The same group, with Zhu and Feng, later examined how attribute-based access control can be implemented with a compact policy matrix, reporting better policy efficiency and improved privacy while acknowledging that the cryptographic processing remains advanced. Both papers establish the central trade-off that recurs throughout this literature: expressiveness of policy is bought with computational and engineering complexity.

A second line of work adds a distributed ledger. Almasian and Shafieinejad combine blockchain with attribute-based encryption so that access decisions are recorded in smart contracts, which gives fast revocation and an auditable record of who accessed what. The gain in accountability is real, but the solution requires a blockchain infrastructure to be operated and maintained, which is a substantial addition for a system that otherwise needs only a server and a browser.

A third line addresses provenance. Work published in Future Generation Computer Systems on attribute-based cloud storage with secure provenance over encrypted data couples fine-grained access control with a record of the origin and history of each object. This adds privacy, dynamic user management and traceability, at the cost of a provenance layer that increases overall system complexity. Kuehner and Hartenstein take a different angle and analyse the resource consumption of decentralized secure data sharing built on attribute-based encryption. They confirm that confidentiality and integrity can be achieved, but show that resource consumption and reliance on trusted entities remain open issues.

More recent work turns to lattice-based constructions. A 2023 scheme for efficient lattice-based revocable attribute-based encryption against decryption key exposure applies ciphertext-policy attribute-based encryption with revocation and multiple authorities. It addresses dynamic user management and resistance to key exposure, which are weaknesses of earlier constructions, but the cryptographic cost is higher.

Two observations follow from this body of work. First, attribute-based encryption is powerful but heavy: it assumes a policy authority, an attribute infrastructure and, in several proposals, a blockchain or a provenance service. Second, none of the surveyed systems is aimed at the small, self-contained case that this project addresses, where two users exchange a document through a single server that must be assumed hostile but is operated by nobody in particular. The prototype described here does not attempt to reproduce attribute-based policy. It adopts the simpler and more direct construction that the client's requirement implies: a per-user key pair generated on the user's device, a fresh symmetric key per file, and a public-key wrap of that symmetric key to the named recipient. This is the classic hybrid encryption pattern, and it is what makes it possible to keep the whole system free of dependencies and free of cost. The attribute-based literature is nevertheless the right frame for the future work in Chapter 5, where fine-grained policy is proposed as the natural extension of the single per-file permission.

## 2.2 Conventional and End-to-End Encrypted File Sharing

It is useful to contrast the conventional model with the model adopted here, because the difference is architectural rather than a matter of configuration.

In the conventional model, shown in Figure 2.1, the sender's browser transmits the file to the server, the server stores the file in readable form, and the recipient's browser later downloads it. Encryption in transit protects the file on the wire, but the server holds the file itself. An attacker who reaches the server's storage, or an administrator who is entitled to look, obtains the document. This is the model that most file-sharing services implement, and it is the model that the present work set out to avoid.

Figure 2.1 The conventional file-sharing model, in which the server can read the file

[FIGURE: docs/figures/02-without-e2ee.svg]

In the end-to-end encrypted model, shown in Figure 2.3, the sender's browser encrypts the file before it is transmitted, the server stores only ciphertext together with the material needed to route and decrypt it, and the recipient's browser decrypts. The critical property is that the transformation from plaintext to ciphertext happens on the sender's device and the reverse transformation happens on the recipient's device. The server is a relay and a store, not a reader. An attacker who reaches the server obtains ciphertext and public keys, neither of which yields the document.

Figure 2.2 explains the mechanism for a single share. A plain document is encrypted with AES-GCM under a freshly generated 256-bit key and a random 96-bit initialisation vector. The resulting ciphertext is uploaded. The AES key itself is then encrypted, or wrapped, with the recipient's RSA-OAEP public key, and the wrapped key is uploaded alongside the ciphertext and the initialisation vector. The recipient's browser reverses the process: it unwraps the AES key with the private key held in IndexedDB, then decrypts the ciphertext. The server never sees the plaintext file and never sees the AES key.

Figure 2.2 End-to-end encryption for a single share

[FIGURE: docs/figures/03-e2ee.svg]

Figure 2.3 The proposed model, in which only ciphertext is held by the server

[FIGURE: docs/figures/04-with-e2ee.svg]

Table 2.1 sets out the comparison along the dimensions that matter for this project.

Table 2.1 Conventional file sharing compared with end-to-end encrypted sharing

| Property | Conventional file sharing | End-to-end encrypted sharing |
|---|---|---|
| What the server receives | The file in readable form | Ciphertext, initialisation vector and wrapped key |
| What the server stores | The file in readable form | Ciphertext blobs, share metadata and public keys |
| Who can read the file | The sender, the recipient and the operator of the server | The sender and the recipient only |
| Effect of a server compromise | Every stored document is exposed | No document is exposed; only ciphertext is obtained |
| Effect of an insider at the server | Documents can be read without trace | Documents cannot be read |
| Where encryption happens | In transit, on the wire | In the sender's browser, before transmission |
| Where decryption happens | Nowhere; the server holds the file | In the recipient's browser, after download |
| Role of the server's key material | Holds or escrows the keys | Holds public keys only; never a private key |
| Dependence on the server's honesty | Complete | None for confidentiality |

The comparison makes the design choice concrete. SecureShare implements the right-hand column. The server in this prototype holds accounts, public keys, share metadata and ciphertext blobs, and it has no operation that turns ciphertext back into a file.

## 2.3 Literature Survey

Table 2.2 summarises the six papers surveyed in Section 2.1, in the order in which they were reviewed. The columns record the title, the authors and venue, the methodology and the inference drawn for this project.

Table 2.2 Literature survey of related work

| S.No | Title of Paper | Paper Details | Methodology | Inference |
|---|---|---|---|---|
| 1 | Secure Remote Cloud File Sharing With Attribute-Based Access Control and Performance Optimization | E. Chen, Y. Zhu, K. Liang, H. Yin, IEEE Transactions on Cloud Computing, Vol. 11, No. 1, pp. 579-594, 2023 | ABAC with XACML and CP-ABE, with performance optimisation of policy evaluation | Fine-grained access control can be enforced over encrypted files; policy processing adds complexity |
| 2 | How to Implement Secure Cloud File Sharing Using Optimized Attribute-Based Access Control with Small Policy Matrix and Minimized Cumulative Errors | E. Chen, Y. Zhu, G. Zhu, K. Liang, R. Feng, Computers & Security, Vol. 107, art. 102318, 2021 | ABAC with XACML and lattice-based CP-ABE using a small policy matrix | Better policy efficiency and privacy, at the cost of advanced cryptographic processing |
| 3 | Secure cloud file sharing scheme using blockchain and attribute-based encryption | M. Almasian, A. Shafieinejad, Computer Standards & Interfaces, Vol. 87, art. 103745, 2024 | Blockchain smart contracts combined with attribute-based encryption | Fast revocation and auditable access; the blockchain adds infrastructure complexity |
| 4 | Attribute-based cloud storage with secure provenance over encrypted data | H. Cui, R. H. Deng, Y. Li, Future Generation Computer Systems, Vol. 79, pp. 461-472, 2018 | Encryption with fine-grained access control plus secure provenance | Adds privacy, dynamic user management and traceability; provenance increases system complexity |
| 5 | Decentralized Secure Data Sharing with Attribute-Based Encryption: A Resource Consumption Analysis | H. Kuehner, H. Hartenstein, Proc. 4th ACM Int. Workshop on Security in Cloud Computing (SCC), pp. 74-81, 2016 | Resource-consumption analysis of attribute-based secure data sharing | Confidentiality and integrity are achievable, but resource consumption and trusted-entity issues remain |
| 6 | Efficient Lattice-Based Revocable Attribute-Based Encryption Against Decryption Key Exposure for Cloud File Sharing | B. Huang, J. Gao, X. Li, Journal of Cloud Computing, Vol. 12, No. 1, art. 37, 2023 | Ring-LWE lattice-based CP-ABE with binary-tree revocation and multiple authorities | Addresses dynamic management and key-exposure resistance; the cryptographic cost is higher |
| 7 | Client-side Encryption for Privacy-sensitive Applications on the Cloud | S. M. P. C. Souza, R. Puttini, Procedia Computer Science, Vol. 97, pp. 126-130, 2016 | Homomorphic and order-preserving encryption so the cloud can still search ciphertext | Client-side encryption costs server-side functionality, and the crypto that restores search leaks ordering |
| 8 | Web Cryptography API: Prevalence and Possible Developer Mistakes | P. Wichmann, M. Blochberger, H. Federrath, ARES 2022, ACM, pp. 1-10, 2022 | Empirical study of Web Crypto API use in web apps and GitHub repositories, with a catalogue of developer mistakes | Browser cryptography is real but underused and easy to misuse, so an API design that cannot be misused wrongly matters |
| 9 | Towards Enabling Secure Web-Based Cloud Services using Client-Side Encryption | M. Johns, A. Dirksen, ACM SIGSAC CCSW 2020, pp. 67-76, 2020 | CryptoMembranes: native client-side components that isolate encrypted data from application-supplied JavaScript | In a web application the client is the attacker's target, so browser-side encryption needs an isolation layer to be more than cosmetic |
| 10 | OmniShare: Encrypted Cloud Storage for the Multi-Device Era | A. Paverd, S. Tamrakar, H. L. Nguyen, P. Pendyala, T. D. Nguyen, E. Stobert, T. Groendahl, N. Asokan, A.-R. Sadeghi, IEEE Internet Computing, Vol. 22, No. 4, pp. 27-36, 2018 | Client-side encryption with out-of-band device authentication channels for enrolment | The blocker for client-side encryption is key distribution and trust bootstrapping, not the cipher |
| 11 | Design and Optimization of Hybrid End-to-end Encryption Architecture for a Secure Web Application System | X. Ma, J. Hur, M. Gu, N. Du, Journal of Web Engineering, Vol. 24, pp. 1155-1180, 2025 | Three-layer hybrid end-to-end encryption with ECDH and HKDF key derivation, ephemeral key pairs and certificate binding | Hybrid end-to-end encryption in the browser layer is practical, but transport encryption is still required underneath it |
| 12 | Securing End-to-End Encrypted File Sharing Services With the Messaging Layer Security Protocol | R. Helmich, L. Braubach, Concurrency and Computation: Practice and Experience, Vol. 37, No. 27-28, art. e70414, 2025 | Messaging Layer Security group key exchange combined with attribute-based access control and a versioned metadata store | End-to-end file sharing with attribute-based access control survives a fully compromised server, with forward secrecy that holds only in part |

The survey supports the design decision recorded in Section 2.1. The published systems achieve richer policy than SecureShare, but each depends on infrastructure that a zero-cost localhost prototype cannot provide. SecureShare instead makes the narrow guarantee that the server cannot read the file, and it makes that guarantee with primitives that are built into the browser and into Node.js.

## 2.4 Mathematical Background

This section states the relations on which the implementation rests and connects each one to the code. The notation is conventional: E denotes encryption and D denotes decryption; a subscript names the key or the algorithm; a value in upper case denotes a message or a key, and a value in lower case denotes a random or public parameter.

The first relation is the generation of the user's key pair. At registration the browser generates an RSA-OAEP key pair with a modulus of 2048 bits and a public exponent of 65537, using SHA-256 as the OAEP hash. In notation,

(K_pub, K_priv) = RSA-OAEP.KeyGen(2048)    (2.1)

The private key K_priv is created as a non-extractable CryptoKey. The Web Crypto API will use such a key for decryption but will refuse to export it, so the key cannot be copied out of the browser by the page itself. It is stored in IndexedDB in that non-extractable form, and only the public key K_pub is exported, encoded in SPKI form and published to the server. The relation matters because the entire confidentiality argument depends on K_priv never reaching the server, and the non-extractable flag is what makes that a property of the platform rather than a promise made by the application.

The second relation concerns the size of the symmetric key space. A fresh AES-GCM key of 256 bits is generated for every share, so the number of possible keys is

N = 2^256 ≈ 1.16 × 10^77    (2.2)

An exhaustive search over this space is not practical with any foreseeable computing resource, which is why the security of the file encryption does not depend on keeping the key secret for a long time. It is enough that the key exists for the duration of one share and is transferred only in wrapped form. The implementation generates this key in the sender's browser with `crypto.subtle.generateKey` and never leaves the key unwrapped anywhere outside that browser session.

The third relation is the encryption of the file. With K the fresh AES key, F the plaintext file and CF the ciphertext,

CF = E(K, F)    (2.3)

The encryption is AES-GCM with a random 96-bit initialisation vector, generated separately for each share. GCM is an authenticated mode: alongside the ciphertext it produces an authentication tag, which allows the recipient to detect any modification of the ciphertext before accepting it. In the implementation the call to `crypto.subtle.encrypt` with the AES-GCM algorithm returns the ciphertext with the tag appended, and the recipient's call to `crypto.subtle.decrypt` will fail if the tag does not verify.

The fourth relation is the wrapping of the AES key. The AES key K is itself encrypted under the recipient's RSA-OAEP public key K_RB, producing the wrapped key CK:

CK = E(K_RB, K)    (2.4)

This is the step that makes the scheme hybrid. The file is protected by a fast symmetric cipher, and only the short symmetric key is protected by the slower asymmetric cipher. The wrapped key is small, and it is the only value that the recipient's private key is required to process. In the implementation the sender's browser imports the recipient's published public key from SPKI form and calls `crypto.subtle.encrypt` with RSA-OAEP over the raw AES key bytes.

The fifth relation is recovery. The recipient obtains F by first recovering K from CK with the private key, then decrypting the ciphertext:

F = D(K), where K = D(K_RB, CK)    (2.5)

The inner operation uses the recipient's private key; the outer operation uses the recovered AES key and the initialisation vector stored with the share. Both operations run in the recipient's browser. The server is not involved in either, which is the operational meaning of end-to-end encryption in this system.

The sixth relation bounds the chance of a successful forgery against the authentication tag. For a 96-bit initialisation vector and the tag length used by AES-GCM, the probability that a forged ciphertext is accepted is on the order of

P(forgery) ≈ 10^-6 per code    (2.6)

This is a bound on a single attempt, and it is small enough that an attacker cannot rely on forgery in practice, but it is not zero. The bound is also the reason the report does not claim integrity beyond what GCM provides: a deliberate attacker who can make a very large number of attempts is limited by this probability rather than stopped by it. A digital signature over the ciphertext, listed in Chapter 5 as future work, would give a stronger and independently verifiable integrity guarantee.

The seventh relation concerns the one-time code. A six-digit code is drawn from a space of size 10^6:

|C| = 10^6    (2.7)

Taken alone this is a small space, and a code that remained valid indefinitely could be guessed by exhaustive trial. Its role in this system is therefore specific: it is a second factor presented shortly after the password, valid only for a short window, and delivered out of band through the mailer. Against an attacker who has obtained the password but not the mailbox, the code raises the cost of access from a single successful guess to a search over the code space within a short validity window, and the server rejects a wrong code with 401. The implementation stores the code as a scrypt hash with an expiry, so the code itself is not retained in readable form by the server. The entropy argument is thus the justification for treating the one-time code as a meaningful second factor even though the code space is far smaller than the AES key space.

Together these relations describe the whole cryptographic path of the prototype: a key pair generated on the device (2.1), a symmetric key drawn from an infeasibly large space (2.2), the file encrypted under that key (2.3), the key wrapped to the recipient (2.4), the recipient recovering the file without the server's help (2.5), the integrity of the ciphertext bounded by the authentication tag (2.6), and the account protected by a time-limited second factor (2.7).

Table 2.3 collects the parameters used in the implementation so that the relations above can be read against concrete values.

Table 2.3 Cryptographic parameters used in the prototype

| Parameter | Value used in SecureShare | Where it is applied |
|---|---|---|
| Asymmetric algorithm | RSA-OAEP | Key pair generation and AES key wrapping |
| RSA modulus | 2048 bits | Generated once per user at registration |
| RSA public exponent | 65537 | Fixed at key generation |
| OAEP hash | SHA-256 | Used in key wrapping and unwrapping |
| Symmetric algorithm | AES-GCM | File encryption and decryption |
| AES key length | 256 bits | Fresh key generated for every share |
| Initialisation vector | 96 bits, random | One per share, stored with the share |
| Key encoding | SPKI for public keys, raw for the AES key | Published public key and wrapped key |
| Password hash | scrypt | Stored with a per-user salt |
| One-time code | Six digits | Verified once, then discarded |
| Session cookie | HttpOnly, SameSite=Strict | Server-side session token |
