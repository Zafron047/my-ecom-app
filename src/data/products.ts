export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  image: string;
  category: string;
  badge?: string;
  superSale?: boolean;
}

export const catalogProducts: CatalogProduct[] = [
  {
    id: '1',
    name: 'Wireless Earbuds Pro',
    price: 49.99,
    salePrice: 34.99,
    image:
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=500&h=500&fit=crop',
    category: 'Gadgets',
    badge: 'Sale',
    superSale: true,
  },
  {
    id: '2',
    name: 'Mini Portable Blender Bottle Flask for Shakes',
    price: 32.99,
    salePrice: 24.99,
    image:
      'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=500&h=500&fit=crop',
    category: 'Home Finds',
    badge: 'Sale',
    superSale: true,
  },
  {
    id: '3',
    name: 'Magnetic Car Phone Holder',
    price: 28.99,
    salePrice: 26.99,
    image:
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=500&h=500&fit=crop',
    category: 'Car Accessories',
    superSale: true,
  },
  {
    id: '4',
    name: 'USB Rechargeable Table Lamp',
    price: 34.99,
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=500&h=500&fit=crop',
    category: 'Home Finds',
  },
  {
    id: '5',
    name: 'Foldable Laptop Stand',
    price: 17.99,
    salePrice: 14.99,
    image:
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&h=500&fit=crop',
    category: 'Office Setup',
    superSale: true,
  },
  {
    id: '6',
    name: '40oz Stainless Steel Tumbler',
    price: 12.99,
    image:
      'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=500&h=500&fit=crop',
    category: 'Kitchen Picks',
  },
  {
    id: '7',
    name: 'Pet Grooming Glove',
    price: 24.99,
    salePrice: 19.99,
    image:
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=500&h=500&fit=crop',
    category: 'Pet Essentials',
    superSale: true,
  },
  {
    id: '8',
    name: 'Travel Packing Cubes Set',
    price: 39.99,
    salePrice: 31.99,
    image:
      'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=500&h=500&fit=crop',
    category: 'Travel Gear',
    superSale: true,
  },
];

export const catalogCategories = [
  'All',
  'Gadgets',
  'Home Finds',
  'Car Accessories',
  'Office Setup',
  'Kitchen Picks',
  'Pet Essentials',
  'Travel Gear',
];
