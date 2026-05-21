export interface StorefrontCatalogProduct {
  id: string;
  name: string;
  createdAt: string;
  price: number;
  salePrice?: number;
  image: string;
  images: string[];
  category: string;
  tags: string[];
  badge?: string;
  superSale?: boolean;
  hasActiveBundleOffer?: boolean;
  bundleMinTotalQty?: number;
  bundleDiscountPercent?: number;
  bundleDisplayText?: string;
  variants: {
    id: string;
    color: string;
    colorHex?: string;
    size: string;
    price: number;
    salePrice?: number;
    stockQuantity: number;
    image: string;
    images?: string[];
  }[];
  bundleOffers?: {
    id: string;
    title: string;
    image: string;
    minTotalQty: number;
    discountPercent: number;
    variantIds: string[];
    isActive: boolean;
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

export interface StorefrontHeroSlide {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export interface StorefrontBusinessProfile {
  businessName: string;
  tagline: string;
  logoUrl: string;
  logoAlt: string;
  bannerUrl?: string;
  bannerAlt?: string;
  phone?: string;
  email?: string;
  address?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  returnRefundPolicy?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogImageUrl?: string;
}

export interface StorefrontProductDetail {
  id: string;
  name: string;
  imageVersion: number;
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
  bundleOffers: {
    id: string;
    title: string;
    image: string;
    minTotalQty: number;
    discountPercent: number;
    variantIds: string[];
    isActive: boolean;
  }[];
  inStock: boolean;
  rating: number;
  reviews: number;
  variants: {
    id: string;
    color: string;
    colorHex?: string;
    size: string;
    price: number;
    salePrice?: number;
    stockQuantity: number;
    image: string;
    images?: string[];
  }[];
}
