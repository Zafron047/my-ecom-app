#### Cart Test
## Scenario 1
3 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit

serial Title Eligible Variants Min Qty Discount % 
1. Buy 10 Bags get 30% OFF all 10 30%
2. Buy 5 Bags get 20% OFF all 5 20%
3. Buy 3 Bags get 10% OFF all 3 10%

5 variants 10 ttl active discount: Buy 10 Bags get 30% OFF >>>OK<<<
5 variants 5 ttl active discount: Buy 3 Bags get 10% OFF >>>BUG<<<
3 variants 3 ttl active discount: Buy 3 Bags get 10% OFF >>>OK<<<

## Scenario 2 
4 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title Eligible Variants Min Qty Discount %  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 10 Leopard Bags ge1 50% OFF Leopard 10 50%    

Cart:
Leopard 10 ttl active discount: Clearance - Buy 10 Leopard Bags get 50% OFF >>>OK<<<

## Scenario 3
4 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 10 50%    

Cart:
- Leopard 5 8000.00 x 5 >>>OK<<<
- Black 5 2300.00 x 5 >>>OK<<<

- Product subtotal ৳51500.00 >>>OK<<<
- active Bundle offers:
  Clearance - Buy 5 Leopard Bags get 50% OFF -৳20000.00 <<<Fixed>>>
  Buy 5 Bags get 20% OFF -৳2300.00 <<<Fixed>>>

## Scenario 4
4 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 10 50%    

Cart:
- Leopard 5 2800.00 x 5 <<<OK>>>
- Gray 3 1900.00 x 3 <<<Fixed>>>

- active Bundle offers:
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 3 Bags get 10% OFF -৳570.00 <<<FIXED>>>

Product subtotal ৳19700.00
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 3 Bags get 10% OFF -৳570.00
Bundle discount -৳7570.00
After discount ৳12130.00


## Scenario 5
4 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 10 50%    

Cart:
- Leopard 2800.00 x 5
- Gray 1900.00 x 5

- Product subtotal ৳23500.00

- Bundle Offers
  - Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
  - Buy 5 Bags get 20% OFF -৳1900.00

- Bundle discount -৳8900.00
- After discount ৳14600.00


## Scenario 7
4 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 10 50%    

Cart:
- Leopard 2800.00 x 5
- Gray 1900.00 x 4

Product subtotal ৳21600.00
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 3 Bags get 10% OFF -৳760.00
Bundle discount -৳7760.00
After discount ৳13840.00


## Scenario 8
4 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 10 50%    

Cart:
- Leopard 2800.00 x 5
- Gray 1900.00 x 10

Product subtotal ৳33000.00
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 10 Bags get 30% OFF -৳5700.00
Bundle discount -৳12700.00
After discount ৳20300.00


## Scenario 9
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 5 50%    
5. Clearance - Buy 3 Red Bags get 60% OFF Red 3 60%

Cart:
- Leopard ৳2800.00 x 5
- Gray ৳1900.00 x 1
- Red ৳1200.00 x 3

Product subtotal ৳19500.00
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Clearance!!! Buy 3 Red Bags get 60% OFF -৳2160.00
Bundle discount -৳9160.00
After discount ৳10340.00

## Scenario 10
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 5 50%    
5. Clearance - Buy 3 Red Bags get 60% OFF Red 3 60%

Cart:
- Leopard ৳2800.00 x 5
- Gray ৳1900.00 x 2
- Red ৳1200.00 x 3
ttl qty 10

Product subtotal ৳21400.00
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Clearance - Buy 3 Red Bags get 60% OFF -৳2160.00
Bundle discount -৳9160.00
After discount ৳12240.00

## Scenario 11 Global-vs-greedy check
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 5 50%    
5. Clearance - Buy 3 Red Bags get 60% OFF Red 3 60%

Cart:
- Gray ৳1900.00 x 7
- Red ৳1200.00 x 3
ttl qty 10

Product subtotal ৳16900.00
Buy 10 Bags get 30% OFF -৳5070.00
Bundle discount -৳5070.00
After discount ৳11830.00


## Scenario 12 Variant-specific + generic split
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 5 50%    
5. Clearance - Buy 3 Red Bags get 60% OFF Red 3 60%

Cart:
- Leopard 2800.00 x 5
- Gray 1900.00 x 4
ttl qty 9

Product subtotal ৳21600.00
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 3 Bags get 10% OFF -৳760.00
Bundle discount -৳7760.00
After discount ৳13840.00


