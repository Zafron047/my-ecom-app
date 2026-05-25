# Meta Pixel + Conversions API

This implementation is scoped to Meta Pixel plus Meta Conversions API only.
The main optimization event is the standard `Purchase` event.

## Files

- `src/components/MetaPixel.tsx` loads the browser Pixel only when `NEXT_PUBLIC_META_PIXEL_ID` is configured.
- `src/lib/meta-pixel.ts` contains browser-safe event helpers.
- `src/lib/meta-capi.ts` contains server-only Conversions API helpers and SHA-256 hashing.
- `src/app/api/checkout/place-order/route.ts` sends the authoritative server-side CAPI `Purchase` only after a valid order is created.
- `src/app/api/meta/events/route.ts` accepts safe client-originated non-purchase server events. It does not accept client-relayed `Purchase`.

## Environment

Set these in `.env` locally and in Vercel Project Settings for production:

```env
NEXT_PUBLIC_META_PIXEL_ID="1234567890"
META_PIXEL_ID="1234567890"
META_CAPI_ACCESS_TOKEN="EAAB..."
META_CAPI_API_VERSION="v25.0"
META_TEST_EVENT_CODE=""
```

Production setup:

1. Set `NEXT_PUBLIC_APP_URL` to the exact production origin, for example `https://example.com`.
2. Set `NEXT_PUBLIC_META_PIXEL_ID` and `META_PIXEL_ID` to the production Meta Pixel ID.
3. Set `META_CAPI_ACCESS_TOKEN` only in server-side production environment variables.
4. Keep `META_CAPI_API_VERSION` pinned to the tested Graph API version.
5. Set `META_TEST_EVENT_CODE` only during Events Manager testing, then remove it before normal production traffic.

`NEXT_PUBLIC_META_PIXEL_ID` is the only browser-exposed Meta value. `META_CAPI_ACCESS_TOKEN` must stay server-only and must never be prefixed with `NEXT_PUBLIC_`.

If Pixel or CAPI env vars are missing, tracking no-ops gracefully. Missing Meta config or Meta API failures must not block checkout or order creation.

## Purchase Policy

For this store's COD/startup mode, submitted order placement counts as `Purchase`.
The CAPI `Purchase` is sent after the order row and order products are created successfully. Failed validation, blocked customers, rate-limited attempts, stock failures, duplicate failures before creation, cancelled-before-creation, refunded, and abandoned carts do not send `Purchase`.

Browser and server `Purchase` both use the standard event name `Purchase` and the exact same `event_id`. The checkout response returns that server-generated event id, the browser stores it under the order number, and `/order-confirmation` uses it once for the Pixel event.

Browser `Purchase` waits for the server order lookup before firing so the value, currency, item ids, item prices, and quantities come from the saved order when available. A local fallback is used only if the order lookup is unavailable. A local tracked marker prevents refiring on refresh/back navigation.

Purchase payload requirements:

- `order_id`
- `value`
- `currency`
- `content_ids`
- `contents`
- item `quantity`
- item `item_price`

## Match Quality And Privacy

CAPI user data is built server-side. Email, phone, first name, last name, city, country, and external id are normalized and SHA-256 hashed before being sent to Meta.

CAPI also includes `_fbp` and `_fbc` cookies when present, plus client IP, user agent, and `event_source_url` for match quality.

Raw email, phone, and names must never be sent to Meta. The CAPI access token must remain server-only.

Native Meta ROAS depends mainly on attributed `Purchase` value and currency. Optional `CancelOrder` and `ReturnOrder` events are retained as custom/internal analytics signals for profitability analysis, reconciliation, and post-purchase reporting; they do not replace the native Purchase value used for Meta optimization.

## Examples

Product page:

```ts
trackMetaEvent('ViewContent', {
  content_ids: [variantId ?? productId],
  content_name: productName,
  content_type: 'product',
  currency: 'BDT',
  value: price,
});
```

Cart:

```ts
trackMetaAddToCart(cartItem, addedQuantity);
```

Checkout:

```ts
trackMetaInitiateCheckout(selectedCartItems, checkoutTotal);
```

Successful order page:

```ts
trackMetaPurchase({
  eventId: metaEventIdFromServer,
  items: orderItems,
  orderId,
  value: orderTotal,
});
```

Custom events:

```ts
trackMetaCancelOrder({ orderId, value });
trackMetaReturnOrder({ orderId, value });
```

## Testing In Meta Events Manager

1. Open Meta Events Manager.
2. Select the Pixel.
3. Open **Test events**.
4. Copy the test event code into `META_TEST_EVENT_CODE` in production or preview environment variables.
5. Redeploy/restart so the server-side variable is active.
6. Open the public storefront and trigger PageView, ViewContent, Search, AddToCart, InitiateCheckout, and a test COD order.
7. Confirm browser and server `Purchase` appear with event name `Purchase`.
8. Confirm CAPI `Purchase` includes user_data parameters, `_fbp`/`_fbc` when cookies exist, client IP, user agent, and event source URL.
9. Remove `META_TEST_EVENT_CODE` and redeploy/restart after testing.

## Deduplication

Purchase sends browser + server copies with the same `event_id`.
In Events Manager, open a matching Purchase event pair and confirm Meta shows deduplication instead of counting two separate conversions. Refresh `/order-confirmation?orderId=...` and use back/forward navigation to confirm the browser `Purchase` does not refire.

## Production Checklist

- Confirm the production Pixel ID belongs to the intended Business Manager.
- Confirm the CAPI access token has permission for the same Pixel and is server-only.
- Confirm consent/privacy requirements before loading marketing pixels in production.
- Confirm no Pixel is loaded on admin, API, auth/session, or internal routes.
- Place one valid COD test order and confirm exactly one deduped Purchase in Events Manager.
- Attempt failed checkout validation and blocked-customer flows and confirm no Purchase is sent.
- Confirm Meta Pixel Helper shows no major storefront console errors.
- Confirm checkout still succeeds if Meta scripts are blocked by the browser.
- Confirm the test event code is removed after verification.

## Vercel Deployment

Add all Meta variables in Vercel Project Settings, redeploy, then test production with `META_TEST_EVENT_CODE` temporarily set. Remove the test event code after verification so production events are not marked as test traffic.
