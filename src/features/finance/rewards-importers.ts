import type { FinanceRewardProfileDraft, RewardProfileImporter } from './rewards-types';

/** Provider-neutral manual importer used by editors and future catalog adapters. */
export const manualRewardProfileImporter: RewardProfileImporter<FinanceRewardProfileDraft> = {
  id: 'manual',
  async import(draft) {
    return {
      ...draft,
      source: { ...draft.source, kind: 'manual', warnings: [...draft.source.warnings] },
      rules: draft.rules.map((rule) => ({ ...rule })),
      benefits: draft.benefits.map((benefit) => ({ ...benefit })),
      editedFields: [...draft.editedFields],
    };
  },
};
