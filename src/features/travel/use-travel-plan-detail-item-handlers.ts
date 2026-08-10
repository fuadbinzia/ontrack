import {
  emptyExpenseForm,
  expenseFormFromExpense,
  type ExpenseFormState,
} from '@/features/travel/expenses/expense-form';
import type { TravelRangeScheduleDraft } from '@/features/travel/travel-range-schedule';
import { validateTravelRangeSchedule } from '@/features/travel/travel-range-schedule';
import type { TravelItineraryItem, TravelPlan } from '@/features/travel/types';
import type { useTravelPlanConfirmationImports } from '@/features/travel/use-travel-plan-confirmation-imports';
import type { useTravelPlanItemDetailsEdit } from '@/features/travel/use-travel-plan-item-details-edit';
import type { useTravelPlanItemMedia } from '@/features/travel/use-travel-plan-item-media';
import { useTravel } from '@/store/travel';
import { formatDateKey, minutesBetween } from '@/utils/date';

type ItemHandlersOptions = {
  planId: string;
  plan: TravelPlan;
  minimizedItemIds: Set<string>;
  dateDisplayFormat: Parameters<typeof formatDateKey>[1];
  itemEdit: ReturnType<typeof useTravelPlanItemDetailsEdit>;
  itemMedia: ReturnType<typeof useTravelPlanItemMedia>;
  confirmationImports: ReturnType<typeof useTravelPlanConfirmationImports>;
  onToggle: (itemId: string) => void;
  updatePlan: (plan: TravelPlan) => void;
  setExpenseDraft: (draft: ExpenseFormState | undefined) => void;
  setOpenExpenseSheet: (open: boolean) => void;
  onBeginItemEdit?: (item: TravelItineraryItem) => void;
};

export function buildTravelPlanDetailItemHandlers({
  planId,
  plan,
  minimizedItemIds,
  dateDisplayFormat,
  itemEdit,
  itemMedia,
  confirmationImports,
  onToggle,
  updatePlan,
  setExpenseDraft,
  setOpenExpenseSheet,
  onBeginItemEdit,
}: ItemHandlersOptions) {
  return {
    plan,
    minimizedItemIds,
    dateDisplayFormat,
    editingFlightItemId: itemEdit.editingFlightItemId,
    editedFlightDetails: itemEdit.editedFlightDetails,
    editedFlightDetailsError: itemEdit.editedFlightDetailsError,
    editedFlightFileName: itemEdit.editedFlightFileName,
    importingFlightTarget: confirmationImports.importingFlightTarget,
    editingRentalItemId: itemEdit.editingRentalItemId,
    editedRentalDetails: itemEdit.editedRentalDetails,
    editedRentalDetailsError: itemEdit.editedRentalDetailsError,
    editedRentalFileName: itemEdit.editedRentalFileName,
    importingRentalTarget: confirmationImports.importingRentalTarget,
    editingStayItemId: itemEdit.editingStayItemId,
    editedStayDetails: itemEdit.editedStayDetails,
    editedStayDetailsError: itemEdit.editedStayDetailsError,
    editedStayFileName: itemEdit.editedStayFileName,
    importingStayTarget: confirmationImports.importingStayTarget,
    onToggle,
    onEditedFlightDetailsChange: itemEdit.setEditedFlightDetails,
    onImportFlight: (itemId: string) =>
      confirmationImports.chooseConfirmationImport(itemId),
    onSaveFlightDetails: itemEdit.saveEditedFlightDetails,
    onCancelFlightEdit: () => itemEdit.setEditingFlightItemId(undefined),
    onBeginFlightEdit: itemEdit.beginEditingFlightDetails,
    onEditedRentalDetailsChange: itemEdit.setEditedRentalDetails,
    onImportRental: (itemId: string) =>
      confirmationImports.chooseRentalConfirmationImport(itemId),
    onSaveRentalDetails: itemEdit.saveEditedRentalDetails,
    onCancelRentalEdit: () => itemEdit.setEditingRentalItemId(undefined),
    onBeginRentalEdit: itemEdit.beginEditingRentalDetails,
    onEditedStayDetailsChange: itemEdit.setEditedStayDetails,
    onImportStay: (itemId: string) =>
      confirmationImports.chooseStayConfirmationImport(itemId),
    onSaveStayDetails: itemEdit.saveEditedStayDetails,
    onCancelStayEdit: () => itemEdit.setEditingStayItemId(undefined),
    onBeginStayEdit: itemEdit.beginEditingStayDetails,
    onSaveTransportDetails: (
      itemId: string,
      nextDetails: NonNullable<TravelItineraryItem['transport']>,
      schedule: TravelRangeScheduleDraft,
    ) => {
      const scheduleResult = validateTravelRangeSchedule(schedule, {
        start: 'departure',
        end: 'arrival',
      });
      if (!scheduleResult.ok || schedule.endMinutes === null) return;
      const latest =
        useTravel.getState().plans.find((entry) => entry.id === planId) ?? plan;
      const durationMinutes = minutesBetween(
        schedule.startDate,
        scheduleResult.value.startMinutes,
        schedule.endDate,
        schedule.endMinutes,
      );
      const nextPlan = {
        ...latest,
        itinerary: latest.itinerary.map((item) =>
          item.id === itemId
            ? {
                ...item,
                date: schedule.startDate,
                startMinutes: scheduleResult.value.startMinutes,
                durationMinutes,
                transport: nextDetails,
              }
            : item,
        ),
        updatedAt: new Date().toISOString(),
      };
      updatePlan(nextPlan);
      if (nextDetails.fare && nextDetails.currency) {
        const existing = latest.expenses.find(
          (expense) => expense.travelItemId === itemId,
        );
        setExpenseDraft({
          ...(existing
            ? expenseFormFromExpense(existing)
            : emptyExpenseForm(latest, nextDetails.currency)),
          title:
            latest.itinerary.find((item) => item.id === itemId)?.title ??
            'Transport',
          amountText: String(nextDetails.fare),
          currency: nextDetails.currency,
          date: schedule.startDate,
          category: 'transport',
          travelItemId: itemId,
        });
        setOpenExpenseSheet(true);
      }
    },
    onAddPhotos: itemMedia.addPhotosToItem,
    onRemove: itemMedia.confirmRemoveItem,
    onSaveNotes: itemMedia.saveItemNotes,
    onBeginItemEdit,
  };
}

export type TravelPlanDetailItemHandlers = ReturnType<
  typeof buildTravelPlanDetailItemHandlers
>;
