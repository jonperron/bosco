# Envelope encryption for module authors

> Provisional document — `@bosco/crypto` is the first step of lot 6. It
> holds the cryptography only: no storage, no NestJS wiring and no routes
> yet; those arrive in the next steps of the lot.

bosco is for managers only: collaborators never log in. A manager's private
data (one-on-one notes first) is encrypted with a key that belongs to that
manager. This guide explains the scheme and the API a module uses.

## The scheme

- The **installation master key** (KEK, 32 bytes) wraps one **data key per
  manager**. The master key never encrypts data itself.
- Data is sealed with **XChaCha20-Poly1305** under a random 24-byte nonce.
- The associated data binds the **owner id** and the **purpose**. Put the
  record id in the purpose, for example `one-on-one-note:<id>`: a ciphertext
  moved to another row, or to another manager, then fails to decrypt.
- Every stored value starts with a **format version byte** (currently `1`),
  so later format changes stay readable:
  - wrapped key: `version || nonce || XChaCha20-Poly1305(data key)`;
  - recovery key: `version || crypto_box_seal(data key || ownerId)`;
  - ciphertext: `version || nonce || XChaCha20-Poly1305(plaintext)`.

## The API

- `generateMasterKey()` returns a fresh 32-byte master key.
- `generateManagerKey(masterKey, ownerId, recoveryPublicKey)` returns
  `{ wrappedKey, recoveryKey }`: store both for the manager.
- `encrypt(plaintext, wrappedKey, masterKey, { ownerId, purpose })` and
  `decrypt(ciphertext, wrappedKey, masterKey, { ownerId, purpose })`. The
  caller owns the plaintext `decrypt` returns: zero it with `fill(0)` once
  used.
- `rewrapManagerKey(wrappedKey, ownerId, oldMasterKey, newMasterKey)` rotates
  the master key: the data key is re-wrapped, data is untouched. A key
  already wrapped under the new master key is returned unchanged, so an
  interrupted rotation is resumed by running it again over every manager.
  Keep the old master key file until that run has succeeded.
- `rotateManagerKey(wrappedKey, masterKey, ownerId, recoveryPublicKey, items)`
  rotates a manager key: every given `{ ciphertext, purpose }` is decrypted
  and encrypted again under a fresh data key, all or nothing. Store the new
  wrapped key, recovery key and every returned ciphertext in **one
  transaction**.
- `generateRecoveryKeyPair()` and
  `recoverManagerKey(recoveryKey, ownerId, keyPair, masterKey, verify)`: see
  below.
- `loadMasterKeyFromFile()` reads the master key from the file named by
  `BOSCO_MASTER_KEY_FILE`; a file larger than 256 bytes is refused.
- Every failure throws a `CryptoError`; its message never contains a key.

## Decisions

- **The master key lives in a file mounted in the container**, named by
  `BOSCO_MASTER_KEY_FILE`. It holds the 32 bytes in standard base64, for
  example the output of `openssl rand -base64 32`.
- **A lost manager key is handled by an admin recovery key pair.** Each data
  key is also sealed to the admin public key; the private key stays offline
  and is brought in for a recovery only. The admin can therefore read every
  manager's notes. A sealed box does not prove who sealed it, so
  `recoverManagerKey` requires one of the owner's existing ciphertexts as
  `verify`: a planted recovery key is then refused. Pick one written before
  the suspected tampering (the oldest, say), because a database writer could
  plant a matching ciphertext next to a planted recovery key. An owner with
  no ciphertext has nothing to recover: generate a fresh manager key instead.
- **On a change of manager, one-on-one notes are archived, not
  transferred.** No transfer function exists.

## Limits

- Zeroing is best effort in JavaScript: strings and the copies in the WASM
  heap cannot be wiped. Prefer `Uint8Array` over strings for plaintext.
- A module never reads another module's tables, nor the key tables
  directly: access goes through the core contract API (lot 7).
