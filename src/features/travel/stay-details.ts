import { isDateKey } from '@/utils/date';

import { normalizeConfirmationUris } from './confirmation-attachments';
import type { TravelStayDetails } from './types';

export interface StayDetailsDraft {
  confirmationCode: string;
  reservationEmail: string;
  checkoutDate: string;
  checkoutMinutes: string;
  confirmationUris?: string[];
  notes: string;
  price: string;
  currency: string;
}

export function emptyStayDetailsDraft(
  defaults?: Partial<
    Pick<
      StayDetailsDraft,
      | 'checkoutDate'
      | 'checkoutMinutes'
      | 'reservationEmail'
      | 'price'
      | 'currency'
    >
  >,
): StayDetailsDraft {
  return {
    confirmationCode: '',
    reservationEmail: defaults?.reservationEmail ?? '',
    checkoutDate: defaults?.checkoutDate ?? '',
    checkoutMinutes: defaults?.checkoutMinutes ?? String(11 * 60),
    notes: '',
    price: defaults?.price ?? '',
    currency: defaults?.currency ?? '',
  };
}

function optionalText(value: unknown, uppercase = false): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return uppercase ? trimmed.toUpperCase() : trimmed;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, '').trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed * 100) / 100;
    }
  }
  return undefined;
}

function optionalMinutes(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded >= 0 && rounded < 24 * 60 ? rounded : undefined;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed)) return undefined;
    const rounded = Math.round(parsed);
    return rounded >= 0 && rounded < 24 * 60 ? rounded : undefined;
  }
  return undefined;
}

export function stayDetailsDraft(value?: TravelStayDetails): StayDetailsDraft {
  return {
    confirmationCode: value?.confirmationCode ?? '',
    reservationEmail: value?.reservationEmail ?? '',
    checkoutDate: value?.checkoutDate ?? '',
    checkoutMinutes:
      value?.checkoutMinutes !== undefined ? String(value.checkoutMinutes) : '',
    notes: value?.notes ?? '',
    price: value?.price !== undefined ? String(value.price) : '',
    currency: value?.currency ?? '',
    ...(value?.confirmationUris?.length
      ? { confirmationUris: value.confirmationUris }
      : {}),
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeStayDetails(input: unknown): TravelStayDetails | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = input as Partial<TravelStayDetails>;
  const checkoutDate = optionalText(value.checkoutDate);
  const confirmationUris = normalizeConfirmationUris(value.confirmationUris);
  const reservationEmail = optionalText(value.reservationEmail)?.toLowerCase();
  const price = optionalPositiveNumber(value.price);
  const currency = optionalText(value.currency, true);
  const next: TravelStayDetails = {
    confirmationCode: optionalText(value.confirmationCode, true),
    reservationEmail:
      reservationEmail && EMAIL_PATTERN.test(reservationEmail)
        ? reservationEmail
        : undefined,
    checkoutDate: checkoutDate && isDateKey(checkoutDate) ? checkoutDate : undefined,
    checkoutMinutes: optionalMinutes(value.checkoutMinutes),
    notes: optionalText(value.notes),
    price,
    currency: price !== undefined && currency ? currency : undefined,
    straiawayPropertyId: optionalText(value.straiawayPropertyId),
    straiawayReservationId: optionalText(value.straiawayReservationId),
    ...(confirmationUris ? { confirmationUris } : {}),
  };
  if (
    !next.confirmationCode &&
    !next.reservationEmail &&
    !next.checkoutDate &&
    next.checkoutMinutes === undefined &&
    !next.notes &&
    next.price === undefined &&
    !next.confirmationUris?.length &&
    !next.straiawayPropertyId &&
    !next.straiawayReservationId
  ) {
    return undefined;
  }
  return next;
}

export function validateStayDetails(
  draft: StayDetailsDraft,
): { ok: true; value: TravelStayDetails | undefined } | { ok: false; error: string } {
  const checkoutMinutesText = draft.checkoutMinutes.trim();
  let checkoutMinutes: number | undefined;
  if (checkoutMinutesText) {
    checkoutMinutes = Number(checkoutMinutesText);
    if (
      !Number.isFinite(checkoutMinutes) ||
      checkoutMinutes < 0 ||
      checkoutMinutes >= 24 * 60
    ) {
      return { ok: false, error: 'Choose a valid check-out time.' };
    }
  }
  if (draft.checkoutDate.trim() && !isDateKey(draft.checkoutDate.trim())) {
    return { ok: false, error: 'Use a valid check-out date.' };
  }
  const notes = draft.notes.trim();
  if (notes.length > 1000) {
    return { ok: false, error: 'Keep stay notes under 1,000 characters.' };
  }
  const priceText = draft.price.trim();
  let price: number | undefined;
  if (priceText) {
    price = Number(priceText.replace(/,/g, ''));
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: 'Enter a valid stay price.' };
    }
  }
  const reservationEmail = draft.reservationEmail.trim();
  if (reservationEmail && !EMAIL_PATTERN.test(reservationEmail)) {
    return { ok: false, error: 'Enter a valid reservation email.' };
  }
  const value = normalizeStayDetails({
    confirmationCode: draft.confirmationCode,
    reservationEmail: reservationEmail || undefined,
    checkoutDate: draft.checkoutDate.trim() || undefined,
    checkoutMinutes,
    confirmationUris: draft.confirmationUris,
    notes: notes || undefined,
    price,
    currency: draft.currency.trim() || undefined,
  });
  if (
    value?.confirmationCode &&
    !/^[A-Z0-9-]{3,24}$/.test(value.confirmationCode)
  ) {
    return { ok: false, error: 'Confirmation codes use letters and numbers only.' };
  }
  return { ok: true, value };
}
