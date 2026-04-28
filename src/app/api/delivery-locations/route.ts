import {
  getDeliveryAreas,
  getDeliveryDistricts,
  getDeliveryDivisions,
} from '@/lib/delivery-locations';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const division = url.searchParams.get('division') ?? '';
  const district = url.searchParams.get('district') ?? '';

  if (type === 'districts') {
    return Response.json({ items: getDeliveryDistricts(division) });
  }

  if (type === 'areas') {
    return Response.json({ items: getDeliveryAreas(division, district) });
  }

  return Response.json({ items: getDeliveryDivisions() });
}

