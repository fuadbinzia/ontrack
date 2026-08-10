import type { ApiRateLimitPeek, PaidApiBucket } from './api-rate-limit';

export type ApiUsageMetering =
  | 'app-rate-limit'
  | 'route-limit'
  | 'unmetered'
  | 'provider-account'
  | 'local';

export type ApiServiceHealth =
  | 'healthy'
  | 'degraded'
  | 'down'
  | 'unconfigured'
  | 'unchecked';

export type ApiHealthProbe = {
  kind:
    | 'http'
    | 'ollama'
    | 'supabase'
    | 'openai'
    | 'gemini'
    | 'tmdb'
    | 'usda'
    | 'amadeus'
    | 'destination-cover'
  /** Public/read-only URL for `http` probes — never use paid generation endpoints. */
  url?: string;
  /** Optional failover URLs tried after `url` (same headers / okStatuses). */
  fallbackUrls?: readonly string[];
  okStatuses?: readonly number[];
  /** Headers for `http` probes (include Accept when needed). */
  headers?: Record<string, string>;
};

export type ApiUsageCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  /** Feature surfaces that call this service. */
  usedBy: readonly string[];
  metering: ApiUsageMetering;
  /** Shared in-process app quota when metering is app-rate-limit. */
  bucket?: PaidApiBucket;
  /** Static limit copy when live counts are unavailable. */
  limitNote?: string;
  /**
   * Env presence check key — server maps this to configured boolean.
   * Omit for public/always-available clients.
   */
  configKey?: ApiUsageConfigKey;
  /** `guardedFetch` dependency names that feed circuit health. */
  guardNames?: readonly string[];
  /** Optional free/read-only reachability probe. */
  healthProbe?: ApiHealthProbe;
};

export type ApiUsageServiceSnapshot = {
  id: string;
  name: string;
  provider: string;
  usedBy: string[];
  metering: ApiUsageMetering;
  bucket?: PaidApiBucket;
  configured: boolean | null;
  health: ApiServiceHealth;
  healthLabel: string;
  healthDetail: string;
  healthLatencyMs: number | null;
  used: number | null;
  max: number | null;
  remaining: number | null;
  windowMs: number | null;
  note: string;
};

export type ApiUsageSnapshot = {
  subject: string;
  generatedAt: string;
  buckets: Record<PaidApiBucket, ApiRateLimitPeek>;
  healthSummary: Record<ApiServiceHealth, number>;
  services: ApiUsageServiceSnapshot[];
};

export type ApiUsageConfigKey =
  | 'openai'
  | 'gemini'
  | 'ollama'
  | 'usda'
  | 'tmdb'
  | 'amadeus'
  | 'aerodatabox'
  | 'supabase'
  /** Apple/Google OAuth via Supabase Auth (same host credentials as `supabase`). */
  | 'apple-google-auth';

