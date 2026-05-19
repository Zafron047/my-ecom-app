import rawDistricts from '@/data/bd-geocode/districts.json';
import rawDivisions from '@/data/bd-geocode/divisions.json';

type TableEnvelope<T> = {
  type: 'table';
  name: string;
  data: T[];
};

type DivisionRow = {
  id: string;
  name: string;
};

type DistrictRow = {
  division_id: string;
  name: string;
};

const DHAKA_OUTER_AREAS = new Set([
  'Dhamrai',
  'Savar',
  'Dohar',
  'Keraniganj',
  'Nawabganj',
  'Demra',
]);

function getTableData<T>(raw: unknown, tableName: string): T[] {
  if (!Array.isArray(raw)) return [];
  const table = raw.find((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as TableEnvelope<T>;
    return candidate.type === 'table' && candidate.name === tableName;
  }) as TableEnvelope<T> | undefined;

  return table?.data ?? [];
}

const divisionNameById = new Map(
  getTableData<DivisionRow>(rawDivisions, 'divisions').map((division) => [
    division.id,
    division.name,
  ]),
);
const divisionByDistrictName = new Map(
  getTableData<DistrictRow>(rawDistricts, 'districts')
    .map((district) => [
      district.name.trim().toLowerCase(),
      divisionNameById.get(district.division_id)?.trim() ?? '',
    ] as const)
    .filter(([, division]) => Boolean(division)),
);

export function getShippingCharge(input: {
  division: string;
  district: string;
  area: string;
}) {
  const district = input.district.trim();
  const division = input.division.trim() || inferDivisionFromDistrict(district);
  const area = input.area.trim();

  if (!division) return 0;
  if (division !== 'Dhaka') return 150;
  if (!district) return 0;
  if (district !== 'Dhaka') return 120;
  if (area && DHAKA_OUTER_AREAS.has(area)) return 120;
  return 80;
}

function inferDivisionFromDistrict(district: string) {
  if (!district) return '';
  return divisionByDistrictName.get(district.trim().toLowerCase()) ?? '';
}

