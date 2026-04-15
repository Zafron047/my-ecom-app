'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const slides = [
  {
    id: 1,
    image:
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1920&h=1080&fit=crop',
    title: 'Trending Gadgets & Daily Finds',
    subtitle: 'Fresh AliExpress-style picks for tech, travel, home, and more',
    cta: 'Shop Now',
    ctaLink: '/products',
  },
  {
    id: 2,
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1920&h=1080&fit=crop',
    title: 'Home Upgrades Under Budget',
    subtitle: 'Smart little upgrades that make your space more useful and fun',
    cta: 'Explore Home',
    ctaLink: '/products',
  },
  {
    id: 3,
    image:
      'https://images.unsplash.com/photo-1511556820780-d912e42b4980?w=1920&h=1080&fit=crop',
    title: 'Accessories That Sell Fast',
    subtitle:
      'Popular add-ons and impulse buys your customers keep coming back for',
    cta: 'Browse Bestsellers',
    ctaLink: '/products',
  },
  {
    id: 4,
    image:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1920&h=1080&fit=crop',
    title: 'Top Picks From Every Category',
    subtitle:
      'Discover mix-and-match products across gadgets, lifestyle, and home',
    cta: 'View Collection',
    ctaLink: '/products',
  },
];

export default function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-play functionality
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000); // Change slide every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    // Keep auto-play running even after user interaction
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    // Keep auto-play running even after user interaction
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    // Keep auto-play running even after user interaction
  };

  return (
    <section className="relative h-[42vh] md:h-[70vh] overflow-hidden">
      {/* Slides */}
      <div className="relative h-full">
        {slides.map((slide, index) => (
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
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Content */}
            <div className="relative h-full flex items-center justify-center z-20 pointer-events-none">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white pointer-events-auto">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 animate-fade-in">
                  {slide.title}
                </h1>
                <p className="text-lg md:text-xl mb-6 max-w-3xl mx-auto opacity-90 animate-fade-in-delay">
                  {slide.subtitle}
                </p>
                <div className="flex flex-wrap justify-center gap-3 animate-fade-in-delay-2">
                  <Link
                    href={slide.ctaLink}
                    className="inline-flex min-w-[152px] items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm !font-normal !text-white shadow-lg transition-colors duration-300 hover:bg-blue-700 hover:!text-white"
                  >
                    {slide.cta}
                  </Link>
                  <Link
                    href="#featured"
                    className="inline-flex min-w-[152px] items-center justify-center rounded-full border border-white/65 bg-white/10 px-4 py-2.5 text-sm !font-normal !text-white backdrop-blur-sm transition-colors duration-300 hover:border-white hover:bg-white/18 hover:!text-white"
                  >
                    Explore More
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110 z-10"
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
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110 z-10"
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
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'bg-white scale-125'
                : 'bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

    </section>
  );
}
