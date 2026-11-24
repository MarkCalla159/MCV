# DeepSpace / MaintenanceFlow security-audit architecture

## Scope and source state

- Target: `C:/MCV/DeepSpace`.
- The target is an untracked directory inside parent Git root `C:/MCV`; there is no target-specific commit.
- This audit is source/configuration-only. No deployment, external endpoint, credential, or target-controlled process was used as audit evidence.
- Required OS sandbox controls for target execution are unavailable in this environment, so runtime, browser, concurrency, and provider behavior remain validation blockers.

## Product and trust model

MaintenanceFlow is a single shared demo workspace. Authenticated DeepSpace members can read the operational collections; MaintenanceFlow business roles are `operator`, `technician`, and `supervisor`. The app owner is the initial supervisor and is the only principal allowed to change business roles or seed demo data (`src/actions/maintenance.ts:131-156`, `src/actions/maintenance.ts:442-459`). Demo identities are fictitious records and are rejected by ordinary actions (`src/actions/maintenance.ts:53-65`).

The application deliberately has no tenant boundary beyond the app scope. This is acceptable only for the documented fictional shared sandbox; it is not an enterprise multi-tenant design (`README.md:3-9`, `src/constants.ts:17-18`).

## Entry points and boundaries

| Surface | Entry points | Strongest source-visible control | Sensitive sink |
|---|---|---|---|
| Domain actions | `POST /api/actions/:name`, `src/actions/index.ts` | verified bearer identity, own-key action lookup, app-scoped coordinator, business-role checks | RBAC-off RecordRoom writes and status/audit/attachment metadata |
| Evidence gateway | `POST /api/maintenance/orders/:workOrderId/attachments`, `GET /api/maintenance/attachments/:attachmentId` | bearer JWT, server-derived user ID, image MIME/signature checks, R2 key generation | private R2 bytes and attachment metadata |
| Record/WebSocket | `/ws/:roomId`, `/ws/yjs/:docId`, `/ws/canvas/:docId`, `/ws/presence/:scopeId`, `/ws/cron/:roomId`, `/ws/jobs/:roomId` | JWT forwarding and route-specific role/document checks; generic room route is broad | RecordRoom/Yjs/collaboration state |
| Auth/proxies | `/api/auth/*`, `/api/files/*`, `/_deepspace/*`, integration/debug routes | JWT/session verification, exact proxy allowlist, app identity reassertion, fail-closed flags | auth sessions, platform files, integrations, debug control plane |
| AI/agent | `/api/ai/*`, `/_deepspace/agent*`, MCP/browser tool transports | verified identity, app membership, exact-origin agent token, RecordRoom user executor | schema/record CRUD and persisted chat/tool history |
| Browser/client | React routes under `src/pages`, `src/lib` | server actions are the intended write boundary; CSP/security headers | rendered user-controlled text, bearer calls, private object URLs |
| Build/release | `vite.config.ts`, `wrangler.toml`, package lock, DeepSpace deploy | ignored secrets, asset ignore, explicit DO/R2 manifest | deployed worker/assets and release authority |

## Data flow and authorization notes

`resolveAuth` verifies bearer JWTs with the configured issuer and public key (`src/server/http-routes.ts:35-44`). Action routes require both verified auth and a bearer token, then forward the verified `userId` and caller token to `MaintenanceCoordinator` (`src/server/action-routes.ts:44-79`). The coordinator serializes action execution per app and calls action handlers with `createActionTools`; those tools intentionally bypass RecordRoom RBAC, making action-level checks the security boundary (`src/server/action-routes.ts:5-27`, `worker.ts:90-124`).

Maintenance collections deny client writes and permit member/admin reads; operation receipts are hidden from client roles (`src/schemas/maintenance-schema.ts:3-8`, `src/schemas/maintenance-schema.ts:101-118`). Work-order mutation helpers enforce status, role, identity, `expectedVersion`, audit history, and operation receipts (`src/actions/maintenance.ts:232-245`). Evidence upload performs a preflight action, buffers the image, writes the app-owned R2 object, then registers metadata through a second action (`src/server/maintenance-files.ts:47-94`). The metadata action derives `report` vs `repair` from server state (`src/actions/maintenance.ts:392-439`).

The AI layer uses the caller's RecordRoom executor and checks app membership before exposing tools (`src/ai/agent.ts:54-101`, `src/ai/chat-routes.ts:254-263`). The allowlist includes generic record create/update/delete tools (`src/ai/tools.ts:18-27`), so the effective security boundary is the SDK RecordRoom permission layer rather than the prompt.

## Deployment/runtime facts not established

`wrangler.toml` declares an app-scoped worker, Durable Objects, and private evidence R2 binding (`wrangler.toml:1-8`, `wrangler.toml:36-53`). Actual `OWNER_USER_ID`, JWT settings, app identity token, owner JWT, R2 privacy, deployed routes, code authority, and production behavior are environment/deployment facts not visible in source. The repository records production and two-account acceptance checks as pending (`docs/VERIFICATION.md:24-38`).

The audit therefore reports source-grounded candidates as `needs_validation` unless independently demonstrated inside a compliant sandbox. The exact blocker is missing OS-enforced empty environment, no-network namespace, read-only target/toolchain mounts, scratch-only writes, safe promotion controls, and resource/process limits.
