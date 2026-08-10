import {
    stripTripCoverUploads,
    tripCoverUploadFields,
    validateTravelPlanDetails,
} from '../travel-plan-details';

describe('travel plan details', () => {
  it('trims editable details and removes empty notes', () => {
    expect(validateTravelPlanDetails({
      title: '  Iceland escape  ',
      destination: '  Reykjavík  ',
      notes: '   ',
    })).toEqual({
      ok: true,
      value: {
        title: 'Iceland escape',
        destination: 'Reykjavík',
        notes: undefined,
      },
    });
  });

  it('requires a trip name and destination', () => {
    expect(validateTravelPlanDetails({
      title: '',
      destination: 'Iceland',
      notes: '',
    })).toEqual({ ok: false, error: 'Add both a trip name and destination.' });
  });

  it('strips cover uploads and rebuilds fields from a uri list', () => {
    expect(
      stripTripCoverUploads({
        id: 'trip-1',
        coverUri: 'file:///a.jpg',
        coverUris: ['file:///a.jpg'],
      }),
    ).toEqual({ id: 'trip-1' });
    expect(tripCoverUploadFields([])).toEqual({});
    expect(tripCoverUploadFields(['file:///a.jpg', 'file:///b.jpg'])).toEqual({
      coverUris: ['file:///a.jpg', 'file:///b.jpg'],
      coverUri: 'file:///a.jpg',
    });
  });
});
