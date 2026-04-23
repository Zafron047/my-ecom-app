export const adminRoles = ['admin', 'manager', 'support'] as const;

export type AdminRole = (typeof adminRoles)[number];
export const adminPermissions = [
  'dashboard.read',
  'orders.read',
  'orders.write',
  'products.read',
  'products.write',
  'customers.read',
  'accounting.read',
  'settings.manage',
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

export type AdminSession = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
};

type AdminRouteRule = {
  prefix: string;
  requiredPermissions: AdminPermission[];
};

const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  admin: [
    'dashboard.read',
    'orders.read',
    'orders.write',
    'products.read',
    'products.write',
    'customers.read',
    'accounting.read',
    'settings.manage',
  ],
  manager: [
    'dashboard.read',
    'orders.read',
    'orders.write',
    'products.read',
    'products.write',
    'customers.read',
    'accounting.read',
  ],
  support: ['dashboard.read', 'orders.read', 'orders.write', 'customers.read'],
};

const adminRouteRules: AdminRouteRule[] = [
  {
    prefix: '/admin/settings',
    requiredPermissions: ['settings.manage'],
  },
  {
    prefix: '/admin/accounting',
    requiredPermissions: ['accounting.read'],
  },
  {
    prefix: '/admin/orders',
    requiredPermissions: ['orders.read'],
  },
  {
    prefix: '/admin/products',
    requiredPermissions: ['products.read'],
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

export function parseAdminRole(value: string | undefined): AdminRole | null {
  if (!value) return null;

  const normalizedValue = value.trim().toLowerCase();
  return adminRoles.includes(normalizedValue as AdminRole)
    ? (normalizedValue as AdminRole)
    : null;
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
