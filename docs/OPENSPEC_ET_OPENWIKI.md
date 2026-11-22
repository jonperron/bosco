# OpenSpec et OpenWiki - Documentation Bosco

Ce document explique comment utiliser **OpenSpec** et **OpenWiki** dans le projet Bosco pour la documentation pilotée par les spécifications (Spec-Driven Development).

## 📋 Introduction

Bosco utilise deux outils complémentaires pour la documentation :

- **OpenSpec** : Système AI-native pour le développement piloté par les spécifications
- **OpenWiki** : CLI pour générer et maintenir un wiki de documentation

Ces outils permettent de :

- ✅ Définir des spécifications claires et validées pour chaque composant
- ✅ Générer automatiquement la documentation
- ✅ Maintenir la documentation à jour avec le code
- ✅ Utiliser l'IA pour aider à la rédaction et à la validation

## 🚀 Installation

Les dépendances sont déjà ajoutées au projet. Si ce n'est pas le cas :

```bash
# Installer les dépendances
pnpm install @fission-ai/openspec openwiki --save-dev
```

## 📦 Configuration

### OpenSpec

OpenSpec est configuré via `.openspec/config.yaml` :

```yaml
name: bosco
version: 0.0.1
description: Bosco - Engineering Management Tool
license: Apache-2.0
spec_dirs:
  - specs
  - packages/core/src
docs_dir: docs/specs
```

**Fichiers de spécification** :

- `specs/project.spec.yaml` - Spécification principale du projet
- `specs/core.spec.yaml` - Spécification du package core
- Ajoutez d'autres fichiers `.spec.yaml` selon vos besoins

### OpenWiki

OpenWiki est configuré via `.openwiki/config.json` :

```json
{
  "name": "bosco",
  "version": "0.0.1",
  "sourceDir": "wiki",
  "outputDir": "docs/wiki",
  "language": "fr",
  "additionalLanguages": ["en"]
}
```

**Fichiers wiki** :

- `wiki/index.md` - Page d'accueil du wiki
- Ajoutez d'autres fichiers `.md` dans le dossier `wiki/`

## 🛠️ Utilisation

### Commandes OpenSpec

| Commande                 | Description                                 |
| ------------------------ | ------------------------------------------- |
| `pnpm openspec`          | Lancer le CLI OpenSpec                      |
| `pnpm openspec:init`     | Initialiser OpenSpec                        |
| `pnpm openspec:validate` | Valider les spécifications                  |
| `pnpm openspec:generate` | Générer la documentation à partir des specs |

**Exemples :**

```bash
# Valider toutes les spécifications
pnpm openspec:validate

# Générer la documentation
pnpm openspec:generate

# Voir l'aide
pnpm openspec --help
```

### Commandes OpenWiki

| Commande                 | Description                           |
| ------------------------ | ------------------------------------- |
| `pnpm openwiki`          | Lancer le CLI OpenWiki                |
| `pnpm openwiki:init`     | Initialiser OpenWiki                  |
| `pnpm openwiki:generate` | Générer le wiki                       |
| `pnpm openwiki:serve`    | Servir le wiki localement (port 3001) |

**Exemples :**

```bash
# Générer le wiki
pnpm openwiki:generate

# Servir le wiki localement
pnpm openwiki:serve

# Voir l'aide
pnpm openwiki --help
```

### Commandes combinées

| Commande             | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `pnpm docs:generate` | Générer toute la documentation (OpenSpec + OpenWiki) |
| `pnpm docs:setup`    | Configurer le système de documentation               |
| `pnpm docs:validate` | Valider les spécifications                           |

## 📝 Création de spécifications

### Structure d'une spécification OpenSpec

```yaml
spec_version: 1.0.0
name: @bosco/core
version: 0.0.1
title: Bosco Core Module
description: Description du module

tags:
  - core
  - types

# Types
 types:
   - name: User
     description: Base user type
     properties:
       id: string
       email: string
       role: UserRole

# Fonctions
functions:
  - name: createResult
    description: Create a Result object
    signature: "createResult<T, E>(ok: boolean, value?: T, error?: E): Result<T, E>"

# Constantes
constants:
  - name: DEFAULT_PAGE_SIZE
    type: number
    value: 20

# Schémas de validation
schemas:
  - name: EmailSchema
    type: string
    format: email

# Erreurs
 errors:
   - name: ValidationError
     description: Validation failed
     properties:
       message: string
       details: Record<string, string[]>
```

### Bonnes pratiques

1. **Un fichier par module** : Créez un fichier `.spec.yaml` pour chaque package/module
2. **Décrivez tout** : Types, fonctions, constantes, erreurs, API endpoints
3. **Utilisez des tags** : Catégorisez vos spécifications
4. **Gardez à jour** : Mettez à jour les specs avec le code
5. **Validez** : Exécutez `pnpm openspec:validate` régulièrement

## 📚 Création de documentation Wiki

### Structure d'un article Wiki

````markdown
# Titre de l'article

## Description

Description détaillée de la fonctionnalité.

## Exemples

```typescript
// Exemple de code
import { functionName } from '@bosco/core';

functionName(param1, param2);
```
````

## API Reference

