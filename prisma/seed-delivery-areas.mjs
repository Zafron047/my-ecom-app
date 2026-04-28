import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const divisionsPath = path.join(__dirname, '..', 'src', 'data', 'bd-geocode', 'divisions.json');
const districtsPath = path.join(__dirname, '..', 'src', 'data', 'bd-geocode', 'districts.json');
const upazilasPath = path.join(__dirname, '..', 'src', 'data', 'bd-geocode', 'upazilas.json');

function getTableData(raw, tableName) {
  if (!Array.isArray(raw)) return [];
  const table = raw.find(
    (entry) => entry && entry.type === 'table' && entry.name === tableName && Array.isArray(entry.data),
  );
  return table?.data ?? [];
}

function validateDataset(divisions, districts, upazilas) {
  if (!Array.isArray(divisions) || divisions.length === 0) {
    throw new Error('Invalid geocode dataset: missing divisions.');
  }
  if (!Array.isArray(districts) || districts.length === 0) {
    throw new Error('Invalid geocode dataset: missing districts.');
  }
  if (!Array.isArray(upazilas) || upazilas.length === 0) {
    throw new Error('Invalid geocode dataset: missing upazilas.');
  }

  const divisionIds = new Set(divisions.map((division) => Number(division.id)));
  const districtIds = new Set();
  const upazilaIds = new Set();

  for (const district of districts) {
    const districtId = Number(district.id);
    const divisionId = Number(district.division_id);

    if (!Number.isInteger(districtId) || !district.name || !Number.isInteger(divisionId)) {
      throw new Error(`Invalid district row: ${JSON.stringify(district)}`);
    }
    if (!divisionIds.has(divisionId)) {
      throw new Error(`District references unknown division: ${JSON.stringify(district)}`);
    }
    if (districtIds.has(districtId)) {
      throw new Error(`Duplicate district id found: ${districtId}`);
    }
    districtIds.add(districtId);
  }

  for (const upazila of upazilas) {
    const upazilaId = Number(upazila.id);
    const districtId = Number(upazila.district_id);

    if (!Number.isInteger(upazilaId) || !upazila.name || !Number.isInteger(districtId)) {
      throw new Error(`Invalid upazila row: ${JSON.stringify(upazila)}`);
    }
    if (!districtIds.has(districtId)) {
      throw new Error(`Upazila references unknown district: ${JSON.stringify(upazila)}`);
    }
    if (upazilaIds.has(upazilaId)) {
      throw new Error(`Duplicate upazila id found: ${upazilaId}`);
    }
    upazilaIds.add(upazilaId);
  }
}

