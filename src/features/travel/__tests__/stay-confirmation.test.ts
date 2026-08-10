import { AIRBNB_PUNTA_CANA_TRIPS_PAGE } from '../fixtures/airbnb-punta-cana-trips-page';
import { expandedTripRangeForStay } from '../stay-confirmation-itinerary';
import { parseStayConfirmation } from '../stay-confirmation-parser';

const BOOKING_CENTERHOTEL = `
Booking.com Confirmation
Confirmation number: 4521.8832.0199
Hotel: Centerhotel Miðgarður
Address: Laugavegur 120, 105 Reykjavik, Iceland
Check-in: Tuesday 8 September 2026 from 15:00
Check-out: Monday 14 September 2026 until 11:00
https://www.booking.com/hotel/is/centerhotel-midgardur.html
`;

const MARRIOTT_STAY = `
Marriott Bonvoy
Confirmation Number: 8349201756
Hotel Name: Reykjavik Edition
Check-in Date: 09/10/2026
Check-in Time: 4:00 PM
Check-out Date: 09/12/2026
Check-out Time: 12:00 PM
Address: 70 Austurstræti, Reykjavik
`;

/** Real embedded text from trivago DEALS PDF printout (print headers included). */
const TRIVAGO_CENTERHOTEL = `
8/1/26, 11:10 AM Booking: Centerhotel Miðgarður
Your booking is confirmed
Booking number: 13460175
Centerhotel Miðgarður
Laugavegi 120, 105 Reykjavik, Reykjavík, Iceland
Standard Room
Room only
Non-Refundable
Booking details
Booked for Alex Rivera
Check-in Sep 09, 2026
Check-out Sep 14, 2026
Number of nights 5 Nights
Number of rooms 1 Room
https://www.trivago.deals/my-trips/403123/805959a3-19ed-4810-90d3-846bbc1e9f3c?languageCode=EN 1/3

8/1/26, 11:10 AM Booking: Centerhotel Miðgarður
Room 1 2 Adults
Arrival details
Check-in
From 12:00 PM
Check-out
Until 12:00 PM
Special check-in instructions
Minimum check-in age is 21
You may need to show a government-issued ID at check-in.
Price summary 1 room x 5 nights $213.06 average per night per room
https://www.trivago.deals/my-trips/403123/805959a3-19ed-4810-90d3-846bbc1e9f3c?languageCode=EN 2/3
`;

