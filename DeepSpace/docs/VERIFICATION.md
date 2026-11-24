# MaintenanceFlow verification

## Implemented by agent

- Server actions are exposed through the authenticated action route, including attachment registration and owner-only demo seed.
- Domain writes use named actions; business role and order state are revalidated on the server.
- `MaintenanceCoordinator` serializes action execution per app before the RecordRoom write.
- Private evidence uses the custom `MAINTENANCE_EVIDENCE` R2 binding and the authenticated gateway.
- Evidence is limited to JPEG, PNG and WebP, 5 MiB per image, three images per order, and fifteen uploads per user.
- Demo seed is owner-only, idempotent, uses fictitious `demo:` profiles, creates seven orders across the lifecycle, and adds repair evidence to review/completed examples.

## Automated checks run

| Check | Result |
| --- | --- |
| `npm run type-check` | Passed locally |
| `npm run lint` | Passed locally |
| `npm run validate` | Passed locally |
| `npm run build` | Passed locally; Wrangler log-file EPERM warning is environment-only |
| `npx playwright test --config tests/playwright.config.ts tests/smoke.spec.ts` | Passed locally — 6 smoke tests |
| `npx deepspace test run all` | Not completed in this session because `auth.deep.space` was unreachable |
| Production deploy | Succeeded — https://maintenanceflow.app.space |

## Acceptance checks still requiring a deployed app

- Two separate authenticated accounts observe create, assignment, review and approval without refresh.
- Operator/technician/supervisor direct HTTP calls receive the same server authorization decisions.
- Two concurrent commands using the same `expectedVersion` produce one acceptance and one `version_conflict`.
- Anonymous requests cannot read private evidence; an authenticated workspace participant can read it through the gateway.
- Invalid image signatures, SVG/HTML, fourth-photo uploads and quota overflow are rejected without orphan metadata.
- Deep links, reconnect behavior and mobile/keyboard interaction are verified at the deployed URL.

## Verified by candidate

- [ ] Candidate completed the report → assign → work → evidence → review → approve flow personally.
- [ ] Candidate personally checked a permission rejection.
- [ ] Candidate personally checked a private photo cannot be read anonymously.
- [ ] Candidate reviewed the final diff, ignored files and deployed release.
