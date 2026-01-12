# 🚀 Running Sales Performance Tracker Locally with Docker

This guide explains how to run the complete application stack locally using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)
- Git

## Quick Start

### 1. Clone and Navigate to Docker Directory

```bash
cd docker
```

### 2. Create Environment File

```bash
cp .env.simple .env
```

Edit `.env` and set secure values:

```env
POSTGRES_PASSWORD=your-secure-password-here
SESSION_SECRET=generate-a-random-32-char-string
VITE_API_URL=/api
```

**Generate a secure session secret:**
```bash
openssl rand -base64 32
```

### 3. Build and Start

```bash
docker-compose -f docker-compose.simple.yml up --build
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **API Health Check**: http://localhost:4000/health
- **Database**: localhost:5432

## First Time Setup

1. Open http://localhost:3000
2. Click "Sign Up" to create your first account
3. The first user will need to be manually promoted to admin

### Promote User to Admin

Connect to the database and run:

```bash
docker exec -it docker-db-1 psql -U postgres -d salestracker
```

```sql
-- Find your user ID
SELECT id, email FROM profiles;

-- Add admin role
INSERT INTO user_roles (user_id, role) 
VALUES ('YOUR_USER_ID', 'admin');
```

## Common Commands

### Start in Background
```bash
docker-compose -f docker-compose.simple.yml up -d
```

### View Logs
```bash
docker-compose -f docker-compose.simple.yml logs -f
```

### Stop Services
```bash
docker-compose -f docker-compose.simple.yml down
```

### Reset Database (Warning: Deletes all data!)
```bash
docker-compose -f docker-compose.simple.yml down -v
docker-compose -f docker-compose.simple.yml up --build
```

### Rebuild After Code Changes
```bash
docker-compose -f docker-compose.simple.yml up --build
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Docker Network                 │
│  ┌─────────────┐         ┌─────────────────┐    │
│  │   Frontend  │◄───────►│   API Server    │    │
│  │  (nginx)    │  /api   │  (Express.js)   │    │
│  │  Port 3000  │         │   Port 4000     │    │
│  └─────────────┘         └────────┬────────┘    │
│                                   │              │
│                          ┌────────▼────────┐    │
│                          │   PostgreSQL    │    │
│                          │   Port 5432     │    │
│                          └─────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | `postgres` |
| `SESSION_SECRET` | Express session secret | (required) |
| `VITE_API_URL` | API URL for frontend | `/api` |

## Troubleshooting

### Database Connection Issues
```bash
# Check if database is healthy
docker-compose -f docker-compose.simple.yml ps

# View database logs
docker-compose -f docker-compose.simple.yml logs db
```

### API Not Responding
```bash
# Check API logs
docker-compose -f docker-compose.simple.yml logs app

# Test health endpoint
curl http://localhost:4000/health
```

### Port Already in Use
```bash
# Find process using port
lsof -i :3000
lsof -i :4000
lsof -i :5432

# Kill process or change ports in docker-compose.simple.yml
```

## Data Persistence

- Database data is stored in a Docker volume: `postgres-data`
- To backup: `docker exec docker-db-1 pg_dump -U postgres salestracker > backup.sql`
- To restore: `cat backup.sql | docker exec -i docker-db-1 psql -U postgres salestracker`

## Production Considerations

For production deployment:

1. Use proper SSL/TLS certificates
2. Set strong, unique passwords
3. Configure proper backup strategies
4. Consider using a managed database service
5. Set up monitoring and logging
6. Use environment-specific configurations
