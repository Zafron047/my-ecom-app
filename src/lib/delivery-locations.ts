import rawDivisions from '@/data/bd-geocode/divisions.json';
import rawDistricts from '@/data/bd-geocode/districts.json';
import rawUpazilas from '@/data/bd-geocode/upazilas.json';
import { prisma } from '@/lib/prisma';

type TableEnvelope<T> = {
  type: 'table';
  name: string;
  data: T[];
};

type DivisionRow = {
  id: string;
  name: string;
  bn_name: string;
  url: string;
};

type DistrictRow = {
  id: string;
  division_id: string;
  name: string;
  bn_name: string;
  lat: string;
  lon: string;
  url: string;
};

type UpazilaRow = {
  id: string;
  district_id: string;
  name: string;
  bn_name: string;
  url: string;
};

function getTableData<T>(raw: unknown, tableName: string): T[] {
  if (!Array.isArray(raw)) return [];
  const table = raw.find((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as TableEnvelope<T>;
    return candidate.type === 'table' && candidate.name === tableName;
  }) as TableEnvelope<T> | undefined;

  return table?.data ?? [];
}

function sortAsc(values: string[]) {
  return [...values].sort((a, b) => a.localeCompare(b, 'en'));
}

const divisions = getTableData<DivisionRow>(rawDivisions, 'divisions');
const districts = getTableData<DistrictRow>(rawDistricts, 'districts');
const upazilas = getTableData<UpazilaRow>(rawUpazilas, 'upazilas');

const divisionNameById = new Map(divisions.map((division) => [division.id, division.name]));
const districtNameById = new Map(districts.map((district) => [district.id, district.name]));
const districtDivisionByName = new Map<string, string>();
const districtsByDivision = new Map<string, Set<string>>();
const upazilasByDistrict = new Map<string, Set<string>>();

for (const district of districts) {
  const divisionName = divisionNameById.get(district.division_id);
  if (!divisionName) continue;
  districtDivisionByName.set(district.name.trim().toLowerCase(), divisionName.trim());
  if (!districtsByDivision.has(divisionName)) {
    districtsByDivision.set(divisionName, new Set<string>());
  }
  districtsByDivision.get(divisionName)?.add(district.name.trim());
}

for (const upazila of upazilas) {
  const districtName = districtNameById.get(upazila.district_id);
  if (!districtName) continue;
  if (!upazilasByDistrict.has(districtName)) {
    upazilasByDistrict.set(districtName, new Set<string>());
  }
  upazilasByDistrict.get(districtName)?.add(upazila.name.trim());
}

function getFallbackDivisions() {
  return sortAsc(divisions.map((division) => division.name.trim()));
}

function getFallbackDistricts(divisionName: string) {
  if (!divisionName.trim()) {
    return sortAsc(districts.map((district) => district.name.trim()));
  }
  const districtSet = districtsByDivision.get(divisionName);
  if (!districtSet) return [];
  return sortAsc(Array.from(districtSet));
}

function getFallbackAreas(divisionName: string, districtName: string) {
  const inferredDivision = divisionName || getFallbackDivisionForDistrict(districtName);
  const districtSet = districtsByDivision.get(inferredDivision);
  if (!districtSet || !districtSet.has(districtName)) return [];
  const upazilaSet = upazilasByDistrict.get(districtName);
  if (!upazilaSet) return [];
  return sortAsc(Array.from(upazilaSet));
}

function getFallbackDivisionForDistrict(districtName: string) {
  return districtDivisionByName.get(districtName.trim().toLowerCase()) ?? '';
}

export async function getDeliveryDivisions() {
  try {
    const rows = await prisma.deliveryDivision.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    if (rows.length > 0) {
      return rows.map((row) => row.name.trim());
    }
  } catch {
    // Fall back to static dataset when DB is unavailable.
  }

  return getFallbackDivisions();
}

export async function getDeliveryDistricts(divisionName: string) {
  try {
    if (!divisionName.trim()) {
      const rows = await prisma.deliveryDistrict.findMany({
        where: { isActive: true, division: { isActive: true } },
        orderBy: { name: 'asc' },
        select: { name: true },
      });
      if (rows.length > 0) {
        return rows.map((row) => row.name.trim());
      }
    }

    const division = await prisma.deliveryDivision.findFirst({
      where: { isActive: true, name: { equals: divisionName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (division) {
      const rows = await prisma.deliveryDistrict.findMany({
        where: { divisionId: division.id, isActive: true },
        orderBy: { name: 'asc' },
        select: { name: true },
      });
      if (rows.length > 0) {
        return rows.map((row) => row.name.trim());
      }
    }
  } catch {
    // Fall back to static dataset when DB is unavailable.
  }

  return getFallbackDistricts(divisionName);
}

export async function getDeliveryAreas(divisionName: string, districtName: string) {
  try {
    const district = await prisma.deliveryDistrict.findFirst({
      where: {
        isActive: true,
        name: { equals: districtName, mode: 'insensitive' },
        division: divisionName.trim()
          ? {
              isActive: true,
              name: { equals: divisionName, mode: 'insensitive' },
            }
          : { isActive: true },
      },
      select: { id: true },
    });
    if (district) {
      const rows = await prisma.deliveryArea.findMany({
        where: { districtId: district.id, isActive: true },
        orderBy: { name: 'asc' },
        select: { name: true },
      });
      if (rows.length > 0) {
        return rows.map((row) => row.name.trim());
      }
    }
  } catch {
    // Fall back to static dataset when DB is unavailable.
  }

  return getFallbackAreas(divisionName, districtName);
}

export async function getDeliveryDivisionForDistrict(districtName: string) {
  try {
    const district = await prisma.deliveryDistrict.findFirst({
      where: {
        isActive: true,
        name: { equals: districtName, mode: 'insensitive' },
        division: { isActive: true },
      },
      select: {
        division: {
          select: {
            name: true,
          },
        },
      },
    });
    if (district?.division?.name) {
      return district.division.name.trim();
    }
  } catch {
    // Fall back to static dataset when DB is unavailable.
  }

  return getFallbackDivisionForDistrict(districtName);
}
