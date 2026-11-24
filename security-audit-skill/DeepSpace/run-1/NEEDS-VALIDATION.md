# Needs validation

Run: `deepspace-maintenanceflow-20261123-run-1`

The audit is incomplete because the host does not provide the required OS-enforced audit sandbox: empty allowlisted environment, no external network, read-only target/toolchain mounts, scratch-only writes, no-follow/exclusive artifact promotion, and CPU/memory/process/disk limits. No target-controlled process, build, test, browser, WebSocket, MCP, live endpoint, or deployment was used as audit evidence.

## Priority candidates

### `action-register-attachment-metadata-only`

`POST /api/actions/:name` exposes `registerAttachment` from `src/actions/index.ts`. The action validates only the `orders/<workOrderId>/` key shape, creates `order_attachments` metadata, and advances the order. It does not prove that the key exists in `MAINTENANCE_EVIDENCE` or that the object was created by the upload gateway. `submitWorkForReview` and `approveWorkOrder` count matching metadata rather than checking the blob.

Source trace: `src/server/action-routes.ts:44-79` → `src/actions/index.ts:49` → `src/actions/maintenance.ts:406-439` → `src/actions/maintenance.ts:373-389` and `src/actions/maintenance.ts:307-323`.

Validation:

1. In a compliant isolated worker test, create an in-progress order assigned to a technician.
2. Call `registerAttachment` directly with a valid-looking key that was not written to R2.
3. Complete the other review prerequisites and call `submitWorkForReview`.
4. Confirm whether the status changes and whether approval can complete. Also confirm that the attachment download cannot read the nonexistent object.
5. Repeat against the deployed app only with fictitious test data.

Recommended remediation if confirmed: make registration internal-only, or issue a server-generated upload receipt/nonce and verify it against the R2 object (content type, size, key, actor, order, and operation) before creating metadata. Approval should require a successful object lookup or a trusted receipt, not metadata count alone.

### `realtime-arbitrary-room-allocation`

`GET /ws/:roomId` accepts an optional token and passes attacker-controlled `roomId` to `RECORD_ROOMS.idFromName` without an app-scope allowlist, membership gate, or source-visible rate limit. This may allow anonymous room allocation/connection work or cross-scope room probing.

Source trace: `src/server/realtime-routes.ts:19-43` and `src/server/realtime-routes.ts:123-127`.

Validation:

1. In an isolated Miniflare/Worker harness, instrument `RECORD_ROOMS` and send bounded anonymous WebSocket requests to unique names.
2. Record whether the DO is allocated and whether the socket upgrades before authorization.
3. Confirm that the intended `app:<DEEPSPACE_APP_ID>` client scope remains functional.
4. Check platform quota/metrics behavior in deployment without using business data.

Recommended remediation if confirmed: replace the generic route with an exact app-scope route, or allow only a documented namespace pattern and enforce authenticated membership/rate limits before resolving arbitrary names.

## Additional validation items

### `http.oauth-code-state-binding`

The browser callback at `src/server/http-routes.ts:98-126` exchanges a query-string code and installs the returned session cookie. No app-side state or PKCE value is visible in this worker. Confirm the external auth-worker contract: whether exchange codes are single-use and bound to the initiating browser, redirect URI, state, or PKCE verifier. If not, test login-CSRF/session substitution with dummy accounts and remediate by enforcing state/PKCE binding at the auth boundary.

### `realtime-yjs-missing-schema-member-fallback`

`src/server/realtime-routes.ts:94-109` returns `member` when `documents` is not registered, while `src/schemas.ts:22-31` registers no `documents` collection. Confirm whether any Yjs rooms are used and how the SDK interprets the forwarded role. If sensitive rooms exist, fail closed instead of falling back to member.

- Confirm deployed R2 privacy, origin routing, and whether `MAINTENANCE_EVIDENCE` can be reached outside the authenticated gateway (`wrangler.toml:51-53`, `src/server/maintenance-files.ts:97-112`).
- Exercise two-account role and revocation behavior over already-open WebSockets; the SDK stores connection identity/role at connection time, but the target's revocation policy is external.
- Exercise browser account switching and token cache invalidation; the installed SDK has a module-global bearer cache, while the app action helper obtains the cached token (`src/lib/maintenance-actions.ts:5-16`). Explicit SDK sign-out clears it, but multi-tab/session replacement behavior is external.
- If AI chat schemas are ever enabled, add server-side approval binding for destructive AI/MCP/browser tools. The current confirmation instruction is prompt text in `src/ai/tools.ts:56-66`, not a technical authorization state; current RecordRoom permissions still limit the caller's authority and in-app AI chat is not registered in `src/schemas.ts:22-31`.
- Consider whether anonymous schema discovery over the generic RecordRoom route is acceptable. It may disclose collection names/fields even when operational reads are denied; no business records were shown source-only.
- Verify release contents from the intended clean source authority and confirm `.dev.vars`/wrangler metadata are absent from deployed assets. The configured asset ignore lists them, but release/deploy authority was not observed.

## Validator blocker

The required validators were invoked:

```text
node validate-coverage-ledger.cjs ...\coverage-ledger.json
node validate-findings.cjs ...\findings.json
```

Both stopped before semantic validation with:

```text
OS no-follow and nonblocking input protection is unavailable
```

JSON parsing and a parent-side canonical-ID/sort check succeeded, but that is not a substitute for the official validator.
