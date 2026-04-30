export interface StorefrontCatalogProduct {
  id: string;
  name: string;
  createdAt: string;
  price: number;
  salePrice?: number;
  image: string;
  category: string;
  tags: string[];
  badge?: string;
  superSale?: boolean;
  variants: {
    id: string;
    color: string;
    size: string;
    price: number;
    salePrice?: number;
    image: string;
  }[];
}

export interface StorefrontHomepageSection {
  id: string;
  title: string;
  eyebrow?: string;
  variant: 'default' | 'sale';
  layout: 'grid' | 'carousel';
  sourceType: 'latest' | 'super_sale' | 'category' | 'tag';
  sourceValue?: string;
  productIds?: string[];
  productLimit: number;
  displayOrder: number;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface StorefrontProductDetail {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  image: string;
  images: string[];
  category: string;
  description: string;
  benefits: string[];
  specs: {
    name: string;
    value: string;
  }[];
  inStock: boolean;
  rating: number;
  reviews: number;
  variants: {
    id: string;
    color: string;
    size: string;
    price: number;
    salePrice?: number;
    image: string;
  }[];
}
