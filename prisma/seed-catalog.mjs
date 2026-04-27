import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    name: 'Smart Gadgets',
    slug: 'smart-gadgets',
    description: 'Trending electronics and smart everyday tools.',
  },
  {
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    description: 'Useful home essentials and kitchen helpers.',
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty-personal-care',
    description: 'Daily beauty, grooming, and self-care items.',
  },
  {
    name: 'Fashion Accessories',
    slug: 'fashion-accessories',
    description: 'Affordable style-focused accessories and add-ons.',
  },
  {
    name: 'Fitness & Outdoors',
    slug: 'fitness-outdoors',
    description: 'Workout and outdoor accessories for active buyers.',
  },
];

const products = [
  {
    name: 'Wireless Noise-Canceling Earbuds Pro',
    slug: 'wireless-noise-canceling-earbuds-pro',
    shortDescription: 'Compact wireless earbuds with ANC and long battery life.',
    description:
      'Popular AliExpress-style earbuds with touch controls, deep bass, and quick USB-C charging.',
    categorySlug: 'smart-gadgets',
    specs: [
      { name: 'Battery Life', value: 'Up to 28 hours' },
      { name: 'Bluetooth', value: '5.3' },
    ],
    variants: [
      { color: 'Black', size: 'Standard', price: 2590, stock: 22 },
      { color: 'White', size: 'Standard', price: 2590, stock: 18 },
    ],
  },
  {
    name: 'Portable Mini Blender Bottle',
    slug: 'portable-mini-blender-bottle',
    shortDescription: 'USB rechargeable mini blender for juices and shakes.',
    description:
      'Single-serve blender bottle designed for office and travel use with easy cleaning.',
    categorySlug: 'home-kitchen',
    specs: [
      { name: 'Capacity', value: '380ml' },
      { name: 'Charge Port', value: 'USB-C' },
    ],
    variants: [
      { color: 'Pink', size: '380ml', price: 1850, stock: 15 },
      { color: 'Green', size: '380ml', price: 1850, stock: 14 },
    ],
  },
  {
    name: 'LED Vanity Makeup Mirror',
    slug: 'led-vanity-makeup-mirror',
    shortDescription: 'Tri-tone LED mirror with touch brightness control.',
    description:
      'Countertop cosmetic mirror with adjustable angle and natural daylight lighting.',
    categorySlug: 'beauty-personal-care',
    specs: [
      { name: 'Light Modes', value: 'Warm, Natural, Cool' },
      { name: 'Power', value: 'USB or Battery' },
    ],
    variants: [
      { color: 'White', size: 'Medium', price: 1690, stock: 20 },
      { color: 'Black', size: 'Medium', price: 1690, stock: 16 },
    ],
  },
  {
    name: 'Magnetic Car Phone Holder 360',
    slug: 'magnetic-car-phone-holder-360',
    shortDescription: 'Dashboard magnetic phone mount with full rotation.',
    description:
      'Strong hold magnetic mount compatible with most smartphones and smooth swivel positioning.',
    categorySlug: 'smart-gadgets',
    specs: [
      { name: 'Rotation', value: '360 degree' },
      { name: 'Mount Type', value: 'Dashboard' },
    ],
    variants: [
      { color: 'Black', size: 'Single Pack', price: 690, stock: 40 },
      { color: 'Silver', size: 'Single Pack', price: 690, stock: 28 },
    ],
  },
  {
    name: 'Air Fryer Silicone Basket Liner Set',
    slug: 'air-fryer-silicone-basket-liner-set',
    shortDescription: 'Reusable non-stick liners for cleaner air fryer cooking.',
    description:
      'Heat-resistant food-safe silicone liners that reduce mess and improve basket life.',
    categorySlug: 'home-kitchen',
    specs: [
      { name: 'Material', value: 'Food-grade silicone' },
      { name: 'Heat Resistance', value: 'Up to 230C' },
    ],
    variants: [
      { color: 'Red', size: '7 inch', price: 980, stock: 35 },
      { color: 'Gray', size: '8 inch', price: 1050, stock: 24 },
    ],
  },
  {
    name: 'Satin Heatless Curling Headband',
    slug: 'satin-heatless-curling-headband',
    shortDescription: 'Overnight heatless curl set for soft volume.',
    description:
      'Gentle satin curling ribbon set designed for frizz-free curls without heat damage.',
    categorySlug: 'beauty-personal-care',
    specs: [
      { name: 'Material', value: 'Satin' },
      { name: 'Use', value: 'Overnight styling' },
    ],
    variants: [
      { color: 'Rose Gold', size: 'Standard', price: 790, stock: 30 },
      { color: 'Champagne', size: 'Standard', price: 790, stock: 26 },
    ],
  },
  {
    name: 'Layered Minimalist Chain Necklace',
    slug: 'layered-minimalist-chain-necklace',
    shortDescription: 'Three-layer lightweight necklace for casual styling.',
    description:
      'Everyday fashion accessory with adjustable length and anti-tarnish finish.',
    categorySlug: 'fashion-accessories',
    specs: [
      { name: 'Material', value: 'Alloy with gold plating' },
      { name: 'Length', value: '38cm + extender' },
    ],
    variants: [
      { color: 'Gold', size: 'Standard', price: 850, stock: 34 },
      { color: 'Silver', size: 'Standard', price: 850, stock: 29 },
    ],
  },
  {
    name: 'Resistance Band Set with Handles',
    slug: 'resistance-band-set-with-handles',
    shortDescription: 'Portable training bands for home workouts.',
    description:
      'Stackable resistance set with handles, ankle straps, and door anchor for full body exercises.',
    categorySlug: 'fitness-outdoors',
    specs: [
      { name: 'Resistance Range', value: '10lb to 100lb' },
      { name: 'Pieces', value: '11' },
    ],
    variants: [
      { color: 'Multicolor', size: '11 pcs', price: 2190, stock: 19 },
      { color: 'Black', size: '5 pcs', price: 1690, stock: 17 },
    ],
  },
  {
    name: 'Rechargeable Electric Lint Remover',
    slug: 'rechargeable-electric-lint-remover',
    shortDescription: 'Fabric shaver for sweaters and upholstery.',
    description:
      'USB rechargeable lint remover with safe mesh guard and detachable waste container.',
    categorySlug: 'home-kitchen',
    specs: [
      { name: 'Power', value: 'Rechargeable battery' },
      { name: 'Blade', value: 'Stainless steel' },
    ],
    variants: [
      { color: 'White', size: 'Standard', price: 1190, stock: 21 },
      { color: 'Navy', size: 'Standard', price: 1190, stock: 15 },
    ],
  },
  {
    name: 'Portable Facial Steamer Nano Mist',
    slug: 'portable-facial-steamer-nano-mist',
    shortDescription: 'Handheld nano mist sprayer for hydration boost.',
    description:
      'Pocket-friendly facial steamer suitable for makeup prep and dry skin refresh.',
    categorySlug: 'beauty-personal-care',
    specs: [
      { name: 'Water Tank', value: '30ml' },
      { name: 'Mist Tech', value: 'Nano ionic' },
    ],
    variants: [
      { color: 'Pink', size: '30ml', price: 990, stock: 27 },
      { color: 'White', size: '30ml', price: 990, stock: 23 },
    ],
  },
  {
    name: 'Crossbody Sling Bag Anti-Theft',
    slug: 'crossbody-sling-bag-anti-theft',
    shortDescription: 'Slim urban sling bag with hidden pocket design.',
    description:
      'AliExpress bestseller style crossbody bag with USB pass-through and secure zippers.',
    categorySlug: 'fashion-accessories',
    specs: [
      { name: 'Material', value: 'Water-resistant polyester' },
      { name: 'Compartments', value: '4 zipped pockets' },
    ],
    variants: [
      { color: 'Black', size: 'Medium', price: 1450, stock: 25 },
      { color: 'Gray', size: 'Medium', price: 1450, stock: 20 },
    ],
  },
  {
    name: 'Smart Watch Fitness Tracker S9',
    slug: 'smart-watch-fitness-tracker-s9',
    shortDescription: 'Affordable smartwatch with health and activity tracking.',
    description:
      'Tracks steps, sleep, and heart rate with call alerts and custom watch faces.',
    categorySlug: 'smart-gadgets',
    specs: [
      { name: 'Display', value: '1.83 inch IPS' },
      { name: 'Battery', value: 'Up to 7 days' },
    ],
    variants: [
      { color: 'Black', size: '44mm', price: 3290, stock: 18 },
      { color: 'Pink', size: '44mm', price: 3290, stock: 13 },
    ],
  },
  {
    name: 'Silicone Dish Drying Mat Roll-Up',
    slug: 'silicone-dish-drying-mat-roll-up',
    shortDescription: 'Foldable dish drying rack mat for compact kitchens.',
    description:
      'Heat-safe roll-up sink mat for drying dishes, fruits, and washed cookware.',
    categorySlug: 'home-kitchen',
    specs: [
      { name: 'Length', value: '47cm' },
      { name: 'Material', value: 'Silicone + steel core' },
    ],
    variants: [
      { color: 'Gray', size: '47x30cm', price: 1290, stock: 22 },
      { color: 'Black', size: '47x30cm', price: 1290, stock: 19 },
    ],
  },
  {
    name: 'Electric Blackhead Remover Vacuum',
    slug: 'electric-blackhead-remover-vacuum',
    shortDescription: 'Multi-head pore vacuum cleaner for facial care.',
    description:
      'Adjustable suction tool with reusable heads for blackhead and dead skin cleanup.',
    categorySlug: 'beauty-personal-care',
    specs: [
      { name: 'Modes', value: '3 suction levels' },
      { name: 'Charging', value: 'USB' },
    ],
    variants: [
      { color: 'White', size: 'Standard', price: 1390, stock: 24 },
      { color: 'Black', size: 'Standard', price: 1390, stock: 18 },
    ],
  },
  {
    name: 'UV Protection Polarized Sunglasses',
    slug: 'uv-protection-polarized-sunglasses',
    shortDescription: 'Classic polarized sunglasses with UV400 lens.',
    description:
      'Unisex fashion sunglasses with lightweight frame and anti-glare lens technology.',
    categorySlug: 'fashion-accessories',
    specs: [
      { name: 'Protection', value: 'UV400' },
      { name: 'Lens Type', value: 'Polarized' },
    ],
    variants: [
      { color: 'Black', size: 'Standard', price: 990, stock: 33 },
      { color: 'Tea', size: 'Standard', price: 990, stock: 25 },
    ],
  },
  {
    name: 'Ab Roller Wheel with Knee Pad',
    slug: 'ab-roller-wheel-with-knee-pad',
    shortDescription: 'Core workout wheel with stable dual-wheel design.',
    description:
      'Compact ab roller set for home workouts including non-slip knee pad support.',
    categorySlug: 'fitness-outdoors',
    specs: [
      { name: 'Wheel Type', value: 'Dual wheel' },
      { name: 'Included', value: 'Knee pad' },
    ],
    variants: [
      { color: 'Black', size: 'Dual Wheel', price: 1490, stock: 20 },
      { color: 'Blue', size: 'Dual Wheel', price: 1490, stock: 15 },
    ],
  },
  {
    name: 'Mini Portable Projector YG300',
    slug: 'mini-portable-projector-yg300',
    shortDescription: 'Budget compact projector for home media playback.',
    description:
      'Small-form projector supporting HDMI and USB input for casual entertainment use.',
    categorySlug: 'smart-gadgets',
    specs: [
      { name: 'Resolution', value: '800x480 native' },
      { name: 'Inputs', value: 'HDMI, USB, AV' },
    ],
    variants: [
      { color: 'Yellow', size: 'Standard', price: 4990, stock: 10 },
      { color: 'White', size: 'Standard', price: 4990, stock: 9 },
    ],
  },
  {
    name: 'Oil Spray Bottle for Cooking',
    slug: 'oil-spray-bottle-for-cooking',
    shortDescription: 'Pressurized oil mister for healthy meal prep.',
    description:
      'Refillable spray bottle with fine mist output for air fryer and pan cooking.',
    categorySlug: 'home-kitchen',
    specs: [
      { name: 'Capacity', value: '200ml' },
      { name: 'Body', value: 'Glass bottle' },
    ],
    variants: [
      { color: 'Clear', size: '200ml', price: 690, stock: 44 },
      { color: 'Amber', size: '200ml', price: 750, stock: 27 },
    ],
  },
  {
    name: 'Jade Roller and Gua Sha Set',
    slug: 'jade-roller-and-gua-sha-set',
    shortDescription: 'Facial massage duo for cooling skin routine.',
    description:
      'Beauty massage set for depuffing and circulation support in daily skincare ritual.',
    categorySlug: 'beauty-personal-care',
    specs: [
      { name: 'Material', value: 'Natural stone' },
      { name: 'Included', value: 'Roller + Gua Sha' },
    ],
    variants: [
      { color: 'Green', size: '2 pcs', price: 850, stock: 28 },
      { color: 'Rose', size: '2 pcs', price: 890, stock: 19 },
    ],
  },
  {
    name: 'Metal Strap Quartz Wrist Watch',
    slug: 'metal-strap-quartz-wrist-watch',
    shortDescription: 'Elegant budget watch with minimalist dial.',
    description:
      'Affordable dress watch inspired by top-selling global styles with alloy chain strap.',
    categorySlug: 'fashion-accessories',
    specs: [
      { name: 'Movement', value: 'Quartz' },
      { name: 'Water Resistance', value: '3 ATM' },
    ],
    variants: [
      { color: 'Silver', size: '40mm', price: 1890, stock: 16 },
      { color: 'Gold', size: '40mm', price: 1950, stock: 14 },
    ],
  },
];

