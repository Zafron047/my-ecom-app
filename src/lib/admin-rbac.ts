export const adminRoles = [
  'supaAdmin',
  'admin',
  'manager',
  'operator',
  'support',
] as const;

export type AdminRole = (typeof adminRoles)[number];

export const adminRoleLabels: Record<AdminRole, string> = {
  supaAdmin: 'SupaAdmin',
  admin: 'Admin',
  manager: 'Manager',
  operator: 'Operator',
  support: 'Support',
};

export const adminPermissions = [
  'dashboard.read',
  'orders.read',
  'orders.write',
  'orderDrafts.manage',
  'pos.manage',
  'deliveryOptions.manage',
  'products.read',
  'products.write',
  'products.delete',
  'products.export',
  'productCatalog.read',
  'productCatalog.manage',
  'productImages.upload',
  'inventory.read',
  'purchaseOrders.read',
  'purchaseOrders.write',
  'purchaseOrders.submit',
  'purchaseOrders.cost.read',
  'purchaseOrders.payment.manage',
  'customers.read',
  'accounting.read',
  'settings.manage',
  'settings.system',
  'backups.manage',
  'adminUsers.manage',
  'password.change',
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

export type AdminSession = {
  id: string;
  name: string;
  email: string;
  mustResetPassword: boolean;
  role: AdminRole;
};

type AdminRouteRule = {
  prefix: string;
  requiredPermissions: AdminPermission[];
};

export const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  supaAdmin: [...adminPermissions],
  admin: [
    'dashboard.read',
    'orders.read',
    'orders.write',
    'orderDrafts.manage',
    'pos.manage',
    'deliveryOptions.manage',
    'products.read',
    'products.write',
    'products.delete',
    'products.export',
    'productCatalog.read',
    'productCatalog.manage',
    'productImages.upload',
    'inventory.read',
    'purchaseOrders.read',
    'purchaseOrders.write',
    'purchaseOrders.submit',
    'purchaseOrders.cost.read',
    'purchaseOrders.payment.manage',
    'customers.read',
    'accounting.read',
    'settings.manage',
    'password.change',
  ],
  manager: [
    'dashboard.read',
    'orders.read',
    'orders.write',
    'orderDrafts.manage',
    'pos.manage',
    'deliveryOptions.manage',
    'products.read',
    'products.write',
    'products.export',
    'productCatalog.read',
    'productCatalog.manage',
    'productImages.upload',
    'inventory.read',
    'purchaseOrders.read',
    'purchaseOrders.write',
    'customers.read',
    'accounting.read',
  ],
  operator: [
    'dashboard.read',
    'orders.read',
    'orders.write',
    'orderDrafts.manage',
    'pos.manage',
    'products.read',
    'products.write',
    'productImages.upload',
    'inventory.read',
    'password.change',
  ],
  support: ['dashboard.read', 'password.change'],
};

const adminRouteRules: AdminRouteRule[] = [
  {
    prefix: '/admin/settings/backup',
    requiredPermissions: ['backups.manage'],
  },
  {
    prefix: '/admin/settings/manage-roles',
    requiredPermissions: ['adminUsers.manage'],
  },
  {
    prefix: '/admin/settings',
    requiredPermissions: ['settings.manage'],
  },
  {
    prefix: '/admin/accounting',
    requiredPermissions: ['accounting.read'],
  },
  {
    prefix: '/admin/orders/pos',
    requiredPermissions: ['pos.manage'],
  },
  {
    prefix: '/admin/orders/drafts',
    requiredPermissions: ['orderDrafts.manage'],
  },
  {
    prefix: '/admin/orders/delivery-options',
    requiredPermissions: ['deliveryOptions.manage'],
  },
  {
    prefix: '/admin/orders',
    requiredPermissions: ['orders.read'],
  },
  {
    prefix: '/admin/products/categories',
    requiredPermissions: ['productCatalog.read'],
  },
  {
    prefix: '/admin/products/brands',
    requiredPermissions: ['productCatalog.read'],
  },
  {
    prefix: '/admin/products/bundles',
    requiredPermissions: ['productCatalog.read'],
  },
  {
    prefix: '/admin/products/stock',
    requiredPermissions: ['inventory.read'],
  },
  {
    prefix: '/admin/products',
    requiredPermissions: ['products.read'],
  },
  {
    prefix: '/admin/purchase-order',
    requiredPermissions: ['purchaseOrders.read'],
  },
  {
    prefix: '/admin/customers',
    requiredPermissions: ['customers.read'],
  },
  {
    prefix: '/admin',
    requiredPermissions: ['dashboard.read'],
  },
];

export function formatAdminRole(role: AdminRole): string {
  return adminRoleLabels[role];
}

export function parseAdminRole(value: string | undefined): AdminRole | null {
  if (!value) return null;

  const normalizedValue = value.trim().toLowerCase();
  return (
    adminRoles.find((role) => role.toLowerCase() === normalizedValue) ?? null
  );
}

export function canAccessAdminPath(pathname: string, role: AdminRole): boolean {
  const matchedRule = adminRouteRules.find((rule) =>
    pathname.startsWith(rule.prefix),
  );

  if (!matchedRule) return false;
  return matchedRule.requiredPermissions.every((permission) =>
    canAccessPermission(role, permission),
  );
}

export function canAccessPermission(
  role: AdminRole,
  permission: AdminPermission,
): boolean {
  return rolePermissions[role].includes(permission);
}

export function getAssignableAdminRoles(actorRole: AdminRole): AdminRole[] {
  if (actorRole === 'supaAdmin') return [...adminRoles];
  if (actorRole === 'admin') return ['manager', 'operator', 'support'];
  return [];
}

export function canAssignAdminRole(
  actorRole: AdminRole,
  targetRole: AdminRole,
): boolean {
  return getAssignableAdminRoles(actorRole).includes(targetRole);
}

export function canManageAdminUser(
  actorRole: AdminRole,
  targetRole: AdminRole,
): boolean {
  if (actorRole === 'supaAdmin') return true;
  if (actorRole === 'admin') {
    return targetRole === 'manager' || targetRole === 'operator' || targetRole === 'support';
  }
  return false;
}

export function isPrivilegedAdminRole(role: AdminRole): boolean {
  return role === 'supaAdmin' || role === 'admin';
}
