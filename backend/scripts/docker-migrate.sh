#!/bin/sh
set -eu

echo "Attente de PostgreSQL..."

until pnpm exec prisma migrate deploy; do
  echo "PostgreSQL ou Prisma n'est pas encore prêt, nouvel essai dans 3 secondes..."
  sleep 3
done

echo "Migrations Prisma terminées."
