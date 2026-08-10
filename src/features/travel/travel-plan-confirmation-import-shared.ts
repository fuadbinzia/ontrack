import type { Dispatch, SetStateAction } from 'react';

import type { ImportedFlightConfirmation } from '@/features/travel/flight-confirmation-import';
import type { ImportedFlightSchedule } from '@/features/travel/flight-confirmation-schedule';
import type { FlightDetailsDraft } from '@/features/travel/flight-details';
import type {
  FlightLegScheduleDraft,
  FlightTripType,
} from '@/features/travel/flight-roundtrip-draft';
import type { RentalDetailsDraft } from '@/features/travel/rental-details';
import type { StayDetailsDraft } from '@/features/travel/stay-details';
import type { TravelItemKind } from '@/features/travel/types';

type SetStr = Dispatch<SetStateAction<string>>;
type SetOptStr = Dispatch<SetStateAction<string | undefined>>;
type SetNum = Dispatch<SetStateAction<number | null>>;

/** Add-sheet field setters the confirmation importers write into for `target === 'new'`. */
export type TravelPlanAddSheetImportBindings = {
  date: string;
  startMinutes: number | null;
  setTitle: SetStr;
  setDetails: SetStr;
  setBookingUrl: SetStr;
  setDate: SetStr;
  setStartMinutes: SetNum;
  setEndDate: SetStr;
  setEndMinutes: SetNum;
  setDuration: SetStr;
  setKind: Dispatch<SetStateAction<TravelItemKind>>;
  setIsAddingItem: Dispatch<SetStateAction<boolean>>;
  setError: SetOptStr;
  setFlightDetails: Dispatch<SetStateAction<FlightDetailsDraft>>;
  setFlightDetailsError: SetOptStr;
  setImportedFlightFileName: SetOptStr;
  setFlightTripType: Dispatch<SetStateAction<FlightTripType>>;
  setReturnFlightTitle: SetStr;
  setReturnFlightDetails: Dispatch<SetStateAction<FlightDetailsDraft>>;
  setReturnFlightSchedule: Dispatch<SetStateAction<FlightLegScheduleDraft>>;
  /** Full parsed confirmation so submit can expand connecting legs. */
  setPendingFlightImport: Dispatch<
    SetStateAction<ImportedFlightConfirmation | undefined>
  >;
  setRentalDetails: Dispatch<SetStateAction<RentalDetailsDraft>>;
  setRentalDetailsError: SetOptStr;
  setImportedRentalFileName: SetOptStr;
  setStayDetails: Dispatch<SetStateAction<StayDetailsDraft>>;
  setStayDetailsError: SetOptStr;
  setImportedStayFileName: SetOptStr;
};

export function applyFlightScheduleToAddSheet(
  addSheet: TravelPlanAddSheetImportBindings,
  schedule: ImportedFlightSchedule,
) {
  if (schedule.departureDate) addSheet.setDate(schedule.departureDate);
  if (schedule.departureMinutes !== undefined) {
    addSheet.setStartMinutes(schedule.departureMinutes);
  }
  if (schedule.durationMinutes !== undefined) {
    addSheet.setDuration(String(schedule.durationMinutes));
  }
  if (schedule.arrivalDate) addSheet.setEndDate(schedule.arrivalDate);
  if (schedule.arrivalMinutes !== undefined) {
    addSheet.setEndMinutes(schedule.arrivalMinutes);
  }
}

export type EditBindings = {
  setEditingFlightItemId: SetOptStr;
  setEditedFlightDetails: Dispatch<SetStateAction<FlightDetailsDraft>>;
  setEditedFlightDetailsError: SetOptStr;
  setEditedFlightFileName: SetOptStr;
  setEditingRentalItemId: SetOptStr;
  setEditedRentalDetailsError: SetOptStr;
  setEditingStayItemId: SetOptStr;
  setEditedStayDetails: Dispatch<SetStateAction<StayDetailsDraft>>;
  setEditedStayDetailsError: SetOptStr;
  setEditedStayFileName: SetOptStr;
};
