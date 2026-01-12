#!/bin/bash
set -e

# This script sets up role passwords using the POSTGRES_PASSWORD environment variable.
# It runs after 01-init.sql has created the roles.

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "ERROR: POSTGRES_PASSWORD is not set" >&2
  exit 1
fi

echo "Setting up role passwords..."

# Set passwords for all login roles
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    ALTER ROLE authenticator WITH PASSWORD '$POSTGRES_PASSWORD';
    ALTER ROLE supabase_admin WITH PASSWORD '$POSTGRES_PASSWORD';
    ALTER ROLE supabase_auth_admin WITH PASSWORD '$POSTGRES_PASSWORD';
    ALTER ROLE supabase_storage_admin WITH PASSWORD '$POSTGRES_PASSWORD';
EOSQL

echo "Role passwords configured successfully"