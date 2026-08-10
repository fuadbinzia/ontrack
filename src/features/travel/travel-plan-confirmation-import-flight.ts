import { appPrompt } from '@/components/primitives';
import { applyImportedFlightsToPlan } from '@/features/travel/apply-imported-flights';
import type { ExpenseFormState } from '@/features/travel/expenses/expense-form';
import { mergeFlightConfirmationDraftDetails } from '@/features/travel/flight-confirmation-draft';
import {
  importFlightConfirmation,
  type FlightConfirmationImportSource,
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
  applyFlightScheduleToAddSheet,
  type EditBindings,
  type TravelPlanAddSheetImportBindings,
} from '@/features/travel/travel-plan-confirmation-import-shared';
import type { TravelPlan } from '@/features/travel/types';
import { newId } from '@/store/schedule';
import { useTravel } from '@/store/travel';

export type FlightConfirmationImportContext = {
  plan: TravelPlan;
  updatePlan: (next: TravelPlan) => void;
  addSheet: TravelPlanAddSheetImportBindings;
  edit: EditBindings;
  setImportingFlightTarget: (target: string | undefined) => void;
  setImportStatusLabel: (label: string | undefined) => void;
  paintImportLoading: () => Promise<void>;
  confirmationPickerUi: (args: {
    onOpening?: () => void;
    onReading?: () => void;
  }) => any;
  runAddSheetImport: <T>(work: () => Promise<T>) => Promise<T>;
  prepareImportedExpenseDraft: (
    amount: number,
    currency: string | undefined,
    date: string | undefined,
    category: string,
    title: string,
    notes?: string,
  ) => void;
};

export async function runFlightConfirmationImport(
  ctx: FlightConfirmationImportContext,
  target: 'new' | string,
  source: FlightConfirmationImportSource,
) {

  ctx.setImportingFlightTarget(target);
  if (target === 'new') {
    ctx.addSheet.setFlightDetailsError(undefined);
    ctx.setImportStatusLabel(undefined);
  } else ctx.edit.setEditedFlightDetailsError(undefined);
  await ctx.paintImportLoading();
  const pickerUi = ctx.confirmationPickerUi({
    onOpening: () => ctx.setImportingFlightTarget(undefined),
    onReading: () => ctx.setImportingFlightTarget(target),
  });
  try {
    const parsedImport = await (target === 'new'
      ? ctx.runAddSheetImport(() =>
          importFlightConfirmation(
            {
              startDate: ctx.plan.startDate,
              endDate: ctx.plan.endDate,
            },
            source,
            pickerUi,
          ),
        )
      : importFlightConfirmation(
          {
            startDate: ctx.plan.startDate,
            endDate: ctx.plan.endDate,
          },
          source,
          pickerUi,
        ));
    if (!parsedImport) return;
    const imported = await enrichFlightConfirmationTerminals(parsedImport);
    const importedSchedule = flightConfirmationSchedule(imported, {
      date: ctx.addSheet.date,
      startMinutes: ctx.addSheet.startMinutes ?? undefined,
    });
    const expenseAlert =
      imported.amount !== undefined && imported.amount > 0
        ? ` Added ${imported.currency ?? ctx.plan.baseCurrency} ${imported.amount.toFixed(2)} under Expenses.`
        : '';
    if (target === 'new') {
      // Import only fills the draft. The user still owns the Add to Timeline action.
      // Keep the full parse so submit can expand connecting legs into the itinerary.
      ctx.addSheet.setPendingFlightImport(imported);
      ctx.addSheet.setImportedFlightFileName(imported.fileName);
      const directions = splitRoundTripDirections(imported.segments);
      const roundTrip = Boolean(directions);
      ctx.addSheet.setFlightTripType(roundTrip ? 'round-trip' : 'one-way');
      const outboundSegments = directions?.outbound ?? imported.segments;
      const outboundDetails = mergeFlightConfirmationDraftDetails(
        emptyFlightDetailsDraft(),
        {
          ...imported,
          segments: outboundSegments,
        },
      );
      ctx.addSheet.setFlightDetails((current) =>
        mergeFlightConfirmationDraftDetails(current, {
          ...imported,
          segments: outboundSegments,
        }),
      );
      if (directions) {
        const returnDetails = mergeFlightConfirmationDraftDetails(
          emptyFlightDetailsDraft(),
          { ...imported, segments: directions.returning },
        );
        ctx.addSheet.setReturnFlightDetails(returnDetails);
        ctx.addSheet.setReturnFlightSchedule(
          flightLegScheduleFromImported(
            flightDirectionSchedule(directions.returning, imported),
          ),
        );
        ctx.addSheet.setReturnFlightTitle(
          formatFlightTitle(returnDetails) ||
            directions.returning[0]?.title?.trim() ||
            returnFlightTitle(returnDetails),
        );
      }
      // Prefer the merged draft route (includes connection hubs) over the first leg title.
      const reviewTitle =
        formatFlightTitle(outboundDetails) ||
        imported.title ||
        outboundSegments[0]?.title;
      if (reviewTitle) ctx.addSheet.setTitle(reviewTitle);
      applyFlightScheduleToAddSheet(
        ctx.addSheet,
        directions
          ? flightDirectionSchedule(directions.outbound, imported, {
              date: ctx.addSheet.date,
              startMinutes: ctx.addSheet.startMinutes ?? undefined,
            })
          : importedSchedule,
      );
      if (imported.amount !== undefined && imported.amount > 0) {
        ctx.prepareImportedExpenseDraft(
          imported.amount,
          imported.currency,
          importedSchedule.departureDate,
          'flight',
          imported.title ?? 'Flight expense',
          imported.flight.confirmationCode
            ? `Confirmation: ${imported.flight.confirmationCode}`
            : undefined,
        );
      }
      return;
    }

    if (target !== 'new') {
      const latest =
        useTravel.getState().plans.find((entry) => entry.id === ctx.plan.id) ??
        ctx.plan;
      if (!latest.itinerary.some((item: { id: string }) => item.id === target)) {
        ctx.edit.setEditedFlightDetailsError(
          'That flight is no longer on this trip.',
        );
        return;
      }
      ctx.updatePlan(
        applyImportedFlightsToPlan({
          plan: latest,
          imported,
          createId: () => newId('trip-item'),
          targetItemId: target,
        }),
      );
      ctx.edit.setEditingFlightItemId(undefined);
      if (expenseAlert) {
        appPrompt.alert(
          'Flight Updated',
          `Updated this flight from the confirmation.${expenseAlert}`,
          undefined,
          { cancelable: true },
        );
      }
      return;
    }
  } catch (reason) {
    const message =
      reason instanceof Error
        ? reason.message
        : 'The confirmation document could not be read.';
    if (target === 'new') ctx.addSheet.setFlightDetailsError(message);
    else ctx.edit.setEditedFlightDetailsError(message);
  } finally {
    ctx.setImportingFlightTarget(undefined);
    if (target === 'new') ctx.setImportStatusLabel(undefined);
  }
}
