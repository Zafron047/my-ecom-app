const DHAKA_OUTER_AREAS = new Set([
  'Dhamrai',
  'Savar',
  'Dohar',
  'Keraniganj',
  'Nawabganj',
  'Demra',
]);

export function getShippingCharge(input: {
  division: string;
  district: string;
  area: string;
}) {
  const division = input.division.trim();
  const district = input.district.trim();
  const area = input.area.trim();

  if (!division) return 0;
  if (division !== 'Dhaka') return 150;
  if (!district) return 0;
  if (district !== 'Dhaka') return 120;
  if (area && DHAKA_OUTER_AREAS.has(area)) return 120;
  return 80;
}

