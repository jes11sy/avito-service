# Avito Service - Deployment Guide

## Prerequisites

1. PostgreSQL database
2. Docker & Docker Compose (optional)
3. Avito API credentials (Client ID, Client Secret)
4. Proxy servers (optional, for Avito API access)

---

## Local Development

### 1. Install Dependencies

```bash
cd api-services/avito-service
npm install
```

### 2. Setup Environment

Create `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/avito_db
JWT_SECRET=your-secret-key
PORT=5004
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### 3. Generate Prisma Client

```bash
npx prisma generate
npx prisma db push
```

### 4. Run Development Server

```bash
npm run start:dev
```

Service will be available at `http://localhost:5004`

---

## Docker Deployment

### 1. Build Docker Image

```bash
cd api-services/avito-service
docker build -t avito-service:latest .
```

### 2. Run Container

```bash
docker run -d \
  --name avito-service \
  -p 5004:5004 \
  -e DATABASE_URL="postgresql://user:password@host:5432/db" \
  -e JWT_SECRET="your-secret-key" \
  -e NODE_ENV="production" \
  avito-service:latest
```

---

## Kubernetes Deployment

### 1. Create Secrets

Create `k8s/secrets/avito-service-secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: avito-service-secrets
  namespace: default
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:password@postgres:5432/avito_db"
  JWT_SECRET: "your-jwt-secret-key"
```

Apply:

```bash
kubectl apply -f k8s/secrets/avito-service-secrets.yaml
```

### 2. Deploy Service

Create `k8s/deployments/avito-service.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: avito-service
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: avito-service
  template:
    metadata:
      labels:
        app: avito-service
    spec:
      containers:
      - name: avito-service
        image: your-registry/avito-service:latest
        ports:
        - containerPort: 5004
        env:
        - name: PORT
          value: "5004"
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: avito-service-secrets
              key: DATABASE_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: avito-service-secrets
              key: JWT_SECRET
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/v1/avito/health
            port: 5004
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/avito/health
            port: 5004
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: avito-service
  namespace: default
spec:
  selector:
    app: avito-service
  ports:
  - protocol: TCP
    port: 5004
    targetPort: 5004
  type: ClusterIP
```

Apply:

```bash
kubectl apply -f k8s/deployments/avito-service.yaml
```

---

## Database Setup

### 1. Create Database

```sql
CREATE DATABASE avito_db;
CREATE USER avito_user WITH ENCRYPTED PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE avito_db TO avito_user;
```

### 2. Run Migrations

```bash
npx prisma db push
```

---

## Initial Configuration

### 1. Create Avito Account

After deployment, create your first Avito account:

```bash
curl -X POST https://api.test-shem.ru/api/v1/accounts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Account",
    "clientId": "YOUR_AVITO_CLIENT_ID",
    "clientSecret": "YOUR_AVITO_CLIENT_SECRET",
    "userId": "YOUR_AVITO_USER_ID"
  }'
```

### 2. Test Connection

```bash
curl -X POST https://api.test-shem.ru/api/v1/accounts/1/check-connection \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Enable Eternal Online (optional)

```bash
curl -X POST https://api.test-shem.ru/api/v1/eternal-online/accounts/1/enable \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"interval": 300}'
```

---

## Proxy Configuration

### HTTP/HTTPS Proxy

```json
{
  "name": "Account with HTTP Proxy",
  "clientId": "...",
  "clientSecret": "...",
  "proxyType": "http",
  "proxyHost": "proxy.example.com",
  "proxyPort": 8080,
  "proxyLogin": "username",
  "proxyPassword": "password"
}
```

### SOCKS5 Proxy

```json
{
  "name": "Account with SOCKS5 Proxy",
  "clientId": "...",
  "clientSecret": "...",
  "proxyType": "socks5",
  "proxyHost": "socks.example.com",
  "proxyPort": 1080,
  "proxyLogin": "username",
  "proxyPassword": "password"
}
```

---

## Webhook Configuration

Configure Avito webhook in your Avito account settings:

**Webhook URL:** `https://api.test-shem.ru/api/v1/webhook/avito`

**Events to subscribe:**
- `chat.new`
- `message.new`

---

## Monitoring

### Health Check

```bash
curl https://api.test-shem.ru/api/v1/avito/health
```

### Check Logs

```bash
# Docker
docker logs -f avito-service

# Kubernetes
kubectl logs -f deployment/avito-service
```

---

## Troubleshooting

### 1. Connection Failed to Avito API

**Problem:** `connectionStatus: "disconnected"`

**Solutions:**
- Check Client ID and Client Secret
- Verify Avito API credentials are valid
- Check network connectivity

### 2. Proxy Connection Failed

**Problem:** `proxyStatus: "disconnected"`

**Solutions:**
- Verify proxy host and port
- Check proxy credentials
- Test proxy connection manually
- Try different proxy type

### 3. Eternal Online Not Working

**Problem:** Accounts not staying online

**Solutions:**
- Check cron is enabled (ScheduleModule)
- Verify `eternalOnlineEnabled: true`
- Check logs for errors
- Manually trigger: `POST /eternal-online/accounts/:id/set-online`

### 4. Database Connection Issues

**Problem:** Prisma connection errors

**Solutions:**
- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Test connection: `npx prisma db push`
- Check database permissions

---

## Production Checklist

- [ ] Environment variables configured
- [ ] Database created and migrated
- [ ] JWT_SECRET is strong and secure
- [ ] CORS_ORIGIN configured correctly
- [ ] Avito accounts created and tested
- [ ] Proxy configured (if needed)
- [ ] Webhook URL configured in Avito
- [ ] Health checks working
- [ ] Logs monitoring setup
- [ ] Eternal Online enabled (if needed)
- [ ] Backup strategy configured

---

## Support

For issues or questions, check:
- Swagger docs: `https://api.test-shem.ru/api/docs`
- Service logs
- README.md for API reference

