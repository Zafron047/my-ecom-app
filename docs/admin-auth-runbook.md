# Admin Auth Runbook

## Environment

Required:

- `DATABASE_URL`

Optional:

- `ADMIN_PASSWORD_RESET_TTL_MINUTES`: one-time admin reset link lifetime. Defaults to `60`.
- `ADMIN_DEV_ROLE`: local development bypass only. Leave empty in production.

Bootstrap the first owner account with:

```bash
npm run prisma:seed:admin
```

Use a unique `ADMIN_SEED_EMAIL` and rotate `ADMIN_SEED_PASSWORD` after handover.

## Client SOP

Add staff:

1. Sign in as an active `admin`.
2. Open `Admin > Settings > Admin Access`.
3. Enter name, email, and role.
4. Create the account and share the one-time reset link through a private channel.

Change roles:

1. Open `Admin Access`.
2. Choose the new role and save.
3. The user is logged out so the next session picks up the new role.

Reset passwords:

1. Open `Admin Access`.
2. Use `Reset` for the admin user.
3. Share the one-time reset link through a private channel.
4. The reset marks the account as password-reset-required and revokes active sessions.

Remove access:

1. Open `Admin Access`.
2. Set the user to inactive.
3. Confirm there is still another active `admin` account.
4. Active sessions are revoked when the account is deactivated.

Logout all sessions:

1. Open `Admin Access`.
2. Use `Logout all` for the target admin user.

Audit checks:

- Review the `Auth Audit` table in `Admin Access`.
- Login success/failure, role changes, deactivation, password resets, and session revokes are written to `AuditLog`.

## Production Hardening Checklist

- Keep `ADMIN_DEV_ROLE` empty in production.
- Run migrations before handover:

```bash
npm run prisma:migrate
```

- Seed exactly one known owner account, then create staff through `Admin Access`.
- Verify `/admin/**` pages redirect when logged out.
- Verify non-admin roles cannot open `/admin/settings/**`.
- Verify password reset links expire after `ADMIN_PASSWORD_RESET_TTL_MINUTES`.
- Verify deactivating a staff user revokes their active sessions.
