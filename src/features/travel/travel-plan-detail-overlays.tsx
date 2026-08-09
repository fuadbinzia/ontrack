import type { MutableRefObject } from 'react';

import type { StayBookingOpen } from '@/features/travel/booking-open';
import { BookingOpenSheet } from '@/features/travel/booking-open-sheet';
import type { ExpenseFormState } from '@/features/travel/expenses/expense-form';
import { TravelExpensesSheet } from '@/features/travel/expenses/travel-expenses-sheet';
import { TravelAddPhotosModal } from '@/features/travel/travel-add-photos-modal';
import {
    TravelImportResultModal,
    type TravelImportResult,
} from '@/features/travel/travel-import-result-modal';
import { TravelItineraryAddSheet } from '@/features/travel/travel-itinerary-add-sheet';
import { TravelRemoveConfirmModal } from '@/features/travel/travel-remove-confirm-modal';
import { TravelTimelineAddModal } from '@/features/travel/travel-timeline-add-modal';
import { TravelTripDatesSheet } from '@/features/travel/travel-trip-dates-sheet';
import { TravelTripNotesSheet } from '@/features/travel/travel-trip-notes-sheet';
import type { TravelItemKind, TravelItineraryItem, TravelPlan } from '@/features/travel/types';
import type { useTravelPlanConfirmationImports } from '@/features/travel/use-travel-plan-confirmation-imports';
import type { TravelPlanDetailAddForm } from '@/features/travel/use-travel-plan-detail-add-form';
import type { useTravelPlanItemMedia } from '@/features/travel/use-travel-plan-item-media';
import { useTravel } from '@/store/travel';
import { pickCameraImage, pickLibraryImages } from '@/utils/pick-image';

type TravelPlanDetailOverlaysProps = {
  plan: TravelPlan;
  itinerary: TravelItineraryItem[];
  form: TravelPlanDetailAddForm;
  confirmationImports: ReturnType<typeof useTravelPlanConfirmationImports>;
  itemMedia: ReturnType<typeof useTravelPlanItemMedia>;
  editingTripDates: boolean;
  setEditingTripDates: (open: boolean) => void;
  editingTripNotes: boolean;
  setEditingTripNotes: (open: boolean) => void;
  openExpenseSheet: boolean;
  setOpenExpenseSheet: (open: boolean) => void;
  expenseDraft?: ExpenseFormState;
  setExpenseDraft: (draft: ExpenseFormState | undefined) => void;
  importResult: TravelImportResult | null;
  setImportResult: (result: TravelImportResult | null) => void;
  importResultExpenseRef: MutableRefObject<{
    plan: TravelPlan;
    draft: ExpenseFormState;
  } | null>;
  devBookingOpen: Extract<StayBookingOpen, { mode: 'webview' }> | null;
  setDevBookingOpen: (
    target: Extract<StayBookingOpen, { mode: 'webview' }> | null,
  ) => void;
  updatePlan: (plan: TravelPlan) => void;
  chooseAddKind: (kind: TravelItemKind) => void;
  cancelAddToTimeline: () => void;
  addItem: () => void;
  goToItinerarySafely: () => void;
  openImportedExpenseReview: (
    sourcePlan: TravelPlan,
    draft: ExpenseFormState,
  ) => void;
};

