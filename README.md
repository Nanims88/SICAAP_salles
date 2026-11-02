# SICAAP – Réservation des salles

Planning de réservation des **2 box** et des **2 salles de réunion** (petite et grande).

## Fonctionnalités (V1)

| Domaine | Règle |
|---|---|
| Salles | Box 1 (2 pers.), Box 2 (2 pers.), Petite salle (6), Grande salle (12) — modifiables dans l'admin |
| Créneaux | 30 min, du lundi au vendredi, de 8h à 19h (heure de Paris) |
| Délai | Jusqu'à 3 mois à l'avance (sans limite pour les admins) |
| Confirmation | Immédiate ; chevauchements impossibles (contrôle applicatif **et** contrainte PostgreSQL) |
| Récurrence | Hebdomadaire, 26 semaines max ; jours fériés et fermetures ignorés automatiquement |
| Jours fériés | Calculés automatiquement (France métropolitaine) |
| Fermetures | Saisies par un admin, pour une salle ou toutes |
| Visibilité | Les autres voient le **nom** de la personne ; l'objet n'est visible que par l'auteur et les admins |
| Droits | Modification / annulation par l'auteur et les admins |
| Comptes | E-mail + mot de passe ; créés par un admin avec mot de passe provisoire à changer à la 1re connexion |
| E-mails | Confirmation, modification, annulation, avec invitation **.ics** (Outlook) — en V1, écrits dans les logs |
| Vue | Semaine, toutes salles (une couleur par salle) |

Pages : **Planning**, **Mes réservations**, **Administration** (Salles, Utilisateurs, Fermetures, Réservations).

## Stack technique

- **Next.js 15** (App Router, actions serveur) + **TypeScript**
- **PostgreSQL** standard via **Prisma** — fonctionne à l'identique en local, sur Supabase et sur Scaleway
- Authentification maison : mots de passe bcrypt, sessions en base (jeton aléatoire en cookie httpOnly, seule son empreinte SHA-256 est stockée), limitation des tentatives de connexion
- Tests : **Vitest**

## Démarrage en local

Prérequis : Node.js ≥ 20 et PostgreSQL ≥ 14 (ou Docker).

```bash
cp .env.example .env          # puis ajuster DATABASE_URL si besoin
npm install
npm run db:migrate            # crée les tables et contraintes
npm run db:seed               # crée les 4 salles + l'admin (mot de passe provisoire affiché)
npm run dev                   # http://localhost:3000
```

> L'utilisateur PostgreSQL doit pouvoir créer l'extension `btree_gist` (déjà disponible sur Supabase et Scaleway).

Avec Docker : `docker compose up -d --build` puis `docker compose exec app npx prisma db seed`.

## Tests

```bash
npm test                      # tests unitaires (règles, jours fériés, récurrence, .ics)
set -a; . ./.env; set +a; npm test   # + test d'intégration PostgreSQL (anti-chevauchement)
npm run lint                  # vérification TypeScript
```

## Base de test Supabase (projet partagé, données cloisonnées)

La base de test est hébergée dans le projet Supabase **« Suivi temps travail »**, sans mélange avec ses données :

| Élément | Valeur |
|---|---|
| Schéma | `reservation_salles` (les données du suivi du temps restent dans `public`) |
| Rôle PostgreSQL | `reservation_salles_app` : propriétaire de son schéma, **aucun accès** aux tables de `public` ni droit d'y créer quoi que ce soit |
| API Supabase | schéma **non exposé** : `anon` et `authenticated` n'y ont aucun accès |
| Historique des migrations | table `_prisma_migrations` propre au schéma (l'historique Supabase du projet n'est pas touché) |

Installation (déjà faite sur le projet de test) : script [`docs/supabase-cloisonnement.sql`](docs/supabase-cloisonnement.sql), puis `npm run db:migrate` et `npm run db:seed` avec la chaîne de connexion du rôle dédié.

Chaîne de connexion (mode **Session pooler**, compatible IPv4) :

```env
DATABASE_URL="postgresql://reservation_salles_app.<REF_PROJET>:<MOT_DE_PASSE>@<HOTE_POOLER>:5432/postgres?schema=reservation_salles"
```

- `<HOTE_POOLER>` : bouton **Connect** du projet Supabase → *Session pooler* ;
- le paramètre `?schema=reservation_salles` est **indispensable** ;
- mot de passe perdu : `alter role reservation_salles_app password '…';` dans le SQL Editor.

Supabase n'est utilisé **que comme base PostgreSQL** : aucune dépendance à son SDK, son auth ou ses e-mails. Le passage à Scaleway se fait en changeant `DATABASE_URL`.

## Hébergement de test (Render, sans rien installer)

Le fichier `render.yaml` décrit le service : offre gratuite, région Francfort, déploiement automatique à chaque mise à jour de `main`.

1. Créer un compte sur [render.com](https://render.com) avec le compte GitHub.
2. **New → Blueprint**, choisir le dépôt `SICAAP_salles`.
3. Renseigner `DATABASE_URL` (base Supabase cloisonnée) et `APP_URL` (adresse donnée par Render, ex. `https://sicaap-salles.onrender.com`).
4. Valider : l'application est en ligne après quelques minutes.

Offre gratuite : mise en veille après 15 min sans visite (réveil en ~1 min).

## Déploiement Scaleway (via GitLab)

L'application est livrée avec un `Dockerfile` (build Next.js *standalone*). Au démarrage, le conteneur applique les migrations puis lance le serveur.

1. Créer une base **Managed PostgreSQL** Scaleway et récupérer son URL.
2. Construire et pousser l'image dans le **Container Registry** Scaleway (depuis la CI GitLab).
3. Déployer sur **Serverless Containers** (ou Kapsule) avec les variables d'environnement de `.env.example`.
4. Lancer une fois `npx prisma db seed` pour créer les salles et l'admin.

## Configuration

| Où | Quoi |
|---|---|
| `.env` | Base de données, admin initial, e-mails (voir `.env.example`) |
| `src/config/settings.ts` | Horaires, granularité, jours ouvrés, délai max, durée de récurrence |
| `src/config/brand.ts` | Nom affiché et logo (déposer le fichier dans `public/`) |
| `src/app/theme.css` | Couleurs de la charte |

### Activer l'envoi réel des e-mails (Microsoft 365)

```env
MAIL_TRANSPORT="smtp"
MAIL_FROM="Réservations SICAAP <reservations@sicaap.com>"
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_USER="reservations@sicaap.com"
SMTP_PASSWORD="…"
```

La boîte d'envoi doit avoir **SMTP AUTH** activé dans Microsoft 365 (centre d'administration Exchange). Une erreur d'envoi n'empêche jamais une réservation : elle est journalisée.

## Arborescence

```
prisma/            schéma, migrations (dont contrainte anti-chevauchement), seed
src/config/        règles métier et identité visuelle
src/lib/           cœur métier : règles, jours fériés, récurrence, .ics, e-mails, auth, réservations
src/app/           pages et actions serveur (planning, mes réservations, admin, connexion)
src/components/    planning hebdomadaire, fenêtre de réservation, tableaux
tests/             tests unitaires et d'intégration
```

## Évolutions envisagées (V2)

- Synchronisation automatique avec les agendas Outlook (Microsoft Graph) ou connexion SSO Microsoft 365
- Version mobile, écrans « libre / occupé » devant les salles
- Statistiques d'occupation
