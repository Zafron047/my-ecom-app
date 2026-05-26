import dhakaMetroAreas from '@/data/delivery-zones/dhaka-metro-areas.json';

export type DhakaDeliveryZone = {
  id: string;
  shippingOption: ShippingOptionId;
  heading: string;
  deliveryCharge: number;
  areas: string[];
};

export type ShippingOptionId =
  | 'dhaka-city'
  | 'dhaka-division'
  | 'outside-dhaka-division';

export type DeliveryShippingOption = {
  id: ShippingOptionId;
  label: string;
  badge: string;
  title: string;
  deliveryCharge: number;
  deliveryTime: string;
  summary: string;
};

const zoneData = dhakaMetroAreas as {
  shippingOptions: DeliveryShippingOption[];
  zones: DhakaDeliveryZone[];
};

export const deliveryShippingOptions = zoneData.shippingOptions;
export const dhakaDeliveryZones = zoneData.zones;

export const dhakaOuterDeliveryAreas = new Set(
  dhakaDeliveryZones
    .filter((zone) => zone.shippingOption !== 'dhaka-city')
    .flatMap((zone) => zone.areas),
);

export const deliveryShippingOptionsById = Object.fromEntries(
  deliveryShippingOptions.map((option) => [option.id, option]),
) as Record<ShippingOptionId, DeliveryShippingOption>;