export function TravelPlanDetailOverlays({
  plan,
  itinerary,
  form,
  confirmationImports,
  itemMedia,
  editingTripDates,
  setEditingTripDates,
  editingTripNotes,
  setEditingTripNotes,
  openExpenseSheet,
  setOpenExpenseSheet,
  expenseDraft,
  setExpenseDraft,
  importResult,
  setImportResult,
  importResultExpenseRef,
  devBookingOpen,
  setDevBookingOpen,
  updatePlan,
  chooseAddKind,
  cancelAddToTimeline,
  addItem,
  goToItinerarySafely,
  openImportedExpenseReview,
}: TravelPlanDetailOverlaysProps) {
  return (
    <>
      <TravelTripDatesSheet
        visible={editingTripDates}
        tripTitle={plan.title}
        startDate={plan.startDate}
        endDate={plan.endDate}
        itinerary={itinerary}
        onClose={() => setEditingTripDates(false)}
        onSave={(nextStartDate, nextEndDate) => {
          const latest =
            useTravel.getState().plans.find((entry) => entry.id === plan.id) ??
            plan;
          updatePlan({
            ...latest,
            startDate: nextStartDate,
            endDate: nextEndDate,
            updatedAt: new Date().toISOString(),
          });
          setEditingTripDates(false);
        }}
      />
      <TravelTripNotesSheet
        visible={editingTripNotes}
        tripTitle={plan.title}
        notes={plan.notes ?? ''}
        onClose={() => setEditingTripNotes(false)}
        onSave={(nextNotes) => {
          const latest =
            useTravel.getState().plans.find((entry) => entry.id === plan.id) ??
            plan;
          updatePlan({
            ...latest,
            notes: nextNotes,
            updatedAt: new Date().toISOString(),
          });
          setEditingTripNotes(false);
        }}
      />
      <TravelTimelineAddModal
        visible={form.isChoosingAddKind}
        onClose={() => form.setIsChoosingAddKind(false)}
        onSelect={chooseAddKind}
      />
      <TravelRemoveConfirmModal
        payload={itemMedia.removeConfirm}
        onCancel={() => itemMedia.setRemoveConfirm(null)}
      />
      <TravelAddPhotosModal
        visible={itemMedia.addPhotosItemId != null}
        onClose={itemMedia.clearAddPhotos}
        onTakePhoto={() => {
          const itemId = itemMedia.addPhotosItemIdRef.current;
          if (!itemId) return;
          void (async () => {
            const uri = await pickCameraImage();
            if (uri) await itemMedia.appendPhotosToItem(itemId, [uri]);
          })();
        }}
        onChooseFromPhotos={() => {
          const itemId = itemMedia.addPhotosItemIdRef.current;
          if (!itemId) return;
          void (async () => {
            const assets = await pickLibraryImages({
              allowsMultipleSelection: true,
              selectionLimit: 8,
            });
            if (assets?.length) {
              await itemMedia.appendPhotosToItem(
                itemId,
                assets.map((asset) => asset.uri),
              );
            }
          })();
        }}
      />
      <TravelItineraryAddSheet
        visible={form.isAddingItem}
        kind={form.kind}
        editing={Boolean(form.editingItemId)}
        title={form.title}
        date={form.date}
        startMinutes={form.startMinutes}
        endDate={form.endDate}
        endMinutes={form.endMinutes}
        details={form.details}
        bookingUrl={form.bookingUrl}
        photoUris={form.photoUris}
        flightDetails={form.flightDetails}
        flightDetailsError={form.flightDetailsError}
        flightTripType={form.flightTripType}
        returnFlightTitle={form.returnFlightTitle}
        returnFlightDetails={form.returnFlightDetails}
        returnFlightSchedule={form.returnFlightSchedule}
        importedFlightFileName={form.importedFlightFileName}
        importingFlight={confirmationImports.importingFlightTarget === 'new'}
        transportDetails={form.transportDetails}
        transportDetailsError={form.transportDetailsError}
        rentalDetails={form.rentalDetails}
        rentalDetailsError={form.rentalDetailsError}
        importedRentalFileName={form.importedRentalFileName}
        importingRental={confirmationImports.importingRentalTarget === 'new'}
        stayDetails={form.stayDetails}
        stayDetailsError={form.stayDetailsError}
        importedStayFileName={form.importedStayFileName}
        importingStay={confirmationImports.importingStayTarget === 'new'}
        error={form.error}
        importStatusLabel={confirmationImports.importStatusLabel}
        planStartDate={plan.startDate}
        planEndDate={plan.endDate}
        onClose={cancelAddToTimeline}
        onTitleChange={form.setTitle}
        onDateChange={form.setDate}
        onStartMinutesChange={form.setStartMinutes}
        onEndDateChange={form.setEndDate}
        onEndMinutesChange={form.setEndMinutes}
        onDetailsChange={form.setDetails}
        onBookingUrlChange={form.setBookingUrl}
        onPhotoUrisChange={form.setPhotoUris}
        onFlightDetailsChange={form.setFlightDetails}
        onFlightTripTypeChange={form.handleFlightTripTypeChange}
        onReturnFlightTitleChange={form.setReturnFlightTitle}
        onReturnFlightDetailsChange={form.setReturnFlightDetails}
        onReturnFlightScheduleChange={form.setReturnFlightSchedule}
        onImportFlight={(source) =>
          void confirmationImports.importConfirmation('new', source)
        }
        onTransportDetailsChange={form.setTransportDetails}
        onRentalDetailsChange={form.setRentalDetails}
        onImportRental={(source) =>
          void confirmationImports.importRental('new', source)
        }
        onStayDetailsChange={form.setStayDetails}
        onImportStay={(source) =>
          void confirmationImports.importStay('new', source)
        }
        onAdd={addItem}
      />
      <TravelExpensesSheet
        plan={plan}
        visible={openExpenseSheet}
        initialForm={expenseDraft}
        onClose={() => {
          setOpenExpenseSheet(false);
          setExpenseDraft(undefined);
        }}
        onSavePlan={updatePlan}
        onSaved={({ mode }) => {
          setOpenExpenseSheet(false);
          setExpenseDraft(undefined);
          if (mode === 'edit') return;
          importResultExpenseRef.current = null;
          setImportResult({ stage: 'expense-saved' });
        }}
      />
      <TravelImportResultModal
        result={importResult}
        onClose={goToItinerarySafely}
        onReviewExpense={() => {
          const pending = importResultExpenseRef.current;
          setImportResult(null);
          if (pending) {
            importResultExpenseRef.current = null;
            openImportedExpenseReview(pending.plan, pending.draft);
            return;
          }
          setOpenExpenseSheet(true);
        }}
      />
      <BookingOpenSheet
        target={devBookingOpen}
        onClose={() => setDevBookingOpen(null)}
      />
    </>
  );
}