- [TypeDef](#type-def)
- [Functions](#functions)

### TypeDef

### Functions

````

### Bonnes pratiques

1. **Un fichier par sujet** : Organisez par fonctionnalité/module
2. **Utilisez des liens** : Référencez d'autres articles
3. **Ajoutez des exemples** : Code, screenshots, vidéos
4. **Gardez à jour** : Mettez à jour avec les specs
5. **Utilisez l'IA** : `pnpm openwiki:generate` pour aider à la rédaction

## 🎯 Workflow recommandé

### Pour un nouveau module

1. **Créer la spécification**
   ```bash
   # Créer specs/new-module.spec.yaml
````

2. **Décrire l'API**
   - Types
   - Fonctions
   - Endpoints
   - Erreurs

3. **Valider la spécification**

   ```bash
   pnpm openspec:validate
   ```

4. **Générer la documentation**

   ```bash
   pnpm openspec:generate
   ```

5. **Créer la documentation wiki**

   ```bash
   # Créer wiki/new-module.md
   ```

6. **Générer le wiki**

   ```bash
   pnpm openwiki:generate
   ```

7. **Vérifier la documentation**
   ```bash
   pnpm docs:generate
   ```

### Pour une mise à jour

1. **Mettre à jour le code**
2. **Mettre à jour la spécification**
3. **Valider**
   ```bash
   pnpm docs:validate
   ```
4. **Générer**
   ```bash
   pnpm docs:generate
   ```
5. **Commiter**
   ```bash
   git add specs/ wiki/
   git commit -m "docs: update specification and documentation"
   ```

## 🤖 Utilisation de l'IA

OpenSpec et OpenWiki peuvent utiliser l'IA pour :

- **Générer des specs** à partir de code existant
- **Valider des specs** et suggérer des améliorations
- **Générer de la documentation** à partir des specs
- **Traduire** la documentation dans plusieurs langues

**Configuration** (dans `.openspec/config.yaml` et `.openwiki/config.json`) :

```yaml
# OpenSpec
ai_enabled: true
model: openai/gpt-4
temperature: 0.3
```

```json
// OpenWiki
{
  "ai": {
    "enabled": true,
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.3
  }
}
```

**Note** : Vous devez configurer vos clés API pour que l'IA fonctionne.

## 📁 Structure des dossiers

```
bosco/
├── .openspec/           # Configuration OpenSpec
│   ├── config.yaml      # Configuration principale
│   └── .gitignore       # Fichiers ignorés
├── .openwiki/           # Configuration OpenWiki
│   ├── config.json      # Configuration principale
│   └── .gitignore       # Fichiers ignorés
├── specs/               # Spécifications OpenSpec
│   ├── project.spec.yaml
│   └── core.spec.yaml
├── wiki/                # Documentation Wiki (source)
│   └── index.md
├── docs/                # Documentation générée
│   ├── specs/           # Généré par OpenSpec
│   └── wiki/            # Généré par OpenWiki
└── scripts/
    └── setup-docs.mjs   # Script de configuration
```

## 🔧 Dépannage

### OpenSpec ne fonctionne pas

1. Vérifiez que `@fission-ai/openspec` est installé :

   ```bash
   pnpm list @fission-ai/openspec
   ```

2. Vérifiez la configuration :

   ```bash
   cat .openspec/config.yaml
   ```

3. Essayez avec npx :
   ```bash
   npx @fission-ai/openspec --help
   ```

### OpenWiki ne fonctionne pas

1. Vérifiez que `openwiki` est installé :

   ```bash
   pnpm list openwiki
   ```

2. Vérifiez la configuration :

   ```bash
   cat .openwiki/config.json
   ```

3. Essayez avec npx :
   ```bash
   npx openwiki --help
   ```

### Erreurs de validation

1. Exécutez la validation :

   ```bash
   pnpm openspec:validate
   ```

2. Corrigez les erreurs signalées

3. Vérifiez la syntaxe YAML :
   ```bash
   pnpm exec yaml-lint specs/*.yaml
   ```

## 📖 Ressources

- [OpenSpec Documentation](https://github.com/Fission-AI/OpenSpec)
- [OpenWiki Documentation](https://github.com/langchain-ai/openwiki)
- [Bosco Project](https://github.com/jonperron/bosco)
- [Spec-Driven Development](https://spec.dev/)

## 💡 Conseils

1. **Commencez petit** : Ne cherchez pas à tout documenter d'un coup
2. **Itération** : Mettez à jour la documentation au fur et à mesure
3. **Automatisez** : Intégrez la génération dans votre CI
4. **Collaborez** : Utilisez l'IA pour aider l'équipe
5. **Revoyez** : Faites relire la documentation par d'autres

## 🎉 Conclusion

Avec OpenSpec et OpenWiki, Bosco dispose d'un système de documentation moderne, piloté par les spécifications, qui :

- ✅ Reste synchronisé avec le code
- ✅ Est facile à maintenir
- ✅ Peut être généré automatiquement
- ✅ Bénéficie de l'IA pour la qualité
- ✅ Supporte plusieurs langues

N'hésitez pas à explorer les CLI et à adapter la configuration à vos besoins !
