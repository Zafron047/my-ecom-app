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

  it('does not let Operator manage every child area it can browse near', () => {
    expect(canAccessPermission('operator', 'products.read')).toBe(true);
    expect(canAccessPermission('operator', 'products.write')).toBe(true);
    expect(canAccessPermission('operator', 'productCatalog.read')).toBe(false);
    expect(canAccessPermission('operator', 'inventory.read')).toBe(true);
    expect(canAccessPermission('operator', 'orders.write')).toBe(true);
    expect(canAccessPermission('operator', 'pos.manage')).toBe(true);
    expect(canAccessPermission('operator', 'orderDrafts.manage')).toBe(true);
    expect(canAccessPermission('operator', 'deliveryOptions.manage')).toBe(false);
    expect(canAccessPermission('operator', 'customers.read')).toBe(false);

    expect(canAccessAdminPath('/admin/products', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/products/categories', 'operator')).toBe(false);
    expect(canAccessAdminPath('/admin/products/stock', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/products/stock-transfer', 'operator')).toBe(false);
    expect(canAccessAdminPath('/admin/orders', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/orders/abandoned-checkouts', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/orders/pos', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/orders/drafts', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/orders/delivery-options', 'operator')).toBe(false);
    expect(canAccessAdminPath('/admin/customers', 'operator')).toBe(false);
  });
});
