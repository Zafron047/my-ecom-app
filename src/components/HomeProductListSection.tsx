'use client';

import ProductCard from '@/components/ProductCard';
import type { StorefrontCatalogProduct } from '@/lib/storefront-types';
import { motion } from 'framer-motion';
import Link from 'next/link';
import type { PointerEvent, TouchEvent } from 'react';
import { useRef } from 'react';

type SectionVariant = 'default' | 'sale';

interface HomeProductListSectionProps {
  title: string;
  products: StorefrontCatalogProduct[];
  variant?: SectionVariant;
  layout?: 'grid' | 'carousel';
  sectionClassName?: string;
  containerClassName?: string;
  headerClassName?: string;
  gridClassName?: string;
  animateItems?: boolean;
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
  containerClassName,
  headerClassName,
  gridClassName,
  animateItems = true,
  eyebrow,
  cta,
}: HomeProductListSectionProps) {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{
    isLocked?: boolean;
    scrollLeft: number;
    x: number;
    y: number;
  } | null>(null);
  const isSaleVariant = variant === 'sale';
  const isCarousel = layout === 'carousel';
  const showCarouselControls = isCarousel && products.length > 1;

  const getCarouselItemDistance = () => {
    const carousel = carouselRef.current;

    if (!carousel) return 320;

    const firstProduct = carousel.querySelector<HTMLElement>('[data-carousel-item]');
    return firstProduct
      ? firstProduct.offsetWidth + getCarouselGap(carousel)
      : 320;
  };

  const handleCarouselScroll = (direction: 'previous' | 'next') => {
    const carousel = carouselRef.current;

    if (!carousel) return;

    const scrollDistance = getCarouselItemDistance();

    carousel.scrollBy({
      left: direction === 'previous' ? -scrollDistance : scrollDistance,
      behavior: 'smooth',
    });
  };

  const beginCarouselGesture = (x: number, y: number) => {
    const carousel = carouselRef.current;

    if (!carousel) return;

    gestureRef.current = {
      scrollLeft: carousel.scrollLeft,
      x,
      y,
    };
  };

  const finishCarouselGesture = (x: number, y: number) => {
    const carousel = carouselRef.current;
    const gesture = gestureRef.current;
    gestureRef.current = null;

    if (!carousel || !gesture) return;

    const deltaX = gesture.x - x;
    const deltaY = gesture.y - y;
    const itemDistance = getCarouselItemDistance();
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    const hasSwipeDistance = Math.abs(deltaX) >= 18;

    if (!isHorizontalSwipe || !hasSwipeDistance) return;

    carousel.scrollTo({
      left: gesture.scrollLeft + (deltaX > 0 ? itemDistance : -itemDistance),
      behavior: 'auto',
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;

    beginCarouselGesture(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;

    finishCarouselGesture(event.clientX, event.clientY);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const carousel = carouselRef.current;
    const gesture = gestureRef.current;
    const touch = event.touches[0];

    if (!carousel || !gesture || !touch) return;

    const deltaX = gesture.x - touch.clientX;
    const deltaY = gesture.y - touch.clientY;

    if (gesture.isLocked || Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      gesture.isLocked = true;
      carousel.scrollLeft = gesture.scrollLeft;
      event.preventDefault();
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];

    if (!touch) return;

    beginCarouselGesture(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];

    if (!touch) return;

    finishCarouselGesture(touch.clientX, touch.clientY);
  };

  return (
    <section className={sectionClassName}>
      <div
        className={
          containerClassName ??
          (isCarousel
            ? 'w-full px-4 sm:px-6 lg:px-8'
            : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8')
        }
      >
        <div className={headerClassName ?? (isCarousel ? 'mx-auto max-w-7xl' : '')}>
          {isSaleVariant ? (
            <div className="mb-8 flex items-end justify-between gap-4 md:mb-10">
              <div>
                {eyebrow ? (
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-rose-500">
                    {eyebrow}
                  </p>
                ) : null}
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-[1.02] tracking-tight text-zinc-950 md:text-5xl">
                  {title}
                </h2>
              </div>
              {cta ? (
                <Link
                  href={cta.href}
                  className="inline-flex w-fit items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-950 hover:!text-white"
                >
                  {cta.label}
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mb-8 md:mb-10">
              {eyebrow ? (
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-px w-9 bg-zinc-300" />
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                    {eyebrow}
                  </span>
                </div>
              ) : null}
              <h2 className="mb-4 max-w-3xl text-3xl font-semibold leading-[1.02] tracking-tight text-zinc-950 md:text-5xl">
                {title}
              </h2>
            </div>
          )}
        </div>

        {isCarousel ? (
          <div className="relative">
            <div
              ref={carouselRef}
              onPointerDown={handlePointerDown}
              onPointerCancel={() => {
                gestureRef.current = null;
              }}
              onPointerUp={handlePointerUp}
              onTouchStart={handleTouchStart}
              onTouchCancel={() => {
                gestureRef.current = null;
              }}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="snap-x snap-mandatory overflow-x-auto scroll-smooth px-1 pb-2 touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-80px' }}
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.045 } },
                }}
                className="mx-auto flex w-max gap-4 md:gap-5"
              >
                {products.map((product) => (
                  <motion.div
                    key={product.id}
                    data-carousel-item
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      show: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    className="w-[78vw] min-w-[78vw] max-w-[320px] flex-shrink-0 snap-start snap-always py-1 sm:w-[276px] sm:min-w-[276px]"
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {showCarouselControls ? (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-white via-white/80 to-transparent sm:block" />
                <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-white via-white/80 to-transparent sm:block" />
                <CarouselArrowButton
                  direction="previous"
                  label={`Previous products in ${title}`}
                  onClick={() => handleCarouselScroll('previous')}
                />
                <CarouselArrowButton
                  direction="next"
                  label={`Next products in ${title}`}
                  onClick={() => handleCarouselScroll('next')}
                />
              </>
            ) : null}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={{
              hidden: {},
                    show: { transition: { staggerChildren: 0.04 } },
                  }}
            className={
              gridClassName ??
              'grid grid-cols-2 gap-x-3.5 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5 lg:gap-x-6 lg:gap-y-10'
            }
          >
            {products.map((product) =>
              animateItems ? (
                <motion.div
                  key={product.id}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    show: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  className="mx-auto w-full max-w-[280px]"
                >
                  <ProductCard product={product} />
                </motion.div>
              ) : (
                <div key={product.id} className="mx-auto w-full max-w-[280px]">
                  <ProductCard product={product} />
                </div>
              ),
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}

function CarouselArrowButton({
  direction,
  label,
  onClick,
}: {
  direction: 'previous' | 'next';
  label: string;
  onClick: () => void;
}) {
  const isPrevious = direction === 'previous';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-800 shadow-[0_14px_34px_rgba(15,23,42,0.20)] ring-1 ring-slate-900/5 transition hover:-translate-y-1/2 hover:scale-105 hover:bg-slate-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 sm:inline-flex ${
        isPrevious ? 'left-1 sm:left-3' : 'right-1 sm:right-3'
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      >
        {isPrevious ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 6l6 6-6 6" />}
      </svg>
    </button>
  );
}

function getCarouselGap(carousel: HTMLDivElement) {
  const productTrack = carousel.firstElementChild;

  if (!productTrack) return 16;

  const gap = Number.parseFloat(getComputedStyle(productTrack).columnGap);

  return Number.isFinite(gap) ? gap : 16;
}