/** Canonical third-party / external services used by onTrack. */
export const API_USAGE_CATALOG: readonly ApiUsageCatalogEntry[] = [
  {
    id: 'openai-nutrition',
    name: 'OpenAI (meals)',
    provider: 'OpenAI Responses / Images',
    usedBy: ['Meal photo & link analysis', 'Meal image enhance', 'USDA-backed nutrient lookup path'],
    metering: 'app-rate-limit',
    bucket: 'nutrition',
    configKey: 'openai',
    guardNames: ['openai'],
    healthProbe: { kind: 'openai' },
  },
  {
    id: 'openai-recipe',
    name: 'OpenAI (recipes)',
    provider: 'OpenAI',
    usedBy: ['Recipe URL / image import'],
    metering: 'app-rate-limit',
    bucket: 'recipe',
    configKey: 'openai',
    guardNames: ['openai'],
    healthProbe: { kind: 'openai' },
  },
  {
    id: 'openai-food',
    name: 'OpenAI (food)',
    provider: 'OpenAI',
    usedBy: ['AI recipe ideas', 'Ingredient label scan'],
    metering: 'app-rate-limit',
    bucket: 'food',
    configKey: 'openai',
    guardNames: ['openai'],
    healthProbe: { kind: 'openai' },
  },
  {
    id: 'openai-plant',
    name: 'OpenAI (plants)',
    provider: 'OpenAI',
    usedBy: ['Plant identify', 'Plant care tips'],
    metering: 'app-rate-limit',
    bucket: 'plant',
    configKey: 'openai',
    guardNames: ['openai'],
    healthProbe: { kind: 'openai' },
  },
  {
    id: 'openai-health',
    name: 'OpenAI (health)',
    provider: 'OpenAI',
    usedBy: ['Health action suggestions'],
    metering: 'app-rate-limit',
    bucket: 'health',
    configKey: 'openai',
    guardNames: ['openai'],
    healthProbe: { kind: 'openai' },
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'Google Generative Language',
    usedBy: ['Travel confirmation import (flights / stays / rentals)'],
    metering: 'app-rate-limit',
    bucket: 'flights',
    limitNote: 'Shares the flights app bucket with Amadeus search.',
    configKey: 'gemini',
    guardNames: ['gemini-travel'],
    healthProbe: { kind: 'gemini' },
  },
  {
    id: 'ollama',
    name: 'Ollama',
    provider: 'Local loopback',
    usedBy: ['Meal / plant / recipe analysis when local AI is enabled'],
    metering: 'local',
    limitNote: 'Runs on this machine — no cloud quota.',
    configKey: 'ollama',
    guardNames: ['ollama'],
    healthProbe: { kind: 'ollama' },
  },
  {
    id: 'usda-fdc',
    name: 'USDA FoodData Central',
    provider: 'USDA FDC',
    usedBy: ['Meal analysis nutrient lookup'],
    metering: 'app-rate-limit',
    bucket: 'nutrition',
    limitNote: 'Counted under the nutrition app bucket with OpenAI meal calls.',
    configKey: 'usda',
    guardNames: ['usda-fdc'],
    healthProbe: { kind: 'usda' },
  },
  {
    id: 'tmdb',
    name: 'TMDB',
    provider: 'The Movie Database',
    usedBy: ['Movie search', 'Movie details'],
    metering: 'app-rate-limit',
    bucket: 'movies',
    configKey: 'tmdb',
    guardNames: ['tmdb'],
    healthProbe: { kind: 'tmdb' },
  },
  {
    id: 'amadeus',
    name: 'Amadeus',
    provider: 'Amadeus Self-Service',
    usedBy: ['Flight search', 'Airport / city lookup'],
    metering: 'app-rate-limit',
    bucket: 'flights',
    limitNote: 'Shares the flights app bucket with Gemini confirmation parse.',
    configKey: 'amadeus',
    guardNames: ['amadeus'],
    healthProbe: { kind: 'amadeus' },
  },
  {
    id: 'aerodatabox',
    name: 'AeroDataBox',
    provider: 'RapidAPI',
    usedBy: ['Live flight status', 'Terminal / gate sync'],
    metering: 'route-limit',
    limitNote:
      'App route limit: 10 requests/min per client IP. No free health probe — status uses circuit + credentials only. Auto terminal sync is off in __DEV__; agent-ui demo flights never call RapidAPI.',
    configKey: 'aerodatabox',
    guardNames: ['aerodatabox'],
  },
  {
    id: 'inaturalist',
    name: 'iNaturalist',
    provider: 'iNaturalist taxa API',
    usedBy: ['Plant taxonomy search'],
    metering: 'app-rate-limit',
    bucket: 'plant',
    limitNote: 'Counted under the plant app bucket.',
    guardNames: ['inaturalist'],
    healthProbe: {
      kind: 'http',
      url: 'https://api.inaturalist.org/v1/taxa/autocomplete?q=oak&is_active=true&locale=en&per_page=1',
      headers: { Accept: 'application/json' },
    },
  },
  {
    id: 'open-meteo',
    name: 'Open-Meteo',
    provider: 'Open-Meteo',
    usedBy: [
      'Travel weather',
      'Today home weather',
      'Profile city autocomplete (geocoding)',
    ],
    metering: 'unmetered',
    limitNote: 'Public free API — no in-app quota.',
    healthProbe: {
      kind: 'http',
      // Geocoding is the first hop for every weather lookup.
      url: 'https://geocoding-api.open-meteo.com/v1/search?name=Reykjavik&count=1&language=en&format=json',
      headers: { Accept: 'application/json' },
    },
  },
  {
    id: 'currency-api',
    name: 'Currency API',
    provider: '@fawazahmed0/currency-api (jsDelivr)',
    usedBy: ['Travel expense FX rates'],
    metering: 'unmetered',
    limitNote: 'Active FX feed. Frankfurter kept as fallback.',
    healthProbe: {
      kind: 'http',
      // Same hosts as `CURRENCY_API_URLS` in fx-providers.ts.
      url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      fallbackUrls: ['https://latest.currency-api.pages.dev/v1/currencies/usd.json'],
      headers: { Accept: 'application/json' },
    },
  },
  {
    id: 'frankfurter',
    name: 'Frankfurter',
    provider: 'Frankfurter / ECB',
    usedBy: ['Travel expense FX (fallback)'],
    metering: 'unmetered',
    limitNote: 'Fallback when Currency API is unreachable.',
    healthProbe: {
      kind: 'http',
      url: 'https://api.frankfurter.dev/v1/latest?base=USD',
      headers: { Accept: 'application/json' },
    },
  },
  {
    id: 'iconify',
    name: 'Iconify',
    provider: 'api.iconify.design',
    usedBy: ['Profile avatar icon search & SVG'],
    metering: 'unmetered',
    limitNote: 'Public CDN — no in-app quota.',
    healthProbe: {
      kind: 'http',
      url: 'https://api.iconify.design/search?query=account&limit=1',
      headers: { Accept: 'application/json' },
    },
  },
  {
    id: 'destination-cover',
    name: 'Destination covers',
    provider: 'Unsplash / Wikimedia',
    usedBy: ['Travel trip cover photos'],
    metering: 'unmetered',
    limitNote: 'Free lookup via Expo API route — provider quotas not tracked.',
    healthProbe: { kind: 'destination-cover' },
  },
  {
    id: 'photon',
    name: 'Photon',
    provider: 'Komoot Photon',
    usedBy: ['Travel address autocomplete'],
    metering: 'unmetered',
    limitNote: 'Public geocoder — no in-app quota.',
    healthProbe: {
      kind: 'http',
      url: 'https://photon.komoot.io/api/?q=paris&limit=1&lang=en',
      headers: { Accept: 'application/json' },
    },
  },
  {
    id: 'nhtsa',
    name: 'NHTSA vPIC',
    provider: 'NHTSA',
    usedBy: ['Vehicle VIN decode'],
    metering: 'unmetered',
    limitNote: 'Public government API — no in-app quota.',
    healthProbe: {
      kind: 'http',
      url: 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1HGCM82633A004352?format=json',
      headers: { Accept: 'application/json' },
    },
  },
  {
    id: 'travelpayouts',
    name: 'Travelpayouts',
    provider: 'Travelpayouts places autocomplete',
    usedBy: ['Flight location suggestions'],
    metering: 'unmetered',
    limitNote: 'Public autocomplete — no in-app quota.',
    healthProbe: {
      kind: 'http',
      url: 'https://autocomplete.travelpayouts.com/places2?term=nyc&locale=en&types[]=city&types[]=airport',
      headers: { Accept: 'application/json' },
    },
  },
  {
    id: 'avs-logos',
    name: 'Airline logos',
    provider: 'pics.avs.io',
    usedBy: ['Flight cards airline artwork'],
    metering: 'unmetered',
    limitNote: 'Image CDN — no in-app quota.',
    healthProbe: {
      kind: 'http',
      url: 'https://pics.avs.io/al_square/96/96/AA.png',
      headers: { Accept: 'image/png,*/*' },
      okStatuses: [200],
    },
  },
  {
    id: 'supabase',
    name: 'Supabase',
    provider: 'Supabase Auth + Postgres + Realtime',
    usedBy: [
      'Sign-in / session',
      'Cloud sync',
      'Travel chat & roster',
      'Todo / vehicle collaboration',
    ],
    metering: 'provider-account',
    limitNote: 'Account plan limits live in the Supabase dashboard — not metered in-app.',
    configKey: 'supabase',
    guardNames: ['supabase-auth', 'supabase-rest'],
    healthProbe: { kind: 'supabase' },
  },
  {
    id: 'apple-google-auth',
    name: 'Apple & Google Sign-In',
    provider: 'Apple / Google OAuth',
    usedBy: ['Account upgrade & cloud bind'],
    metering: 'provider-account',
    limitNote:
      'Uses Supabase Auth for Apple/Google OAuth. Provider quotas live at Apple/Google — not metered in-app.',
    configKey: 'apple-google-auth',
  },
];

