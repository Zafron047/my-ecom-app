## PO Draft -> Purchase Order Chain

Feature block status: finalized.
### Current routes
- [x] Purchase Orders opens at `/admin/purchase-order` and lists submitted/open POs.
- [x] New PO Draft opens at `/admin/purchase-order/draft?new=1`.
- [x] Existing PO Drafts open at `/admin/purchase-order/draft?draftId=[id]`.
- [x] Submitted POs open at `/admin/purchase-order/purchase-orders/[id]`.
- [x] Closed opens at `/admin/purchase-order/closed` and lists closed lifecycle POs.
- [x] Old redundant purchase-order records/entries/drafts pages were removed.
### PO Draft
- [x] Draft form supports supplier, reference, date, product lines, and actions.
- [x] Draft form no longer keeps inline notes; notes live in the timeline panel.
- [x] Draft save requires at least one variant with quantity greater than 0.
- [x] Draft save allows incomplete cost data so work can be resumed later.
- [x] Submit to PO requires complete valid lines with unit cost greater than 0.
- [x] New and existing drafts create lifecycle timeline events.
- [x] Draft notes can be added, edited, and deleted from the timeline.
- [x] Draft delete is available from the draft header.
- [x] Unsaved navigation guard can save a valid draft before leaving.
### Purchase Order
- [x] Submitted POs leave the draft list and appear in Purchase Orders.
- [x] Product list is read-only on submitted POs.
- [x] Payment card supports due, partial, and paid states.
- [x] Payment method is required for paid or partially paid POs.
- [x] Partial payments must be greater than 0 and less than the remaining payable amount.
- [x] Payment changes add lifecycle timeline events.
- [x] Goods receive validates whole-number quantities and prevents over-receiving.
- [x] Receiving goods creates or reuses batches and increments variant stock by received quantity only.
- [x] Receive changes add lifecycle timeline events.
- [x] PO notes can be added, edited, and deleted from the timeline.
- [x] PO details, cancellation, payment, receive, and close events refresh the timeline.
### Lifecycle
- [x] Fully paid plus fully received POs become Closed.
- [x] Closed POs appear in Closed.
- [x] Closed POs no longer appear in the open Purchase Orders list.
- [x] Reverting payment from Paid reopens the PO lifecycle.
- [x] Cancelled/closed locked POs are protected from receive/payment edits.
### Verification
- [x] `npm run lint` passed with warnings only for existing `<img>` usage.
- [x] `npm test` passed: 8 files, 34 tests.
- [x] `npx prisma validate` passed.
- [x] `npm run build` passed on Next.js 16.2.2 with the expected purchase-order routes.

## Storefront Cost, Cache, And Hardening Regression

Feature block status: ready for regression check after `TO_FIX.MD` completion.

### Command Checks

- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run lint` and confirm only known `<img>` warnings remain.
- [ ] Run `npm test`.
- [ ] Run `npx prisma validate`.
- [ ] Run `npm run build`.
- [ ] Run `npx prisma migrate deploy` on the target environment before runtime testing so `RateLimitBucket` exists.

### Public Storefront

- [x] Open `/` and confirm homepage sections load without loading spinners getting stuck.
- [x] Confirm homepage product cards show images and prices.
- [x] Confirm homepage card image URLs use `/thumb/` variants, not `/original/`.
- [x] Confirm header search/autocomplete returns products while typing.
Search: typed slip kitchen mat expected: Anti-slip 3D Printed Geometric Kitchen Mat. but shown nothing

- [ ] Confirm header search images render and use lightweight card/search image URLs.
- [x] Open `/products` and confirm product grid loads from the server-rendered page.
- [x] Use product filters/sort controls and confirm the list updates correctly.
- [x] Open a collection page from category navigation and confirm products still render.
Clicking a category in homepage does absolutely nothing.

- [x] Open `/products/[id]` from a product card and confirm detail data loads.
- [x] Confirm product gallery main images use `/detail/` variants.
- [x] Open zoom/gallery behavior and confirm zoom uses `/zoom/` only when needed.
- [x] Confirm no public storefront catalog/product API payload includes unnecessary `/original/` image URLs.

### Cart And Checkout

- [x] Add a product with a default or selected variant to cart from a product card.
- [x] Add a product from the product detail page and confirm quantity/variant label are correct.
- [x] Increase and decrease quantity in cart and confirm totals update.
- [x] Confirm bundle discount messaging and totals still update if the selected product has bundle tiers.
- [x] Open checkout with selected cart items.
- [x] Confirm delivery division, district, and thana dropdowns load and filter correctly.
Should remove Division form UI. Selecting District is enough to locate the drtrict belongs to the division

- [x] Place a Cash on Delivery test order and confirm redirect to `/order-confirmation?orderId=...`.

- [x] Confirm order confirmation can load the order details after redirect.
- [ ] Confirm stale/inactive/out-of-stock cart items show a clear error instead of placing an order.
These should never be able to add in the caart.

### Cache Headers And Privacy

- [x] Confirm `GET /api/storefront/catalog` returns `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`.
- [x] Confirm `GET /api/storefront/products/[id]` returns public CDN cache headers.
- [x] Confirm `GET /api/storefront/search` returns public CDN cache headers.
- [x] Confirm `GET /api/delivery-locations` returns public CDN cache headers.
- [x] Confirm `POST /api/cart/price` returns `private, no-store`.
- [x] Confirm `POST /api/checkout/place-order` returns `private, no-store` on success and validation errors.
- [x] Confirm `POST /api/cart/abandoned-checkout` returns `private, no-store`.
- [x] Confirm `GET /api/orders/[orderNumber]` returns `private, no-store`.
- [x] Confirm admin APIs, customer account APIs, and session APIs do not return public cache headers.

### Abuse Protection

- [x] Confirm repeated checkout submissions eventually return `429` with `Retry-After` and `X-RateLimit-*` headers.
- [x] Confirm repeated cart pricing requests eventually return `429` with rate-limit headers.
- [x] Confirm repeated abandoned checkout sync requests eventually return `429`.
- [x] Confirm repeated order lookup requests eventually return `429`.
- [x] Confirm repeated admin image sign-upload requests eventually return `429`.
- [x] Confirm rate limiting still allows normal single-user checkout and cart usage.

### Admin Product Images

- [ ] Open `/admin/products/new` or an existing product edit page.
- [ ] Confirm product image upload accepts JPG, PNG, WEBP, and AVIF only.
- [ ] Confirm files larger than 4MB are rejected before upload/signing.
- [ ] Confirm more than 10 product images are rejected consistently in UI and server save.
- [ ] Save product media and confirm `thumb`, `detail`, and `zoom` variants are generated.
- [ ] Confirm image processing does not time out for a normal multi-image save.
- [ ] Run `npm run ops:cleanup:staged-images` in dry-run mode and confirm it reports stale staged objects without deleting.
- [ ] Run `DRY_RUN=false npm run ops:cleanup:staged-images` only after reviewing dry-run output.

### Inventory And Order Safety

- [x] Confirm checkout still validates fresh stock and price at order placement.
- [x] Confirm cart pricing still validates fresh product/variant prices before checkout.
- [x] Confirm inventory allocation records are created for a placed order.
- [x] Confirm stock cannot be oversold by rapidly placing competing orders for the same low-stock variant.

### Visual Smoke

- [ ] Browser-check desktop `/`.
- [ ] Browser-check mobile `/`.
- [ ] Browser-check desktop `/products`.
- [ ] Browser-check mobile `/products`.
- [ ] Browser-check desktop `/products/[id]`.
- [ ] Browser-check mobile `/products/[id]`.
- [ ] Browser-check checkout to order confirmation in an isolated browser profile.
- [ ] Confirm no major console errors appear during the above flows.

### Known Follow-Up Backlog

- [ ] Review `to_do.md` separately; it contains a broader Sales Orders backlog outside this storefront hardening scope.
