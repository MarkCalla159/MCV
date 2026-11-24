# DeepSpace security audit report

## Executive result

Status: **incomplete / source-only**.

The audit covered `C:\MCV\DeepSpace` using the standard profile. It found no independently confirmed vulnerability because the host cannot provide the required OS-enforced audit sandbox and no deployment/live endpoint was available. It did identify **four source-grounded candidates requiring validation**:

1. `action-register-attachment-metadata-only`: the public `registerAttachment` action appears able to create evidence metadata without proving an R2 object exists; review/approval count metadata.
2. `realtime-arbitrary-room-allocation`: anonymous `/ws/:roomId` accepts attacker-controlled room names and resolves them to Durable Objects without a source-visible scope/rate gate.
3. `http.oauth-code-state-binding`: browser OAuth completion installs the exchanged session without a state/PKCE binding visible in this worker; the auth-worker contract is external.
4. `realtime-yjs-missing-schema-member-fallback`: the Yjs access helper returns `member` when the `documents` schema is absent; actual Yjs usage and SDK semantics require validation.

The first candidate is the immediate P0 remediation priority because it can undermine the evidence-backed approval invariant if reproduced.

## Scope and method

- Target: `C:\MCV\DeepSpace`.
- Source state: untracked target directory under parent Git HEAD `109ca57e918748f22033d2a15a775fdac7725a85`; no target-specific commit.
- Reviewed: worker routes, action registry/handlers, schemas, R2 gateway, auth/proxy routes, realtime routes, AI/agent surfaces, browser code, build/deploy configuration, package lock, security headers, and selected security-audit companion guidance.
- Not performed: deployment, live HTTP/WebSocket/MCP/browser tests, external network access, dependency advisory lookup, target build/test execution under audit controls, or reading `.dev.vars`/credentials.
- Source files were not changed by the audit.

## Coverage

The coverage ledger contains 11 units:

- 6 covered by source review with no source-grounded finding promoted.
- 4 candidate units linked to the findings above.
- 1 blocked build/release unit because clean-tree authority and deploy artifact contents cannot be established offline.

See [architecture.md](./architecture.md), [coverage-ledger.json](./coverage-ledger.json), and [findings.json](./findings.json).

## Main controls observed

- Actions require verified bearer identity, own-key lookup, and an app-scoped serialized coordinator (`src/server/action-routes.ts:44-79`, `worker.ts:90-124`).
- Domain actions reload business profiles and enforce server-side roles/transitions/versions (`src/actions/maintenance.ts:53-65`, `src/actions/maintenance.ts:232-245`).
- Maintenance collection client writes are denied; action tools are the intentional server-side boundary (`src/schemas/maintenance-schema.ts:3-8`, `src/server/action-routes.ts:5-27`).
- Evidence upload is bounded to 5 MiB and accepted image signatures, and failures remove the R2 object (`src/server/maintenance-files.ts:47-94`).
- Evidence downloads require bearer auth and return private/no-store/nosniff responses (`src/server/maintenance-files.ts:97-112`).
- Debug and generic product integrations fail closed by default (`src/server/http-routes.ts:172-190`, `src/server/http-routes.ts:200-237`).
- AI/agent routes resolve verified identity and membership before building caller-scoped tools (`src/ai/agent.ts:54-101`).

## Remediation order

1. Close or harden `registerAttachment`: make it internal-only or bind it to a server-generated upload receipt and a verified R2 object; add a regression test that a nonexistent blob cannot satisfy review.
2. Restrict `/ws/:roomId` to the intended app scope or enforce a bounded namespace and admission/rate control before resolving arbitrary names; test anonymous unique-room requests.
3. Before deployment, run the missing release and production checks in an isolated environment: clean source authority, asset contents, private R2 access, anonymous route behavior, two-account role checks, and concurrent action tests.

## Limitations

The official validators could not run on this Windows host because they require OS no-follow/nonblocking file protection and stopped with `OS no-follow and nonblocking input protection is unavailable`. JSON parsing and parent-side canonical-ID/order checks passed. This report must not be read as a production security sign-off.

The complete validation queue is in [NEEDS-VALIDATION.md](./NEEDS-VALIDATION.md).
