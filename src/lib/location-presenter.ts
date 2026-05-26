import rawDistricts from '@/data/bd-geocode/districts.json';
import rawDivisions from '@/data/bd-geocode/divisions.json';
import { dhakaDeliveryZones } from '@/lib/dhaka-delivery-zones';

type GroupedLocationOptions = {
  heading: string;
  options: string[];
};

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

const PREFERRED_DIVISION_ORDER = ['Dhaka', 'Chattagram', 'Chittagong', 'Sylhet', 'Barisal', 'Barishal'];

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
    division.name.trim(),
  ]),
);
const districtDivisionByName = new Map(
  getTableData<DistrictRow>(rawDistricts, 'districts')
    .map((district) => [
      district.name.trim().toLowerCase(),
      divisionNameById.get(district.division_id) ?? '',
    ] as const)
    .filter(([, division]) => Boolean(division)),
);

export function getGroupedDistrictOptions(districts: string[]): GroupedLocationOptions[] {
  const grouped = new Map<string, string[]>();
  const unknownDistricts: string[] = [];

  for (const district of districts) {
    const trimmedDistrict = district.trim();
    if (!trimmedDistrict) continue;
    const division = districtDivisionByName.get(trimmedDistrict.toLowerCase());
    if (!division) {
      unknownDistricts.push(trimmedDistrict);
      continue;
    }
    grouped.set(division, [...(grouped.get(division) ?? []), trimmedDistrict]);
  }

  const groups = [...grouped.entries()]
    .sort(([first], [second]) => {
      const firstIndex = PREFERRED_DIVISION_ORDER.indexOf(first);
      const secondIndex = PREFERRED_DIVISION_ORDER.indexOf(second);
      const firstRank = firstIndex === -1 ? PREFERRED_DIVISION_ORDER.length : firstIndex;
      const secondRank = secondIndex === -1 ? PREFERRED_DIVISION_ORDER.length : secondIndex;

      if (firstRank !== secondRank) return firstRank - secondRank;
      return first.localeCompare(second, 'en');
    })
    .map(([heading, options]) => ({
      heading,
      options,
    }));

  if (unknownDistricts.length > 0) {
    groups.push({ heading: 'Other', options: unknownDistricts });
  }

  return groups;
}

export function getGroupedAreaOptions(
  division: string,
  district: string,
  fallbackAreas: string[],
): GroupedLocationOptions[] {
  const resolvedDivision = division || (district === 'Dhaka' ? 'Dhaka' : '');
  if (resolvedDivision !== 'Dhaka' || district !== 'Dhaka') {
    return [{ heading: 'Area', options: fallbackAreas }];
  }

  const fallbackSet = new Set(fallbackAreas.map((value) => value.trim()));

  return dhakaDeliveryZones.map((zone) => ({
    heading: zone.heading,
    options:
      zone.id === 'dhaka-upazila'
        ? zone.areas.filter((value) => fallbackSet.has(value))
        : zone.areas,
  }));
}
