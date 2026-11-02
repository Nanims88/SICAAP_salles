-- Charte graphique SICAAP : couleurs des salles.
-- Ne modifie que les salles ayant encore leur couleur d'origine
-- (une couleur personnalisée dans l'administration est conservée).
UPDATE "Room" SET "color" = '#57cbbb' WHERE "name" = 'Box 1'        AND "color" = '#0e7490';
UPDATE "Room" SET "color" = '#f8ac16' WHERE "name" = 'Box 2'        AND "color" = '#7c3aed';
UPDATE "Room" SET "color" = '#044589' WHERE "name" = 'Petite salle' AND "color" = '#16a34a';
UPDATE "Room" SET "color" = '#015959' WHERE "name" = 'Grande salle' AND "color" = '#dc2626';
