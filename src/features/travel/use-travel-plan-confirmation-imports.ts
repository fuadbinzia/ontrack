import { useRef, useState } from 'react';

import { appPrompt } from '@/components/primitives';
import { applyImportedFlightsToPlan } from '@/features/travel/apply-imported-flights';
import { applyImportedRentalToPlan } from '@/features/travel/apply-imported-rental';
import type { ExpenseFormState } from '@/features/travel/expenses/expense-form';
import { defaultSplitIds } from '@/features/travel/expenses/expense-math';
import { mergeFlightConfirmationDraftDetails } from '@/features/travel/flight-confirmation-draft';
import {
  importFlightConfirmation,
  type FlightConfirmationImportSource,
  type ImportedFlightConfirmation,
} from '@/features/travel/flight-confirmation-import';
import { splitRoundTripDirections } from '@/features/travel/flight-confirmation-itinerary';
import {
  flightConfirmationSchedule,
  flightDirectionSchedule,
} from '@/features/travel/flight-confirmation-schedule';
import { emptyFlightDetailsDraft } from '@/features/travel/flight-details';
import {
  flightLegScheduleFromImported,
  returnFlightTitle,
} from '@/features/travel/flight-roundtrip-draft';
import { formatFlightTitle } from '@/features/travel/flight-route-label';
import { enrichFlightConfirmationTerminals } from '@/features/travel/flight-status-client';
import {
  importRentalConfirmation,
  type RentalConfirmationImportSource,
} from '@/features/travel/rental-confirmation-import';
import {
  importStayConfirmation,
  type StayConfirmationImportSource,
} from '@/features/travel/stay-confirmation-import';
import { expandedTripRangeForStay } from '@/features/travel/stay-confirmation-itinerary';
import { applyStayExpenseFromImport } from '@/features/travel/stay-expense-from-import';
import { DETAILS_MAX_LENGTH } from '@/features/travel/travel-itinerary-form';
import {
  applyFlightScheduleToAddSheet,
  type EditBindings,
  type TravelPlanAddSheetImportBindings,
} from '@/features/travel/travel-plan-confirmation-import-shared';
import { runFlightConfirmationImport } from '@/features/travel/travel-plan-confirmation-import-flight';
import { isTravelMemberPlan } from '@/features/travel/trip-roster';
import type { StayDetailsDraft } from '@/features/travel/stay-details';
import type { TravelPlan } from '@/features/travel/types';
import { TRAVEL_EXPENSE_SELF_ID } from '@/features/travel/types';
import { newId } from '@/store/schedule';
import { useTravel } from '@/store/travel';

export type {
  EditBindings,
  TravelPlanAddSheetImportBindings,
} from '@/features/travel/travel-plan-confirmation-import-shared';

/**
 * Flight/rental/stay confirmation document import for plan detail
 * (add sheet + inline item edit). Owns importing*Target + status label.
 */
