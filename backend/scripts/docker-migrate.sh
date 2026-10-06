#!/bin/sh
set -eu

echo "Attente de PostgreSQL..."

# Binaire Prisma appelé directement, sans pnpm : Corepack tenterait de télécharger
# la version de pnpm épinglée dans package.json, or ce conteneur est sur un réseau
# sans accès à Internet (la boucle tournerait alors indéfiniment).
until ./node_modules/.bin/prisma migrate deploy; do
  echo "PostgreSQL ou Prisma n'est pas encore prêt, nouvel essai dans 3 secondes..."
  sleep 3
done

echo "Migrations Prisma terminées."
