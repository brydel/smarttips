# SmartTips Connect Foundation Architecture Report

## Executive Summary

SmartTips Connect should be built as the professional integration layer for SmartTips, not as a CSV feature. Its job is to normalize restaurant operational data from APIs, assisted imports, exports, notifications, and billing providers into canonical SmartTips contracts.

The first implementation should establish the foundation: provider registry, tenant-scoped integration accounts, encrypted credentials, external ID mappings, sync jobs, webhook intake, import batches, health events, connector interfaces, and manager UX. Square POS should be the first direct API connector. The Universal POS Import Assistant should be the fallback path when official API access is unavailable.

Official docs checked for key assumptions: Square OAuth/tokens, Square permissions, Square orders/payments/team/location APIs, and Square webhook validation/retry behavior. Square confirms OAuth is appropriate for multi-tenant seller access, `ORDERS_READ`, `PAYMENTS_READ`, `EMPLOYEES_READ`, and `MERCHANT_PROFILE_READ` are relevant read scopes, webhook signatures use `x-square-hmacsha256-signature`, and webhook events can be duplicated and should be deduped by `event_id`.

Sources:
[Square OAuth](https://developer.squareup.com/docs/oauth-api/overview), [Square access tokens](https://developer.squareup.com/docs/build-basics/access-tokens), [Square permissions](https://developer.squareup.com/docs/oauth-api/square-permissions), [Square webhooks](https://developer.squareup.com/docs/webhooks/overview), [Square webhook validation](https://developer.squareup.com/docs/webhooks/step3validate), [Square Orders search](https://developer.squareup.com/docs/orders-api/manage-orders/search-orders), [Square Payments](https://developer.squareup.com/reference/square/payments-api/list-payments), [Square Team API](https://developer.squareup.com/docs/team/overview), [Clover docs](https://docs.clover.com/dev/docs/developer-documentation), [Toast API overview](https://doc.toasttab.com/doc/devguide/apiOverview.html), [Lightspeed Restaurant API portal](https://api-portal.lsk.lightspeed.app/), [QuickBooks OAuth](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0), [Xero OAuth](https://developer.xero.com/documentation/guides/oauth2/overview), [Stripe webhooks](https://docs.stripe.com/webhooks/signatures).

## Product Positioning

SmartTips Connect is the data integration foundation that turns fragmented restaurant operational data into normalized SmartTips inputs.

It is:
- A tenant-scoped integration platform for POS, import, accounting, notifications, and billing.
- A canonical data normalization layer for locations, employees, shifts, sales, orders, tips, time entries, and exports.
- A reliability layer with sync jobs, cursors, idempotency, health events, audit logs, and error recovery.
- A sales enabler: restaurants can start with assisted import immediately, then upgrade to direct API connectors when access is available.

It is not:
- A raw CSV upload feature.
- A one-off Square integration.
- A replacement for POS, payroll, or accounting systems.
- A bidirectional automation engine in V1.
- An autonomous AI system that changes financial records without manager confirmation.

Sales value:
- "Works with your current POS" becomes credible even before partner access exists.
- Square gives SmartTips a real direct API integration story.
- Universal POS Import Assistant avoids blocking pilots on Toast or TouchBistro partner gates.
- Future QuickBooks/Xero exports make SmartTips fit back-office workflows.
- Connect creates a platform narrative: SmartTips is not just tip splitting, it is restaurant operations intelligence.

## Current System Fit

Current architecture fit:
- `apps/api`: NestJS, Prisma, PostgreSQL, JWT roles, tenant-scoped services.
- `apps/web`: Next.js dashboard and employee mobile surfaces.
- `apps/ml-service`: deployed separately and callable by API.
- Existing business modules: employees, shifts, orders, tip pools, distribution, tenant config, reports, audit.
- Existing schema convention: UUID primary keys, explicit `tenant_id` on business tables, soft deletes for critical entities, immutable audit logs.
- Existing dependencies include BullMQ, Redis, Axios, Resend, validation, throttling, and CSV/PDF export support.
- No general integration module, connector registry, encrypted credential store, OAuth callback controller, webhook framework, or external mapping table is currently present.

Recommended module shape:
- `apps/api/src/integrations`
- `integrations/connectors`
- `integrations/credentials`
- `integrations/oauth`
- `integrations/webhooks`
- `integrations/sync`
- `integrations/imports`
- `integrations/mappings`
- `integrations/health`
- `apps/web/src/app/(dashboard)/dashboard/integrations`
- `apps/web/src/features/integrations`

## Provider Model

Provider enum:

| Provider | Category | First posture |
|---|---|---|
| `SQUARE_POS` | Direct API connector | Build first |
| `CLOVER_POS` | Direct API connector | Later direct POS connector |
| `TOAST_POS` | Partner-gated connector | Design only until access confirmed |
| `LIGHTSPEED_POS` | Direct or access-gated POS connector | Later |
| `TOUCHBISTRO_POS` | Partner-gated connector | Later |
| `UNIVERSAL_POS_IMPORT` | Import assistant connector | Build foundation early |
| `QUICKBOOKS_ONLINE` | Export connector | Later accounting export |
| `XERO` | Export connector | Later accounting export |
| `RESEND` | Notification connector | Existing email provider, formalize later |
| `TWILIO` | Notification connector | Later SMS/WhatsApp |
| `STRIPE` | Billing connector | Later billing/subscription |

Supporting enums:
- `IntegrationCategory`: `DIRECT_API`, `PARTNER_GATED`, `IMPORT_ASSISTANT`, `EXPORT`, `NOTIFICATION`, `BILLING`
- `IntegrationEnvironment`: `SANDBOX`, `PRODUCTION`
- `IntegrationStatus`: `PENDING`, `CONNECTED`, `NEEDS_REAUTH`, `PAUSED`, `DISCONNECTED`, `ERROR`
- `IntegrationCapability`: `LOCATIONS`, `EMPLOYEES`, `SHIFTS`, `SALES`, `TIPS`, `TIME_ENTRIES`, `ACCOUNTING_EXPORT`, `EMAIL`, `SMS`, `BILLING`

## Core Architecture

Core flow:
1. Manager connects provider or starts Universal POS Import Assistant.
2. API creates `IntegrationAccount`.
3. OAuth/API credentials are encrypted in `IntegrationCredential`.
4. Provider data lands as canonical DTOs.
5. External IDs are stored in `IntegrationExternalMapping`.
6. Sync work runs through `IntegrationSyncJob`.
7. Webhook events are verified, deduped, stored, and queued.
8. Invalid rows/events are quarantined.
9. Valid canonical data is applied to current SmartTips entities through tenant-scoped services.
10. Audit and health events are emitted.

Integration boundaries:
- Connectors produce canonical DTOs; they do not directly mutate distribution records.
- Apply services decide whether canonical data creates/updates `Employee`, `Shift`, `Order`, `TipPool`, or future export records.
- Manager confirmation is required before import apply and before any destructive mapping change.
- Distribution remains the financial calculation source.
- Connect supplies better inputs for distribution, reports, dashboard, and ML training.

## Prisma Data Model

### Shared enums

```prisma
enum IntegrationProvider {
  SQUARE_POS
  CLOVER_POS
  TOAST_POS
  LIGHTSPEED_POS
  TOUCHBISTRO_POS
  UNIVERSAL_POS_IMPORT
  QUICKBOOKS_ONLINE
  XERO
  RESEND
  TWILIO
  STRIPE
}

enum IntegrationAccountStatus {
  PENDING
  CONNECTED
  NEEDS_REAUTH
  PAUSED
  DISCONNECTED
  ERROR
}

enum IntegrationCredentialStatus {
  ACTIVE
  EXPIRED
  REVOKED
  ROTATING
}

enum IntegrationMappingStatus {
  UNMAPPED
  MAPPED
  IGNORED
  CONFLICT
  STALE
}

enum IntegrationSyncJobStatus {
  QUEUED
  RUNNING
  SUCCEEDED
  PARTIAL_FAILED
  FAILED
  CANCELED
  DEAD_LETTER
}

enum IntegrationWebhookEventStatus {
  RECEIVED
  VERIFIED
  QUEUED
  PROCESSED
  DUPLICATE
  REJECTED
  FAILED
}

enum IntegrationImportBatchStatus {
  UPLOADED
  PARSED
  MAPPING_REQUIRED
  VALIDATION_FAILED
  READY_TO_APPLY
  APPLYING
  APPLIED
  PARTIAL_FAILED
  FAILED
  CANCELED
}

enum IntegrationImportRowStatus {
  PENDING
  VALID
  INVALID
  QUARANTINED
  DUPLICATE
  SKIPPED
  APPLIED
}

enum IntegrationHealthSeverity {
  INFO
  WARNING
  ERROR
  CRITICAL
}
```

### `IntegrationAccount`

Purpose: tenant-scoped connected provider account.

Fields:
- `id`, `tenantId`, `provider`, `category`, `environment`
- `displayName`
- `externalAccountId`, `externalMerchantId`
- `status`
- `capabilities Json`
- `settings Json`
- `connectedById`, `disconnectedById`
- `connectedAt`, `lastSyncAt`, `disconnectedAt`
- `createdAt`, `updatedAt`, `deletedAt`

Tenant strategy:
- Required `tenantId`.
- Relation to `Tenant` with `onDelete: Restrict`.
- Every query must filter by `tenantId`.

Relations:
- `tenant`
- `connectedBy User`
- credentials, mappings, sync jobs, webhook events, import batches, health events.

Indexes:
- `@@index([tenantId])`
- `@@index([tenantId, provider])`
- `@@index([tenantId, status])`
- `@@index([tenantId, provider, status])`
- `@@index([tenantId, deletedAt])`

Unique constraints:
- `@@unique([tenantId, provider, externalAccountId, environment])`
- For providers without external account IDs, enforce one active account per tenant/provider in service logic or partial unique index later.

Retention:
- Keep account rows indefinitely with soft delete.
- Do not hard-delete connected account history.

Security:
- No tokens or secrets.
- `settings` must not contain credentials.
- Never log external auth payloads.

### `IntegrationCredential`

Purpose: encrypted tenant/provider credential storage.

Fields:
- `id`, `tenantId`, `integrationAccountId`
- `kind`: `OAUTH_ACCESS_TOKEN`, `OAUTH_REFRESH_TOKEN`, `API_KEY`, `WEBHOOK_SECRET`, `CLIENT_SECRET_REFERENCE`
- `status`
- `encryptedPayload`
- `encryptionKeyVersion`
- `scopes String[]`
- `expiresAt`, `lastRefreshedAt`, `rotatedAt`, `revokedAt`
- `createdAt`, `updatedAt`

Tenant strategy:
- Required `tenantId`.
- Must equal parent account `tenantId`, enforced in service and later DB trigger if needed.

Relations:
- `tenant`
- `integrationAccount`

Indexes:
- `@@index([tenantId, integrationAccountId])`
- `@@index([tenantId, status])`
- `@@index([expiresAt])`

Unique constraints:
- `@@unique([integrationAccountId, kind])` for current active credential set, or include `status` if historical rows are retained.

Retention:
- Revoke old credentials and retain metadata.
- Encrypted payload for revoked credentials should be wiped or replaced with tombstone after 30 days.

Security:
- Encrypt with envelope encryption or application AEAD using key versioning.
- Never log decrypted payload, access token, refresh token, API key, webhook secret, auth code, OAuth state secret, or client secret.

### `IntegrationExternalMapping`

Purpose: maps vendor IDs to SmartTips IDs.

Fields:
- `id`, `tenantId`, `integrationAccountId`
- `provider`
- `externalType`: `LOCATION`, `EMPLOYEE`, `SHIFT`, `ORDER`, `PAYMENT`, `TIP`, `TIME_ENTRY`, `ACCOUNTING_ACCOUNT`
- `externalId`
- `internalType`
- `internalId`
- `displayName`
- `status`
- `matchedBy`: `AUTO`, `MANUAL`, `IMPORT_PRESET`, `SYSTEM`
- `confidence`
- `canonicalHash`
- `metadata Json`
- `createdAt`, `updatedAt`, `deletedAt`

Tenant strategy:
- Required `tenantId`; every mapping is tenant-local.
- Same Square employee in two tenants must produce two mappings.

Relations:
- `tenant`
- `integrationAccount`

Indexes:
- `@@index([tenantId, integrationAccountId])`
- `@@index([tenantId, externalType])`
- `@@index([tenantId, internalType, internalId])`
- `@@index([tenantId, status])`

Unique constraints:
- `@@unique([tenantId, integrationAccountId, externalType, externalId])`

Retention:
- Keep mappings while tenant exists.
- Soft-delete stale mappings.

Security:
- External IDs are not secrets but may be sensitive operational metadata.
- Do not store raw vendor employee payloads here.

### `IntegrationSyncJob`

Purpose: durable async sync/export/import-apply job ledger.

Fields:
- `id`, `tenantId`, `integrationAccountId`
- `provider`
- `jobType`: `FULL_SYNC`, `INCREMENTAL_SYNC`, `WEBHOOK_RECONCILE`, `IMPORT_APPLY`, `EXPORT`
- `status`
- `idempotencyKey`
- `cursorFrom Json`, `cursorTo Json`
- `requestedById`
- `startedAt`, `finishedAt`, `nextRetryAt`
- `attemptCount`, `maxAttempts`
- `errorCode`, `safeErrorMessage`
- `stats Json`
- `createdAt`, `updatedAt`

Tenant strategy:
- Required `tenantId`.
- BullMQ job ID should include `tenantId` and job ID.

Relations:
- `tenant`
- `integrationAccount`
- `requestedBy User?`

Indexes:
- `@@index([tenantId, integrationAccountId, createdAt])`
- `@@index([tenantId, status])`
- `@@index([status, nextRetryAt])`
- `@@index([tenantId, jobType])`

Unique constraints:
- `@@unique([tenantId, idempotencyKey])`

Retention:
- Keep successful job details 90 days.
- Keep failed/dead-letter jobs 1 year or until resolved.
- Keep aggregate health history longer.

Security:
- Error fields must be sanitized.
- Never log request/response bodies, tokens, auth headers, or raw vendor payloads.

### `IntegrationWebhookEvent`

Purpose: verified webhook event ledger and dedupe store.

Fields:
- `id`, `tenantId`, `integrationAccountId`
- `provider`
- `providerEventId`
- `eventType`
- `status`
- `payloadHash`
- `payloadRef`
- `signatureVerified`
- `receivedAt`, `processedAt`
- `providerCreatedAt`
- `retryNumber`
- `requestId`
- `safeSummary Json`
- `errorCode`, `safeErrorMessage`
- `createdAt`, `updatedAt`

Tenant strategy:
- Required `tenantId` for persisted events.
- Webhook route should resolve account by signed provider metadata or account-specific endpoint before persistence.
- Unknown/unverifiable webhooks should be rejected without storing raw payload.

Relations:
- `tenant`
- `integrationAccount`

Indexes:
- `@@index([tenantId, integrationAccountId, receivedAt])`
- `@@index([tenantId, status])`
- `@@index([provider, eventType])`

Unique constraints:
- `@@unique([provider, integrationAccountId, providerEventId])`

Retention:
- Keep dedupe records at least 180 days.
- Raw payload refs, if used, expire after 7-30 days.
- Keep payload hash and safe summary longer.

Security:
- Store hash or encrypted object reference, not raw payload in DB.
- Never log raw body, signature header, authorization header, full payload, customer PII, or payment details.

### `IntegrationImportBatch`

Purpose: import assistant session and apply ledger.

Fields:
- `id`, `tenantId`, `integrationAccountId?`
- `provider` fixed to `UNIVERSAL_POS_IMPORT`
- `sourceProviderGuess`
- `originalFilename`
- `storedFileRef`
- `fileSha256`
- `mimeType`
- `sizeBytes`
- `rowCount`
- `status`
- `detectedColumns Json`
- `mapping Json`
- `mappingPresetName`
- `stats Json`
- `idempotencyKey`
- `uploadedById`, `appliedById`
- `uploadedAt`, `parsedAt`, `appliedAt`
- `createdAt`, `updatedAt`, `deletedAt`

Tenant strategy:
- Required `tenantId`.
- File storage key must include tenant ID and batch ID.

Relations:
- `tenant`
- `integrationAccount?`
- `rows`
- `uploadedBy User`
- `appliedBy User?`

Indexes:
- `@@index([tenantId, status])`
- `@@index([tenantId, uploadedAt])`
- `@@index([tenantId, fileSha256])`

Unique constraints:
- `@@unique([tenantId, idempotencyKey])`
- Optionally `@@unique([tenantId, fileSha256])` for duplicate detection warnings, not hard rejection.

Retention:
- Delete raw uploaded files after 30-90 days.
- Keep batch metadata and audit trail for 1-7 years depending compliance policy.
- Keep sanitized error report refs for 90 days.

Security:
- Uploaded files are untrusted.
- Never log row contents.
- Sanitize formula prefixes on error report export.

### `IntegrationImportRow`

Purpose: row-level validation, quarantine, and apply status.

Fields:
- `id`, `tenantId`, `importBatchId`
- `rowNumber`
- `rowHash`
- `externalId`
- `targetType`
- `targetId`
- `status`
- `canonicalDraft Json`
- `validationErrors Json`
- `warnings Json`
- `duplicateOfRowId`
- `safePreview Json`
- `createdAt`, `updatedAt`

Tenant strategy:
- Required `tenantId`.
- Must equal parent batch `tenantId`.

Relations:
- `tenant`
- `importBatch`

Indexes:
- `@@index([tenantId, importBatchId])`
- `@@index([tenantId, status])`
- `@@index([importBatchId, rowNumber])`

Unique constraints:
- `@@unique([importBatchId, rowNumber])`
- `@@unique([importBatchId, rowHash])` if duplicate rows should be collapsed.

Retention:
- Keep row validation metadata 90 days.
- Keep applied summary/audit indefinitely.
- Purge raw/sensitive row fields after retention window.

Security:
- `canonicalDraft` must contain sanitized normalized fields only.
- Never log raw row data, notes containing PII, card data, or payroll-sensitive details.

### `IntegrationHealthEvent`

Purpose: visible operational health for managers and support.

Fields:
- `id`, `tenantId`, `integrationAccountId`
- `provider`
- `severity`
- `status`: `OPEN`, `ACKNOWLEDGED`, `RESOLVED`
- `eventType`: `TOKEN_EXPIRING`, `TOKEN_EXPIRED`, `RATE_LIMITED`, `SYNC_FAILED`, `WEBHOOK_FAILED`, `MAPPING_CONFLICT`, `PROVIDER_DEGRADED`, `IMPORT_ANOMALY`
- `messageKey`
- `safeDetails Json`
- `correlationId`
- `firstSeenAt`, `lastSeenAt`, `resolvedAt`
- `createdAt`, `updatedAt`

Tenant strategy:
- Required `tenantId`.
- Manager only sees own tenant.

Relations:
- `tenant`
- `integrationAccount`

Indexes:
- `@@index([tenantId, status, severity])`
- `@@index([tenantId, integrationAccountId, lastSeenAt])`
- `@@index([provider, eventType])`

Unique constraints:
- Optional dedupe key: `@@unique([tenantId, integrationAccountId, eventType, correlationId])`

Retention:
- Keep resolved info/warning 180 days.
- Keep error/critical 1 year.
- Aggregate long-term uptime separately later.

Security:
- Safe details only.
- Never include tokens, payloads, headers, raw files, employee full PII, or vendor secrets.

## Connector Interface

```ts
export interface SmartTipsConnector {
  readonly provider: IntegrationProvider;
  readonly category: IntegrationCategory;

  connect(input: ConnectInput): Promise<ConnectResult>;
  refreshCredentials(input: RefreshCredentialsInput): Promise<CredentialRefreshResult>;
  disconnect(input: DisconnectInput): Promise<DisconnectResult>;

  listLocations(input: ConnectorRequest): Promise<CanonicalLocation[]>;
  listEmployees(input: ConnectorRequest): Promise<CanonicalEmployee[]>;
  syncSales(input: SyncWindowRequest): Promise<SyncResult<CanonicalSale>>;
  syncTips(input: SyncWindowRequest): Promise<SyncResult<CanonicalTip>>;
  syncTimeEntries(input: SyncWindowRequest): Promise<SyncResult<CanonicalTimeEntry>>;

  handleWebhook(input: WebhookHandleInput): Promise<WebhookHandleResult>;
  healthCheck(input: ConnectorRequest): Promise<ConnectorHealth>;
  validateConfig(input: ValidateConfigInput): Promise<ValidationResult>;
}
```

Core input types:
- `ConnectorRequest`: `tenantId`, `integrationAccountId`, `requestId`, `dryRun`, `actorUserId?`
- `SyncWindowRequest`: above plus `locationIds`, `cursor?`, `startAt`, `endAt`, `limit?`
- `ConnectInput`: `tenantId`, `provider`, `environment`, `oauthCode?`, `state`, `redirectUri`, `actorUserId`
- `WebhookHandleInput`: `rawBody`, `headers`, `provider`, `receivedAt`, `requestUrl`

Core output types:
- `ConnectResult`: account metadata, scopes, expiresAt, locations preview.
- `SyncResult<T>`: `items`, `nextCursor`, `hasMore`, `stats`, `warnings`.
- `WebhookHandleResult`: `providerEventId`, `dedupeKey`, `action`, `queuedJobId?`.
- `ConnectorHealth`: `status`, `latencyMs`, `rateLimit`, `expiresAt`, `safeMessage`.

Error types:
- `ProviderAuthError`
- `ProviderRateLimitError`
- `ProviderUnavailableError`
- `ProviderValidationError`
- `ProviderConflictError`
- `ProviderMappingError`
- `ProviderWebhookSignatureError`
- `ProviderPartialFailureError`

Idempotency:
- Job key: `tenantId:accountId:jobType:cursorOrWindowHash`.
- Entity key: `provider:accountId:externalType:externalId:versionOrUpdatedAt`.
- Webhook key: `provider:accountId:providerEventId`.
- Import apply key: `tenantId:batchId:fileSha256:mappingHash`.

Retry:
- BullMQ exponential backoff with jitter.
- Respect provider `Retry-After`.
- Do not retry validation errors.
- Retry network, 429, 5xx, and provider timeout errors.
- Move exhausted jobs to dead-letter status.

Rate limits:
- Provider-specific limiter per account.
- Global limiter per provider.
- Sync jobs should page and checkpoint between pages.
- Webhooks should ack quickly after verification and enqueue processing.

## Canonical Contracts

Global rules:
- `tenantId` is required on every canonical DTO.
- `source.provider`, `source.integrationAccountId`, `source.externalId`, and `source.externalUpdatedAt?` are required.
- Money is integer minor units: `amountCents`, `currency`.
- Dates are ISO UTC instants plus restaurant-local date fields where business logic depends on local day.
- No floats for money.
- DTO validation happens before apply.
- Unknown vendor fields stay in sanitized `sourceMetadata`, not raw payload.

### `CanonicalLocation`

Required:
- `tenantId`
- `source`
- `name`
- `timezone`
- `currency`

Optional:
- `address`
- `phone`
- `active`
- `businessHours`
- `externalMerchantId`

Validation:
- Valid IANA timezone.
- ISO currency.
- External ID unique per account.

### `CanonicalEmployee`

Required:
- `tenantId`
- `source`
- `displayName`
- `active`

Optional:
- `firstName`, `lastName`, `email`, `phone`
- `role`
- `employeeNumber`
- `locationExternalIds`
- `hireDate`

Validation:
- Email normalized but not required.
- Role maps to current `EmployeeRole` or requires manager mapping.
- Never auto-create user login accounts.

### `CanonicalShift`

Required:
- `tenantId`
- `source`
- `locationExternalId`
- `localDate`
- `startAt`
- `endAt`
- `status`

Optional:
- `shiftType`
- `employeeExternalIds`
- `notes`

Validation:
- `endAt > startAt`.
- Local date matches tenant timezone.
- Status maps to `PLANNED`, `IN_PROGRESS`, `CLOSED`, or `CANCELLED`.

### `CanonicalSale`

Required:
- `tenantId`
- `source`
- `locationExternalId`
- `orderExternalId`
- `closedAt`
- `subtotalCents`
- `taxCents`
- `totalCents`
- `currency`

Optional:
- `serverExternalId`
- `paymentExternalIds`
- `guestCount`
- `status`
- `channel`

Validation:
- Money fields are integers.
- Total should be greater than or equal to subtotal unless refund/void.
- Negative/refund records must be flagged explicitly.

### `CanonicalTip`

Required:
- `tenantId`
- `source`
- `locationExternalId`
- `tipCents`
- `currency`
- `receivedAt`

Optional:
- `employeeExternalId`
- `orderExternalId`
- `paymentExternalId`
- `tipType`: `CARD`, `CASH`, `SERVICE_CHARGE`, `DECLARED`
- `poolEligible`

Validation:
- Tip amount can be zero, not negative unless explicit reversal.
- Employee attribution may be unknown and require mapping.

### `CanonicalOrder`

Required:
- `tenantId`
- `source`
- `locationExternalId`
- `orderNumber`
- `openedAt`
- `status`
- `totalCents`
- `currency`

Optional:
- `closedAt`
- `serverExternalId`
- `tableName`
- `items`
- `payments`
- `tips`

Validation:
- Item totals reconcile within configured tolerance.
- No card PAN, receipt auth code, or sensitive payment fields.

### `CanonicalTimeEntry`

Required:
- `tenantId`
- `source`
- `employeeExternalId`
- `locationExternalId`
- `clockInAt`
- `status`

Optional:
- `clockOutAt`
- `breakMinutes`
- `declaredCashTipsCents`
- `jobTitle`
- `shiftExternalId`

Validation:
- Closed time entry requires `clockOutAt > clockInAt`.
- Break minutes non-negative.
- Declared tips use cents.

### `CanonicalAccountingExport`

Required:
- `tenantId`
- `provider`
- `periodStart`
- `periodEnd`
- `currency`
- `lines`

Lines:
- `employeeId?`
- `accountCode?`
- `description`
- `amountCents`
- `taxCents?`
- `classOrLocation?`
- `externalReference`

Validation:
- Export totals reconcile to report source.
- Export is append-only unless explicit void/reversal.

## Square Connector MVP

OAuth flow:
1. OWNER or MANAGER clicks "Connect Square".
2. API creates short-lived OAuth state with `tenantId`, `userId`, `environment`, `nonce`, and redirect target.
3. Redirect to Square authorization URL.
4. Callback validates state, tenant, nonce, expiry, and user session.
5. Exchange code using Square OAuth token endpoint.
6. Store encrypted access and refresh tokens.
7. Create `IntegrationAccount` with merchant/account metadata.
8. Fetch locations.
9. Manager maps Square locations to SmartTips tenant/location concept.
10. Run dry-run preview before applying any data.

Required scopes for MVP:
- `MERCHANT_PROFILE_READ` for locations.
- `ORDERS_READ` for order search/retrieve.
- `PAYMENTS_READ` for payment/tip data.
- `EMPLOYEES_READ` for team member mapping.
- `TIMECARDS_READ` only if V1 includes time entries; otherwise defer.

Account/location connection:
- One `IntegrationAccount` per Square seller merchant per tenant/environment.
- Store Square merchant ID as `externalMerchantId`.
- Store each Square location as `IntegrationExternalMapping`.
- MVP can map Square location to the current tenant as a whole. Later add first-class internal location model if multi-location tenants arrive.

Order/payment/tip sync:
- Use `SearchOrders` by location and `closed_at` window for completed orders.
- Use `ListPayments` for payment/tip reconciliation.
- Normalize Square `Payment.tip_money` into `CanonicalTip`.
- Normalize order totals into `CanonicalOrder` and `CanonicalSale`.
- Treat offline Square orders as delayed; sync lookback window should overlap 72 hours.
- Keep cursor by location: last closed timestamp plus last order/payment ID.

Employee/staff mapping:
- Use Team API search/list.
- Auto-match by email, then employee number/name.
- Require manager confirmation for low-confidence matches.
- Do not create SmartTips user accounts from Square team members.

Dry-run preview:
- Show records found, new employees, mapping conflicts, estimated sales/tips, duplicates, and invalid rows.
- No mutations except sync job/audit/preview metadata.

Apply sync:
- Upsert employees only if manager selected "create missing employees".
- Upsert orders/tips using external mapping and idempotency keys.
- Do not auto-run distribution unless manager confirms.
- After apply, dashboard and distribution can use imported sales/tips.

Audit trail:
- `INTEGRATION_CONNECTED`
- `INTEGRATION_LOCATION_MAPPED`
- `INTEGRATION_EMPLOYEE_MAPPED`
- `INTEGRATION_SYNC_PREVIEWED`
- `INTEGRATION_SYNC_APPLIED`
- `INTEGRATION_DISCONNECTED`
- `INTEGRATION_CREDENTIAL_REFRESHED`

Webhook strategy:
- Subscribe to `payment.updated`, `order.created`, `order.updated`, and relevant team/location events when enabled.
- Verify Square HMAC signature using raw body, notification URL, and signature key.
- Persist dedupe by Square `event_id`.
- Ack quickly after verification and enqueue reconciliation job.
- Webhook does not directly mutate financial records.

Failure handling:
- 401/403: mark account `NEEDS_REAUTH`.
- 429: back off per provider response.
- 5xx/timeouts: retry with jitter, circuit break if repeated.
- Partial page failure: keep last successful cursor and resume.
- Mapping conflict: quarantine item and create health event.

Rate limits:
- Implement per-account Square limiter.
- Page sync windows.
- Use overlapping incremental windows for eventual consistency.
- Avoid full historical sync during business hours by default.

## Universal POS Import Assistant

Positioning:
- "Universal POS Import Assistant" is the fallback and onboarding bridge, not the product core.
- It supports restaurants before official POS API access exists.
- It should feel like a guided reconciliation workflow, not a file upload form.

Workflow:
1. Upload POS report.
2. Detect provider/template if possible.
3. Detect columns.
4. Select saved mapping preset or create mapping.
5. Preview normalized SmartTips fields.
6. Match employees.
7. Validate sales/tips/shifts.
8. Detect anomalies and duplicates.
9. Manager confirms apply.
10. Apply canonical data.
11. Generate sanitized error report.
12. Write audit and health events.

V1:
- Canonical SmartTips template only.
- Strict required columns.
- Mapping preview.
- Employee matching.
- Validation summary.
- Apply after confirmation.
- Error report download.

V2:
- Flexible manual column mapping.
- Saved mapping preset per tenant.
- Column type inference.
- Confidence score.
- Transform helpers for date, currency, role, payment type.

V3:
- POS-specific templates for Square export, Toast export, TouchBistro export, Lightspeed export, Clover export.
- Provider/template auto-detection.
- Anomaly models: unusual tip percentage, duplicate ticket range, missing employee, bad date windows.

Required capabilities:
- File type allowlist: CSV initially; XLSX only later if dependency approved.
- File size limit: start at 5-10 MB.
- Row count limit: start at 10,000 rows.
- Formula injection protection on all exported errors.
- Duplicate detection by file hash, row hash, external order number, date, amount, and employee.
- Quarantine invalid rows.
- No raw import rows in application logs.

## Security Model

Credential security:
- Encrypt OAuth tokens and API keys at rest.
- Use key versioning for rotation.
- Store only encrypted token payloads in DB.
- Keep provider app secrets in Railway environment variables or a managed secret store.
- Never expose credentials to `apps/web`.

Tenant isolation:
- Every integration table has `tenantId`.
- Every service method requires tenant context.
- External mapping always includes tenant and account.
- Cross-tenant mappings are impossible by unique constraints and service guards.

Webhook security:
- Verify provider signature before persistence.
- Use raw request body.
- Use constant-time comparison.
- Store payload hash, not raw payload.
- Reject unknown account/provider events.
- Deduplicate provider event IDs.
- Apply replay window checks where provider timestamp exists.

Logging:
- No raw vendor payloads.
- No tokens.
- No authorization headers.
- No webhook signatures.
- No OAuth codes.
- No refresh tokens.
- No imported row contents.
- No card data.
- No sensitive employee PII in operational logs.

Import security:
- Enforce file size and row count limits.
- Reject binary/unexpected MIME types.
- Sanitize null bytes.
- Prefix dangerous CSV cells beginning with `=`, `+`, `-`, `@`, tab, CR, LF.
- Scan for impossible dates and malformed money.
- Store uploaded files outside public access.

Access control:
- OWNER and MANAGER only for Connect.
- EMPLOYEE never sees integration settings.
- Reconnect/disconnect should require OWNER by default; MANAGER can run sync/import if allowed by tenant config.
- Audit all connect, disconnect, mapping, import, export, and apply actions.

Safe errors:
- UI can say "Square token expired, reconnect required."
- UI must not show provider raw error body.
- Support details should use safe error codes and request IDs.

## Reliability Model

Sync cursors:
- Store cursor per account, provider, data type, and location.
- Cursor includes provider timestamp, provider ID, page cursor if applicable, and lookback window.
- Use overlap windows for eventual consistency.

Idempotency:
- Sync job unique key.
- Webhook event unique key.
- Canonical entity unique key.
- Import batch apply unique key.
- Distribution remains protected by existing unique distribution constraints.

Duplicate handling:
- Webhook duplicate becomes `DUPLICATE` and exits.
- Import duplicate row becomes `DUPLICATE` or `SKIPPED`.
- Provider duplicate order/payment maps to existing internal object.

Retries:
- Exponential backoff with jitter.
- Respect `Retry-After`.
- Retry only transient failures.
- Dead-letter after max attempts.
- Manual retry from health dashboard.

Partial sync recovery:
- Commit per page or per bounded transaction.
- Advance cursor only after successful page apply.
- Failed records are quarantined; valid records continue if safe.
- Reconciliation job can rerun a time window.

Provider degraded status:
- Circuit breaker per provider/account.
- Mark account health `WARNING` or `ERROR`.
- Pause non-urgent jobs while provider is down.
- Continue Universal Import Assistant and local SmartTips operations.

Health checks:
- Token validity.
- Minimal provider ping.
- Last successful sync age.
- Webhook failure count.
- Mapping conflict count.
- Import error rate.

## Manager UX Flow

Integrations page:
- Provider cards: Square, Universal POS Import Assistant, Clover, Toast, Lightspeed, TouchBistro, QuickBooks, Xero, Resend, Twilio, Stripe.
- Status: Not connected, Connected, Needs reconnect, Sync degraded, Coming later.
- Primary actions: Connect, Import, View health, Configure.

Connect provider:
- Explain requested permissions.
- Choose sandbox/production in non-production environments.
- OAuth redirect.
- Callback success screen.

Connected accounts:
- Provider account name.
- Merchant/location count.
- Last sync.
- Credential status.
- Disconnect/reconnect.

Location mapping:
- Square locations on left.
- SmartTips location/tenant target on right.
- V1 maps to current tenant.
- Conflict warnings.

Employee mapping:
- Auto-match table.
- Confidence indicators.
- Manual match.
- Create missing employee option.
- Ignore employee option.

Sync health:
- Last successful sync.
- Current cursor/window.
- Recent jobs.
- Provider errors.
- Reconnect prompt.

Error resolution queue:
- Mapping conflicts.
- Invalid rows.
- Duplicate warnings.
- Token issues.
- Retry actions.

Universal Import Assistant:
- Upload.
- Template selection.
- Column detection/mapping.
- Employee matching.
- Validation preview.
- Anomaly review.
- Apply confirmation.
- Error report download.

Preview and apply:
- Show "will create", "will update", "will skip", "needs attention".
- Apply is disabled until required conflicts are resolved.
- Apply writes audit events.

Reconnect expired credentials:
- Prominent banner.
- Keep existing mappings.
- Resume sync after OAuth refresh/reconnect.

## Employee Mobile Impact

SmartTips Connect improves employee mobile by making source data faster and more trustworthy:
- Tips become visible sooner because sales/tip data flows from Square or import apply.
- Shift/tip history becomes more accurate because imported orders, tips, and time entries reduce manual gaps.
- Employee can see transparent source labels: "Source: Square", "Source: Universal Import", "Adjusted by manager".
- Dispute/report issue flow can reference source order, shift, and tip pool summary without exposing sensitive POS payload.
- Payout status can later reflect accounting/payroll export state, but V1 should only show calculated/distributed/paid status from SmartTips.

Employee mobile should not expose:
- Provider credentials.
- Raw POS payloads.
- Other employees' sales/tips.
- Manager mapping screens.
- Full audit logs.

## Feature Coherence Review

Distribution:
- Connect supplies cleaner orders, sales, tips, employees, and time entries.
- Distribution should consume normalized SmartTips entities, not connector DTOs directly.
- Current distribution requires closed shifts and declared tip pools. Connect will expose whether tip pool creation/closing is too manual for imported POS data.

Audit trail:
- Existing audit is append-only and tenant scoped.
- New integration actions should extend audit enums.
- Sensitive payloads must stay out of audit `metadata`.

Reports:
- Current payroll/audit/tip pool exports are strong starting points.
- Accounting exports should reuse report hardening and signature/hash concepts.
- Current reports export from SmartTips data only; Connect will create a clearer distinction between source data, calculated distributions, and exported accounting records.

ML training:
- Connect improves feature quality: actual sales, orders, employee count, time windows, tips.
- Need source labels in training events to detect API/import data quality differences.
- Avoid training on quarantined or manager-unconfirmed import rows.

Employee mobile:
- Connect makes employee history more credible.
- Needs "report issue" or dispute flag if employees see imported data.

Tenant config:
- Distribution config remains separate.
- Add Connect settings later: allowed providers, manager permissions, default sync schedule, import limits.

Manager dashboard:
- Add integration health widgets.
- Existing dashboard may currently estimate tips from sales if no pool exists; Connect will expose that estimates and real imported tips must be clearly labeled.

Current inconsistencies Connect would expose:
- Orders currently require `tableId` and `serverId`; POS imports may have no table or no employee attribution.
- One tenant currently acts like one restaurant location; Square can have multiple locations.
- Shift model requires predefined `shiftType`; POS/time entries may not map cleanly to breakfast/lunch/dinner/late night.
- Tip pools are shift-level, while POS tips may be order/payment-level.
- Employee roles are constrained to SmartTips roles; POS job titles may not match.
- Reports assume completed shift assignments; imported sales/tips may arrive before assignments are complete.
- Billing schema has Stripe placeholders, but no billing connector lifecycle yet.

## Tests Required

Connector interface:
- Connector registry resolves provider.
- Unsupported capability returns typed error.
- Connector outputs validate canonical DTOs.

Tenant isolation:
- Cannot read another tenant's account, credential, mapping, job, webhook, import, or health event.
- External IDs can repeat across tenants safely.

Credential encryption/redaction:
- Tokens encrypted before DB write.
- Decrypted only inside credential service.
- Logs redact token-like fields.
- Rotation preserves key version.

OAuth callback:
- Valid state succeeds.
- Expired state rejected.
- Wrong tenant/user rejected.
- Replay rejected.
- Provider error sanitized.

Webhook signature:
- Valid Square signature accepted.
- Invalid signature rejected.
- Modified raw body rejected.
- Missing account rejected.

Duplicate webhook:
- Same provider event ID deduped.
- Duplicate does not enqueue second apply job.

Sync idempotency:
- Same sync window creates one job.
- Replayed provider record updates or skips deterministically.
- Cursor advances only after success.

Import validation:
- Required columns missing.
- Invalid money.
- Invalid dates.
- Unknown employee.
- Bad role mapping.
- Oversized file rejected.
- Row limit enforced.

CSV injection:
- Error exports sanitize dangerous prefixes.
- Null bytes removed.
- Raw cell values not logged.

Row quarantine:
- Invalid rows quarantined.
- Valid rows still previewable.
- Apply skips quarantined rows.

Mapping conflicts:
- Two external employees mapped to same internal employee warning.
- One external location mapped to multiple internal targets blocked.
- Low confidence requires confirmation.

Apply idempotency:
- Reapplying same batch does not duplicate orders/tips/employees.
- Partial failure can resume.

Audit events:
- Connect, map, preview, apply, disconnect, reconnect logged.
- Audit excludes secrets and raw payloads.

Authorization:
- OWNER/MANAGER access only.
- EMPLOYEE forbidden.
- Disconnect/reconnect owner-only if adopted.

Rate limit behavior:
- 429 schedules retry.
- `Retry-After` respected.
- Circuit breaker opens after repeated provider failures.

## Implementation Ticket Breakdown

### BIS-30 - SmartTips Connect Core Models

Business value:
- Establishes the durable foundation for all integrations.

Technical scope:
- Add provider/status enums.
- Add `IntegrationAccount`, `IntegrationCredential`, `IntegrationExternalMapping`, `IntegrationSyncJob`, `IntegrationWebhookEvent`, `IntegrationImportBatch`, `IntegrationImportRow`, `IntegrationHealthEvent`.
- Add tenant relations.
- Add audit enum values.

Affected modules:
- `apps/api/prisma/schema.prisma`
- `apps/api/src/integrations`
- audit types/tests

Risks:
- Migration complexity.
- Credential schema must be correct before tokens exist.

Tests:
- Prisma relation tests.
- Tenant isolation tests.
- Unique constraint tests.

Definition of done:
- Schema generated.
- Migration reviewed.
- No raw secrets fields.
- Tenant indexes present.

### BIS-31 - Integration Connector Interface

Business value:
- Prevents Square from becoming a one-off implementation.

Technical scope:
- Connector interface.
- Provider registry.
- Canonical DTO validators.
- Typed connector errors.
- Idempotency helpers.
- Rate limit abstraction.

Affected modules:
- `apps/api/src/integrations/connectors`
- `apps/api/src/integrations/canonical`
- `apps/api/src/integrations/errors`

Risks:
- Over-abstraction before first connector.
- DTOs too broad.

Tests:
- Registry tests.
- DTO validation tests.
- Error classification tests.

Definition of done:
- Square and Universal Import can both target the same contracts.

### BIS-32 - Universal POS Import Assistant V1

Business value:
- Enables pilots without official POS API access.

Technical scope:
- Canonical SmartTips template.
- Upload validation.
- Parse CSV.
- Mapping preview.
- Employee matching.
- Validation/quarantine.
- Apply confirmation.
- Error report export.
- Audit events.

Affected modules:
- `apps/api/src/integrations/imports`
- `apps/web/src/features/integrations/imports`
- reports/export helper reuse

Risks:
- Accidentally perceived as "CSV feature".
- Bad imports pollute financial records.

Tests:
- File limits.
- CSV injection.
- Mapping validation.
- Row quarantine.
- Apply idempotency.
- Authorization.

Definition of done:
- Manager can import canonical template safely with preview and audit.

### BIS-33 - Square POS Connector MVP

Business value:
- First professional direct POS API integration.

Technical scope:
- OAuth start/callback.
- Encrypted Square credentials.
- Location fetch/mapping.
- Team member fetch/mapping.
- Orders/payments/tips dry run.
- Apply sync.
- Square webhook receiver.
- Sync jobs and cursors.
- Health events.

Affected modules:
- `apps/api/src/integrations/providers/square`
- `apps/api/src/integrations/oauth`
- `apps/api/src/integrations/webhooks`
- `apps/web/src/features/integrations/square`

Risks:
- Square data model does not map cleanly to current shift/table requirements.
- Offline orders delayed up to 72 hours.
- Tip attribution may be incomplete.

Tests:
- OAuth callback.
- Token refresh.
- Webhook signature.
- Duplicate event.
- Incremental sync.
- Mapping conflicts.
- Rate limit retry.

Definition of done:
- Sandbox Square account can connect, preview, apply, and show health without secrets in logs.

### BIS-34 - Integration Health Dashboard

Business value:
- Managers can trust and operate integrations without developer intervention.

Technical scope:
- Health event APIs.
- Last sync status.
- Error queue.
- Manual retry.
- Reconnect expired credentials.
- Job history.

Affected modules:
- `apps/api/src/integrations/health`
- `apps/web/src/app/(dashboard)/dashboard/integrations`

Risks:
- Too much technical detail in UI.
- Unsafe error exposure.

Tests:
- Authorization.
- Health event filtering.
- Safe error rendering.
- Retry action.

Definition of done:
- Manager sees connected providers, health, last sync, and actionable errors.

### BIS-35 - QuickBooks/Xero Export Design

Business value:
- Prepares back-office accounting value without building risky automation early.

Technical scope:
- Export connector contract.
- Canonical accounting export DTO.
- Mapping requirements for accounts/classes.
- Export preview design.
- No production OAuth implementation yet.

Affected modules:
- `apps/api/src/integrations/exports`
- reports service
- future accounting connector modules

Risks:
- Payroll/accounting requirements vary by jurisdiction.
- Export format can be confused with payroll automation.

Tests:
- DTO validation.
- Export idempotency.
- CSV/Xero/QuickBooks-safe output planning.

Definition of done:
- Implementation plan and contracts are ready, but no live accounting mutation exists.

## What Not To Build Yet

Do not build in the first version:
- Toast connector until partner/API access is confirmed.
- TouchBistro connector until access model is confirmed.
- QuickBooks payroll automation.
- Xero live posting.
- Automated employee payments.
- Stripe billing automation beyond existing placeholders.
- Full bidirectional sync.
- POS writeback.
- Autonomous AI actions.
- Automatic distribution execution immediately after sync.
- Complex POS-specific import templates before V1 canonical import foundation.
- XLSX import unless dependency and security review are approved.
- Multi-location tenant restructuring unless Square MVP proves it is required immediately.
- Raw vendor payload browser views.
- Employee-facing provider details beyond source labels.

## Final Recommendation

Build SmartTips Connect in this order:

1. BIS-30 and BIS-31 first: core models, credentials, mappings, jobs, health, connector interface, canonical DTOs.
2. BIS-32 next: Universal POS Import Assistant V1 using the same canonical contracts.
3. BIS-33 next: Square POS Connector MVP with OAuth, dry-run, apply, webhooks, and health.
4. BIS-34 after Square has real failure modes to display.
5. BIS-35 as a design-only track until accounting export requirements are clearer.

This gives SmartTips a professional integration story immediately: direct Square API where available, assisted import everywhere else, and a clean path toward Toast, accounting, notifications, and billing without reworking the foundation.