export function useTravelPlanConfirmationImports({
  plan,
  updatePlan,
  accountEmail,
  addSheet,
  edit,
  navigation,
}: {
  plan: TravelPlan;
  updatePlan: (next: TravelPlan) => void;
  accountEmail?: string;
  addSheet: TravelPlanAddSheetImportBindings;
  edit: EditBindings;
  navigation?: {
    onOpenExpenseDraft?: (planId: string, draft: ExpenseFormState) => void;
    onPrepareExpenseDraft?: (planId: string, draft: ExpenseFormState) => void;
    onGoToItinerary?: (planId: string) => void;
  };
}) {
  const [importingFlightTarget, setImportingFlightTarget] = useState<string>();
  const [importingRentalTarget, setImportingRentalTarget] = useState<string>();
  const [importingStayTarget, setImportingStayTarget] = useState<string>();
  /** Blocks dismiss/reset while a system picker or OCR import is in flight. */
  const importInProgressRef = useRef(false);
  const [importStatusLabel, setImportStatusLabel] = useState<string>();

  const runAddSheetImport = async <T,>(work: () => Promise<T>): Promise<T> => {
    importInProgressRef.current = true;
    try {
      return await work();
    } finally {
      importInProgressRef.current = false;
    }
  };

  /** Let the import spinner commit before the system picker covers the sheet. */
  const paintImportLoading = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 48));

  const confirmationPickerUi = (args: {
    onOpening: () => void;
    onReading: () => void;
  }) => ({
    pickerWillPresent: () => {
      args.onOpening();
      setImportStatusLabel(undefined);
    },
    onPhase: (phase: 'picker' | 'reading') => {
      if (phase === 'reading') {
        args.onReading();
        setImportStatusLabel(undefined);
      }
    },
  });

  const expenseDraftForImport = (
    title: string,
    amount: number,
    currency: string | undefined,
    date: string | undefined,
    category: 'flight' | 'transport' | 'stay',
    notes?: string,
  ): ExpenseFormState => ({
    title,
    amountText: String(amount),
    currency: currency ?? plan.baseCurrency,
    date: date ?? plan.startDate,
    category,
    notes: notes ?? '',
    paidById: TRAVEL_EXPENSE_SELF_ID,
    splitWithIds: defaultSplitIds(plan.participants, isTravelMemberPlan(plan)),
  });

  const prepareImportedExpenseDraft = (
    amount: number,
    currency: string | undefined,
    date: string | undefined,
    category: 'flight' | 'transport' | 'stay',
    title: string,
    notes?: string,
  ) => {
    if (!navigation?.onPrepareExpenseDraft) return;
    navigation.onPrepareExpenseDraft(
      plan.id,
      expenseDraftForImport(title, amount, currency, date, category, notes),
    );
  };

  const importConfirmation = (
    target: 'new' | string,
    source: FlightConfirmationImportSource,
  ) =>
    runFlightConfirmationImport(
      {
        plan,
        updatePlan,
        addSheet,
        edit,
        setImportingFlightTarget,
        setImportStatusLabel,
        paintImportLoading,
        confirmationPickerUi,
        runAddSheetImport,
        prepareImportedExpenseDraft,
      } as any,
      target,
      source,
    );

  const importRental = async (
    target: 'new' | string,
    source: RentalConfirmationImportSource,
  ) => {
    setImportingRentalTarget(target);
    if (target === 'new') {
      addSheet.setRentalDetailsError(undefined);
      setImportStatusLabel(undefined);
    } else edit.setEditedRentalDetailsError(undefined);
    await paintImportLoading();
    const pickerUi = confirmationPickerUi({
      onOpening: () => setImportingRentalTarget(undefined),
      onReading: () => setImportingRentalTarget(target),
    });
    try {
      const imported = await (target === 'new'
        ? runAddSheetImport(() =>
            importRentalConfirmation(
              {
                startDate: plan.startDate,
                endDate: plan.endDate,
              },
              source,
              pickerUi,
            ),
          )
        : importRentalConfirmation(
            {
              startDate: plan.startDate,
              endDate: plan.endDate,
            },
            source,
            pickerUi,
          ));
      if (!imported) return;
      if (target !== 'new') {
        const latest =
          useTravel.getState().plans.find((entry) => entry.id === plan.id) ??
          plan;
        if (!latest.itinerary.some((item) => item.id === target)) {
          edit.setEditedRentalDetailsError(
            'That rental is no longer on this trip.',
          );
          return;
        }
        updatePlan(
          applyImportedRentalToPlan({
            plan: latest,
            imported,
            createId: () => newId('trip-item'),
            targetItemId: target,
          }),
        );
        edit.setEditingRentalItemId(undefined);
      } else {
        // Fill the add sheet for review; addItem() saves on submit
        const rentalTitle =
          imported.title ||
          (imported.rental.company ? `${imported.rental.company} Rental` : 'Car Rental');
        addSheet.setKind('rental');
        addSheet.setTitle(rentalTitle);
        addSheet.setDetails('');
        addSheet.setBookingUrl('');
        addSheet.setRentalDetails({ ...imported.rental });
        if (imported.date) addSheet.setDate(imported.date);
        if (imported.startMinutes !== undefined) addSheet.setStartMinutes(imported.startMinutes);
        if (imported.rental.dropoffDate) addSheet.setEndDate(imported.rental.dropoffDate);
        const dropMinutes = Number(imported.rental.dropoffMinutes);
        if (Number.isFinite(dropMinutes) && dropMinutes >= 0) {
          addSheet.setEndMinutes(dropMinutes);
        }
        if (imported.amount !== undefined && imported.amount > 0) {
          prepareImportedExpenseDraft(
            imported.amount,
            imported.currency,
            imported.date,
            'transport',
            imported.title ?? 'Rental expense',
            imported.rental.confirmationCode
              ? `Confirmation: ${imported.rental.confirmationCode}`
              : undefined,
          );
        }
      }
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'The confirmation document could not be read.';
      if (target === 'new') addSheet.setRentalDetailsError(message);
      else edit.setEditedRentalDetailsError(message);
    } finally {
      setImportingRentalTarget(undefined);
      if (target === 'new') setImportStatusLabel(undefined);
    }
  };

  const importStay = async (
    target: 'new' | string,
    source: StayConfirmationImportSource,
  ) => {
    setImportingStayTarget(target);
    if (target === 'new') {
      addSheet.setStayDetailsError(undefined);
      setImportStatusLabel(undefined);
    } else edit.setEditedStayDetailsError(undefined);
    await paintImportLoading();
    const pickerUi = confirmationPickerUi({
      onOpening: () => setImportingStayTarget(undefined),
      onReading: () => setImportingStayTarget(target),
    });
    try {
      const imported = await (target === 'new'
        ? runAddSheetImport(() =>
            importStayConfirmation(
              {
                startDate: plan.startDate,
                endDate: plan.endDate,
              },
              source,
              pickerUi,
            ),
          )
        : importStayConfirmation(
            {
              startDate: plan.startDate,
              endDate: plan.endDate,
            },
            source,
            pickerUi,
          ));
      if (!imported) return;
      const latestBefore =
        useTravel.getState().plans.find((entry) => entry.id === plan.id) ?? plan;
      const range = expandedTripRangeForStay(latestBefore, imported);
      if (
        range.startDate !== latestBefore.startDate ||
        range.endDate !== latestBefore.endDate
      ) {
        updatePlan({
          ...latestBefore,
          ...range,
          updatedAt: new Date().toISOString(),
        });
      }
      if (imported.amount !== undefined && imported.amount > 0 && target === 'new') {
        prepareImportedExpenseDraft(
          imported.amount,
          imported.currency,
          imported.date,
          'stay',
          imported.title ?? 'Stay expense',
          imported.stay.confirmationCode
            ? `Confirmation: ${imported.stay.confirmationCode}`
            : undefined,
        );
      }
      const mergeImportedDetails = (current: StayDetailsDraft): StayDetailsDraft => ({
        ...current,
        confirmationCode:
          imported.stay.confirmationCode || current.confirmationCode,
        reservationEmail:
          target === 'new'
            ? current.reservationEmail.trim() || accountEmail || ''
            : imported.stay.reservationEmail || current.reservationEmail,
        checkoutDate: imported.stay.checkoutDate || current.checkoutDate,
        checkoutMinutes:
          imported.stay.checkoutMinutes !== undefined &&
          imported.stay.checkoutMinutes !== null &&
          imported.stay.checkoutMinutes !== ''
            ? String(imported.stay.checkoutMinutes)
            : current.checkoutMinutes,
        confirmationUris: imported.confirmationUris.length
          ? imported.confirmationUris
          : current.confirmationUris,
        notes: imported.stay.notes || current.notes,
        price:
          imported.stay.price !== undefined
            ? String(imported.stay.price)
            : current.price,
        currency: imported.stay.currency || current.currency,
      });
      if (target === 'new') {
        addSheet.setError(undefined);
        addSheet.setStayDetails((current) => mergeImportedDetails(current));
        addSheet.setImportedStayFileName(imported.fileName);
        if (imported.title) addSheet.setTitle(imported.title);
        if (imported.date) addSheet.setDate(imported.date);
        if (imported.startMinutes !== undefined) {
          addSheet.setStartMinutes(imported.startMinutes);
        }
        if (imported.stay.checkoutDate) addSheet.setEndDate(imported.stay.checkoutDate);
        if (imported.stay.checkoutMinutes !== undefined) {
          const minutes = Number(imported.stay.checkoutMinutes);
          if (Number.isFinite(minutes) && minutes >= 0) {
            addSheet.setEndMinutes(minutes);
          }
        }
        if (imported.details) {
          addSheet.setDetails(imported.details.slice(0, DETAILS_MAX_LENGTH));
        }
        if (imported.bookingUrl) addSheet.setBookingUrl(imported.bookingUrl);
      } else {
        const latest =
          useTravel.getState().plans.find((entry) => entry.id === plan.id) ??
          plan;
        if (imported.amount !== undefined && imported.amount > 0) {
          updatePlan(applyStayExpenseFromImport(latest, imported));
        }
        edit.setEditedStayDetails((current) => mergeImportedDetails(current));
        edit.setEditedStayFileName(imported.fileName);
      }
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'The confirmation document could not be saved.';
      if (target === 'new') addSheet.setStayDetailsError(message);
      else edit.setEditedStayDetailsError(message);
    } finally {
      setImportingStayTarget(undefined);
      if (target === 'new') setImportStatusLabel(undefined);
    }
  };

  const chooseConfirmationImport = (target: 'new' | string) => {
    appPrompt.alert(
      'Import Flight Confirmation',
      'Choose a document, saved email, or up to 6 screenshots from Photos. The total is added to trip expenses when found.',
      [
        {
          text: 'Photo Screenshots',
          onPress: () => void importConfirmation(target, 'screenshots'),
        },
        {
          text: 'Document or Email',
          onPress: () => void importConfirmation(target, 'document'),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const chooseRentalConfirmationImport = (target: 'new' | string) => {
    appPrompt.alert(
      'Import Rental Confirmation',
      'Choose a document, saved email, or up to 6 screenshots from Photos. The total is added to trip expenses when found.',
      [
        {
          text: 'Photo Screenshots',
          onPress: () => void importRental(target, 'screenshots'),
        },
        {
          text: 'Document or Email',
          onPress: () => void importRental(target, 'document'),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const chooseStayConfirmationImport = (target: 'new' | string) => {
    appPrompt.alert(
      'Import Stay Confirmation',
      'Choose a document, saved email, or up to 6 screenshots from Photos.',
      [
        {
          text: 'Photo Screenshots',
          onPress: () => void importStay(target, 'screenshots'),
        },
        {
          text: 'Document or Email',
          onPress: () => void importStay(target, 'document'),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return {
    importingFlightTarget,
    importingRentalTarget,
    importingStayTarget,
    importInProgressRef,
    importStatusLabel,
    chooseConfirmationImport,
    chooseRentalConfirmationImport,
    chooseStayConfirmationImport,
    importConfirmation,
    importRental,
    importStay,
  };
}
