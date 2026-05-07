# Free-Tier Monitoring and Backups Runbook

## Goals
- Keep Supabase and Vercel usage inside free-tier limits.
- Keep regular catalog and DB summary backups for recovery.

## Commands
- Catalog CSV snapshot:
  - `npm run ops:backup:catalog`
- DB summary backup:
  - `npm run ops:backup:dbjson`
- Quick usage snapshot:
  - `npm run ops:monitor:usage`

Backups are saved to `backups/`.

## Suggested cadence
- Daily:
  - `npm run ops:monitor:usage`
- Twice weekly:
  - `npm run ops:backup:catalog`
- Weekly:
  - `npm run ops:backup:dbjson`
- Before major imports/releases:
  - run all three commands.

## Supabase checks (manual)
- Open Supabase project usage dashboard and note:
  - Database size
  - Storage size
  - Egress/bandwidth
- Alert threshold recommendation:
  - warn at ~70%
  - action at ~85%

## Vercel checks (manual)
- Open Vercel project usage dashboard and note:
  - Bandwidth
  - Function execution/invocations
  - Edge/cache usage
- Same threshold policy:
  - warn at ~70%
  - action at ~85%

## Action playbook when high usage
- Database near limit:
  - archive stale draft/test products
  - reduce large unneeded records
- Storage/egress near limit:
  - remove duplicate/unreferenced images
  - prefer optimized image variants
- Vercel bandwidth near limit:
  - validate image caching headers and CDN paths
  - reduce unnecessary API polling

## Notes
- `ops:monitor:usage` includes DB-level counts and reminders.
- Exact Supabase storage/egress totals must be confirmed in Supabase dashboard.
