import ProductCard from '@/components/ProductCard';
import type { StorefrontCatalogProduct } from '@/lib/storefront-types';
import Link from 'next/link';

type SectionVariant = 'default' | 'sale';

interface HomeProductListSectionProps {
  title: string;
  products: StorefrontCatalogProduct[];
  variant?: SectionVariant;
  layout?: 'grid' | 'carousel';
  sectionClassName?: string;
  eyebrow?: string;
  cta?: {
    href: string;
    label: string;
  };
}

export default function HomeProductListSection({
  title,
  products,
  variant = 'default',
  layout = 'grid',
  sectionClassName = 'bg-gradient-to-b from-slate-100 to-white py-16',
  eyebrow,
  cta,
}: HomeProductListSectionProps) {
  const isSaleVariant = variant === 'sale';

  return (
    <section className={sectionClassName}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {isSaleVariant ? (
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              {eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-rose-500">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="mt-3 text-2xl font-semibold text-gray-900">{title}</h2>
            </div>
            {cta ? (
              <Link
                href={cta.href}
                className="inline-flex w-fit items-center rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
              >
                {cta.label}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="mb-7">
            {eyebrow ? (
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px w-10 bg-gradient-to-r from-orange-300 via-amber-400 to-orange-500" />
                <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-transparent">
                  {eyebrow}
                </span>
              </div>
            ) : null}
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">{title}</h2>
          </div>
        )}

        <div
          className={
            layout === 'carousel'
              ? 'flex gap-4 overflow-x-auto pb-2'
              : 'grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6'
          }
        >
          {products.map((product) => (
            <div
              key={product.id}
              className={
                layout === 'carousel'
                  ? 'w-[220px] min-w-[220px] flex-shrink-0'
                  : 'mx-auto w-full max-w-[230px]'
              }
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
