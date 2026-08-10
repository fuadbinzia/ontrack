export {
  DESTINATION_COVER_MAX,
  DESTINATION_COVER_POOL_MAX,
  destinationPhotoSuggestsPeople,
  destinationPhotoSuggestsText,
  enlargeWikimediaThumb,
  hasDestinationLandmarkIntent,
  isAllowedDestinationCoverImageUrl,
  isDirectClientCoverUrl,
  isUsableDestinationPhotoUrl,
  mergeDestinationCoverUrls,
} from '@/features/travel/destination-cover-lookup';

export {
  destinationCoverCandidates,
  isRemoteDestinationCoverUri,
  localTripCoverUri,
  persistTravelCoverPhoto,
  persistTravelCoverPhotos,
  pickRotatingHeroUris,
  stayCoverCandidates,
  TRIP_COVER_UPLOAD_MAX,
  uploadedTripCoverUris,
} from '@/features/travel/destination-cover-plan';

export type { FetchDestinationHeroOptions } from '@/features/travel/destination-cover-fetch';
export {
  fetchDestinationCoverUri,
  fetchDestinationHeroUris,
  fetchPlaceCoverUri,
  fetchPlaceCoverUris,
  fetchRemoteDestinationCoverUri,
  proxyDestinationCoverImageUrl,
} from '@/features/travel/destination-cover-fetch';
