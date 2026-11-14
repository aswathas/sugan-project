# Chapter 1 Introduction

## 1.1 Problem Statement

The exchange of documents between colleagues, students and institutions is now almost entirely digital. Question papers, syllabi, certificates, project reports and personal records are routinely sent by electronic mail or placed on a cloud storage service and a link is forwarded to the intended recipient. This convenience rests on an assumption that is rarely examined: that the party storing the file may be trusted with its contents. In the conventional model the file is uploaded in readable form, kept in readable form, and downloaded in readable form. Whoever operates the storage, and whoever gains control of it, is capable of reading every document that passes through it.

The assumption fails in three distinct ways. First, an external attacker who compromises the storage obtains the documents themselves rather than an unreadable container. Second, an administrator or an insider with legitimate access to the storage can inspect material that was meant only for a named recipient, and such inspection leaves no trace in the file itself. Third, the party storing the file may be bound by law or by policy to disclose it, and the sender has no technical means of preventing that disclosure. Encryption in transit, provided by HTTPS, does nothing about any of these cases, because it protects the file only while it is moving and not while it is stored.

A second, narrower problem accompanies the first. Even where a file is encrypted, the sender usually has no control over what the recipient does with it after delivery. The common requirement is modest and practical: some documents should be readable by the recipient but should not present an obvious route to a saved copy, while others are meant to be downloaded and kept. A system that records the sender's intention for each file, and reflects it in the interface, is more faithful to how documents are actually handled than one that treats every share identically.

This project takes both problems together. It asks whether a file-sharing website can be built in which the storage server is structurally incapable of reading the files it holds, and in which the sender records a per-file permission that governs how the recipient may open the file. The answer described in this report is a working prototype named SecureShare, built entirely from software that is already present on an ordinary computer, with no paid service and no package to install.

## 1.2 Objectives

The work was guided by five objectives.

- To develop a web-based file-sharing system that supports uploading, sharing and downloading files.
- To implement user authentication with a one-time code and sender-controlled access control.
- To integrate end-to-end encryption so that the server can never read a file.
- To implement key management so that private keys never leave the user's device.
- To verify the main workflows and the unauthorised-access scenario against the running prototype.

Each objective corresponds to a part of the delivered system. The first is met by the browser interface and the HTTP interface behind it: a registered user selects a file, names a recipient, and the recipient later opens the file from an inbox. The second is met by registration with a username, an email address and a password, followed by verification with a six-digit one-time code, and by a permission chosen by the sender for every share. The third and fourth are met by generating the key pair in the browser, keeping the private key non-extractable in IndexedDB, and encrypting each file under a fresh symmetric key that is wrapped to the recipient's public key. The fifth is met by two independent test layers, one exercising the server contract directly and one driving the real interface in two separate browser profiles. The tests and their outcomes are reported in Chapter 4.

## 1.3 Scope of the Work

The scope was fixed deliberately and is stated here so that the report is read against the right expectations. SecureShare is a localhost prototype. It runs on a single Node.js process, keeps its accounts and share metadata in a JSON file, and keeps ciphertext blobs in a directory on disk. It supports one permission per share, chosen by the sender, and it authenticates users with a password and an email one-time code. It does not implement roles, revocation, audit logging or attribute-based policies, and it does not include the Google sign-in path that was designed as an optional addition; that path is described as future work. These omissions are not accidental. The client required a system that could be demonstrated at no cost and without external accounts, and every feature that would have required a paid service, a certificate or an external identity provider was left out of the verified build so that the claims made for the system would be true of the code that actually runs.

The scope of the security claim is equally specific. The system guarantees that the server does not hold a private key, an AES key or plaintext. It does not guarantee that a recipient who has decrypted a file can be prevented from retaining a copy, because with end-to-end encryption the plaintext is necessarily present in the recipient's browser at the moment of use. The per-file permission of view or download is therefore an interface-level rule and not a cryptographic one. This distinction is stated in the design chapter, examined in the results, and repeated in the conclusions.

## 1.4 Organisation of the Report

The report is organised into five chapters and two appendices.

Chapter 1 has introduced the problem of trusting a storage server with the contents of shared documents, stated the five objectives, and fixed the scope and the honesty of the security claim.

Chapter 2 reviews the related work. It surveys the attribute-based and cryptographic literature on secure cloud file sharing, contrasts the conventional sharing model with the end-to-end encrypted model, presents the literature survey table, and sets out the mathematical background: the RSA-OAEP key-wrapping relation, the AES-GCM ciphertext relation, the decryption and recovery relations, the size of the AES-256 key space, the authentication-tag forgery bound and the entropy of a six-digit one-time code.

Chapter 3 describes the design of the proposed system. It presents the modules, the logical architecture and its trust boundaries, the hardware and software requirements, the stage-wise development of the prototype, the seven-step working principle, the data held by the server, the HTTP interface, and the testing procedure.

Chapter 4 reports the results. It gives the functional verification, the test-case table, the results of the Node self-test and of the headless browser test, screenshots of the real interface, a discussion of what the results establish, and the limits of the prototype.

Chapter 5 reviews the work, states the conclusions, and lists the recommendations for future work.

Appendix 1 lists the programs that make up the prototype and describes what each one does. Appendix 2 reproduces the raw output of the test runs.
