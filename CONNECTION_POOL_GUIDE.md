# Connection Pool Configuration Guide

## Обзор

Правильная настройка connection pool критична для производительности и стабильности сервиса. По умолчанию Prisma использует всего 10 соединений, что недостаточно для production нагрузки.

---

## 🎯 Быстрый старт

### Development
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/db?connection_limit=10&pool_timeout=10"
```

### Production - Recommended
```env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=50&pool_timeout=20&connect_timeout=10&socket_timeout=30"
```

---

## 📊 Параметры Connection Pool

### 1. `connection_limit`
**Что:** Максимальное количество одновременных соединений с БД

**Значения:**
- `10` (default) - для разработки
- `20-30` - production с низкой нагрузкой
- `50-100` - production с высокой нагрузкой
- `100+` - масштабные deployments

**Формула для расчета:**
```
connection_limit = (CPU cores * 2) + effective_spindle_count

Примеры:
- 2 core server: (2 * 2) + 1 = 5 → используйте 10
- 4 core server: (4 * 2) + 1 = 9 → используйте 20
- 8 core server: (8 * 2) + 1 = 17 → используйте 30-50
```

**Когда увеличивать:**
- Много одновременных запросов
- Длительные транзакции
- Микросервисная архитектура
- Высокий RPS (requests per second)

**Признаки недостаточного лимита:**
```
Error: Can't reach database server
Error: Timed out fetching a new connection
```

---

### 2. `pool_timeout`
**Что:** Время ожидания свободного соединения (в секундах)

**Значения:**
- `10` (default) - для разработки
- `20` - production
- `30+` - для длительных операций

**Когда увеличивать:**
- Частые timeouts при получении connection
- Длительные запросы
- Высокая конкуренция за connections

**Ошибки при недостаточном timeout:**
```
Error: Timed out fetching a new connection from the connection pool
```

---

### 3. `connect_timeout`
**Что:** Время ожидания установки TCP соединения (в секундах)

**Значения:**
- `5` (default) - для разработки
- `10` - production
- `15-30` - медленная сеть или удаленная БД

**Когда увеличивать:**
- БД находится в другом дата-центре
- Медленная сеть
- Большие расстояния (geographic latency)

---

### 4. `socket_timeout`
**Что:** Timeout для выполнения запроса (в секундах)

**Значения:**
- `0` (default) - без таймаута
- `30` - короткие запросы
- `60-120` - длительные операции (отчеты, экспорты)

**Когда устанавливать:**
- Защита от "висящих" запросов
- Ограничение времени выполнения API calls
- Предотвращение deadlocks

**⚠️ Внимание:** Может прервать длительные операции!

---

## 🔧 Примеры конфигураций

### Малый проект (1-10 RPS)
```env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10"
```

**Характеристики:**
- До 10 запросов в секунду
- 1-2 replicas
- Локальная БД

---

### Средний проект (10-100 RPS)
```env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=30&pool_timeout=15&connect_timeout=10"
```

**Характеристики:**
- 10-100 запросов в секунду
- 2-4 replicas
- БД в том же регионе

---

### Крупный проект (100+ RPS)
```env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=100&pool_timeout=20&connect_timeout=10&socket_timeout=30"
```

**Характеристики:**
- 100+ запросов в секунду
- 5+ replicas
- Высокая нагрузка
- Потребность в мониторинге

---

### Микросервисная архитектура
```env
# Каждый микросервис
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=15"
```

**Расчет:**
- 5 микросервисов × 20 connections = 100 total
- PostgreSQL default: `max_connections = 100`
- Нужно увеличить `max_connections` в PostgreSQL!

```sql
-- В postgresql.conf
max_connections = 200
```

---

## 📈 Мониторинг Connection Pool

### 1. Встроенный мониторинг

```bash
# Health check с информацией о pool
curl http://localhost:5004/api/v1/accounts/health

# Детальная статистика (требует JWT)
curl -H "Authorization: Bearer $JWT" \
  http://localhost:5004/api/v1/accounts/stats/database
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "totalQueries": 15234,
    "totalErrors": 2,
    "poolInfo": "Limit: 50, Pool Timeout: 20s, Connect Timeout: 10s",
    "timestamp": "2025-10-30T12:00:00.000Z"
  }
}
```

---

### 2. Логи Prisma

При запуске сервиса в логах отображается информация о pool:

```
✅ Database connected
📊 Connection Pool: Limit: 50, Pool Timeout: 20s, Connect Timeout: 10s
```

В production включается мониторинг медленных запросов:

```
🔍 Slow query logging enabled (threshold: 1000ms)
🐌 Slow Query Detected: Avito.findMany took 1234ms
🔴 Very Slow Query: Order.aggregate took 3456ms
```

---

### 3. PostgreSQL мониторинг

```sql
-- Текущие активные соединения
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- Лимит соединений
SHOW max_connections;

-- Соединения по database
SELECT datname, count(*) as connections
FROM pg_stat_activity
GROUP BY datname
ORDER BY connections DESC;

