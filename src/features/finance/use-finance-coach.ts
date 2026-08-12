import { useEffect, useMemo, useState } from 'react';

import { requestFinanceCoachPolish } from '@/services/finance/coach-client';
import { useFinance } from '@/store/finance';

import { buildFinanceCoachInsights, type FinanceCoachInsight } from './coach';
import { referenceSavingsAprPercent } from './rate-context';

export function useFinanceCoachInsights() {
  const transactions = useFinance((s) => s.transactions);
  const bills = useFinance((s) => s.bills);
  const buckets = useFinance((s) => s.buckets);
  const accounts = useFinance((s) => s.accounts);
  const referenceSavingsApr = useFinance((s) => s.referenceSavingsApr);

  const local = useMemo(
    () =>
      buildFinanceCoachInsights({
        transactions,
        bills,
        buckets,
        accounts,
        referenceSavingsApr,
      }),
    [transactions, bills, buckets, accounts, referenceSavingsApr],
  );

  const [insights, setInsights] = useState<FinanceCoachInsight[]>(local);
  const [source, setSource] = useState<'local' | 'ai'>('local');
  const [disclaimer, setDisclaimer] = useState(
    'Educational tips only — not personalized financial advice.',
  );

  useEffect(() => {
    setInsights(local);
    setSource('local');
    let cancelled = false;
    const savingsApr = referenceSavingsAprPercent(referenceSavingsApr);
    void requestFinanceCoachPolish({
      insights: local,
      referenceSavingsApr: savingsApr,
    })
      .then((result) => {
        if (cancelled) return;
        if (Array.isArray(result.insights) && result.insights.length) {
          setInsights(
            result.insights.map((row, index) => ({
              id: row.id || local[index]?.id || `tip-${index}`,
              title: row.title,
              body: row.body,
              priority: row.priority ?? local[index]?.priority ?? 50,
            })),
          );
          setSource(result.source);
        }
        if (result.disclaimer) setDisclaimer(result.disclaimer);
      })
      .catch(() => {
        // Keep local heuristics offline / when polish fails.
      });
    return () => {
      cancelled = true;
    };
  }, [local, referenceSavingsApr]);

  return { insights, source, disclaimer };
}
