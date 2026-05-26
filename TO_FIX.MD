## Suggested Permission Policy

SupaAdmin:
- Full access to everything.
- Invisible supaadmin info doesn't appear in ui.

Admin:
- Admin can do everything
except:
  - View / manage Admin Access, Backup

Manager:
- Can do everything
except:
  - View settings
  - Upgrade draft PO to -> PO
  - View PO item cost line
  - View / update PO Payment section

Operator:
- Can view: Products/, Orders/SalesOrders, orders/abandoned-checkouts,
- Can Manage: CRU product, SalesOrder

Support:
- Can view Products, Stock, Orders, Abandoned Checkouts
- Can manage Order


## Implement Admin Password reset feature
- log in to each role and test RBAC
- [x] SupaAdmin
- [x] Admin
- [x] Manager
- [x] Operator

### Admin Auth
- [x] Reset Password with Resend

## Pixel
- [x] Merge Pixel Branch with dev
- [x] Integrate Pixel with Meta
- [x] Ensure Convertion API is on
- [x] Fix Meta Search test: Search product expected Search event, but nothing appeared in Meta Test Events

## To Do Tomorrow

## Clean Up Test contents
- Note: This cleanup is large enough to do on a separate branch.
- [ ] Create branch cleanup/test-content-removal
- [ ] Take a DB backup first
- [ ] create a dry-run cleanup script
- [ ] review the output
- [ ] then run the actual cleanup only after the affected orders/inventory/bundles/media/customer records are confirmed

