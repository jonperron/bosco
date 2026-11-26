# Chiffrement par enveloppe pour les auteurs de modules

> Document provisoire — `@bosco/crypto` est la première étape du lot 6. Il
> ne contient que la cryptographie : ni stockage, ni intégration NestJS, ni
> routes pour l'instant ; elles arrivent dans les étapes suivantes du lot.

bosco s'adresse aux seuls managers : les collaborateurs ne se connectent
jamais. Les données privées d'un manager (d'abord les notes d'entretien
individuel) sont chiffrées avec une clé qui lui est propre. Ce guide décrit
le schéma et l'API qu'un module utilise.

## Le schéma

- La **clé maître de l'installation** (KEK, 32 octets) chiffre une **clé de
  données par manager**. La clé maître ne chiffre jamais les données
  elles-mêmes.
- Les données sont scellées avec **XChaCha20-Poly1305**, sous un nonce
  aléatoire de 24 octets.
- Les données associées lient l'**identifiant du propriétaire** et
  l'**usage** (`purpose`). Mettez l'identifiant de l'enregistrement dans
  l'usage, par exemple `one-on-one-note:<id>` : un chiffré déplacé vers une
  autre ligne, ou vers un autre manager, ne se déchiffre plus.
- Chaque valeur stockée commence par un **octet de version** (actuellement
  `1`), pour que les formats futurs restent lisibles :
  - clé enveloppée : `version || nonce || XChaCha20-Poly1305(clé de données)` ;
  - clé de recouvrement : `version || crypto_box_seal(clé de données || ownerId)` ;
  - chiffré : `version || nonce || XChaCha20-Poly1305(texte clair)`.

## L'API

- `generateMasterKey()` renvoie une nouvelle clé maître de 32 octets.
- `generateManagerKey(masterKey, ownerId, recoveryPublicKey)` renvoie
  `{ wrappedKey, recoveryKey }` : stockez les deux pour le manager.
- `encrypt(plaintext, wrappedKey, masterKey, { ownerId, purpose })` et
  `decrypt(ciphertext, wrappedKey, masterKey, { ownerId, purpose })`. Le
  texte clair renvoyé par `decrypt` appartient à l'appelant : effacez-le avec
  `fill(0)` après usage.
- `rewrapManagerKey(wrappedKey, ownerId, oldMasterKey, newMasterKey)` fait
  tourner la clé maître : la clé de données est ré-enveloppée, les données
  ne bougent pas.
- `rotateManagerKey(wrappedKey, masterKey, ownerId, recoveryPublicKey, items)`
  fait tourner la clé d'un manager : chaque `{ ciphertext, purpose }` fourni
  est déchiffré puis rechiffré sous une nouvelle clé de données, tout ou
  rien. Stockez la nouvelle clé enveloppée, la clé de recouvrement et tous
  les chiffrés renvoyés dans **une seule transaction**.
- `generateRecoveryKeyPair()` et
  `recoverManagerKey(recoveryKey, ownerId, keyPair, masterKey, verify)` :
  voir plus bas.
- `loadMasterKeyFromFile()` lit la clé maître dans le fichier désigné par
  `BOSCO_MASTER_KEY_FILE`.
- Toute erreur lève une `CryptoError`, dont le message ne contient jamais de
  clé.

## Décisions

- **La clé maître est un fichier monté dans le conteneur**, désigné par
  `BOSCO_MASTER_KEY_FILE`. Il contient les 32 octets en base64 standard, par
  exemple la sortie de `openssl rand -base64 32`.
- **La perte d'une clé de manager se règle avec une paire de clés de
  recouvrement administrateur.** Chaque clé de données est aussi scellée
  pour la clé publique de l'administrateur ; la clé privée reste hors ligne
  et n'est sortie que pour un recouvrement. L'administrateur peut donc lire
  les notes de tous les managers. Une boîte scellée ne prouve pas qui l'a
  scellée : passez toujours à `recoverManagerKey` un chiffré existant du
  propriétaire en `verify`, afin qu'une clé de recouvrement implantée soit
  refusée.
- **Quand une personne change de manager, les notes d'entretien sont
  archivées, pas transférées.** Aucune fonction de transfert n'existe.

## Limites

- L'effacement mémoire est au mieux en JavaScript : les chaînes et les
  copies dans le tas WASM ne peuvent pas être effacées. Préférez un
  `Uint8Array` à une chaîne pour le texte clair.
- Un module ne lit jamais les tables d'un autre module, ni directement les
  tables de clés : l'accès passe par l'API contrat du socle (lot 7).
