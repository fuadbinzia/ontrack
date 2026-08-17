import {
    AGENT_UI_DEMO_CHASE_OUTBOUND_ID,
    AGENT_UI_DEMO_FLIGHT_ID,
    AGENT_UI_DEMO_TRIP_ID,
    AGENT_UI_PUNTA_CANA_OUTBOUND_ID,
    AGENT_UI_PUNTA_CANA_TRIP_ID,
} from './fixtures';

import { AGENT_UI_WAIT_TIMEOUT_MS } from './flows-waits';

const ICELAND_TRIP_TOOLS = 'travel/trip-travel-home-iceland/tools';
const ICELAND_PACKING_LIST =
  'ontrack.travel.list.packingList.trip-travel-home-iceland';

function landIcelandTripTools(options?: { seed?: boolean }) {
  return [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    ...(options?.seed === false ? [] : [{ op: 'seed', to: 'travel-home' }]),
    { op: 'goto', to: ICELAND_TRIP_TOOLS },
    {
      op: 'wait',
      id: ICELAND_PACKING_LIST,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ];
}

function openIcelandTripChecklist() {
  return [
    { op: 'tap', id: ICELAND_PACKING_LIST },
    {
      op: 'wait',
      id: 'ontrack.checklists.detail.newTask',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ];
}

export const AGENT_UI_TRAVEL_FLOWS = {
  'travel-map-demo': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-map-demo' },
    { op: 'goto', to: 'travel-map' },
    {
      op: 'wait',
      id: 'ontrack.travel.map.section.world',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'travel-list': [
    // Clear leftover travel sheets so list taps are not swallowed.
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'goto', to: 'travel' },
    { op: 'wait', prefix: 'ontrack.travel.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'travel-demo': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-demo' },
    { op: 'goto', to: `travel/${AGENT_UI_DEMO_TRIP_ID}` },
    // Entrance shell paints first; wait for post-transition Loaded tree.
    {
      op: 'wait',
      id: 'ontrack.travel.planDetail.section.transport',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    // Sky overlay mounts with Loaded chrome (enableSkyDecor) — after transport.
    {
      op: 'wait',
      id: 'ontrack.travel.chrome.skyDecor',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'travel-punta-cana': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-punta-cana' },
    { op: 'goto', to: `travel/${AGENT_UI_PUNTA_CANA_TRIP_ID}` },
    {
      op: 'wait',
      id: 'ontrack.travel.planDetail.section.transport',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.travel.chrome.skyDecor',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'travel-demo-list': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-demo' },
    { op: 'goto', to: 'travel' },
    {
      op: 'wait',
      id: `ontrack.travel.list.itinerary.${AGENT_UI_DEMO_TRIP_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'travel-home': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-home' },
    { op: 'goto', to: 'travel' },
    {
      op: 'wait',
      id: 'ontrack.travel.list.itinerary.trip-travel-home-iceland',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'travel-home-search': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-home' },
    { op: 'goto', to: 'travel' },
    {
      op: 'wait',
      id: 'ontrack.travel.list.search',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.travel.list.search' },
    { op: 'wait', ms: 350 },
  ],
  'travel-home-empty': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-home-empty' },
    { op: 'goto', to: 'travel' },
    {
      op: 'wait',
      id: 'ontrack.travel.list.empty.create',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'travel-home-iceland': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-home' },
    { op: 'goto', to: 'travel/trip-travel-home-iceland' },
    {
      op: 'wait',
      id: 'ontrack.travel.chrome.skyDecor',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'travel-home-iceland-tools': landIcelandTripTools(),
  'travel-home-iceland-checklist': [
    ...landIcelandTripTools(),
    ...openIcelandTripChecklist(),
  ],
  // Second Checklist tap without reseeding — must open the same list.
  'travel-home-iceland-checklist-again': [
    ...landIcelandTripTools({ seed: false }),
    ...openIcelandTripChecklist(),
  ],
  'travel-demo-hub': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-demo' },
    // Keep the legacy flow name while proving the dedicated tools route.
    { op: 'goto', to: `travel/${AGENT_UI_DEMO_TRIP_ID}/hub` },
    {
      op: 'wait',
      id: 'ontrack.travel.planDetail.section.tools',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      // Keep this stable demo target literal so the Living System Map can map the flow.
      id: 'ontrack.travel.tripTools.section.trip-agent-ui-demo',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'travel-demo-add-flight': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-demo' },
    { op: 'goto', to: `travel/${AGENT_UI_DEMO_TRIP_ID}/add/flight` },
    {
      op: 'wait',
      prefix: 'ontrack.travel.itineraryAdd.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    // Sheet chrome paints after route; avoid mid-open screenshots/taps.
    { op: 'wait', ms: 250 },
  ],
  'travel-demo-add-activity': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-demo' },
    { op: 'goto', to: `travel/${AGENT_UI_DEMO_TRIP_ID}/add/activity` },
    {
      op: 'wait',
      prefix: 'ontrack.travel.itineraryAdd.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'wait', ms: 250 },
  ],
  'travel-demo-timeline-add': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-demo' },
    { op: 'goto', to: `travel/${AGENT_UI_DEMO_TRIP_ID}` },
    {
      op: 'wait',
      id: 'ontrack.travel.planDetail.addToTimeline',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.travel.planDetail.addToTimeline' },
    {
      op: 'wait',
      id: 'ontrack.travel.timelineAdd.kind.transport',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'wait', ms: 250 },
  ],
  'travel-demo-add-flight-connecting': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-demo' },
    {
      op: 'goto',
      to: `travel/${AGENT_UI_DEMO_TRIP_ID}/add/flight?importFlight=connecting`,
    },
    {
      op: 'wait',
      prefix: 'ontrack.travel.itineraryAdd.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    // Import prefills settle after mount (parse + setTitle).
    { op: 'wait', ms: 350 },
  ],
  'travel-demo-add-flight-roundtrip': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-demo' },
    {
      op: 'goto',
      to: `travel/${AGENT_UI_DEMO_TRIP_ID}/add/flight?importFlight=roundtrip`,
    },
    {
      op: 'wait',
      prefix: 'ontrack.travel.itineraryAdd.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    // Import prefills settle after mount; keep a short pure delay.
    { op: 'wait', ms: 250 },
    { op: 'tap', id: 'ontrack.travel.itineraryAdd.submit' },
    {
      op: 'wait',
      id: `ontrack.travel.timelineItem.${AGENT_UI_DEMO_CHASE_OUTBOUND_ID}.default`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'tap',
      id: `ontrack.travel.timelineItem.${AGENT_UI_DEMO_CHASE_OUTBOUND_ID}.default`,
    },
    {
      op: 'wait',
      id: `ontrack.travel.flight.passenger.${AGENT_UI_DEMO_CHASE_OUTBOUND_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'travel-demo-add-flight-jetblue': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-demo' },
    {
      op: 'goto',
      to: `travel/${AGENT_UI_DEMO_TRIP_ID}/add/flight?importFlight=jetblue`,
    },
    {
      op: 'wait',
      prefix: 'ontrack.travel.itineraryAdd.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'wait', ms: 350 },
    { op: 'tap', id: 'ontrack.travel.itineraryAdd.submit' },
    {
      op: 'wait',
      id: `ontrack.travel.timelineItem.${AGENT_UI_PUNTA_CANA_OUTBOUND_ID}.default`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'travel-demo-edit-flight': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    { op: 'seed', to: 'travel-demo' },
    { op: 'goto', to: `travel/${AGENT_UI_DEMO_TRIP_ID}` },
    {
      op: 'wait',
      id: 'ontrack.travel.planDetail.section.timeline',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    // Expand then scroll — Edit sits below the fold on Android (~384×832).
    {
      op: 'tap',
      id: `ontrack.travel.timelineItem.${AGENT_UI_DEMO_FLIGHT_ID}.default`,
    },
    {
      op: 'wait',
      id: `ontrack.travel.timelineItem.${AGENT_UI_DEMO_FLIGHT_ID}.editFlight`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'scroll',
      id: `ontrack.travel.timelineItem.${AGENT_UI_DEMO_FLIGHT_ID}.editFlight`,
    },
    {
      op: 'tap',
      id: `ontrack.travel.timelineItem.${AGENT_UI_DEMO_FLIGHT_ID}.editFlight`,
    },
    {
      op: 'wait',
      id: `ontrack.travel.detailsEditor.save.${AGENT_UI_DEMO_FLIGHT_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'open-new-trip': [
    { op: 'dismiss', prefix: 'ontrack.travel.' },
    // The header add button is intentionally absent in the zero-trip state;
    // seed one stable trip so this flow always exercises that entry point.
    { op: 'seed', to: 'travel-demo' },
    { op: 'goto', to: 'travel' },
    { op: 'wait', prefix: 'ontrack.travel.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.travel.newTrip.open' },
    {
      op: 'wait',
      id: 'ontrack.travel.newTrip.title',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'wait', ms: 250 },
  ],
} as const satisfies Record<string, readonly import('./flows').AgentUiFlowStep[]>;
