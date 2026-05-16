## Purchase Entry -> PO Chain

- [ ] Test with an admin or manager account with product write access.
- [x] Purchase Entry required Fields: at least 1 Variant with qty
- [x] New Purchase Entry Button: Fix color, Also Add this button in Purchase Orders page

### Routes

- [X] Purchase Orders opens at `/admin/purchase-order` and lists all submitted POs.
- [x] Purchase Entry opens at `/admin/purchase-order/purchase-entry` and lists saved purchase entries.
- [x] `New Purchase Entry` opens the form at `/admin/purchase-order/purchase-entry?new=1`.
Fix: New Purchase Entry Btn colors

- [x] Closed opens at `/admin/purchase-order/closed` and lists all closed POs.
Fix: Lists open POs

- [x] Old `/admin/purchase-order/entries` route redirects to `/admin/purchase-order/purchase-entry`.
- [x] Old `/admin/purchase-order/drafts` route redirects to `/admin/purchase-order/purchase-entry`.
Old unused URLs Should not exist

### 1. Purchase Entry Form

- [x] Open Purchase Entry. Click `New Purchase Entry`. No payment section is visible.
- [x] Form only has supplier/reference/date, product lines, notes, and entry actions.

Validation:

- [x] With no line item, `Submit to PO` is disabled.
- [x] With no line item, a clear message says at least one purchase line is required.
- [x] Add a product but do not select a variant.
- [x] With no variant selected, `Submit to PO` is disabled.
- [x] With no variant selected, a clear message says variant is required.
- [x] Set quantity to `0`.
- [x] With quantity `0`, `Submit to PO` is disabled.
- [x] With quantity `0`, a clear message says quantity must be greater than 0.
- [x] Leave unit cost blank. With blank unit cost, Purchase Entry can be saved.
- [x] With blank unit cost, `Submit to PO` stays disabled.
- [x] With blank unit cost, saved entry appears under Purchase Entry, not Purchase Orders.
- [x] Set unit cost to `0`. With unit cost `0`, `Submit to PO` is disabled.
- [x] With unit cost `0`, a clear message says unit cost must be greater than 0.
- [ ] Fill product, variant, quantity greater than 0, and unit cost greater than 0. With complete valid lines, `Submit to PO` is enabled.

### 2. Save Purchase Entry

- [x] Create an incomplete Purchase Entry and click `Save Purchase Entry`. Success message uses "Purchase entry", not "Draft".
- [x] Entry appears at `/admin/purchase-order/purchase-entry`.
- [x] Action button says `Open Entry`.
- [x] Open the entry.
- [x] Product lines load back into the Purchase Entry form.
- [x] Save Purchase Entry without any product. Expected: Select at least 1 variant with qty
Fix: Empty purchase entries are blocked.

### 3. Submit Purchase Entry To PO

- [x] Create a complete Purchase Entry.
- [x] Click `Submit to PO`.
- [x] Redirects to `/admin/purchase-order/records/[id]`.
- [x] Submitted item no longer appears in Purchase Entry.
- [x] PO appears in Purchase Orders.
- [x] Initial PO status is Open.
- [x] Payment status is Due.
- [x] Paid amount is `0`.
- [x] Payable equals total cost.

### 4. PO Product List Card

- [x] Open the PO detail page. Product List card is default open.
- [x] Product List card is collapsible.
- [x] Product list is read-only.
- [x] No add/remove product controls are available on the PO.
- [x] Ordered quantity matches the Purchase Entry.
- [x] Unit cost matches the Purchase Entry.
- [x] Line total matches the Purchase Entry.

### 5. PO Payment Card

- [x] Payment card is default open.
- [x] Payment card is collapsible.
- [x] Method label reads `Payment Method`.
- [x] Default view shows only `Update`.
- [x] Click `Update`. Payment fields become editable.
- [x] Buttons show `Save Payment` and `Cancel`.
- [x] `Update` is not visible while editing.

Validation:

- [x] Set payment to Paid without Payment Method. Paid without Payment Method is blocked with a clear payment method error.
- [x] Set payment to Partially Paid without Payment Method. Partially Paid without Payment Method is blocked with a clear payment method error.
- [x] Partially Paid with amount `0` is blocked with a clear partial payment error.
- [x] Set payment to Partially Paid with amount greater than 0 and less than total. Valid partial payment saves successfully.
- [x] Valid partial payment keeps PO Open.
- [x] Valid partial payment updates payable amount.
- [x] Make a second partial payment with the same amount and method.
- [x] Second partial payment adds to the paid total.
- [x] Second partial payment updates payable amount.

- [x] Set payment to Paid with a Payment Method. Valid paid payment saves successfully.
<!-- - [ ] Paid amount equals total cost. -->
- [x] PO remains Open if goods are not fully received.
- [x] While editing payment, change values and click `Cancel`.
- [x] Payment values reset to the last saved values.

### 6. PO Goods Receive Card

- [x] Goods Receive card is always visible.
- [x] Goods Receive card is not collapsible.
- [x] Each line shows Batch Number.
- [x] Default view shows only `Update`.
- [x] Click `Update`. Receive quantities become editable.
- [x] Buttons show `Save Receive` and `Cancel`.
- [x] `Update` is not visible while editing.
Remove: Full Receive functionality with button.

Validation:

- [x] Save with all receive quantities as `0`. All-zero receive save is blocked with a clear receive quantity error.
- [x] Enter a negative receive quantity. Negative receive quantity is blocked with a clear whole-number error.
- [x] Enter a decimal receive quantity. Decimal receive quantity is blocked with a clear whole-number error.
- [x] Enter receive quantity greater than remaining quantity. Over-receive is blocked with a clear over-receive error.
- [x] Partially receive a line. Partial receive saves successfully.
- [x] Batch number is created/shown.
- [x] Received quantity updates.
- [x] Left quantity updates.
- [x] PO remains Open after partial receive.
- [x] Fully receive all lines while payment is not fully paid.
- [x] PO remains Open when fully received but not fully paid.
- [x] While editing receiving, change quantities and click `Cancel`.
- [x] Receive inputs reset to `0`.

### 7. Close PO

- Open an Open PO.
- [x] Set payment status to Paid with Payment Method.
- [x] Fully receive all goods.
- [x] PO status becomes Closed.
- [x] PO remains in Purchase Orders with Closed status.
- [x] PO appears in Closed.
- [x] Closed contains only POs with a closed lifecycle status.
- [x] Closed does not show Open POs.

### 8. Reopen Behavior

- [x] Open a Closed PO.
- [x] Change payment from Paid to Due.
- [x] Save succeeds.
- [x] Status becomes Open because the PO is no longer fully paid.
- [x] PO still appears in Purchase Orders with Open status.
- [x] PO no longer appears in Closed.

- [x] Change payment from Paid to Partially Paid.
- [x] Save succeeds.
- [x] Status becomes Open because the PO is no longer fully paid.
- [x] PO still appears in Purchase Orders with Open status.
- [x] PO no longer appears in Closed.

### 9. Inventory Check

- [x] Before receiving, note the variant stock quantity.
- [x] Receive a partial quantity.
- [x] Variant stock increases only by the received quantity.
- [x] Receive the remaining quantity.
- [x] Variant stock increases by the remaining quantity only.
- [x] Receiving the same quantity twice is not possible after it has already been received.
