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
- [x] Create branch cleanup/test-content-removal
- [x] Take a DB backup first
- [x] create a dry-run cleanup script
- [x] review the output
- [x] then run the actual cleanup only after the affected orders/inventory/bundles/media/customer records are confirmed

### API
- [x] Expose API for wowmall to fetch Products

### Invoice Template
- WoWMall
- [x] Must fit in A5 size paper

- [ ] WoWMall
- [ ] Ensure resel orders are print with relevant invoice templates with logo on supplier webapp

## WoWMall
- [ ] Create WoWMall App Repo and domain deploy
- [ ] Fetch Products from Buy Easy
- [ ] Ensure no latenency
- [ ] Ensure products display from the supplier catalog
- [ ] Sales orders go to BDBuy supplier to fulfill
- [ ] Implement RedX API
- [ ] Integrate Pixel and Convesion API with Meta

- Later:
- [ ] Create Customer service Chatbot
- [ ] Connect chatbot to meta messenger

### Page
- [ ] Redesign WoWMall us Page to WoWMallxyz / wowmall.xyz

### Resell Orders
- [ ] Ensure Resell orders has clear headers WoWMall Order
- [ ] Ensure forwarded orders to supplier has clear Header FulFiller: BDBuy supplier

## Launch AD
- [ ] WoWMall
- [ ] WoWMall
