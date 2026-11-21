# Charte de collecte des données

> Document provisoire — les principes ci-dessous sont ceux du plan du socle
> v0 ; ils accompagnent chaque lot et sont vérifiés par la suite de tests.

bosco est un outil auto-hébergé qui rassemble le travail quotidien d'un
engineering manager. Ces données sont sensibles : la présente charte fixe
les principles que tout module et toute évolution du socle doit respecter.

## 1. Des métriques agrégées par équipe

Les métriques d'activité sont calculées et présentées **par équipe**, jamais
par individu. Un tableau de bord ne montre pas un classement de personnes ;
aucune interaction ne doit permettre de reconstituer un classement
individuel à partir des vues agrégées.

## 2. Rien qui classe un individu

Aucune fonctionnalité de bosco ne note, évalue ni compare une personne.
Les données personnelles servent au pilotage du collectif et au suivi de
chaque gestion managériale (entretiens, objectifs), jamais à un contrôle
individualisé ou à un score.

## 3. Chiffrement des notes privées

Les notes privées prises pendant les entretiens sont **chiffrées**, avec une
clé par manager, protégée par une clé maître propre à l'installation. Elles
sont illisibles en clair en base de données et visibles uniquement de leur
propriétaire, dans les conditions de partage choisies.

## 4. Traçabilité de chaque nombre

Chaque chiffre affiché remonte à sa **source** : l'intégration (Lucca,
annuaire, module) et l'instant de collecte qui l'a produit. Une métrique
sans provenance vérifiable ne doit pas exister dans l'interface.

## 5. Une organisation par installation

Une instance de bosco ne dessert **qu'une seule organisation**. Cette
hypothèse structure les droits, l'OIDC (restreint au domaine de
l'entreprise) et le périmètre d'export RGPD ; aucune donnée ne sort du
périmètre de l'organisation.