export function resolveApiUsageConfigured(
  key: ApiUsageConfigKey | undefined,
): boolean | null {
  if (!key) return null;
  switch (key) {
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY?.trim());
    case 'gemini':
      return Boolean(process.env.GEMINI_API_KEY?.trim());
    case 'ollama':
      return (
        process.env.LOCAL_MEAL_AI_ENABLED === 'true' ||
        process.env.LOCAL_PLANT_AI_ENABLED === 'true' ||
        Boolean(process.env.OLLAMA_BASE_URL?.trim())
      );
    case 'usda':
      return Boolean(process.env.USDA_FDC_API_KEY?.trim());
    case 'tmdb':
      return Boolean(process.env.TMDB_READ_ACCESS_TOKEN?.trim());
    case 'amadeus':
      return Boolean(
        process.env.AMADEUS_CLIENT_ID?.trim() && process.env.AMADEUS_CLIENT_SECRET?.trim(),
      );
    case 'aerodatabox':
      return Boolean(process.env.AERODATABOX_API_KEY?.trim());
    case 'supabase':
    case 'apple-google-auth':
      // Sign-in is Supabase Auth + native Apple / Google OAuth — same project credentials.
      return Boolean(
        (process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()) &&
          (process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
            process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()),
      );
    default:
      return null;
  }
}
