'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { StorefrontHeroSlide } from '@/lib/storefront-types';

export default function HeroSlider({ slides }: { slides: StorefrontHeroSlide[] }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const activeSlides = slides.length > 0 ? slides : [];

  useEffect(() => {
    if (activeSlides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
    }, 5200);

    return () => clearInterval(interval);
  }, [activeSlides.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  if (activeSlides.length === 0) return null;

  return (
    <section className="relative h-[58svh] min-h-[420px] overflow-hidden bg-zinc-950 md:h-[66vh] md:min-h-[540px]">
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
                style={{ objectPosition: 'center 44%' }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,8,0.66)_0%,rgba(8,8,8,0.48)_34%,rgba(8,8,8,0.12)_64%,rgba(8,8,8,0.30)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.12)_0%,rgba(8,8,8,0.00)_34%,rgba(8,8,8,0.48)_88%,#09090b_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(255,255,255,0.13),transparent_30%)] opacity-70" />
            </div>

            {/* Content */}
            <div className="pointer-events-none relative z-20 flex h-full items-end md:items-center">
              <div
                key={`${slide.id}-content`}
                className={`pointer-events-auto mx-auto grid w-full max-w-7xl px-5 pb-16 text-left text-white transition duration-700 ease-out sm:px-6 md:grid-cols-[minmax(0,0.88fr)_minmax(16rem,0.62fr)] md:items-end md:pb-0 lg:px-8 ${
                  index === currentSlide
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-4 opacity-0'
                }`}
              >
                <div className="max-w-[28rem] sm:max-w-[32rem] lg:max-w-[36rem]">
                  <div className="mb-3 inline-flex items-center text-[0.66rem] font-medium uppercase leading-none tracking-[0.14em] text-white/64 md:mb-4">
                    Practical lifestyle finds
                  </div>
                  <h1 className="text-balance text-[2rem] font-medium leading-[1.04] tracking-normal text-white sm:text-[2.58rem] md:text-[3.16rem] lg:text-[3.65rem]">
                    <HeroTitle title={slide.title} />
                  </h1>
                  {slide.subtitle ? (
                    <p className="mt-4 max-w-[20.5rem] text-sm font-normal leading-6 !text-white/72 sm:max-w-[25rem] sm:text-[0.98rem] md:mt-5 md:leading-7">
                      {slide.subtitle}
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-wrap items-center gap-3.5 md:mt-7">
                    {slide.ctaLabel && slide.ctaHref ? (
                      <Link
                        href={slide.ctaHref}
                        className="inline-flex h-8 min-w-[7.65rem] items-center justify-center rounded-md bg-white px-3.5 text-[0.72rem] font-medium !text-zinc-950 shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition duration-300 hover:bg-white/90 hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)] focus:outline-none focus:ring-4 focus:ring-white/18 md:h-9 md:min-w-[8.25rem] md:px-4"
                      >
                        {slide.ctaLabel}
                      </Link>
                    ) : null}
                    {slide.secondaryLabel && slide.secondaryHref ? (
                      <Link
                        href={slide.secondaryHref}
                        className="group inline-flex h-8 items-center gap-2 border-b border-white/26 px-0 text-[0.72rem] font-medium !text-white/78 transition duration-300 hover:border-white/72 hover:!text-white focus:outline-none focus:ring-4 focus:ring-white/12 md:h-9"
                      >
                        {slide.secondaryLabel}
                        <span className="transition duration-300 group-hover:translate-x-0.5" aria-hidden="true">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M5 12h14m-6-6 6 6-6 6"
                            />
                          </svg>
                        </span>
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="hidden justify-self-end text-right md:block">
                  <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-white/44">
                    {String(index + 1).padStart(2, '0')} / {String(activeSlides.length).padStart(2, '0')}
                  </p>
                  <p className="mt-3 max-w-[15rem] text-sm leading-6 !text-white/52">
                    Selected for everyday friction points, not trend noise.
                  </p>
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
        className="absolute bottom-7 right-[4.75rem] z-10 hidden h-9 w-9 items-center justify-center rounded-full border border-white/18 bg-black/10 text-white/68 backdrop-blur-md transition duration-300 hover:border-white/38 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-white/12 md:flex"
        aria-label="Previous slide"
      >
        <svg
          className="h-4 w-4"
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
        className="absolute bottom-7 right-8 z-10 hidden h-9 w-9 items-center justify-center rounded-full border border-white/18 bg-black/10 text-white/68 backdrop-blur-md transition duration-300 hover:border-white/38 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-white/12 md:flex"
        aria-label="Next slide"
      >
        <svg
          className="h-4 w-4"
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
      <div className="absolute bottom-7 left-5 z-10 flex gap-2 sm:left-6 md:left-8">
        {activeSlides.map((_, index) => (
          <button
            suppressHydrationWarning
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-px transition-all duration-300 ${
              index === currentSlide
                ? 'w-9 bg-white'
                : 'w-5 bg-white/32 hover:bg-white/68'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

    </section>
  );
}

function HeroTitle({ title }: { title: string }) {
  const intentionalBreaks: Record<string, string[]> = {
    'Finds That Make Life Easier': ['Finds That', 'Make Life Easier'],
    'Smarter Daily Routines': ['Smarter Daily', 'Routines'],
    'Small Fixes, Better Flow': ['Small Fixes,', 'Better Flow'],
    'Curated For Real Needs': ['Curated For', 'Real Needs'],
  };
  const lines = intentionalBreaks[title];

  if (!lines) return title;

  return (
    <>
      {lines.map((line, index) => (
        <span key={line} className="block">
          {line}
          {index < lines.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}