- [x] Find anything with test in app then list below (DB scan for `test` in catalog/order-related records; no cleanup done)
- [ ] All Test Products
- [ ] Test Sharp update (active, slug: test-sharp-update, sku: TEST-SHARP-UPDATE-BEIGE, stock: 0; variants 1, images 1, product bundle offers 0, order lines 0, PO lines 0, homepage links 0)
- [ ] Test 3 in 1 Food Processor (active, slug: test-3-in-1-food-processor, sku: TEST-3-IN-CYAN, stock: 0; variants 3, images 6, product bundle offers 0, order lines 4, PO lines 6, homepage links 0)
- [ ] TEST Product Silicone Spatula Set 12pcs (active, slug: test-product-silicone-spatula-set-12pcs, sku: TEST-PRODUCT-SILICONE-12-PCS-SET-BABY-PINK, stock: 0; variants 7, images 4, product bundle offers 0, order lines 0, PO lines 0, homepage links 0)
- [ ] Test Product Title (active, slug: test-product-title, sku: TEST-PRODUCT-TITLE-ANY-SIZE-BLACK, stock: 0; variants 1, images 1, product bundle offers 0, order lines 3, PO lines 1, homepage links 0)
- [ ] TEST PRODUCT HP Pavilion Laptop (draft, slug: test-product-hp-pavilion-laptop, sku: TEST-PRODUCT-HP-BLUE, stock: 0; variants 1, images 1, product bundle offers 0, order lines 0, PO lines 0, homepage links 0)
- [ ] Test Product Lipton Taaza Tea Bags (active, slug: test-product-lipton-taaza-tea-bags, sku: LIPTON-TAAZA-TEA-150-TEA-BAGS-GREEN, stock: 0; variants 1, images 2, product bundle offers 0, order lines 0, PO lines 0, homepage links 0)
- [ ] Test Product (draft, slug: test-product, sku: none, stock: 0; variants 0, images 1, product bundle offers 0, order lines 0, PO lines 0, homepage links 0)
- [ ] "TEST_ITEM" Microwave Cover (draft, slug: test-item-microwave-cover, sku: MICROWAVE-COVER-BLACK-L, stock: 25; variants 2, images 0, product bundle offers 0, order lines 0, PO lines 2, homepage links 0)
- [ ] "TEST_ITEM" Nail Polish Display Organizer (active, slug: test-item-nail-polish-display-organizer, sku: NAIL-POLISH-DISPLAY-31-29-5-18-5-CM, stock: 200; variants 2, images 6, product bundle offers 0, order lines 0, PO lines 2, homepage links 1)
- [ ] "TEST_ITEM" Closeup Freshness Toothpaste (active, slug: test-item-closeup-freshness-toothpaste, sku: CLOSEUP-FRESHNESS-TOOTHPASTE, stock: 0; variants 1, images 1, product bundle offers 0, order lines 0, PO lines 1, homepage links 1)
- [ ] "TEST_ITEM" Gillette twin blade razor max (active, slug: test-item-gillette-twin-blade-razor-max, sku: GILLETTE-TWIN-BLADE-L, stock: 100; variants 1, images 1, product bundle offers 0, order lines 0, PO lines 1, homepage links 1)
- [ ] "TEST_ITEM" Crack Heel Cream (active, slug: test-item-crack-heel-cream, sku: none, stock: 0; variants 3, images 6, product bundle offers 0, order lines 2, PO lines 8, homepage links 1)
- [ ] "TEST ITEM" Womens Chest Bag (active, slug: test-item-womens-chest-bag, sku: TEST-ITEM-WOMENS-LEOPARD, stock: 420; variants 5, images 6, product bundle offers 7, order lines 5, PO lines 15, homepage links 1)
- [ ] "TEST_ITEM" Oxford Simple Crossbody Bag (active, slug: test-item-oxford-simple-crossbody-bag, sku: none, stock: 0; variants 3, images 6, product bundle offers 0, order lines 2, PO lines 5, homepage links 1)
- [ ] "TEST_ITEM" Metal Strap Quartz Wrist Watch (active, slug: test-item-metal-strap-quartz-wrist-watch, sku: none, stock: 0; variants 4, images 6, product bundle offers 0, order lines 5, PO lines 4, homepage links 1)
- [ ] All Orders
- [ ] ORD-9724111730-4535 (pending, 2026-05-25, Nohain Islam, 01671234567, total 10079; items: 1x Test Product Title; events 0, notes 0, returns 0)
- [ ] ORD-9724022946-4924 (pending, 2026-05-25, Nohain Islam, 01671234567, total 10079; items: 1x Test Product Title; events 0, notes 0, returns 0)
- [ ] ORD-9721994908-7353 (pending, 2026-05-25, Nohain Islam, 01671234567, total 3580; items: 1x Test 3 in 1 Food Processor; events 0, notes 0, returns 0)
- [ ] ORD-9445575717-3885 (pending, 2026-05-22, Nohain Islam, 01671234567, total 5680; items: 2x "TEST ITEM" Womens Chest Bag; events 0, notes 0, returns 0)
- [ ] ORD-9181521624-5613 (returned, 2026-05-19, Nohain Islam, 01671234567, total 9079.1; items: 1x Test Product Title; events 22, notes 4, returns 0)
- [ ] ORD-9180697239-7859 (pending, 2026-05-19, Nohain Islam, 01671234567, total 3580; items: 1x Test 3 in 1 Food Processor; events 0, notes 0, returns 0)
- [ ] ORD-9171633810-5789 (pending, 2026-05-19, Smoke Tester, 01733718312, total 3650; items: 1x Test 3 in 1 Food Processor; events 0, notes 0, returns 0)
- [ ] ORD-9108744472-2466 (pending, 2026-05-18, Nohain Islam, 01671234567, total 3580; items: 1x Test 3 in 1 Food Processor; events 0, notes 0, returns 0)
- [ ] ORD-9100111297-9125 (pending, 2026-05-18, Nohain Islam, 01671234567, total 9600; items: 4x "TEST ITEM" Womens Chest Bag [bundle: TEST 4PCS SET]; events 0, notes 0, returns 0)
- [ ] ORD-7983090483-2714 (delivered, 2026-05-05, Abdul Jabbar, 01712345678, total 8590; items: 5x Womens Chest Bag; 3x Womens Chest Bag; events 3, notes 1, returns 1)
- [ ] ORD-7803174685-8847 (pending, 2026-05-03, Nohain Islam, 01671234567, total 2930; items: 1x Crack Heel Cream; 2x Crack Heel Cream; events 0, notes 0, returns 0)
- [ ] ORD-7731172882-1584 (pending, 2026-05-02, Fahim Yusuf, 01977882216, total 2880; items: 1x Womens Chest Bag; events 0, notes 0, returns 0)
- [ ] ORD-7730023680-4171 (pending, 2026-05-02, Fahim Yusuf, 01977882216, total 56780; items: 1x Metal Strap Quartz Wrist Watch; 1x Metal Strap Quartz Wrist Watch; 1x Metal Strap Quartz Wrist Watch; events 0, notes 0, returns 0)
- [ ] ORD-7716834096-7796 (pending, 2026-05-02, Fahim Yusuf, 01977882216, total 1580; items: 2x Oxford Simple Crossbody Bag; 1x Oxford Simple Crossbody Bag; events 0, notes 0, returns 0)
- [ ] ORD-7709718458-7721 (pending, 2026-05-02, First Name, 01712345678, total 37880; items: 1x Metal Strap Quartz Wrist Watch; 1x Metal Strap Quartz Wrist Watch; events 0, notes 0, returns 0)
- [ ] All Bundle offers
  Product-level bundle offers:
