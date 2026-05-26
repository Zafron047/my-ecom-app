export type PublicStorefrontSort =
  | 'newest'
  | 'oldest'
  | 'name_asc'
  | 'price_asc'
  | 'price_desc';

export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PublicImageDTO {
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

export interface CategoryDTO {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  productCount?: number;
}

export interface ProductPricingDTO {
  minPrice: number;
  maxPrice: number;
  minCompareAtPrice?: number;
  maxCompareAtPrice?: number;
  hasRange: boolean;
  hasDiscount: boolean;
}

export interface InventoryBatchDTO {
  batchNumber: string;
  quantity: number;
  unitCost: number;
  status: string;
  receivedAt: string;
}

export interface ProductVariantDTO {
  id: string;
  sku: string;
  color?: string;
  colorHex?: string;
  size?: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  inventoryBatches?: InventoryBatchDTO[];
  images: PublicImageDTO[];
}

export interface ProductDTO {
  title: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  pricing: ProductPricingDTO;
  quantity: number;
  categories: CategoryDTO[];
  images: PublicImageDTO[];
  variants: ProductVariantDTO[];
  seo?: {
    title?: string;
    description?: string;
  };
}

export interface ProductListQueryDTO {
  page: number;
  limit: number;
  category?: string;
  search?: string;
  sort: PublicStorefrontSort;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface PublicApiSuccess<T> {
  success: true;
  data: T;
}

export interface PublicApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type PublicApiResponse<T> = PublicApiSuccess<T> | PublicApiError;
