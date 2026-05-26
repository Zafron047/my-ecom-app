import { describe, expect, it } from 'vitest';
import { getGroupedAreaOptions } from '../src/lib/location-presenter';
import { getShippingCharge } from '../src/lib/shipping-charge';

const dhakaFallbackAreas = ['Dhamrai', 'Savar', 'Dohar', 'Keraniganj', 'Nawabganj'];

describe('Dhaka delivery zones', () => {
  it('groups Dhaka areas from JSON-backed delivery zones', () => {
    const groups = getGroupedAreaOptions('Dhaka', 'Dhaka', dhakaFallbackAreas);

    expect(groups).toEqual([
      expect.objectContaining({
        heading: 'Dhaka Metro (80 Tk)',
        options: expect.arrayContaining(['Dhanmondi', 'Gulshan', 'Wari']),
      }),
      {
        heading: 'Upazila (120 Tk)',
        options: dhakaFallbackAreas,
      },
      {
        heading: 'Outer Metro (120 Tk)',
        options: ['Demra'],
      },
    ]);
  });

  it('keeps the existing Dhaka shipping charges', () => {
    expect(getShippingCharge({ division: 'Dhaka', district: 'Dhaka', area: 'Dhanmondi' })).toBe(80);
    expect(getShippingCharge({ division: 'Dhaka', district: 'Dhaka', area: 'Savar' })).toBe(120);
    expect(getShippingCharge({ division: 'Dhaka', district: 'Dhaka', area: 'Demra' })).toBe(120);
    expect(getShippingCharge({ division: 'Dhaka', district: 'Gazipur', area: 'Gazipur Sadar' })).toBe(120);
    expect(getShippingCharge({ division: 'Chattagram', district: 'Cumilla', area: 'Comilla Sadar' })).toBe(150);
  });
});