## Scenario 13 Variant-specific on two different variants
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 5 50%    
5. Clearance - Buy 3 Red Bags get 60% OFF Red 3 60%

Cart:
- Leopard 2800.00 x 5
- Red 2800.00 x 3
- Gray 1900.00 x 2
ttl qty 10

Product subtotal ৳21400.00
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Clearance - Buy 3 Red Bags get 60% OFF -৳2160.00
Bundle discount -৳9160.00
After discount ৳12240.00


## Scenario 14 Higher tier wins within same scope
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 5 50%    
5. Clearance - Buy 3 Red Bags get 60% OFF Red 3 60%

Cart:
- Gray 1900.00 x 10
ttl qty 10

Product subtotal ৳19000.00
Buy 10 Bags get 30% OFF -৳5700.00
Bundle discount -৳5700.00
After discount ৳13300.00

## Scenario 15 Empty eligible variants means all
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 5 50%    
5. Clearance - Buy 3 Red Bags get 60% OFF Red 3 60%

Cart:
- Gray 1900.00 x 4
ttl qty 4

Product subtotal ৳7600.00
Buy 3 Bags get 10% OFF -৳760.00
Bundle discount -৳760.00
After discount ৳6840.00


## Scenario 16 Label/amount correctness
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 5 50%    
5. Clearance - Buy 3 Red Bags get 60% OFF Red 3 60%

Cart:
- Gray 1900.00 x 5
- Leopard 2800.00 x 5
ttl qty 10

Product subtotal ৳23500.00
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 5 Bags get 20% OFF -৳1900.00
Bundle discount -৳8900.00
After discount ৳14600.00


## Scenario 17 Price integrity after admin edit
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 5 50%    
5. Clearance - Buy 3 Red Bags get 60% OFF Red 3 60%

Cart:
- Gray 1900.00 x 3
- Leopard 2800.00 x 5
- Red 1200.00 x 2
ttl qty 10

Changed Bundle Title: Clearance!!! Buy 5 Leopard Bags get 50% OFF and saved

Product subtotal ৳22100.00
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 5 Bags get 20% OFF -৳1620.00
Bundle discount -৳8620.00
After discount ৳13480.00

After refresh
Product subtotal ৳22100.00
Clearance!!! Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 5 Bags get 20% OFF -৳1620.00
Bundle discount -৳8620.00
After discount ৳13480.00


## Scenario 18 API pricing resilience (Network disconnect with ctrl + c in powershell)
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   

serial Title EligibleVariants MinQty Discount%  
1. Buy 10 Bags get 30% OFF all 10 30% 
2. Buy 5 Bags get 20% OFF all 5 20% 
3. Buy 3 Bags get 10% OFF all 3 10% 
4. Clearance - Buy 5 Leopard Bags get 50% OFF Leopard 5 50%    
5. Clearance - Buy 3 Red Bags get 60% OFF Red 3 60%

Cart:
- Gray 1900.00 x 3
- Leopard 2800.00 x 5
- Red 1200.00 x 2
ttl qty 10

Changed Bundle Title: Clearance!!! Buy 5 Leopard Bags get 50% OFF and saved

Product subtotal ৳22100.00
Clearance - Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 5 Bags get 20% OFF -৳1620.00
Bundle discount -৳8620.00
After discount ৳13480.00

After ctrl + c
Product subtotal ৳22100.00
Clearance!!! Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 5 Bags get 20% OFF -৳1620.00
Bundle discount -৳8620.00
After discount ৳13480.00

after npm run dev page refresh
Product subtotal ৳22100.00
Clearance!!! Buy 5 Leopard Bags get 50% OFF -৳7000.00
Buy 5 Bags get 20% OFF -৳1620.00
Bundle discount -৳8620.00
After discount ৳13480.00


## Scenario 19 Tie-break sanity
5 bundles on http://localhost:3000/admin/products/23ac4a6b-98c6-4d0d-8f05-e078f0120dea/edit   
serial Title EligibleVariants MinQty Discount%  
1. Buy 5 Bags get 10% OFF all 
2. Buy 10 Bags get 20% OFF all 

Cart:
- Leopard 2800.00 x 5
- Black 2300.00 x 5
ttl qty 10

Product subtotal ৳25500.00
Buy 10 Bags get 20% OFF (2) -৳5100.00
Bundle discount -৳5100.00
After discount ৳20400.00
