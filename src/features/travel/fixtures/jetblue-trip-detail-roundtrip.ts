/**
 * OCR-ish text from JetBlue mobile "Trip detail" screens (round-trip).
 * Yearless dates; bare Terminal/Gate columns; Departs/Arrives (not Duration).
 * Traveler names are synthetic fixtures only.
 */
export const JETBLUE_TRIP_DETAIL_OUTBOUND = `
Trip detail
Flight
B6 2709
Date
Aug 10
Confirmation
WYDBAP
New York, NY
JFK
Terminal 5
Gate 527
Santo Domingo, Do...
SDQ
Terminal Main
Gate -
ON TIME
Boards
5:55am
Doors close
6:20am
Departs
6:40am
Arrives
10:32am
Modify check-in
Boarding pass
`;

export const JETBLUE_TRIP_DETAIL_RETURN = `
Trip detail
Flight
B6 1850
Date
Aug 14
Confirmation
WYDBAP
Santo Domingo, D...
SDQ
Terminal Main
Gate -
New York, NY
JFK
Terminal 5
Gate -
ON TIME
Boards
5:08pm
Doors close
5:33pm
Departs
5:53pm
Arrives
9:50pm
Manage trip
Travelers
Alex Rivera
Seat 28A
Jordan Lee
Seat 28B
`;

export const JETBLUE_TRIP_DETAIL_ROUNDTRIP = `${JETBLUE_TRIP_DETAIL_OUTBOUND}\n\n${JETBLUE_TRIP_DETAIL_RETURN}`;
