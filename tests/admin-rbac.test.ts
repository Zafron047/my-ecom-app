import { describe, expect, it } from 'vitest';
import {
  canAccessAdminPath,
  canAccessPermission,
} from '../src/lib/admin-rbac';

describe('admin settings permissions', () => {
  it('allows Admin into Settings but blocks Admin Access and Backup', () => {
    expect(canAccessPermission('admin', 'settings.manage')).toBe(true);
    expect(canAccessPermission('admin', 'adminUsers.manage')).toBe(false);
    expect(canAccessPermission('admin', 'backups.manage')).toBe(false);

    expect(canAccessAdminPath('/admin/settings', 'admin')).toBe(true);
    expect(canAccessAdminPath('/admin/settings/business-profile', 'admin')).toBe(true);
    expect(canAccessAdminPath('/admin/settings/manage-roles', 'admin')).toBe(false);
    expect(canAccessAdminPath('/admin/settings/backup', 'admin')).toBe(false);
  });
});
