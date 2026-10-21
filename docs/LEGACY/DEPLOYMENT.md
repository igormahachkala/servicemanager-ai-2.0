# DEPLOYMENT — ServiceManager.AI

---

## 1. Current Dev Environment

- WSL Ubuntu
- Docker Compose
- Postgres container
- NestJS container

---

## 2. Production Architecture (Target)

- VPS or Cloud VM
- Docker Compose OR Kubernetes
- Reverse proxy (Nginx)
- HTTPS (Let's Encrypt)
- Separate Postgres instance
- Daily backups

---

## 3. Environment Variables (Production)

Required:
- DATABASE_URL
- JWT_SECRET
- NODE_ENV=production

Optional:
- RATE_LIMIT_CONFIG
- LOG_LEVEL

---

## 4. Scaling Plan

Stage 1:
Single server + Docker

Stage 2:
Separate DB server

Stage 3:
Horizontal scaling backend
Load balancer
Redis for caching

---

## 5. Monitoring

Future:
- Prometheus
- Grafana
- Log aggregation
- Error tracking (Sentry)

---

## 6. Backups

Daily:
pg_dump

Weekly:
Full DB snapshot

Store backups outside main server.
