import type { IngredientKnowledge } from '@/types/food';

/**
 * Reference-data samples for Ingredient Info screens. Every jurisdiction row
 * carries `sourceUrl` + `lastReviewedAt` — the restricted/banned example must
 * never render without them.
 */
export const FOOD_FIXTURE_INGREDIENT_KNOWLEDGE: IngredientKnowledge[] = [
  {
    canonicalKey: 'potassium-bromate',
    name: 'Potassium bromate',
    aliases: ['E924', 'bromated flour'],
    functionalPurpose: 'Dough strengthener that improves rise in commercial baking.',
    concerns: [
      'Classified as possibly carcinogenic (IARC Group 2B) in animal studies.',
    ],
    allergenTags: [],
    dietaryCompatibility: {},
    jurisdictionStatuses: [
      {
        countryCode: 'US',
        countryName: 'United States',
        status: 'allowed',
        reason: 'Permitted within FDA limits; industry use has declined.',
        sourceUrl: 'https://www.fda.gov/food/food-additives-petitions',
        lastReviewedAt: '2025-11-12T00:00:00.000Z',
      },
      {
        countryCode: 'EU',
        countryName: 'European Union',
        status: 'banned',
        reason: 'Not on the EU approved food additives list.',
        sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2008/1333/oj',
        lastReviewedAt: '2025-11-12T00:00:00.000Z',
      },
      {
        countryCode: 'CA',
        countryName: 'Canada',
        status: 'banned',
        reason: 'Prohibited under the Food and Drug Regulations.',
        sourceUrl: 'https://laws-lois.justice.gc.ca/eng/regulations/c.r.c.,_c._870/',
        lastReviewedAt: '2025-11-12T00:00:00.000Z',
      },
    ],
    alternatives: ['ascorbic acid (vitamin C) as a dough conditioner'],
    lastReviewedAt: '2025-11-12T00:00:00.000Z',
    sources: [
      {
        title: 'EU Regulation (EC) No 1333/2008 on food additives',
        url: 'https://eur-lex.europa.eu/eli/reg/2008/1333/oj',
        accessedAt: '2025-11-12T00:00:00.000Z',
      },
    ],
  },
  {
    canonicalKey: 'tartrazine',
    name: 'Tartrazine',
    aliases: ['E102', 'FD&C Yellow No. 5'],
    functionalPurpose: 'Synthetic yellow colorant for drinks, sweets, and snacks.',
    concerns: ['May trigger reactions in people sensitive to azo dyes.'],
    allergenTags: [],
    dietaryCompatibility: {},
    jurisdictionStatuses: [
      {
        countryCode: 'EU',
        countryName: 'European Union',
        status: 'restricted',
        reason: 'Allowed with a mandatory hyperactivity warning label.',
        sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2008/1333/oj',
        lastReviewedAt: '2025-10-02T00:00:00.000Z',
      },
      {
        countryCode: 'US',
        countryName: 'United States',
        status: 'allowed',
        reason: 'Certified color additive; must be declared on the label.',
        sourceUrl: 'https://www.fda.gov/industry/color-additives',
        lastReviewedAt: '2025-10-02T00:00:00.000Z',
      },
    ],
    alternatives: ['turmeric or saffron for yellow color'],
    lastReviewedAt: '2025-10-02T00:00:00.000Z',
    sources: [
      {
        title: 'FDA Color Additives overview',
        url: 'https://www.fda.gov/industry/color-additives',
        accessedAt: '2025-10-02T00:00:00.000Z',
      },
    ],
  },
  {
    canonicalKey: 'peanut',
    name: 'Peanut',
    aliases: ['groundnut', 'arachis oil (unrefined)'],
    functionalPurpose: 'Legume used whole, as butter, flour, and pressed oil.',
    concerns: ['One of the most common severe food allergens.'],
    allergenTags: ['peanut'],
    dietaryCompatibility: { 'nut-free': 'incompatible' },
    jurisdictionStatuses: [],
    alternatives: ['sunflower seed butter', 'roasted chickpeas'],
    lastReviewedAt: '2025-09-18T00:00:00.000Z',
    sources: [
      {
        title: 'FDA Food Allergies overview',
        url: 'https://www.fda.gov/food/food-labeling-nutrition/food-allergies',
        accessedAt: '2025-09-18T00:00:00.000Z',
      },
    ],
  },
  {
    canonicalKey: 'saffron',
    name: 'Saffron',
    aliases: ['crocus stigma', 'kesar'],
    functionalPurpose: 'Aromatic spice and natural yellow-orange colorant.',
    concerns: [],
    allergenTags: [],
    dietaryCompatibility: { halal: 'compatible', kosher: 'compatible', vegan: 'compatible' },
    jurisdictionStatuses: [
      {
        countryCode: 'US',
        countryName: 'United States',
        status: 'allowed',
        reason: 'Generally recognized as safe as a spice and colorant.',
        sourceUrl: 'https://www.fda.gov/food/food-ingredients-packaging/generally-recognized-safe-gras',
        lastReviewedAt: '2025-09-18T00:00:00.000Z',
      },
    ],
    alternatives: [],
    lastReviewedAt: '2025-09-18T00:00:00.000Z',
    sources: [
      {
        title: 'FDA GRAS overview',
        url: 'https://www.fda.gov/food/food-ingredients-packaging/generally-recognized-safe-gras',
        accessedAt: '2025-09-18T00:00:00.000Z',
      },
    ],
  },
];
