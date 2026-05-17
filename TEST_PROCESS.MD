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