- [ ] Buy 10 Bags get 20% OFF (2) (inactive, min qty 10, discount 20%, variant links 4, product: "TEST ITEM" Womens Chest Bag)
- [ ] Buy 5 Bags get 10% OFF (1) (inactive, min qty 5, discount 10%, variant links 4, product: "TEST ITEM" Womens Chest Bag)
- [ ] Clearance - Buy 3 Red Bags get 60% OFF (active, min qty 3, discount 60%, variant links 0, product: "TEST ITEM" Womens Chest Bag)
- [ ] Clearance!!! Buy 5 Leopard Bags get 50% OFF (active, min qty 5, discount 50%, variant links 1, product: "TEST ITEM" Womens Chest Bag)
- [ ] Buy 3 Bags get 10% OFF (active, min qty 3, discount 10%, variant links 4, product: "TEST ITEM" Womens Chest Bag)
- [ ] Buy 5 Bags get 20% OFF (active, min qty 5, discount 20%, variant links 4, product: "TEST ITEM" Womens Chest Bag)
- [ ] Buy 10 Bags get 30% OFF (inactive, min qty 10, discount 30%, variant links 4, product: "TEST ITEM" Womens Chest Bag)
  Global bundle offers:
- [ ] TEST 4PCS SET (active, min qty 4, discount 15%, variant links 5)
- [ ] "TEST BUNDLE" Buy 10 Bags get 20% OFF (2) (inactive, min qty 10, discount 20%, variant links 4)
- [ ] "TEST BUNDLE" Buy 5 Bags get 10% OFF (1) (inactive, min qty 5, discount 10%, variant links 4)
- [ ] "TEST BUNDLE" Clearance - Buy 3 Red Bags get 60% OFF (inactive, min qty 3, discount 60%, variant links 0)
- [ ] "TEST BUNDLE" Clearance!!! Buy 5 Leopard Bags get 50% OFF (active, min qty 5, discount 50%, variant links 1)
- [ ] "TEST BUNDLE" Buy 3 Bags get 10% OFF (active, min qty 3, discount 10%, variant links 4)
- [ ] "TEST BUNDLE" Buy 5 Bags get 20% OFF (active, min qty 5, discount 20%, variant links 4)
- [ ] "TEST BUNDLE" Buy 10 Bags get 30% OFF (inactive, min qty 10, discount 30%, variant links 4)
- [ ] Anything else?
- [ ] Test/customer records tied to these orders: Smoke Tester (01733718312, smoke-1779171631870@example.test, orders 1, sessions 0); Nohain Islam (01671234567, abc@gmail.com, orders 10, sessions 0); Fahim Yusuf (01977882216, no email, orders 3, sessions 0); Abdul Jabbar (01712345678, jabbar@email.com, orders 2, sessions 0)
- [ ] Product media/storage paths for test products: 48 ProductImage rows
- [ ] Homepage placements for test products: 7 rows (Super Sale)
- [ ] Categories containing these products: "TEST CATEGORY" Bags & Lugage (4 products); "TEST CATEGORY" Beauty & Personal Care (7 products); "TEST CATEGORY" Fashion Accessories (4 products); "TEST CATEGORY" Fitness & Outdoors (4 products); "TEST CATEGORY" Home & Kitchen (6 products); "TEST CATEGORY" Smart Gadgets (2 products); Cosmetics & Jewelry Organizer (15 products)
- [ ] Brands containing these products: Made in China (1 products)
- [ ] Anything related to above that should be cleaned up? List as related below
### Related Tables Data
- ProductVariant rows: 35
- OrderProduct rows: 21
- ProductImage rows: 48
- HomepageSectionProduct rows: 7
- PurchaseOrder rows with test products: 17
- [ ] PO PO-OPENING-20260518 (closed/paid, supplier: Opening stock, lines 99, events 3, notes 0, qty 19011, cost 3380250)
- [ ] PO PO-20260518-6587 (closed/paid, supplier: Test-Supplier 101, lines 3, events 9, notes 0, qty 200, cost 325000)
- [ ] PO PO-20260518-7528 (closed/paid, supplier: Chengdu Guangzhou, lines 3, events 9, notes 0, qty 200, cost 255000)
- [ ] PO PO-20260517-1653 (open/due, supplier: Test supplier, lines 1, events 3, notes 1, qty 10, cost 99990)
- [ ] PO PO-20260517-7333 (open/due, supplier: Care Me, lines 2, events 4, notes 2, qty 600, cost 1000000)
- [ ] PO PO-20260517-2547 (draft/due, supplier: Care Me, lines 3, events 1, notes 0, qty 600, cost 1400000)
- [ ] PO PO-20260517-9235 (open/due, supplier: none, lines 1, events 0, notes 0, qty 10, cost 20000)
- [ ] PO PO-20260517-1579 (open/paid, supplier: none, lines 1, events 0, notes 0, qty 1, cost 2000)
- [ ] PO PO-20260516-9836 (open/due, supplier: Test-Supplier, lines 2, events 0, notes 0, qty 200, cost 390000)
- [ ] PO PO-20260516-4515 (open/due, supplier: Test-Supplier, lines 5, events 0, notes 0, qty 104, cost 208000)
- [ ] PO PO-20260514-7627 (closed/paid, supplier: none, lines 1, events 0, notes 0, qty 100, cost 10000)
- [ ] PO PO-20260514-5904 (closed/paid, supplier: Test-Supplier, lines 1, events 0, notes 0, qty 10, cost 20000)
- [ ] PO PO-20260514-4221 (open/due, supplier: Test-Supplier, lines 1, events 0, notes 0, qty 5, cost 10000)
- [ ] PO PO-20260514-3935 (open/partial_paid, supplier: Test-Supplier, lines 1, events 0, notes 0, qty 10, cost 2500)
- [ ] PO PO-20260514-9793 (open/due, supplier: Test-Supplier, lines 1, events 0, notes 0, qty 5, cost 10000)
- [ ] PO PO-20260513-3977 (closed/paid, supplier: Test-Supplier, lines 3, events 0, notes 0, qty 6, cost 710)
- [ ] PO PO-20260512-8938 (open/due, supplier: Test-Supplier, lines 1, events 0, notes 0, qty 10, cost 21000)
- InventoryBatch rows for test variants: 33
- InventoryAllocation rows for test variants: 9
- ProductBundleOfferVariant rows are represented by variant links on product-level bundle offers above
- BundleOfferVariant rows are represented by variant links on global bundle offers above

### API
- [ ] Expose Public API for Products

### Invoice Template
- [ ] BDBuyEasy
- [ ] WoWMall
- [ ] Ensure resel orders are print with relevant invoice templates with logo on supplier webapp

## WoWMall
- [ ] Create WoWMall App Repo and domain deploy
- [ ] Fetch Products from Buy Easy
- [ ] Ensure no latenency
- [ ] Ensure Products display as like bdbuyeasy
- [ ] Sales orders go to bdbuyeasy to fullfill
- [ ] Implement RedX API
- [ ] Integrate Pixel and Convesion API with Meta

- Later:
- [ ] Create Customer service Chatbot
- [ ] Connect chatbot to meta messenger

### Page
- [ ] Redesign WoWMall us Page to WoWMallxyz / wowmall.xyz

### Resell Orders
- [ ] Ensure Resell orders has clear headers WoWMall Order
- [ ] Ensure forwarded orders to supplier has clear Header FulFiller: BDBuyEasy

## Launch AD
- [ ] BDBuyEasy
- [ ] WoWMall