const obsoleteSeedProductSlugs = ['collapsible-water-bottle-bpa-free'];

function createSku(slug, variant, index) {
  const productPart = slug
    .split('-')
    .slice(0, 3)
    .join('')
    .toUpperCase()
    .slice(0, 9);
  const colorPart = (variant.color ?? 'STD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4);
  const sizePart = (variant.size ?? 'OS')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4);
  return `${productPart}-${colorPart}-${sizePart}-${String(index + 1).padStart(2, '0')}`;
}

async function main() {
  const categoryBySlug = new Map();

  await prisma.product.deleteMany({
    where: {
      slug: {
        in: obsoleteSeedProductSlugs,
      },
    },
  });

  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: true,
      },
      update: {
        name: category.name,
        description: category.description,
        isActive: true,
      },
    });

    categoryBySlug.set(category.slug, saved.id);
  }

  for (const product of products) {
    const categoryId = categoryBySlug.get(product.categorySlug);
    if (!categoryId) {
      throw new Error(`Missing category mapping for ${product.categorySlug}`);
    }

    await prisma.$transaction(async (tx) => {
      const savedProduct = await tx.product.upsert({
        where: { slug: product.slug },
        create: {
          name: product.name,
          slug: product.slug,
          shortDescription: product.shortDescription,
          description: product.description,
          status: 'active',
        },
        update: {
          name: product.name,
          shortDescription: product.shortDescription,
          description: product.description,
          status: 'active',
        },
      });

      await tx.productVariant.deleteMany({
        where: { productId: savedProduct.id },
      });
      await tx.productSpecification.deleteMany({
        where: { productId: savedProduct.id },
      });
      await tx.productCategory.deleteMany({
        where: { productId: savedProduct.id },
      });

      await tx.productVariant.createMany({
        data: product.variants.map((variant, index) => ({
          productId: savedProduct.id,
          sku: createSku(product.slug, variant, index),
          color: variant.color,
          size: variant.size,
          price: variant.price.toFixed(2),
          stockQuantity: variant.stock,
          isActive: true,
        })),
      });

      await tx.productSpecification.createMany({
        data: product.specs.map((spec, index) => ({
          productId: savedProduct.id,
          name: spec.name,
          value: spec.value,
          sortOrder: index,
        })),
      });

      await tx.productCategory.create({
        data: {
          productId: savedProduct.id,
          categoryId,
        },
      });
    });
  }

  console.log(
    `Catalog seed complete: ${categories.length} categories and ${products.length} products.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
