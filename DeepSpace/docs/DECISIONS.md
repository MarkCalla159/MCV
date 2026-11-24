# Architecture decisions

## 2026-11-23 — start from the official DeepSpace starter

`DeepSpace` was empty, so the official `create-deepspace@0.44.2` starter was generated in place for MaintenanceFlow.

## 2026-11-23 — first vertical slice is intentionally demo-only

The first screen uses deterministic sample records to establish the product surface while the account and app registration are still unavailable. It visibly says “Shared demo workspace. Use sample data only.” No fake write success, role selection, or domain persistence is presented.

## 2026-11-23 — responsive table and accessibility baseline

The work-order queue uses semantic table markup, scoped headers, a labelled scroll region, visible focus states, text-based status labels, and a container-query stacked layout for narrow widths. This follows the retrieved responsive-table and accessibility guidance.

## 2026-11-23 — domain persistence through server actions

MaintenanceFlow schemas are registered in the app's main RecordRoom. Ordinary client roles can read the operational collections but cannot create, update, or delete them; all domain writes go through named actions in `src/actions/maintenance.ts`. Actions derive `userId` from the verified request, re-check business role and record ownership, validate state transitions, and write bounded audit events.

`operation_receipts` uses a composite uniqueness constraint on actor plus operation ID. The action layer detects replays and conflicts before writing. Every action request is now executed inside the app-scoped `MaintenanceCoordinator` Durable Object, so the expected-version check, record patch, audit event and receipt are serialized as one command.

Receipts are retained for seven days. A retry after that window is a new intention by design; the UI keeps the original operation ID during a retry within the retention window.

Evidence uses a custom auto-provisioned private R2 binding (`MAINTENANCE_EVIDENCE`) instead of the built-in uploader-private file scope. The worker generates the key, verifies the authenticated business role and order state, persists metadata only after the upload, deletes orphaned blobs on failure, and serves files through an authenticated no-store gateway.

The demo seed is an owner-only, idempotent server action. It creates stable `demo:` operator/technician profiles, five assets, seven orders across the lifecycle, and private repair evidence for review/completed examples; it is exposed from Team so it can be run once after the first deploy.

The scaffold's generic integration proxy is disabled by default with `ALLOW_PRODUCT_INTEGRATIONS`; MaintenanceFlow has no P1 integration, so no alternate route can bypass its domain authorization or spending limits.
