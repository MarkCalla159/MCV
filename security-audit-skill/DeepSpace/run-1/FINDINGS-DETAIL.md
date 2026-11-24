# Findings detail

No finding reached `confirmed` status. The two entries below are source-grounded candidates whose decisive runtime validation is blocked by the audit sandbox limitation.

## action-register-attachment-metadata-only

### What was observed

The action registry includes `registerAttachment`, and the generic action endpoint dispatches any own registry key after bearer verification. The action checks role/order state and validates a storage-key prefix, then creates attachment metadata. It does not verify the object in the app-owned R2 bucket. The upload route does write R2 first, but direct callers are not forced through that route. Both review submission and approval use metadata counts as the evidence gate.

### Security consequence if reproduced

An assigned technician could create a fabricated repair-evidence row without uploading bytes and potentially submit/approve a work order as if evidence existed. This is an integrity/authorization issue in the closure workflow, not a claim that arbitrary users can approve orders.

### Evidence

- `src/server/action-routes.ts:44-79`
- `src/actions/index.ts:49`
- `src/actions/maintenance.ts:406-439`
- `src/actions/maintenance.ts:373-389`
- `src/actions/maintenance.ts:307-323`
- `src/server/maintenance-files.ts:71-94`

### Decisive test

Use an isolated fake R2 and action/RecordRoom harness. Call the action directly with a nonexistent `orders/<order>/...` key, then attempt review. The test must verify both metadata creation and the resulting state transition.

## realtime-arbitrary-room-allocation

### What was observed

The generic `/ws/:roomId` route accepts a missing token, uses the path value as a Durable Object name, and forwards the request. The source does not restrict the room to `app:${DEEPSPACE_APP_ID}` or a bounded namespace.

### Security consequence if reproduced

An unauthenticated caller may be able to allocate many RecordRoom instances or hold unauthorized sockets, creating resource exhaustion or a room-namespace boundary issue. The target's RecordRoom and platform quotas may prevent material impact; that is why this remains `needs_validation`.

### Evidence

- `src/server/realtime-routes.ts:19-43`
- `src/server/realtime-routes.ts:123-127`
- `src/pages/(app)/_layout.tsx:70-80` (intended fixed app scope)
- `src/constants.ts:17-18` (intended `app:<id>` scope)

### Decisive test

Instrument the local worker namespace in a compliant sandbox, send a bounded set of unique anonymous room requests, and observe allocation, upgrade, and rejection timing. Then compare with the intended app room.

## http.oauth-code-state-binding

The browser callback reads a query-string code, exchanges it with the external auth worker, and installs the returned session cookie. The worker source shows no app-side state or PKCE binding. This remains a candidate because the external exchange-code contract may already enforce one-time use and binding.

Evidence: `src/server/http-routes.ts:98-126`.

Decisive test: inspect the auth-worker contract or perform a dummy-account flow across two isolated browsers and determine whether a code can be redeemed outside the initiating flow.

## realtime-yjs-missing-schema-member-fallback

The Yjs access helper returns `member` when the `documents` collection is not registered, and the current app has no such schema. This is only material if the generic Yjs endpoint is used for sensitive rooms and if the SDK honors the forwarded role as suspected.

Evidence: `src/server/realtime-routes.ts:94-109`, `src/server/realtime-routes.ts:129-141`, `src/schemas.ts:22-31`.

Decisive test: exercise bounded dummy Yjs rooms with/without a documents schema and inventory deployed document IDs.

## Reviewed and not promoted to findings

- Session-cookie file writes: the route itself forwards methods, but the installed SDK's `resolveSessionReadAuth` rejects methods other than GET/HEAD and cross-site cookie reads.
- XSS: application values are rendered through React bindings; no unsafe HTML/eval sink was found.
- Credentialed CORS: Hono's default wildcard does not emit `Access-Control-Allow-Credentials`; bearer tokens are not ambient cross-origin credentials.
- Generic AI CRUD: tool execution uses the caller's normal RecordRoom permissions. Prompt-only destructive confirmation is a hardening concern, not an authorization bypass in the current configuration.
- Shared evidence reads: any authenticated member can view evidence by design in the documented shared sandbox.
- Debug/integration proxies: debug requires both the exact opt-in flag and platform admin; product integrations are closed unless explicitly enabled.
