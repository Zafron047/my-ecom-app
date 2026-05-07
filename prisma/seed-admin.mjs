import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  const email = (process.env.ADMIN_SEED_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD ?? '';
  const name = (process.env.ADMIN_SEED_NAME ?? 'Admin User').trim();
  const role = (process.env.ADMIN_SEED_ROLE ?? 'admin').trim().toLowerCase();

  if (!email || !password) {
    throw new Error(
      'Missing ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD in environment.',
    );
  }

  const allowedRoles = ['admin', 'manager', 'support'];
  if (!allowedRoles.includes(role)) {
    throw new Error(
      `Invalid ADMIN_SEED_ROLE="${role}". Use one of: ${allowedRoles.join(', ')}`,
    );
  }

  const passwordHash = hashPassword(password);

  const user = await prisma.adminUser.upsert({
    where: { email },
    create: {
      email,
      name,
      role,
      passwordHash,
      isActive: true,
      mustResetPassword: false,
      passwordUpdatedAt: new Date(),
    },
    update: {
      name,
      role,
      passwordHash,
      isActive: true,
      mustResetPassword: false,
      passwordUpdatedAt: new Date(),
    },
  });

  console.log(
    `Seeded admin user: ${user.email} (${user.role}) with id ${user.id}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
