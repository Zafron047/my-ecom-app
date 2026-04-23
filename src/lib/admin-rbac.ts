export const adminRoles = ['reseller', 'support', 'manager', 'owner'] as const;

export type AdminRole = (typeof adminRoles)[number];

export type AdminSession = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
};

type AdminRouteRule = {
  prefix: string;
  allowedRoles: AdminRole[];
};

const adminRouteRules: AdminRouteRule[] = [
  {
    prefix: '/admin/settings',
    allowedRoles: ['owner'],
  },
  {
    prefix: '/admin',
    allowedRoles: ['reseller', 'support', 'manager', 'owner'],
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
  return matchedRule.allowedRoles.includes(role);
}
