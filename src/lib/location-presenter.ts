import rawDistricts from '@/data/bd-geocode/districts.json';
import rawDivisions from '@/data/bd-geocode/divisions.json';

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

const DHAKA_CITY_THANA_80 = [
  'Adabor',
  'Airport',
  'Badda',
  'Banani',
  'Bangshal',
  'Bhashantek',
  'Cantonment',
  'Chackbazar',
  'Dakshin Khan',
  'Darus Salam',
  'Dhanmondi',
  'Gandaria',
  'Gulshan',
  'Hatirjheel',
  'Hazaribagh',
  'Jatrabari',
  'Kadamtoli',
  'Kafrul',
  'Kalabagan',
  'Kamrangirchar',
  'Khilgaon',
  'Khilkhet',
  'Kotwali',
  'Lalbagh',
  'Mirpur Model',
  'Mohammadpur',
  'Motijheel',
  'Mugda',
  'New Market',
  'Pallabi',
  'Paltan Model',
  'Ramna Model',
  'Rampura',
  'Rupnagar',
  'Sabujbag',
  'Shah Ali',
  'Shahbag',
  'Shahjahanpur',
  'Sher-e-Bangla Nagar',
  'Shyampur',
  'Sutrapur',
  'Tejgaon',
  'Tejgaon Industrial Area',
  'Turag',
  'Uttar Khan',
  'Uttara East',
  'Uttara West',
  'Vatara',
  'Wari',
];

const DHAKA_UPAZILA_120 = ['Dhamrai', 'Savar', 'Dohar', 'Keraniganj', 'Nawabganj'];
const DHAKA_OUTER_METRO_120 = ['Demra'];
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
  const filteredUpazila = DHAKA_UPAZILA_120.filter((value) => fallbackSet.has(value));

  return [
    { heading: 'Dhaka Metro (80 Tk)', options: DHAKA_CITY_THANA_80 },
    { heading: 'Upazila (120 Tk)', options: filteredUpazila },
    { heading: 'Outer Metro (120 Tk)', options: DHAKA_OUTER_METRO_120 },
  ];
}
