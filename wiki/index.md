# Bosco Documentation

Bienvenue dans la documentation officielle de **Bosco** — un outil auto-hébergé, open-source (Apache-2.0) qui centralise le travail quotidien d'un manager engineering : personnes, tâches, projets, métriques d'équipe.

## 📖 À propos de Bosco

Bosco est conçu pour répondre aux besoins spécifiques des managers engineering en leur fournissant une plateforme unifiée pour :

- **Gestion des personnes** : Organiser les équipes et les rattachements manager
- **Gestion des tâches et projets** : Suivre l'avancement des travaux
- **Métriques d'équipe** : Visualiser les indicateurs clés
- **Modules extensibles** : Ajouter des fonctionnalités spécifiques via un système de modules

## 🎯 Socle v0

Le socle v0 (fondation) de Bosco ne contient **aucune fonctionnalité de management**. Il fournit ce dont tous les modules auront besoin :

- **Identité** : Qui est qui dans l'organisation
- **Accès** : Qui voit quoi (contrôle des droits)
- **Modules** : Comment un module se branche au socle
- **RGPD** : Export et suppression des données
- **Packaging** : Installation via Docker

### Critères de fin du socle v0

- [ ] Une installation se lance en une commande (`docker compose up`) avec Postgres comme seule dépendance
- [ ] Le premier administrateur se connecte avec Google, crée des équipes et rattache des personnes à leur manager
- [ ] Le partage des notes de 1:1 s'active ou se désactive dans la configuration, et les droits suivent
- [ ] Un module d'exemple s'active, se désactive et lit les personnes via l'API du socle, sans accès direct à leurs tables
- [ ] Une donnée chiffrée par le module d'exemple reste illisible en base
- [ ] On exporte puis on supprime toutes les données d'une personne
- [ ] L'interface existe en français et en anglais
- [ ] La CI est verte : tests, contrôle du contrat OpenAPI

## 🏗️ Architecture

Bosco est structuré comme un **monorepo TypeScript** :

```
bosco/
├── apps/
│   ├── api/          # Backend NestJS
│   └── web/          # Frontend React + Vite
├── packages/
│   ├── api-client/   # Client typé généré depuis OpenAPI
│   └── contract/     # API contract (généré)
├── db/               # Schéma Drizzle et migrations
├── modules/          # Modules (chaque module = 1 schéma Postgres)
├── docs/             # Documentation
└── specs/            # Spécifications OpenSpec
```

## 📦 Technologies

| Composant       | Technologie         |
| --------------- | ------------------- |
| Backend         | NestJS (TypeScript) |
| Frontend        | React + Vite        |
| Base de données | PostgreSQL          |
| ORM             | Drizzle             |
| Tests           | Vitest              |
| Build           | Turborepo + pnpm    |
| CI/CD           | GitHub Actions      |
| Documentation   | OpenSpec + OpenWiki |
| Licence         | Apache-2.0          |

## 🚀 Installation

### Prérequis

- Node.js >= 24
- pnpm >= 9.0.0
- Docker + Docker Compose
- PostgreSQL (ou via Docker)

### Installation rapide

```bash
# Cloner le dépôt
git clone https://github.com/jonperron/bosco.git
cd bosco

# Installer les dépendances
pnpm install

# Lancer l'installation avec Docker Compose
docker compose up -d

# Accéder à l'application
# Frontend: http://localhost:3000
# API: http://localhost:3001
```

## 📂 Documentation

- [Guide d'installation](installation.md)
- [Configuration](configuration.md)
- [Architecture technique](architecture.md)
- [Développement](development.md)
- [API Reference](api.md)
- [Contribution](contribution.md)
- [Spécifications OpenSpec](../specs/project.spec.yaml)

## 🤝 Contribution

Voir [CONTRIBUTING.md](../CONTRIBUTING.md) pour les directives de contribution.

## 📄 Licence

Apache License 2.0 - voir [LICENSE](../LICENSE) pour plus de détails.

---

_Documentation générée avec ❤️ par [OpenWiki](https://github.com/langchain-ai/openwiki)_
