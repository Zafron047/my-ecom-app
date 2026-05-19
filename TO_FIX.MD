# Storefront Performance And Cost Fix Checklist

Status: planned. Work sequentially by phase.

## Core Diagnosis

- [x] Confirmed: the biggest current cost/scaling issue is public storefront catalog work being too dynamic and too heavy.
- [x] Confirmed: this is not primarily a hosting-provider problem.
- [x] Confirmed: checkout/order placement must stay dynamic because stock and pricing validation need fresh database reads.
- [x] Confirmed: admin-only and customer-specific data must not be public cached.

## Phase 1: Immediate Cost Reduction

- [ ] Fix product card image payloads so public storefront cards use `thumb` variants.
- [ ] Fix related-product and category/card image usage so list surfaces do not send originals.
- [ ] Keep product detail main gallery on `detail` variants.
- [ ] Keep product zoom loading on `zoom` variants only when needed.
- [ ] Avoid sending `original` image URLs to public storefront payloads unless a specific UI requires them.
- [ ] Set `NEXT_DISABLE_IMAGE_OPTIMIZATION=true` in Vercel Production and Preview environments.
- [ ] Make `/api/storefront/catalog` CDN-cacheable instead of `force-dynamic` + private cache.
- [ ] Make `/api/storefront/products/[id]` CDN-cacheable for public product content.
- [ ] Make `/api/delivery-locations` CDN-cacheable for public location lookup data.
- [ ] Add explicit `private, no-store` headers to customer, order, checkout mutation, and admin API responses that must never be shared.

## Phase 2: Split Storefront Data And Rendering

- [ ] Split the current heavy `getStorefrontProducts()` query into narrower data functions.
- [ ] Add `getCatalogCards()` for homepage/product listing/collection product cards.
- [ ] Add `getProductDetail()` for product detail pages.
- [ ] Add `getHeaderSearchProducts()` for header search/autocomplete.
- [ ] Add `getCartPricingLookup()` for cart sync/pricing lookup needs.
- [ ] Add `getHomepageSections()` for homepage section configuration and curated product IDs.
- [ ] Convert `/` from full client fetching to Server Component data loading with ISR/cache.
- [ ] Convert `/products` from full client fetching to Server Component data loading with ISR/cache.
- [ ] Convert `/products/[id]` from full client fetching to Server Component product detail loading with ISR/cache.
- [ ] Push `"use client"` down into small interactive controls: cart buttons, gallery/zoom controls, filters/sort controls.
- [ ] Keep checkout stock/pricing validation dynamic and database-backed.
- [ ] Keep customer account and order history dynamic/private.
- [ ] Keep admin pages dynamic/private.

## Phase 3: Abuse Protection And Scaling Hardening

- [ ] Add distributed rate limiting for `/api/checkout/place-order`.
- [ ] Add distributed rate limiting for `/api/cart/price`.
- [ ] Add distributed rate limiting for `/api/cart/abandoned-checkout`.
- [ ] Add distributed rate limiting for `/api/orders/[orderNumber]`.
- [ ] Add distributed rate limiting for `/api/admin/product-images/sign-upload`.
- [ ] Add `sharp` as a direct dependency in `package.json`.
- [ ] Keep Sharp processing on Vercel for now.
- [ ] Enforce product image upload file count and file size limits consistently before signing/upload processing.
- [ ] Avoid processing too many product images concurrently in one request.
- [ ] Add or verify inventory allocation indexes for checkout stock allocation.
- [ ] Add staged/orphaned Supabase Storage cleanup for product images.

## Cache Safety Rules

- [ ] Public-cache only shared storefront catalog/product/location data.
- [ ] Do not public-cache checkout order placement.
- [ ] Do not public-cache cart pricing responses.
- [ ] Do not public-cache customer-specific order data.
- [ ] Do not public-cache customer account/session data.
- [ ] Do not public-cache admin pages or admin APIs.
- [ ] Treat cached stock display as advisory only; validate stock fresh during cart pricing and checkout.
- [ ] Treat cached product price display as advisory only; validate final pricing fresh during cart pricing and checkout.

## Verification Checklist

- [ ] Confirm storefront card images resolve to `thumb` URLs.
- [ ] Confirm product detail main images resolve to `detail` URLs.
- [ ] Confirm zoom image loads `zoom` only during product detail zoom behavior.
- [ ] Confirm no public storefront payload sends `original` URLs unnecessarily.
- [ ] Confirm catalog/product/delivery APIs include safe public CDN cache headers.
- [ ] Confirm private routes include no-store/private headers.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npx prisma validate`.
- [ ] Run `npm run build`.
- [ ] Browser-check `/`.
- [ ] Browser-check `/products`.
- [ ] Browser-check `/products/[id]`.
- [ ] Browser-check checkout to order confirmation.
