/**
 * Canonical design-element catalog + feature usage map.
 * Usage is maintained from app/feature imports (see design-system-gallery).
 */

export type {
  DesignCatalogElement,
  DesignCatalogGroup,
  DesignFeatureId,
} from './design-system-catalog-types';
export {
  DESIGN_CATALOG_GROUP_LABELS,
  DESIGN_CATALOG_GROUPS,
  DESIGN_FEATURE_LABELS,
} from './design-system-catalog-types';
export { DESIGN_CATALOG } from './design-system-catalog-data';

import { DESIGN_CATALOG } from './design-system-catalog-data';
import {
  DESIGN_CATALOG_GROUPS,
  DESIGN_FEATURE_LABELS,
  type DesignCatalogElement,
  type DesignCatalogGroup,
  type DesignFeatureId,
} from './design-system-catalog-types';

export function catalogByGroup(): Record<DesignCatalogGroup, DesignCatalogElement[]> {
  const out = Object.fromEntries(
    DESIGN_CATALOG_GROUPS.map((g) => [g, [] as DesignCatalogElement[]]),
  ) as Record<DesignCatalogGroup, DesignCatalogElement[]>;
  for (const el of DESIGN_CATALOG) out[el.group].push(el);
  return out;
}

export function catalogByFeature(): Record<DesignFeatureId, DesignCatalogElement[]> {
  const out = Object.fromEntries(
    (Object.keys(DESIGN_FEATURE_LABELS) as DesignFeatureId[]).map((f) => [
      f,
      [] as DesignCatalogElement[],
    ]),
  ) as Record<DesignFeatureId, DesignCatalogElement[]>;
  for (const el of DESIGN_CATALOG) {
    for (const f of el.usedBy) out[f].push(el);
  }
  return out;
}
