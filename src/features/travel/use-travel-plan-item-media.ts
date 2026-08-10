import { useRef, useState } from 'react';

import { appPrompt } from '@/components/primitives';
import { persistTravelMomentPhotos } from '@/features/travel/travel-moment-media';
import type { TravelRemoveConfirmPayload } from '@/features/travel/travel-remove-confirm-modal';
import type { TravelPlan } from '@/features/travel/types';
import { useTravel } from '@/store/travel';
import { AgentUiIds } from '@/utils/agent-ui';

type ItineraryItem = TravelPlan['itinerary'][number];

/** Photos, notes, and remove-confirm for plan-detail itinerary items. */
export function useTravelPlanItemMedia({
  planId,
  plan,
  itinerary,
  updatePlan,
}: {
  planId: string;
  plan: TravelPlan;
  itinerary: TravelPlan['itinerary'];
  updatePlan: (next: TravelPlan) => void;
}) {
  const [addPhotosItemId, setAddPhotosItemId] = useState<string>();
  const addPhotosItemIdRef = useRef<string | undefined>(undefined);
  const [removeConfirm, setRemoveConfirm] =
    useState<TravelRemoveConfirmPayload | null>(null);

  const removeItem = (itemId: string, removeLinkedExpense = false) => {
    const latest = useTravel.getState().plans.find((entry) => entry.id === planId) ?? plan;
    updatePlan({
      ...latest,
      itinerary: latest.itinerary.filter((item) => item.id !== itemId),
      expenses: removeLinkedExpense
        ? latest.expenses.filter((expense) => expense.travelItemId !== itemId)
        : latest.expenses,
      updatedAt: new Date().toISOString(),
    });
  };

  const confirmRemoveItem = (item: ItineraryItem) => {
    const linkedExpense = plan.expenses.find((expense) => expense.travelItemId === item.id);
    if (linkedExpense) {
      appPrompt.alert(
        'Remove Transport?',
        `“${linkedExpense.title}” is linked to this itinerary item. Choose whether to keep it in Expenses.`,
        [
          {
            text: 'Keep Expense',
            style: 'destructive',
            testID: AgentUiIds.travel.transport.removeKeepExpense,
            onPress: () => removeItem(item.id),
          },
          {
            text: 'Remove Both',
            style: 'destructive',
            testID: AgentUiIds.travel.transport.removeWithExpense,
            onPress: () => removeItem(item.id, true),
          },
        ],
      );
      return;
    }
    setRemoveConfirm({
      title: 'Remove Itinerary Item?',
      message: 'This action will permanently remove this itinerary item.',
      actionLabel: 'Remove Item',
      onConfirm: () => removeItem(item.id),
    });
  };

  const setItemPhotos = (itemId: string, nextUris: string[]) => {
    const latest =
      useTravel.getState().plans.find((entry) => entry.id === planId) ?? plan;
    updatePlan({
      ...latest,
      itinerary: latest.itinerary.map((item) =>
        item.id === itemId
          ? {
              ...item,
              photoUris: nextUris.length ? nextUris : undefined,
            }
          : item,
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const saveItemNotes = (
    itemId: string,
    notes: NonNullable<ItineraryItem['notes']>,
  ) => {
    const latest =
      useTravel.getState().plans.find((entry) => entry.id === planId) ?? plan;
    updatePlan({
      ...latest,
      itinerary: latest.itinerary.map((item) =>
        item.id === itemId
          ? {
              ...item,
              notes: notes.length ? notes : undefined,
            }
          : item,
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const clearPhotosFromItem = (itemId: string) => {
    setItemPhotos(itemId, []);
  };

  const appendPhotosToItem = async (itemId: string, uris: string[]) => {
    if (!uris.length) return;
    try {
      if (!useTravel.getState().plans.some((entry) => entry.id === planId)) return;
      const persisted = await persistTravelMomentPhotos(uris, itemId);
      // Re-read after await so concurrent itinerary/notes edits are not overwritten.
      const latest = useTravel.getState().plans.find((entry) => entry.id === planId);
      if (!latest) return;
      const current = latest.itinerary.find((entry) => entry.id === itemId);
      if (!current) return;
      const next = [...(current.photoUris ?? []), ...persisted];
      updatePlan({
        ...latest,
        itinerary: latest.itinerary.map((item) =>
          item.id === itemId
            ? { ...item, photoUris: next.length ? next : undefined }
            : item,
        ),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (__DEV__) console.warn('[addPhotosToItem]', error);
      appPrompt.alert(
        'Couldn’t save photo',
        'Something went wrong while saving. Try again with another image.',
      );
    }
  };

  const addPhotosToItem = (itemId: string) => {
    addPhotosItemIdRef.current = itemId;
    setAddPhotosItemId(itemId);
  };

  const clearAddPhotos = () => {
    addPhotosItemIdRef.current = undefined;
    setAddPhotosItemId(undefined);
  };

  return {
    addPhotosItemId,
    addPhotosItemIdRef,
    removeConfirm,
    setRemoveConfirm,
    confirmRemoveItem,
    saveItemNotes,
    clearPhotosFromItem,
    appendPhotosToItem,
    addPhotosToItem,
    clearAddPhotos,
  };
}

// Re-export type for callers that previously imported from the modal module via this surface.
export type { TravelRemoveConfirmPayload };
