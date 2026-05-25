'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { StorefrontHeroSlide } from '@/lib/storefront-types';

export default function HeroSlider({ slides }: { slides: StorefrontHeroSlide[] }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const activeSlides = slides.length > 0 ? slides : [];

  // Auto-play functionality
  useEffect(() => {
    if (activeSlides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
    }, 3000); // Change slide every 3 seconds

    return () => clearInterval(interval);
  }, [activeSlides.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    // Keep auto-play running even after user interaction
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
    // Keep auto-play running even after user interaction
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
    // Keep auto-play running even after user interaction
  };

  if (activeSlides.length === 0) return null;

  return (
    <section className="relative h-[56vh] min-h-[430px] overflow-hidden bg-zinc-950 md:h-[72vh] md:min-h-[620px]">
      {/* Slides */}
      <div className="relative h-full">
        {activeSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-[1600ms] ease-in-out ${
              index === currentSlide
                ? 'scale-100 opacity-100'
                : 'scale-[1.02] opacity-0'
            }`}
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <Image
                src={slide.imageUrl}
                alt={slide.title}
                fill
                loading={index === 0 ? 'eager' : 'lazy'}
                priority={index === 0}
                sizes="100vw"
                className={`h-full w-full object-cover transition-transform duration-[6000ms] ease-out ${
                  index === currentSlide ? 'scale-105' : 'scale-100'
                }`}
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/38 via-black/34 to-black/72" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.14),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.58),transparent_46%,rgba(0,0,0,0.44))]" />
            </div>

            {/* Content */}
            <div className="pointer-events-none relative z-20 flex h-full items-center justify-center">
              <div
                key={`${slide.id}-content`}
                className={`pointer-events-auto mx-auto max-w-7xl px-5 text-center text-white transition duration-700 ease-out sm:px-6 lg:px-8 ${
                  index === currentSlide
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-4 opacity-0'
                }`}
              >
                <div className="mx-auto mb-5 inline-flex items-center rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md">
                  Useful home upgrades
                </div>
                <h1 className="mx-auto mb-4 max-w-[22rem] text-balance text-3xl font-semibold leading-[1.02] tracking-tight text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:max-w-4xl sm:text-5xl md:text-6xl lg:text-7xl">
                  {slide.title}
                </h1>
                {slide.subtitle ? (
                  <div className="mx-auto mb-7 max-w-[20rem] text-sm font-medium leading-6 text-white/84 sm:max-w-2xl sm:text-base md:text-lg md:leading-7">
                    {slide.subtitle}
                  </div>
                ) : null}
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  {slide.ctaLabel && slide.ctaHref ? (
                    <Link
                      href={slide.ctaHref}
                      className="inline-flex min-h-12 min-w-[164px] items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold !text-zinc-950 shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-950 hover:!text-white hover:ring-1 hover:ring-white/30"
                    >
                      {slide.ctaLabel}
                    </Link>
                  ) : null}
                  {slide.secondaryLabel && slide.secondaryHref ? (
                    <Link
                      href={slide.secondaryHref}
                      className="inline-flex min-h-12 min-w-[164px] items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3 text-sm font-semibold !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/55 hover:bg-white/20 hover:!text-white"
                    >
                      {slide.secondaryLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        suppressHydrationWarning
        onClick={prevSlide}
        className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition duration-300 hover:border-white/35 hover:bg-white/20 sm:left-6 sm:h-12 sm:w-12"
        aria-label="Previous slide"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <button
        suppressHydrationWarning
        onClick={nextSlide}
        className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition duration-300 hover:border-white/35 hover:bg-white/20 sm:right-6 sm:h-12 sm:w-12"
        aria-label="Next slide"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* Dot Indicators */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2.5 sm:bottom-8">
        {activeSlides.map((_, index) => (
          <button
            suppressHydrationWarning
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'w-8 bg-white'
                : 'w-1.5 bg-white/45 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

    </section>
  );
}
