const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'beauty & personal care': 'Personal Care',
  'decor': 'Decor & Accessories',
  'fashion accessories': 'Daily Accessories',
  'fitness & outdoors': 'Fitness & Outdoor Tools',
  'home & kitchen': 'Kitchen & Home',
  'home and kitchen': 'Kitchen & Home',
  'home kitchen': 'Kitchen & Home',
  'smart gadgets': 'Smart Gadgets',
};

const CURATED_CATEGORY_ORDER = [
  'Kitchen & Cooking',
  'Kitchen & Home',
  'Home Organization',
  'Decor & Accessories',
  'Smart Gadgets',
  'Bathroom Essentials',
  'Personal Care',
  'Daily Accessories',
  'Fitness & Outdoor Tools',
];

const MOBILE_CHIP_RULES = [
  { label: 'All', match: (displayName: string) => displayName === 'All products' },
  { label: 'Kitchen', match: (displayName: string) => displayName.includes('Kitchen') },
  {
    label: 'Home',
    match: (displayName: string) =>
      displayName.includes('Home') && !displayName.includes('Kitchen'),
  },
  { label: 'Smart Gadgets', match: (displayName: string) => displayName.includes('Smart') },
  { label: 'Decor', match: (displayName: string) => displayName.includes('Decor') },
  { label: 'Bathroom', match: (displayName: string) => displayName.includes('Bathroom') },
];

export interface CollectionNavigationItem {
  rawName: string;
  displayName: string;
}

function normalizeCategoryName(category: string) {
  return category.trim().replace(/\s+/g, ' ');
}

function stripSeedLabel(value: string) {
  return value
    .replace(/^["']?test category["']?\s*/i, '')
    .replace(/^["']?test_item["']?\s*/i, '')
    .replace(/^test product\s*/i, '')
    .trim();
}

function isPlaceholderCategory(category: string) {
  const normalized = stripSeedLabel(normalizeCategoryName(category)).toLowerCase();

  return (
    !normalized ||
    normalized === 'test category' ||
    normalized.includes('placeholder') ||
    normalized.includes('temporary') ||
    normalized.startsWith('test ') ||
    normalized.endsWith(' test')
  );
}

export function getDisplayCategoryName(category: string) {
  const normalized = stripSeedLabel(normalizeCategoryName(category));

  if (!normalized || normalized.toLowerCase() === 'all') {
    return 'All products';
  }

  if (isPlaceholderCategory(normalized)) {
    return 'Collection';
  }

  return CATEGORY_DISPLAY_NAMES[normalized.toLowerCase()] ?? normalized;
}

export function getCollectionDescription(category: string) {
  const displayName = getDisplayCategoryName(category);

  if (displayName === 'All products') {
    return 'Curated practical home essentials.';
  }

  return `${displayName} essentials.`;
}

export function buildCollectionNavigation(categories: string[]): CollectionNavigationItem[] {
  const seenLabels = new Map<string, number>();
  const displayCategories = categories.filter((category) => {
    const normalized = stripSeedLabel(normalizeCategoryName(category));
    return normalized.toLowerCase() === 'all' || !isPlaceholderCategory(normalized);
  });

  const items = displayCategories.map((category) => {
    const displayName = getDisplayCategoryName(category);
    const duplicateCount = seenLabels.get(displayName) ?? 0;
    seenLabels.set(displayName, duplicateCount + 1);

    return {
      rawName: category,
      displayName:
        duplicateCount === 0 ? displayName : `${displayName} ${duplicateCount + 1}`,
    };
  });

  return items.sort((first, second) => {
    if (first.displayName === 'All products') return -1;
    if (second.displayName === 'All products') return 1;

    const firstIndex = CURATED_CATEGORY_ORDER.indexOf(first.displayName);
    const secondIndex = CURATED_CATEGORY_ORDER.indexOf(second.displayName);

    if (firstIndex !== -1 || secondIndex !== -1) {
      return (
        (firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex) -
        (secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex)
      );
    }

    return first.displayName.localeCompare(second.displayName);
  });
}

export function getDisplayProductName(name: string) {
  return stripSeedLabel(name) || name;
}

export function buildMobileCollectionChips(
  collectionNavigation: CollectionNavigationItem[],
) {
  const usedRawNames = new Set<string>();

  return MOBILE_CHIP_RULES.flatMap((rule) => {
    const match = collectionNavigation.find(
      (item) => !usedRawNames.has(item.rawName) && rule.match(item.displayName),
    );

    if (!match) return [];

    usedRawNames.add(match.rawName);
    return [{ ...match, displayName: rule.label }];
  });
}
