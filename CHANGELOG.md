# Changelog - Avito Service

## [3.0.0] - OAuth Migration - 2025-01-XX

### 🚨 BREAKING CHANGES

#### OAuth 2.0 Authorization
- **REMOVED** `client_credentials` authorization (персональные API ключи)
- **ADDED** OAuth 2.0 `authorization_code` flow
- All accounts must be re-authorized via OAuth

#### Why OAuth?
- ✅ **Free** (персональные ключи стали платными на Avito)
- ✅ More secure (automatic token refresh)
- ✅ Better control (users approve access)
- ✅ One app for multiple users

### ✨ New Features

#### OAuth Module
- `GET /api/v1/oauth/avito/authorize/:accountId` - Start OAuth flow
- `GET /api/v1/oauth/avito/callback` - OAuth callback handler
- `GET /api/v1/oauth/avito/refresh/:accountId` - Manual token refresh
- Automatic token refresh on API calls
- State parameter for CSRF protection

#### Token Management
- `clientId` now stores `access_token` (OAuth)
- `clientSecret` now stores `refresh_token` (OAuth)
- Automatic token refresh when expired
- Token lifetime: 24 hours (access), 1 year (refresh)

### 🔧 Technical Changes

#### Environment Variables (NEW - REQUIRED)
```env
AVITO_OAUTH_CLIENT_ID=your_client_id
AVITO_OAUTH_CLIENT_SECRET=your_client_secret
AVITO_OAUTH_REDIRECT_URI=https://api.lead-shem.ru/api/v1/oauth/avito/callback
AVITO_OAUTH_SCOPES=messenger:read,messenger:write,user:read,items:info
```

#### Modified Services
- `avito-api.service.ts` - Removed `client_credentials`, now uses OAuth tokens directly
- `oauth.service.ts` - New service for OAuth flow management
- `oauth.controller.ts` - New controller for OAuth endpoints

#### Database
- No schema changes required
- `clientId` = `access_token` (long JWT string)
- `clientSecret` = `refresh_token` (long string)

### 📝 Migration Guide

See `OAUTH_MIGRATION.md` for detailed migration instructions.

**Quick steps:**
1. Register app at https://developers.avito.ru/applications
2. Add OAuth credentials to `.env`
3. Restart service
4. Re-authorize all accounts via `/oauth/avito/authorize/:accountId`

### 🔒 Security Improvements
- OAuth 2.0 standard compliance
- CSRF protection with state parameter
- Automatic token rotation
- Refresh tokens valid for 1 year

---

## [2.0.0] - Expansion Release

### ✨ New Features

#### Avito Accounts Management
- Added full CRUD for Avito accounts
- Account credentials management (Client ID, Client Secret, User ID)
- Connection status tracking
- Statistics synchronization (balance, ads, views, contacts)

#### Avito API Integration
- Complete Avito API client implementation
- Access token management with auto-refresh
- Account information retrieval
- Balance checking
- Ads statistics (views, contacts, favorites)
- Health check for API connectivity

#### Proxy Support
- Multi-protocol proxy support: HTTP, HTTPS, SOCKS4, SOCKS5
- Per-account proxy configuration
- Proxy authentication support
- Proxy health checks
- Separate status tracking for API and proxy

#### Eternal Online Feature
- Automatic online status maintenance
- Configurable keep-alive interval (60-3600 seconds)
- Cron-based automatic online status updates (every 5 minutes)
- Per-account enable/disable control
- Manual online status trigger
- Online status tracking in database

#### Avito Messenger API
- Direct integration with Avito Messenger API
- Get chats from Avito API
- Get chat messages
- Send messages to chats
- Mark messages as read
- Set online status manually

### 🔧 Technical Improvements

- Added `@nestjs/schedule` for cron jobs
- Added `axios` for HTTP requests
- Added `https-proxy-agent` for HTTP/HTTPS proxy
- Added `socks-proxy-agent` for SOCKS proxy
- Enhanced Prisma schema with `AvitoAccount` model
- Renamed `Avito` model to `AvitoChat` for clarity
- Added account-chat relationships
- Added comprehensive statistics fields
- Improved error handling and logging

### 📦 Database Changes

#### New Tables
- `avito_account` - Avito API accounts with credentials and settings

#### Modified Tables
- `avito` → `avito_chat` - Renamed for clarity
- Added `account_id` field to link chats with accounts
- Added `@map` directives for all fields (snake_case in DB)

### 🎯 API Endpoints

#### New Account Endpoints
- `GET /api/v1/accounts` - List all accounts
- `GET /api/v1/accounts/:id` - Get account details
- `POST /api/v1/accounts` - Create account
- `PUT /api/v1/accounts/:id` - Update account
- `DELETE /api/v1/accounts/:id` - Delete account
- `POST /api/v1/accounts/:id/check-connection` - Check API/proxy
- `POST /api/v1/accounts/:id/sync-stats` - Sync statistics

#### New Messenger Endpoints
- `GET /api/v1/messenger/accounts/:accountId/chats` - Get chats
- `GET /api/v1/messenger/accounts/:accountId/chats/:chatId/messages` - Get messages
- `POST /api/v1/messenger/accounts/:accountId/chats/:chatId/send` - Send message
- `POST /api/v1/messenger/accounts/:accountId/chats/:chatId/messages/:messageId/read` - Mark as read
- `POST /api/v1/messenger/accounts/:accountId/status/online` - Set online

#### New Eternal Online Endpoints
- `POST /api/v1/eternal-online/accounts/:accountId/enable` - Enable eternal online
- `POST /api/v1/eternal-online/accounts/:accountId/disable` - Disable eternal online
- `POST /api/v1/eternal-online/accounts/:accountId/set-online` - Manual online trigger

### 📝 Documentation

- Updated README.md with full feature list
- Added DEPLOYMENT.md with deployment guide
- Added Kubernetes manifests examples
- Added proxy configuration examples
- Added troubleshooting guide

### 🔐 Security

- JWT authentication for all endpoints
- Role-based access control (RBAC)
- Secure credential storage in database
- Proxy authentication support

---

## [1.0.0] - Initial Release

### Features
- Basic Avito chats management
- Chat messages storage
- Webhook integration for incoming messages
- Search by phone number
- Chat status management

