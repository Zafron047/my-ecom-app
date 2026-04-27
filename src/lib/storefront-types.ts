export interface StorefrontCatalogProduct {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  image: string;
  category: string;
  badge?: string;
  superSale?: boolean;
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
}
