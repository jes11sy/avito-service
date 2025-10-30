# Миграция на зашифрованное хранение секретов

## Обзор

В версии 2.1.0 все чувствительные данные (clientSecret, proxyPassword) теперь хранятся в зашифрованном виде.

## Шаги миграции

### 1. Сгенерировать ключ шифрования

```bash
# Сгенерировать случайный ключ (32+ символа)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Добавьте в `.env`:
```env
ENCRYPTION_KEY=ваш_сгенерированный_ключ_64_символа
```

⚠️ **ВАЖНО**: Сохраните этот ключ в надежном месте! Без него невозможно расшифровать данные.

### 2. Создать скрипт миграции

Создайте файл `scripts/migrate-encrypt-secrets.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../src/common/encryption.service';

async function migrateSecrets() {
  const prisma = new PrismaClient();
  const encryption = new EncryptionService();

  console.log('🔐 Starting encryption migration...');

  const accounts = await prisma.avito.findMany();
  
  console.log(`📊 Found ${accounts.length} accounts to migrate`);

  let migrated = 0;
  let skipped = 0;
  
  for (const account of accounts) {
    try {
      // Check if already encrypted
      const isClientSecretEncrypted = encryption.isEncrypted(account.clientSecret);
      const isProxyPasswordEncrypted = account.proxyPassword 
        ? encryption.isEncrypted(account.proxyPassword)
        : true;

      if (isClientSecretEncrypted && isProxyPasswordEncrypted) {
        console.log(`⏭️  Account ${account.name} (ID: ${account.id}) already encrypted, skipping`);
        skipped++;
        continue;
      }

      // Encrypt secrets
      const encryptedClientSecret = isClientSecretEncrypted
        ? account.clientSecret
        : await encryption.encrypt(account.clientSecret);

      const encryptedProxyPassword = account.proxyPassword && !isProxyPasswordEncrypted
        ? await encryption.encrypt(account.proxyPassword)
        : account.proxyPassword;

      // Update in database
      await prisma.avito.update({
        where: { id: account.id },
        data: {
          clientSecret: encryptedClientSecret,
          proxyPassword: encryptedProxyPassword,
        },
      });

      console.log(`✅ Account ${account.name} (ID: ${account.id}) migrated successfully`);
      migrated++;
    } catch (error) {
      console.error(`❌ Failed to migrate account ${account.name} (ID: ${account.id}):`, error.message);
    }
  }

  console.log(`\n📊 Migration completed:`);
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${accounts.length - migrated - skipped}`);

  await prisma.$disconnect();
}

migrateSecrets()
  .catch(console.error)
  .finally(() => process.exit());
```

### 3. Запустить миграцию

```bash
# Установить ts-node если еще не установлен
npm install -D ts-node

# Запустить миграцию
npx ts-node scripts/migrate-encrypt-secrets.ts
```

### 4. Проверить результат

```bash
# Подключиться к БД
psql -U avito_user -d avito_db

# Проверить, что секреты зашифрованы (должны быть длинные hex строки)
SELECT id, name, 
       substring(client_secret, 1, 20) as client_secret_preview,
       length(client_secret) as secret_length
FROM avito
LIMIT 5;
```

Зашифрованные значения должны:
- Быть в hex формате (только 0-9, a-f)
- Иметь длину минимум 256 символов
- Не содержать читаемый текст

### 5. Обновить приложение

```bash
# Пересобрать Docker образ
docker build -t avito-service:2.1.0 .

# Или перезапустить сервис
npm run start:prod
```

## Rollback

Если нужно откатить миграцию:

```typescript
// scripts/rollback-encryption.ts
async function rollbackEncryption() {
  const prisma = new PrismaClient();
  const encryption = new EncryptionService();

  const accounts = await prisma.avito.findMany();
  
  for (const account of accounts) {
    try {
      const decryptedClientSecret = await encryption.decryptIfNeeded(account.clientSecret);
      const decryptedProxyPassword = account.proxyPassword
        ? await encryption.decryptIfNeeded(account.proxyPassword)
        : null;

      await prisma.avito.update({
        where: { id: account.id },
        data: {
          clientSecret: decryptedClientSecret,
          proxyPassword: decryptedProxyPassword,
        },
      });

      console.log(`✅ Account ${account.name} decrypted`);
    } catch (error) {
      console.error(`❌ Failed to decrypt account ${account.name}:`, error.message);
    }
  }

  await prisma.$disconnect();
}
```

## Проверка после миграции

### 1. Тест создания аккаунта

```bash
curl -X POST http://localhost:5004/api/v1/accounts \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Account",
    "clientId": "test123",
    "clientSecret": "secret123",
    "userId": "12345"
  }'
```

### 2. Тест получения аккаунтов

```bash
curl http://localhost:5004/api/v1/accounts \
  -H "Authorization: Bearer YOUR_JWT"
```

Секреты должны возвращаться расшифрованными в API, но в БД храниться зашифрованными.

### 3. Проверка логов

```bash
# Логи НЕ должны содержать расшифрованные секреты
docker logs avito-service 2>&1 | grep -i "secret"
```

Должны быть только маскированные значения: `***` или `abc123...***`

## Безопасность ключа шифрования

### Хранение в Production

**Kubernetes Secret:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: avito-service-secrets
type: Opaque
stringData:
  ENCRYPTION_KEY: "ваш_ключ_64_символа"
```

**Docker Secret:**
```bash
echo "ваш_ключ" | docker secret create encryption_key -
```

**AWS Secrets Manager:**
```bash
aws secretsmanager create-secret \
  --name avito-service/encryption-key \
  --secret-string "ваш_ключ"
```

### Ротация ключей

Для ротации ключей шифрования:

1. Сохраните старый ключ как `ENCRYPTION_KEY_OLD`
2. Создайте новый ключ как `ENCRYPTION_KEY`
3. Запустите скрипт ре-шифрования:

```typescript
async function reEncrypt() {
  const oldKey = process.env.ENCRYPTION_KEY_OLD;
  const newKey = process.env.ENCRYPTION_KEY;
  
  const oldEncryption = new EncryptionService(oldKey);
  const newEncryption = new EncryptionService(newKey);
  
  // Для каждого аккаунта:
  // 1. Расшифровать старым ключом
  // 2. Зашифровать новым ключом
  // 3. Сохранить
}
```

## FAQ

**Q: Что делать, если потерян ключ шифрования?**  
A: Без ключа невозможно расшифровать данные. Нужно будет вручную пере вводить clientSecret для всех аккаунтов.

**Q: Влияет ли шифрование на производительность?**  
A: Минимально. Шифрование/дешифрование занимает ~1-2ms на операцию.

**Q: Можно ли использовать разные ключи для разных сред?**  
A: Да, рекомендуется использовать разные ключи для dev/staging/production.

**Q: Как проверить, что все секреты зашифрованы?**  
A: Запустите SQL запрос для проверки длины и формата:
```sql
SELECT COUNT(*) as total,
       COUNT(CASE WHEN length(client_secret) > 200 THEN 1 END) as encrypted
FROM avito;
```

## Поддержка

При возникновении проблем:
1. Проверьте логи: `docker logs avito-service`
2. Проверьте переменную окружения: `echo $ENCRYPTION_KEY`
3. Создайте issue в репозитории

