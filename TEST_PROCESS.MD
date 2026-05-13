## Test these flows in the UI:

1. **Homepage Refresh Requests**
   - Open homepage with empty cart.
   - Refresh.
   - Expected: no repeated `/api/cart/price`; catalog should not spam.
   - Add one cart item, refresh.
   - Expected: only 1-2 `/api/cart/price`, not 20+.

2. **Global Bundle Offer**
   - Go to `/admin/products/bundles`.
   - Create a bundle offer.
   - Select eligible variants; confirm thumbnails show.
   - Add those variants from storefront.
   - Expected: cart applies bundle discount across eligible variants.

3. **Bundle Delete / Archive**
   - In `/admin/products/bundles`, open a bundle.
   - Try Archive.
   - Try Delete on a test bundle.
   - Expected: archive hides/deactivates; delete removes permanently.

4. **Order Snapshot**
   - Place an order with a bundle discount.
   - Open admin order detail.
   - Expected: product name, variant, price, discount, bundle rule, total are saved.
   - Change product/variant name or bundle title later.
   - Reopen old order.
   - Expected: old order still shows saved order line data.

5. **Deleted Image Fallback**
   - Place an order with product image.
   - Remove that product media.
   - Open old order/invoice/order confirmation.
   - Expected: no broken image icon; shows `Image unavailable`.

6. **Product Delete / Archive**
   - In `/admin/products`, try deleting a product with order history.
   - Expected: skipped with message to archive instead.
   - Try deleting a test product with no order history.
   - Expected: hard delete works.

7. **Brand / Category Delete Archive**
   - In Brands and Categories admin pages:
   - Test Archive.
   - Test Delete on throwaway entries.
   - Expected: archive makes inactive; delete removes.

8. **Delivered Order Lock**
   - Mark an order delivered.
   - Try editing customer/items/totals.
   - Expected: editing is blocked/read-only.


## Stock
Yes, move real cost management out of the variant edit form.

Best structure:

- Variant edit page:
  - Sell price: editable
  - Compare price: editable
  - Cost price: read-only or remove from main edit
  - Show “Current average/FIFO cost” as informational only

- Stock / Purchase Entry page:
  - Search product
  - Select variant
  - Enter quantity received
  - Enter unit cost
  - Supplier optional
  - Invoice/reference optional
  - Batch/lot number auto-generated
  - Save creates an inventory batch

For FIFO:
- Each batch stores `unitCost`, `quantityReceived`, `quantityRemaining`, `receivedAt`.
- When an order is placed, stock is consumed from oldest available batches.
- Order line snapshots the actual consumed cost.

Example:

Batch A: 5 pcs at 100
Batch B: 5 pcs at 90

Customer buys 7:
- 5 consumed from Batch A
- 2 consumed from Batch B
- cost snapshot = `(5x100) + (2x90) = 680`

What to show in variant/admin:
- Available stock: sum of remaining batches
- Current FIFO cost: oldest batch with remaining stock
- Average cost: optional informational
- Last purchase cost: optional informational
- Cost field: read-only or hidden from variant editor

My recommendation:
1. Rename current variant `costPrice` to `referenceCost` or stop using it for accounting.
2. Create `InventoryBatch`.
3. Create `InventoryMovement` later for audit history.
4. Use FIFO batch consumption at order placement.
5. Snapshot cost into order lines for profit reports.

This matches normal retail/ecommerce practice without becoming too complex too early.


- Discard Draft deletes the DB draft -> >>>Destructive<<<
Discard Draft should only change the current changes made in a draft.
Say yesterday I saved the draft form and now I made some changes. I can discard the latest changes only.

- Returning to Purchase Entry loads the latest draft
Not necessary. It should open a new Purchase entry form like always. The Draft list could save inside http://localhost:3000/admin/products/purchase-entry/drafts