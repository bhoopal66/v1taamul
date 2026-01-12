#!/bin/bash
set -e

# This script sets up role passwords using the POSTGRES_PASSWORD environment variable
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Set passwords for all Supabase roles
    DO \$\$
    BEGIN
        -- Only set password if role exists
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
            ALTER ROLE supabase_admin WITH PASSWORD '$POSTGRES_PASSWORD';
        END IF;
        
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
            ALTER ROLE authenticator WITH PASSWORD '$POSTGRES_PASSWORD';
        END IF;
        
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
            ALTER ROLE supabase_auth_admin WITH PASSWORD '$POSTGRES_PASSWORD';
        END IF;
        
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
            ALTER ROLE supabase_storage_admin WITH PASSWORD '$POSTGRES_PASSWORD';
        END IF;
    END
    \$\$;
EOSQL

echo "Role passwords configured successfully"
