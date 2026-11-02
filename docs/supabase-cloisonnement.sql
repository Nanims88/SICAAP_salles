-- =============================================================================
-- Installation cloisonnée de la réservation des salles dans un projet Supabase
-- partagé (ex. projet « Suivi temps travail »).
--
-- Principe :
--   * schéma dédié  : reservation_salles (aucune table dans public)
--   * rôle dédié    : reservation_salles_app, propriétaire de son schéma,
--                     sans aucun droit sur les données des autres projets
--   * non exposé    : le schéma n'est pas ajouté à l'API Supabase ; les rôles
--                     anon / authenticated n'y ont aucun accès
--
-- À exécuter une fois en tant que postgres (SQL Editor de Supabase), en
-- remplaçant <MOT_DE_PASSE>. Les tables sont ensuite créées par
-- `npm run db:migrate` avec la chaîne de connexion du rôle dédié.
-- =============================================================================

create role reservation_salles_app with login password '<MOT_DE_PASSE>'
  nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls connection limit 20;

-- PostgreSQL 16+ : l'administrateur doit pouvoir agir en tant que ce rôle
-- (pour lui attribuer le schéma). L'inverse n'est pas accordé.
grant reservation_salles_app to postgres with set true, inherit false;

create schema reservation_salles authorization reservation_salles_app;
revoke all on schema reservation_salles from public;

alter role reservation_salles_app set search_path = reservation_salles, extensions;
revoke create on schema public from reservation_salles_app;

-- Requise par la contrainte anti-chevauchement ; installée dans le schéma
-- "extensions" de Supabase (partagé, sans impact sur les autres projets).
create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Vérification du cloisonnement (toutes les colonnes "accessibles" doivent valoir 0)
-- -----------------------------------------------------------------------------
-- select count(*) filter (where has_table_privilege('reservation_salles_app', c.oid, 'SELECT,INSERT,UPDATE,DELETE')) as accessibles
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r';