function createId() {
  return `c_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function upsertDivision(client, name) {
  const result = await client.query(
    `
      INSERT INTO "DeliveryDivision" ("id", "name", "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, true, NOW(), NOW())
      ON CONFLICT ("name")
      DO UPDATE SET
        "isActive" = true,
        "updatedAt" = NOW()
      RETURNING "id"
    `,
    [createId(), name],
  );
  return result.rows[0].id;
}

async function upsertDistrict(client, { redxId, divisionId, name }) {
  const result = await client.query(
    `
      INSERT INTO "DeliveryDistrict" ("id", "redxId", "divisionId", "name", "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, true, NOW(), NOW())
      ON CONFLICT ("redxId")
      DO UPDATE SET
        "divisionId" = EXCLUDED."divisionId",
        "name" = EXCLUDED."name",
        "isActive" = true,
        "updatedAt" = NOW()
      RETURNING "id"
    `,
    [createId(), redxId, divisionId, name],
  );
  return result.rows[0].id;
}

async function upsertArea(client, { redxId, districtId, name }) {
  await client.query(
    `
      INSERT INTO "DeliveryArea"
        ("id", "redxId", "districtId", "name", "postCode", "redxZoneId", "isActive", "createdAt", "updatedAt")
      VALUES
        ($1, $2, $3, $4, NULL, NULL, true, NOW(), NOW())
      ON CONFLICT ("redxId")
      DO UPDATE SET
        "districtId" = EXCLUDED."districtId",
        "name" = EXCLUDED."name",
        "postCode" = NULL,
        "redxZoneId" = NULL,
        "isActive" = true,
        "updatedAt" = NOW()
    `,
    [createId(), redxId, districtId, name],
  );
}

async function seedDeliveryAreas() {
  const [rawDivisions, rawDistricts, rawUpazilas] = await Promise.all([
    fs.readFile(divisionsPath, 'utf8'),
    fs.readFile(districtsPath, 'utf8'),
    fs.readFile(upazilasPath, 'utf8'),
  ]);

  const divisions = getTableData(JSON.parse(rawDivisions), 'divisions');
  const districts = getTableData(JSON.parse(rawDistricts), 'districts');
  const upazilas = getTableData(JSON.parse(rawUpazilas), 'upazilas');
  validateDataset(divisions, districts, upazilas);

  const divisionNames = divisions.map((division) => division.name);
  const districtRedxIds = [];
  const areaRedxIds = [];

  let divisionCount = 0;
  let districtCount = 0;
  let areaCount = 0;

  const districtsByDivisionId = new Map();
  for (const district of districts) {
    const divisionId = String(district.division_id);
    if (!districtsByDivisionId.has(divisionId)) {
      districtsByDivisionId.set(divisionId, []);
    }
    districtsByDivisionId.get(divisionId).push(district);
  }

  const upazilasByDistrictId = new Map();
  for (const upazila of upazilas) {
    const districtId = String(upazila.district_id);
    if (!upazilasByDistrictId.has(districtId)) {
      upazilasByDistrictId.set(districtId, []);
    }
    upazilasByDistrictId.get(districtId).push(upazila);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const divisionEntry of divisions) {
      const divisionId = await upsertDivision(client, divisionEntry.name);
      divisionCount += 1;

      const divisionDistricts = districtsByDivisionId.get(String(divisionEntry.id)) ?? [];
      for (const districtEntry of divisionDistricts) {
        const districtRedxId = Number(districtEntry.id);
        districtRedxIds.push(districtRedxId);

        const districtId = await upsertDistrict(client, {
          redxId: districtRedxId,
          divisionId,
          name: districtEntry.name,
        });
        districtCount += 1;

        const districtUpazilas = upazilasByDistrictId.get(String(districtEntry.id)) ?? [];
        for (const areaEntry of districtUpazilas) {
          const areaRedxId = Number(areaEntry.id);
          areaRedxIds.push(areaRedxId);
          await upsertArea(client, {
            redxId: areaRedxId,
            districtId,
            name: areaEntry.name,
          });
          areaCount += 1;
        }
      }
    }

    await client.query(
      `UPDATE "DeliveryArea" SET "isActive" = false WHERE NOT ("redxId" = ANY($1::int[]))`,
      [areaRedxIds],
    );
    await client.query(
      `UPDATE "DeliveryDistrict" SET "isActive" = false WHERE NOT ("redxId" = ANY($1::int[]))`,
      [districtRedxIds],
    );
    await client.query(
      `UPDATE "DeliveryDivision" SET "isActive" = false WHERE NOT ("name" = ANY($1::text[]))`,
      [divisionNames],
    );

    await client.query('COMMIT');

    const [divisionTotals, districtTotals, areaTotals] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM "DeliveryDivision" WHERE "isActive" = true`),
      pool.query(`SELECT COUNT(*)::int AS count FROM "DeliveryDistrict" WHERE "isActive" = true`),
      pool.query(`SELECT COUNT(*)::int AS count FROM "DeliveryArea" WHERE "isActive" = true`),
    ]);

    const activeDivisions = divisionTotals.rows[0].count;
    const activeDistricts = districtTotals.rows[0].count;
    const activeAreas = areaTotals.rows[0].count;

    console.log(
      `Seeded delivery locations: ${divisionCount} divisions, ${districtCount} districts, ${areaCount} upazilas.`,
    );
    console.log(
      `Active database totals: ${activeDivisions} divisions, ${activeDistricts} districts, ${activeAreas} upazilas.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

seedDeliveryAreas()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

