# Charte de collecte des données

> Document provisoire — les principes ci-dessous sont ceux du plan du socle
> v0 ; ils accompagnent chaque lot. Des tests automatisés les vérifieront à
> mesure que les lots arrivent : la matrice des droits au lot 5, le
> chiffrement au lot 6, le cycle de vie RGPD au lot 8.

bosco est un outil auto-hébergé qui rassemble le travail quotidien d'un
engineering manager. Ces données sont sensibles : la présente charte fixe
les principes que tout module et toute évolution du socle doit respecter.

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
propriétaire, dans les conditions de partage choisies. Chaque manager
recevra sa propre clé de secours pour récupérer ses notes s'il perd sa clé,
et personne d'autre ne pourra les lire. Aujourd'hui, le recouvrement passe
encore par une clé de recouvrement propre à l'installation, en attendant ce
changement (voir [chiffrement par enveloppe](crypto-envelope.fr.md)).
Quand une personne change de manager, ses notes de 1:1 sont archivées : ni
transférées au nouveau manager, ni laissées actives.

## 4. Traçabilité de chaque nombre

Chaque chiffre affiché remonte à sa **source** : l'intégration (Lucca,
annuaire, module) et l'instant de collecte qui l'a produit. Une métrique
sans provenance vérifiable ne doit pas exister dans l'interface.

## 5. Une organisation par installation

Une instance de bosco ne dessert **qu'une seule organisation**. Cette
hypothèse structure les droits, l'OIDC (restreint au domaine de
l'entreprise) et le périmètre d'export RGPD ; aucune donnée ne sort du
périmètre de l'organisation.

## Ce que bosco ne collecte jamais

Un outil de management peut devenir un outil de surveillance, et ses
métriques peuvent être détournées. Cette liste publique est notre réponse :
bosco ne collecte jamais :

- de métriques d'activité ni de classement par personne : pas de commits,
  de pull requests ni de lignes de code par individu, pas de « top
  performers », pas de palmarès individuel ;
- le contenu des messages de discussion (Slack) ni des e-mails ;
- de frappes clavier, de captures d'écran, de suivi de présence ni du
  temps passé ;
- de détection ni de comptage du code généré par IA par personne : l'impact
  de l'IA se mesure uniquement sur des dimensions d'équipe ;
- de réponses individuelles aux enquêtes : les réponses ne sont présentées
  qu'agrégées, et rien n'est affiché sous 5 réponses, pour préserver
  l'anonymat ;
- quoi que ce soit d'un module désactivé : un module désactivé ne collecte
  rien ;
- quoi que ce soit pour le projet lui-même : aucune donnée ne sort de
  l'installation, il n'y a pas de télémétrie.

Toute modification de cette liste passe par une pull request publique.
