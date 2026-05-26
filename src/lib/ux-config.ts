export const uxConfig = {
  cartNoticeDurationMs: 2200,
  cartPricingRetryDelaysMs: [0, 200, 600, 1200],
  checkoutPlaceOrderRateLimit: {
    limit: 8,
    windowMs: 60_000,
  },
};
