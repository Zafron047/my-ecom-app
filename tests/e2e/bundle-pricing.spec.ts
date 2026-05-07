import { expect, test } from '@playwright/test';

test('applies expected bundle tier percent based on quantity', async ({ page, request }) => {
  const catalogResponse = await request.get('/api/storefront/catalog');
  expect(catalogResponse.ok()).toBeTruthy();

  const catalogPayload = (await catalogResponse.json()) as {
    products?: Array<{
      id: string;
      name: string;
      bundleOffers?: Array<{
        minTotalQty: number;
        discountPercent: number;
        isActive: boolean;
      }>;
    }>;
  };

  const target = (catalogPayload.products ?? []).find((product) => {
    const activeOffers = (product.bundleOffers ?? []).filter((offer) => offer.isActive);
    return activeOffers.length >= 2;
  });

  test.skip(!target, 'No product with 2+ active bundle tiers found in catalog');
  if (!target) return;

  const activeOffers = (target.bundleOffers ?? [])
    .filter((offer) => offer.isActive)
    .sort((a, b) => a.minTotalQty - b.minTotalQty);

  const expectedTier = activeOffers[1];
  expect(expectedTier).toBeTruthy();

  await page.goto(`/products/${target.id}`);

  const plusButton = page.getByRole('button', { name: 'Increase quantity' }).first();
  await plusButton.waitFor({ state: 'visible' });

  for (let i = 0; i < expectedTier.minTotalQty; i += 1) {
    await plusButton.click();
  }

  await page.getByRole('button', { name: 'Open cart' }).click();

  await expect(
    page.getByText(new RegExp(`Bundle discount\\s+${expectedTier.discountPercent}%`, 'i')),
  ).toBeVisible();
});
