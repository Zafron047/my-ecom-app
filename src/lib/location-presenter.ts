type GroupedLocationOptions = {
  heading: string;
  options: string[];
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
