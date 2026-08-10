/**
 * OCR-ish text from an Airbnb mobile trip page (airbnb.com/trips/…).
 * Mirrors real wraps: "Your stay" section, host line, yearless dates, and a
 * multi-line geographic address. Parser uses the current calendar year
 * (checkout rolls +1 when the stay crosses New Year).
 */
export const AIRBNB_PUNTA_CANA_TRIPS_PAGE = `
Punta Cana
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

Getting there
Book a private car service
Host recommendations
Scape Park
https://www.airbnb.com/trips/v1/1
`;
