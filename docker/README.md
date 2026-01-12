# Self-Hosted Sales Performance Tracker

Complete Docker setup for running the Sales Performance Tracker on your internal network.

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available
- 10GB disk space

## 🚀 Quick Start

### 1. Clone and Navigate

```bash
git clone <your-repo-url>
cd <repo-name>/docker
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your settings
nano .env
```

**Important settings to change:**

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Strong database password |
| `JWT_SECRET` | Min 32 chars (generate: `openssl rand -base64 32`) |
| `SECRET_KEY_BASE` | For Realtime (generate: `openssl rand -base64 64`) |
| `SUPABASE_PUBLIC_URL` | Your server IP, e.g., `http://192.168.1.100:8000` |
| `SITE_URL` | Frontend URL, e.g., `http://192.168.1.100:3000` |

### 3. Generate API Keys

Generate proper JWT keys using your `JWT_SECRET`:

```bash
# Install jwt-cli or use an online generator
# Keys must use the same JWT_SECRET
# See: https://supabase.com/docs/guides/self-hosting#api-keys
```

### 4. Start Services

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f
```

### 5. Initialize Database Schema

After services are running, apply the database migrations:

```bash
# Connect to the database
docker compose exec db psql -U postgres -d postgres

# Or use the Supabase Studio at http://YOUR_SERVER_IP:3001
```

## 📍 Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend App** | `http://YOUR_IP:3000` | Main application |
| **Supabase Studio** | `http://YOUR_IP:3001` | Database admin UI |
| **Supabase API** | `http://YOUR_IP:8000` | REST/Auth/Storage API |
| **PostgreSQL** | `YOUR_IP:5432` | Direct DB access |

## 📁 Project Structure

```
docker/
├── docker-compose.yml    # All services definition
├── Dockerfile            # Frontend build
├── nginx.conf            # Frontend web server config
├── kong.yml              # API Gateway routing
├── .env.example          # Environment template
├── init-scripts/         # Database initialization
│   └── 01-init.sql       # Roles and extensions
└── README.md             # This file
```

## 🔧 Common Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f [service-name]

# Restart a specific service
docker compose restart frontend

# Rebuild frontend after code changes
docker compose up -d --build frontend

# Access database shell
docker compose exec db psql -U postgres

# Backup database
docker compose exec db pg_dump -U postgres postgres > backup.sql

# Restore database
docker compose exec -T db psql -U postgres postgres < backup.sql
```

## 🗄️ Database Migrations

To apply the application's database schema:

1. Open Supabase Studio at `http://YOUR_IP:3001`
2. Navigate to SQL Editor
3. Copy and run each migration file from `supabase/migrations/` in order

Or use the command line:

```bash
# Apply all migrations
for f in ../supabase/migrations/*.sql; do
  docker compose exec -T db psql -U postgres -d postgres < "$f"
done
```

## 🔐 Security Recommendations

1. **Change all default passwords** in `.env`
2. **Use a firewall** to restrict access to internal network only
3. **Enable HTTPS** using a reverse proxy (nginx/traefik) with SSL certificates
4. **Regular backups** of the PostgreSQL data volume
5. **Keep images updated** for security patches

### Adding HTTPS (Optional)

For production, add a reverse proxy with SSL:

```yaml
# Add to docker-compose.yml
traefik:
  image: traefik:v2.10
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
    - ./traefik:/etc/traefik
```

## 🔄 Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart frontend
docker compose up -d --build frontend

# Apply any new migrations
for f in ../supabase/migrations/*.sql; do
  docker compose exec -T db psql -U postgres -d postgres < "$f"
done
```

## 🐛 Troubleshooting

### Services won't start

```bash
# Check service status
docker compose ps

# Check logs for errors
docker compose logs db
docker compose logs auth
```

### Database connection issues

```bash
# Verify database is healthy
docker compose exec db pg_isready

# Check connection from another container
docker compose exec rest psql -h db -U postgres -c "SELECT 1"
```

### Frontend can't reach API

- Verify `SUPABASE_PUBLIC_URL` is accessible from your browser
- Check Kong logs: `docker compose logs kong`
- Ensure ports 3000 and 8000 are not blocked by firewall

### Clear everything and start fresh

```bash
docker compose down -v
docker compose up -d
```

## 📞 Support

For issues specific to this application, check the main repository issues.
For Supabase self-hosting, see: https://supabase.com/docs/guides/self-hosting
