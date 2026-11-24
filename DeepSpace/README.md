# MaintenanceFlow

MaintenanceFlow is a DeepSpace application for coordinating equipment issues, repairs, evidence, and supervisor approval in a shared demo workspace.

## Live app

https://maintenanceflow.app.space

## Current status

The official DeepSpace starter is extended with MaintenanceFlow's shared sandbox: server-validated profiles, assets, work orders, comments, checklists, private evidence, audit history, role transitions, a serialized command coordinator, and an idempotent owner seed.

The sandbox uses fictitious data only. Demo profiles are read-only records and cannot authenticate or execute actions. The owner can seed the workspace from `/team` after the first deploy.

## Local commands

```bash
npm run type-check
npm run lint
npm run build
npm run dev
npm run test:unit
npx deepspace test run all
```

The build requires a registered DeepSpace app ID. Authenticate with the intended DeepSpace account before running `npx deepspace app init`.

## Domain flow

Reporters create a corrective order and may attach a report photo. A supervisor prepares the checklist, sets priority/due date, and assigns an active technician. The technician starts work, records a 30-character minimum summary, completes the checklist, uploads a repair photo, and submits for review. The supervisor approves or returns the work. All mutations use named server actions and `expectedVersion`; private photos are only served by the authenticated MaintenanceFlow gateway.

## Verification status

Automated local checks are recorded in `docs/VERIFICATION.md`. Production deployment, two-account realtime checks, and candidate-personal verification remain explicitly separate until performed.