describe('stay confirmation parser', () => {
  it('extracts hotel, confirmation, check-in/out, and booking link', () => {
    const parsed = parseStayConfirmation(BOOKING_CENTERHOTEL, {
      startDate: '2026-09-08',
      endDate: '2026-09-14',
    });
    expect(parsed.title).toContain('Centerhotel');
    expect(parsed.stay.confirmationCode).toBe('452188320199');
    expect(parsed.date).toBe('2026-09-08');
    expect(parsed.startMinutes).toBe(15 * 60);
    expect(parsed.stay.checkoutDate).toBe('2026-09-14');
    expect(Number(parsed.stay.checkoutMinutes)).toBe(11 * 60);
    expect(parsed.details).toContain('Reykjavik');
    expect(parsed.bookingUrl).toContain('booking.com');
    expect(parsed.detectedFieldCount).toBeGreaterThan(0);
  });

  it('parses Marriott-style labels', () => {
    const parsed = parseStayConfirmation(MARRIOTT_STAY, {
      startDate: '2026-09-08',
      endDate: '2026-09-14',
    });
    expect(parsed.title).toMatch(/Edition|Reykjavik/i);
    expect(parsed.stay.confirmationCode).toBe('8349201756');
    expect(parsed.date).toBe('2026-09-10');
    expect(parsed.startMinutes).toBe(16 * 60);
    expect(parsed.stay.checkoutDate).toBe('2026-09-12');
    expect(Number(parsed.stay.checkoutMinutes)).toBe(12 * 60);
  });

  it('falls back to hotel name from the confirmation file name', () => {
    const parsed = parseStayConfirmation(
      'Confirmation number: ABC123\nCheck-in: Sep 09, 2026 3:00 PM\nCheck-out: Sep 11, 2026 11:00 AM',
      { startDate: '2026-09-08', endDate: '2026-09-14' },
      { fileName: 'Booking_ Centerhotel Miðgarður.pdf' },
    );
    expect(parsed.title).toContain('Centerhotel');
    expect(parsed.stay.confirmationCode).toBe('ABC123');
  });

  it('parses trivago DEALS PDF text without print-header pollution', () => {
    const parsed = parseStayConfirmation(
      TRIVAGO_CENTERHOTEL,
      { startDate: '2026-09-08', endDate: '2026-09-14' },
      { fileName: 'Booking_ Centerhotel Miðgarður.pdf' },
    );
    expect(parsed.title).toContain('Centerhotel');
    expect(parsed.stay.confirmationCode).toBe('13460175');
    expect(parsed.date).toBe('2026-09-09');
    expect(parsed.stay.checkoutDate).toBe('2026-09-14');
    expect(parsed.startMinutes).toBe(12 * 60);
    expect(Number(parsed.stay.checkoutMinutes)).toBe(12 * 60);
    expect(parsed.details).toMatch(/Laugavegi/i);
    expect(parsed.details).not.toMatch(/AM Booking/i);
    expect(parsed.bookingUrl).toContain('trivago.deals');
  });

  it('parses Airbnb itinerary with Stay name, address, notes, price, and currency', () => {
    const AIRBNB_ITINERARY = `
Reservation confirmed
Confirmation code: HM3DMFZH2T
Luxury Villa with Ocean View
Entire home/apt in Malibu, California
Address: 123 Seaside Way, Malibu, CA 90265
Check-in
Thu, Oct 15, 2026
3:00 PM
Checkout
Sun, Oct 18, 2026
11:00 AM
4 guests · 2 bedrooms · 3 beds · 2 baths
Hosted by Maria
Contact host: +1 (555) 234-5678
Total (USD) $1,250.00
https://www.airbnb.com/rooms/12345678
`;
    const parsed = parseStayConfirmation(AIRBNB_ITINERARY, {
      startDate: '2026-10-10',
      endDate: '2026-10-25',
    });
    expect(parsed.stay.confirmationCode).toBe('HM3DMFZH2T');
    expect(parsed.title).toBe('Luxury Villa with Ocean View');
    expect(parsed.details).toBe('123 Seaside Way, Malibu, CA 90265');
    expect(parsed.date).toBe('2026-10-15');
    expect(parsed.startMinutes).toBe(15 * 60);
    expect(parsed.stay.checkoutDate).toBe('2026-10-18');
    expect(Number(parsed.stay.checkoutMinutes)).toBe(11 * 60);
    expect(parsed.amount).toBe(1250);
    expect(parsed.currency).toBe('USD');
    expect(parsed.stay.price).toBe('1250');
    expect(parsed.stay.currency).toBe('USD');
    expect(parsed.stay.notes).toContain('4 guests');
    expect(parsed.stay.notes).toContain('Hosted by Maria');
    expect(parsed.stay.notes).toContain('+1 (555) 234-5678');
  });

  it('parses Villa Patziac Airbnb itinerary with unlabelled geographic location', () => {
    const VILLA_PATZIAC = `
Villa Patziac | Private Cove | Serene Retreat

Check-in
3:00 PM
Tue, Sep 22

Checkout
11:00 AM
Thu, Sep 24

Call host: +1 917-334-6322

Who's coming
5 guests

Confirmation code
HM3DMFZH2T

Santa Cruz la Laguna, Sololá Department, Guatemala

Hosted by Christopher And Erynne

Payment details
Total cost: $1,097.22
`;
    const parsed = parseStayConfirmation(VILLA_PATZIAC, {
      startDate: '2026-09-20',
      endDate: '2026-09-30',
    });
    expect(parsed.stay.confirmationCode).toBe('HM3DMFZH2T');
    expect(parsed.title).toBe('Villa Patziac | Private Cove | Serene Retreat');
    expect(parsed.details).toBe(
      'Santa Cruz la Laguna, Sololá Department, Guatemala',
    );
    expect(parsed.details).not.toContain('Call host');
    expect(parsed.details).not.toContain('+1');
    expect(parsed.date).toBe('2026-09-22');
    expect(parsed.startMinutes).toBe(15 * 60);
    expect(parsed.stay.checkoutDate).toBe('2026-09-24');
    expect(Number(parsed.stay.checkoutMinutes)).toBe(11 * 60);
    expect(parsed.amount).toBe(1097.22);
    expect(parsed.stay.price).toBe('1097.22');
    expect(parsed.stay.notes).toContain('5 guests');
    expect(parsed.stay.notes).toContain('Hosted by Christopher And Erynne');
    expect(parsed.stay.notes).toContain('+1 917-334-6322');
  });

  it('leaves address empty when address is unclear or ambiguous', () => {
    const UNCLEAR_CONFIRMATION = `
Your reservation is confirmed
Confirmation code: XYZ987654
Cozy Lakeside Cabin
Check-in: Sep 10, 2026 3:00 PM
Check-out: Sep 15, 2026 11:00 AM
Hosted by John Doe
Call host: +1 800-555-0199
`;
    const parsed = parseStayConfirmation(UNCLEAR_CONFIRMATION, {
      startDate: '2026-09-08',
      endDate: '2026-09-20',
    });
    expect(parsed.title).toBe('Cozy Lakeside Cabin');
    expect(parsed.stay.confirmationCode).toBe('XYZ987654');
    expect(parsed.details).toBeUndefined();
  });

  it('does not treat room or rate product phrases as stay addresses', () => {
    const parsed = parseStayConfirmation(
      `
Your reservation is confirmed
Confirmation code: ROOM123
Harbor Hotel
Standard Room, City View
Check-in: Sep 10, 2026 3:00 PM
Check-out: Sep 12, 2026 11:00 AM
`,
      { startDate: '2026-09-08', endDate: '2026-09-20' },
    );
    expect(parsed.details).toBeUndefined();
    expect(parsed.stay.confirmationCode).toBe('ROOM123');
  });

  it('parses Airbnb trip page yearless dates without an existing trip range', () => {
    const parsed = parseStayConfirmation(AIRBNB_PUNTA_CANA_TRIPS_PAGE);
    const year = new Date().getFullYear();
    expect(parsed.title).toBe('Punta Cana');
    expect(parsed.title).not.toMatch(/hosted by/i);
    expect(parsed.details).toBe(
      'Punta Cana, La Altagracia Province 23000, Dominican Republic',
    );
    expect(parsed.details).not.toBe('Punta Cana, La Altagracia');
    expect(parsed.date).toBe(`${year}-08-10`);
    expect(parsed.stay.checkoutDate).toBe(`${year}-08-14`);
    expect(parsed.startMinutes).toBe(16 * 60);
    expect(Number(parsed.stay.checkoutMinutes)).toBe(10 * 60);
    expect(parsed.stay.notes).toContain('Hosted by Lisbeth');
    expect(parsed.bookingUrl).toContain('airbnb.com/trips');
  });

  it('does not treat Airbnb Your stay + Hosted by as the stay title', () => {
    const parsed = parseStayConfirmation(`
Your stay
Hosted by Lisbeth
August 10 – 14
Punta Cana, La Altagracia
Province 23000,
Dominican Republic
Check-in
Monday, August 10
After 4:00 PM
Checkout
Friday, August 14
Before 10:00 AM
`);
    expect(parsed.title).toBe('Punta Cana');
    expect(parsed.details).toContain('Dominican Republic');
    expect(parsed.stay.notes).toContain('Hosted by Lisbeth');
  });

  it('fills blank trip dates from stay check-in / check-out', () => {
    const parsed = parseStayConfirmation(AIRBNB_PUNTA_CANA_TRIPS_PAGE);
    expect(
      expandedTripRangeForStay({ startDate: '', endDate: '' }, parsed),
    ).toEqual({
      startDate: parsed.date,
      endDate: parsed.stay.checkoutDate,
    });
  });

  it('widens an existing trip range to cover the stay', () => {
    expect(
      expandedTripRangeForStay(
        { startDate: '2026-08-11', endDate: '2026-08-12' },
        {
          date: '2026-08-10',
          stay: { checkoutDate: '2026-08-14' },
        },
      ),
    ).toEqual({
      startDate: '2026-08-10',
      endDate: '2026-08-14',
    });
  });

  it('rolls yearless checkout into the next year when the stay crosses New Year', () => {
    const year = new Date().getFullYear();
    const parsed = parseStayConfirmation(`
Ski Cabin
Hosted by Alex
December 28 – January 3

Check-in
Sunday, December 28
After 4:00 PM

Checkout
Saturday, January 3
Before 10:00 AM
`);
    expect(parsed.date).toBe(`${year}-12-28`);
    expect(parsed.stay.checkoutDate).toBe(`${year + 1}-01-03`);
  });
});
