import { describe, expect, it } from 'vitest';
import {
  canAccessAdminPath,
  canAccessPermission,
  canAssignAdminRole,
  canManageAdminUser,
  parseAdminRole,
} from './admin-rbac';

describe('admin RBAC', () => {
  it('parses all supported database role values', () => {
    expect(parseAdminRole('supaAdmin')).toBe('supaAdmin');
    expect(parseAdminRole('SupaAdmin')).toBe('supaAdmin');
    expect(parseAdminRole('admin')).toBe('admin');
    expect(parseAdminRole('manager')).toBe('manager');
    expect(parseAdminRole('operator')).toBe('operator');
    expect(parseAdminRole('support')).toBe('support');
  });

  it('allows Admin to manage settings but keeps access and backup SupaAdmin-only', () => {
    expect(canAccessPermission('supaAdmin', 'backups.manage')).toBe(true);
    expect(canAccessPermission('supaAdmin', 'adminUsers.manage')).toBe(true);
    expect(canAccessPermission('supaAdmin', 'settings.manage')).toBe(true);
    expect(canAccessPermission('admin', 'backups.manage')).toBe(false);
    expect(canAccessPermission('admin', 'adminUsers.manage')).toBe(false);
    expect(canAccessPermission('admin', 'settings.manage')).toBe(true);
    expect(canAccessAdminPath('/admin/settings', 'admin')).toBe(true);
    expect(canAccessAdminPath('/admin/settings/manage-roles', 'admin')).toBe(false);
    expect(canAccessAdminPath('/admin/settings/backup', 'admin')).toBe(false);
  });

  it('limits role assignment and target management by actor role', () => {
    expect(canAssignAdminRole('supaAdmin', 'supaAdmin')).toBe(true);
    expect(canAssignAdminRole('admin', 'supaAdmin')).toBe(false);
    expect(canAssignAdminRole('admin', 'admin')).toBe(false);
    expect(canAssignAdminRole('admin', 'manager')).toBe(true);

    expect(canManageAdminUser('admin', 'supaAdmin')).toBe(false);
    expect(canManageAdminUser('admin', 'admin')).toBe(false);
    expect(canManageAdminUser('admin', 'support')).toBe(true);
  });

  it('applies Operator and Support limits', () => {
    expect(canAccessPermission('support', 'dashboard.read')).toBe(true);
    expect(canAccessPermission('support', 'orders.read')).toBe(false);
    expect(canAccessPermission('support', 'orders.write')).toBe(false);
    expect(canAccessPermission('operator', 'orders.write')).toBe(true);
    expect(canAccessPermission('operator', 'pos.manage')).toBe(true);
    expect(canAccessPermission('operator', 'orderDrafts.manage')).toBe(true);
    expect(canAccessPermission('operator', 'deliveryOptions.manage')).toBe(false);
    expect(canAccessPermission('operator', 'products.write')).toBe(true);
    expect(canAccessPermission('operator', 'productCatalog.read')).toBe(false);
    expect(canAccessPermission('operator', 'productCatalog.manage')).toBe(false);
    expect(canAccessPermission('operator', 'inventory.read')).toBe(true);
    expect(canAccessPermission('operator', 'stockTransfers.manage')).toBe(false);
    expect(canAccessPermission('operator', 'products.delete')).toBe(false);
    expect(canAccessPermission('operator', 'customers.read')).toBe(false);
    expect(canAccessPermission('operator', 'purchaseOrders.read')).toBe(false);

    expect(canAccessAdminPath('/admin/products', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/products/new', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/products/categories', 'operator')).toBe(false);
    expect(canAccessAdminPath('/admin/products/brands', 'operator')).toBe(false);
    expect(canAccessAdminPath('/admin/products/bundles', 'operator')).toBe(false);
    expect(canAccessAdminPath('/admin/products/stock', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/products/stock-transfer', 'operator')).toBe(false);
    expect(canAccessAdminPath('/admin/orders', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/orders/abandoned-checkouts', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/orders/pos', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/orders/drafts', 'operator')).toBe(true);
    expect(canAccessAdminPath('/admin/orders/delivery-options', 'operator')).toBe(false);
    expect(canAccessAdminPath('/admin/customers', 'operator')).toBe(false);
  });

  it('keeps Manager away from sensitive PO actions', () => {
    expect(canAccessPermission('manager', 'purchaseOrders.read')).toBe(true);
    expect(canAccessPermission('manager', 'purchaseOrders.write')).toBe(true);
    expect(canAccessPermission('manager', 'purchaseOrders.submit')).toBe(false);
    expect(canAccessPermission('manager', 'purchaseOrders.cost.read')).toBe(false);
    expect(canAccessPermission('manager', 'purchaseOrders.payment.manage')).toBe(
      false,
    );
  });

  it('keeps Manager and Admin access to product catalog and operational order tools', () => {
    expect(canAccessPermission('manager', 'productCatalog.manage')).toBe(true);
    expect(canAccessPermission('manager', 'inventory.read')).toBe(true);
    expect(canAccessPermission('manager', 'stockTransfers.manage')).toBe(true);
    expect(canAccessPermission('manager', 'pos.manage')).toBe(true);
    expect(canAccessPermission('manager', 'orderDrafts.manage')).toBe(true);
    expect(canAccessPermission('manager', 'deliveryOptions.manage')).toBe(true);
    expect(canAccessPermission('admin', 'productCatalog.manage')).toBe(true);
    expect(canAccessPermission('admin', 'pos.manage')).toBe(true);
  });
});