-- Idle connections
SELECT count(*) as idle_connections
FROM pg_stat_activity
WHERE state = 'idle';
```

---

### 4. Prometheus Metrics (рекомендуется)

Для production рекомендуется добавить metrics:

```typescript
// prisma-metrics.service.ts
import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class PrismaMetricsService {
  private readonly poolSize = new client.Gauge({
    name: 'prisma_pool_size',
    help: 'Current connection pool size',
  });

  private readonly activeConnections = new client.Gauge({
    name: 'prisma_active_connections',
    help: 'Number of active connections',
  });

  private readonly waitingRequests = new client.Gauge({
    name: 'prisma_waiting_requests',
    help: 'Number of requests waiting for connection',
  });

  private readonly queryDuration = new client.Histogram({
    name: 'prisma_query_duration_seconds',
    help: 'Query execution time',
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
  });
}
```

---

## 🚨 Проблемы и решения

### Problem 1: Connection Exhaustion

**Симптомы:**
```
Error: Can't reach database server
Error: Timed out fetching a new connection
```

**Причины:**
- Слишком мало connections в pool
- Медленные запросы блокируют connections
- Connection leaks (не закрываются)

**Решение:**
1. Увеличить `connection_limit`
2. Оптимизировать медленные запросы
3. Добавить `socket_timeout` для защиты
4. Проверить наличие connection leaks

```env
# До
connection_limit=10

# После
connection_limit=50&socket_timeout=30
```

---

### Problem 2: High Latency

**Симптомы:**
- Медленные ответы API
- Timeout ошибки

**Причины:**
- Недостаточный `pool_timeout`
- Медленные запросы
- N+1 queries

**Решение:**
1. Увеличить `pool_timeout`
2. Оптимизировать запросы (см. N+1 query fix)
3. Добавить индексы в БД

---

### Problem 3: PostgreSQL max_connections exceeded

**Симптомы:**
```
FATAL: sorry, too many clients already
```

**Причина:**
Сумма connection_limit всех сервисов > PostgreSQL max_connections

**Решение:**

```sql
-- Увеличить в PostgreSQL
ALTER SYSTEM SET max_connections = 200;
-- Перезапуск PostgreSQL
SELECT pg_reload_conf();
```

Или использовать PgBouncer:

```bash
# docker-compose.yml
pgbouncer:
  image: pgbouncer/pgbouncer
  environment:
    - DATABASES_HOST=postgres
    - POOL_MODE=transaction
    - MAX_CLIENT_CONN=1000
    - DEFAULT_POOL_SIZE=25
```

---

### Problem 4: Memory Usage

**Симптомы:**
- Высокое потребление памяти PostgreSQL
- OOM kills

**Причина:**
Слишком много connections × работающая память на connection

**Формула:**
```
RAM = connections × work_mem × max_parallel_workers
Example: 100 × 4MB × 2 = 800MB
```

**Решение:**
1. Уменьшить `connection_limit`
2. Использовать connection pooler (PgBouncer)
3. Оптимизировать `work_mem` в PostgreSQL

---

## 🎯 Best Practices

### 1. Правильный расчет connections

```
Одна инстанс сервиса:
- connection_limit = (CPU cores * 2) + 1
- Example: 4 cores → 10 connections

Kubernetes с replicas:
- Per pod: 20 connections
- 3 replicas × 20 = 60 total
- PostgreSQL max_connections > 60
```

### 2. Мониторинг обязателен

```typescript
// Добавить Prometheus metrics
// Настроить алерты на:
- pool exhaustion (waiting > 5)
- slow queries (> 1s)
- connection errors
```

### 3. Использовать PgBouncer для масштабирования

```yaml
# k8s/pgbouncer.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
spec:
  template:
    spec:
      containers:
      - name: pgbouncer
        image: pgbouncer/pgbouncer
        env:
        - name: POOL_MODE
          value: "transaction"
        - name: MAX_CLIENT_CONN
          value: "1000"
        - name: DEFAULT_POOL_SIZE
          value: "25"
```

### 4. Тестирование под нагрузкой

```bash
# Load testing
npm install -g artillery

# artillery.yml
config:
  target: 'http://localhost:5004'
  phases:
    - duration: 60
      arrivalRate: 10  # 10 req/sec
    - duration: 120
      arrivalRate: 50  # 50 req/sec

scenarios:
  - flow:
    - get:
        url: "/api/v1/accounts"
```

---

## 📊 Рекомендации по sizing

| Метрика | Small | Medium | Large | Enterprise |
|---------|-------|--------|-------|------------|
| RPS | < 10 | 10-100 | 100-500 | 500+ |
| Users | < 100 | 100-1k | 1k-10k | 10k+ |
| Replicas | 1-2 | 2-4 | 4-8 | 8+ |
| connection_limit/pod | 10 | 20-30 | 30-50 | 50-100 |
| Total connections | 10-20 | 40-120 | 120-400 | 400+ |
| PostgreSQL max_conn | 50 | 150 | 500 | 1000+ |
| Use PgBouncer? | Optional | Recommended | Required | Required |

---

## 🔗 Дополнительные ресурсы

- [Prisma Connection Pool](https://www.prisma.io/docs/concepts/components/prisma-client/connection-pool)
- [PostgreSQL Connection Pooling](https://wiki.postgresql.org/wiki/Number_Of_Database_Connections)
- [PgBouncer Documentation](https://www.pgbouncer.org/)
- [Connection Pool Best Practices](https://brandur.org/postgres-connections)

---

## 📝 Чеклист

Production Deployment:
- [ ] Рассчитан оптимальный `connection_limit`
- [ ] Установлены `pool_timeout` и `connect_timeout`
- [ ] PostgreSQL `max_connections` достаточно
- [ ] Настроен мониторинг connections
- [ ] Алерты на connection exhaustion
- [ ] Тестирование под нагрузкой
- [ ] Документация для команды
- [ ] PgBouncer (для >50 connections)

---

**Автор:** AI Database Optimization System  
**Дата:** 2025-10-30  
**Версия:** 1.0

