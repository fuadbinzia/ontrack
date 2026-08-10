/** Travel agent-ui testIDs (composed into AgentUiIds). */

export const agentUiIdsTravel = {
  travel: {
    chrome: {
      /** Layout anchor — flight-path flourish on the main itinerary hero only. */
      flightPath: 'ontrack.travel.chrome.flightPath',
      /** Layout anchor — night stars / day sunshine behind travel page titles. */
      skyDecor: 'ontrack.travel.chrome.skyDecor',
    },
    flight: {
      layoverDuration: 'ontrack.travel.flight.layoverDuration',
      connectionAirport: 'ontrack.travel.flight.connectionAirport',
      departureAirport: 'ontrack.travel.flight.departureAirport',
      arrivalAirport: 'ontrack.travel.flight.arrivalAirport',
      departureTerminal: 'ontrack.travel.flight.departureTerminal',
      arrivalTerminal: 'ontrack.travel.flight.arrivalTerminal',
      departureGate: 'ontrack.travel.flight.departureGate',
      arrivalGate: 'ontrack.travel.flight.arrivalGate',
      status: (itemId: string, legIndex: number) =>
        `ontrack.travel.flight.status.${itemId}.${legIndex}`,
      legStatus: (itemId: string, legIndex: number) =>
        `ontrack.travel.flight.legStatus.${itemId}.${legIndex}`,
      passenger: (itemId: string) =>
        `ontrack.travel.flight.passenger.${itemId}`,
      openConfirmation: (itemId: string) =>
        `ontrack.travel.flight.openConfirmation.${itemId}`,
    },
    transport: {
      mode: (mode: string) => `ontrack.travel.transport.mode.${mode}`,
      origin: 'ontrack.travel.transport.origin',
      destination: 'ontrack.travel.transport.destination',
      arrivalDate: 'ontrack.travel.transport.arrivalDate',
      arrivalTime: 'ontrack.travel.transport.arrivalTime',
      operator: 'ontrack.travel.transport.operator',
      serviceNumber: 'ontrack.travel.transport.serviceNumber',
      platform: 'ontrack.travel.transport.platform',
      seat: 'ontrack.travel.transport.seat',
      vehicle: 'ontrack.travel.transport.vehicle',
      confirmationCode: 'ontrack.travel.transport.confirmationCode',
      attachDocument: 'ontrack.travel.transport.attachDocument',
      attachScreenshots: 'ontrack.travel.transport.attachScreenshots',
      distance: 'ontrack.travel.transport.distance',
      distanceUnit: (unit: string) =>
        `ontrack.travel.transport.distanceUnit.${unit}`,
      fare: 'ontrack.travel.transport.fare',
      currency: 'ontrack.travel.transport.currency',
      addStop: 'ontrack.travel.transport.addStop',
      stopName: (id: string) => `ontrack.travel.transport.stop.${id}.name`,
      stopAddress: (id: string) =>
        `ontrack.travel.transport.stop.${id}.address`,
      stopDate: (id: string) => `ontrack.travel.transport.stop.${id}.date`,
      stopTime: (id: string) => `ontrack.travel.transport.stop.${id}.time`,
      stopNotes: (id: string) => `ontrack.travel.transport.stop.${id}.notes`,
      removeStop: (id: string) => `ontrack.travel.transport.stop.${id}.remove`,
      openMaps: (id: string) => `ontrack.travel.transport.${id}.openMaps`,
      edit: (id: string) => `ontrack.travel.transport.${id}.edit`,
      editDepartureDate: 'ontrack.travel.transport.edit.departureDate',
      editDepartureTime: 'ontrack.travel.transport.edit.departureTime',
      editArrivalDate: 'ontrack.travel.transport.edit.arrivalDate',
      editArrivalTime: 'ontrack.travel.transport.edit.arrivalTime',
      removeKeepExpense: 'ontrack.travel.transport.remove.keepExpense',
      removeWithExpense: 'ontrack.travel.transport.remove.withExpense',
    },
    newTrip: {
      open: 'ontrack.travel.newTrip.open',
      cancel: 'ontrack.travel.newTrip.cancel',
      title: 'ontrack.travel.newTrip.title',
      destination: 'ontrack.travel.newTrip.destination',
      dates: 'ontrack.travel.newTrip.dates',
      datesClose: 'ontrack.travel.newTrip.datesClose',
      datesSave: 'ontrack.travel.newTrip.datesSave',
      calendar: 'ontrack.travel.newTrip.calendar',
      notes: 'ontrack.travel.newTrip.notes',
      create: 'ontrack.travel.newTrip.create',
    },
    /** Backdrop that closes AddressAutofindField suggestions (tap outside). */
    addressSuggestionsDismiss: (fieldTestID: string) =>
      `${fieldTestID}.suggestionsDismiss`,
    addressSuggestion: (fieldTestID: string, index: number) =>
      `${fieldTestID}.suggestion.${index}`,
    /**
     * Travel Home (`/travel`, flow `travel-home`). Wire ids stay `travel.list.*`
     * (historical). Prefer these keys in new code; `list` remains the stamp source.
     * Host resolve also rewrites `travel.home.*` → `travel.list.*`.
     */
    home: {
      sectionYourTrips: 'ontrack.travel.list.section.yourTrips',
      sectionEmpty: 'ontrack.travel.list.section.empty',
      atmosphereLocation: 'ontrack.travel.list.section.atmosphereLocation',
      search: 'ontrack.travel.list.search',
      searchMinimize: 'ontrack.travel.list.searchMinimize',
      searchDismiss: 'ontrack.travel.list.searchDismiss',
      searchClear: 'ontrack.travel.list.searchClear',
      emptyCreate: 'ontrack.travel.list.empty.create',
      emptySearch: 'ontrack.travel.list.empty.search',
      itinerary: (tripId: string) => `ontrack.travel.list.itinerary.${tripId}`,
      dates: (tripId: string) => `ontrack.travel.list.dates.${tripId}`,
      openHub: (tripId: string) => `ontrack.travel.list.openHub.${tripId}`,
      editTrip: (tripId: string) => `ontrack.travel.list.editTrip.${tripId}`,
      coTravelers: (tripId: string) =>
        `ontrack.travel.list.coTravelers.${tripId}`,
    },
    /** Historical wire namespace for Travel Home + plan-detail tool ids. */
    list: {
      cover: (tripId: string) => `ontrack.travel.list.cover.${tripId}`,
      collapse: (tripId: string) => `ontrack.travel.list.collapse.${tripId}`,
      editDates: (tripId: string) => `ontrack.travel.list.editDates.${tripId}`,
      searchFlights: (tripId: string) =>
        `ontrack.travel.list.searchFlights.${tripId}`,
      addTransport: (tripId: string) =>
        `ontrack.travel.list.addTransport.${tripId}`,
      searchStays: (tripId: string) =>
        `ontrack.travel.list.searchStays.${tripId}`,
      itinerary: (tripId: string) => `ontrack.travel.list.itinerary.${tripId}`,
      /** Layout anchor — trip-card footer date + weekday range. */
      dates: (tripId: string) => `ontrack.travel.list.dates.${tripId}`,
      openHub: (tripId: string) => `ontrack.travel.list.openHub.${tripId}`,
      calendar: (tripId: string) => `ontrack.travel.list.calendar.${tripId}`,
      tripWeather: (tripId: string) =>
        `ontrack.travel.list.tripWeather.${tripId}`,
      currency: (tripId: string) => `ontrack.travel.list.currency.${tripId}`,
      expenses: (tripId: string) => `ontrack.travel.list.expenses.${tripId}`,
      groupChat: (tripId: string) => `ontrack.travel.list.groupChat.${tripId}`,
      coTravelers: (tripId: string) =>
        `ontrack.travel.list.coTravelers.${tripId}`,
      editTrip: (tripId: string) => `ontrack.travel.list.editTrip.${tripId}`,
      notesSection: (tripId: string) =>
        `ontrack.travel.list.notesSection.${tripId}`,
      sectionYourTrips: 'ontrack.travel.list.section.yourTrips',
      sectionEmpty: 'ontrack.travel.list.section.empty',
      atmosphereLocation: 'ontrack.travel.list.section.atmosphereLocation',
      search: 'ontrack.travel.list.search',
      searchMinimize: 'ontrack.travel.list.searchMinimize',
      searchDismiss: 'ontrack.travel.list.searchDismiss',
      searchClear: 'ontrack.travel.list.searchClear',
      emptyCreate: 'ontrack.travel.list.empty.create',
      emptySearch: 'ontrack.travel.list.empty.search',
    },
    hub: {
      close: 'ontrack.travel.hub.close',
      backToTravel: 'ontrack.travel.hub.backToTravel',
      section: (tripId: string) => `ontrack.travel.hub.section.${tripId}`,
    },
    dates: {
      close: 'ontrack.travel.dates.close',
      start: 'ontrack.travel.dates.start',
      end: 'ontrack.travel.dates.end',
      calendar: 'ontrack.travel.dates.calendar',
      save: 'ontrack.travel.dates.save',
    },
    planNotes: {
      close: 'ontrack.travel.planNotes.close',
      field: 'ontrack.travel.planNotes.field',
      save: 'ontrack.travel.planNotes.save',
    },
    photoViewer: {
      dismiss: (tripId: string) =>
        `ontrack.travel.photoViewer.dismiss.${tripId}`,
      close: (tripId: string) => `ontrack.travel.photoViewer.close.${tripId}`,
    },
    editTrip: {
      save: 'ontrack.travel.editTrip.save',
      cancel: 'ontrack.travel.editTrip.cancel',
      cover: 'ontrack.travel.editTrip.cover',
      addCover: 'ontrack.travel.editTrip.addCover',
      removeCover: (index: number) =>
        `ontrack.travel.editTrip.removeCover.${index}`,
      title: 'ontrack.travel.editTrip.title',
      destination: 'ontrack.travel.editTrip.destination',
      startDate: 'ontrack.travel.editTrip.startDate',
      endDate: 'ontrack.travel.editTrip.endDate',
      notes: 'ontrack.travel.editTrip.notes',
      dangerZone: 'ontrack.travel.editTrip.dangerZone',
    },
    detailsEditor: {
      save: (itemId: string) => `ontrack.travel.detailsEditor.save.${itemId}`,
      cancel: (itemId: string) =>
        `ontrack.travel.detailsEditor.cancel.${itemId}`,
      remove: (itemId: string) =>
        `ontrack.travel.detailsEditor.remove.${itemId}`,
    },
    friends: {
      close: 'ontrack.travel.friends.close',
      openInvite: 'ontrack.travel.friends.openInvite',
      cancelInvite: 'ontrack.travel.friends.cancelInvite',
      inviteName: 'ontrack.travel.friends.inviteName',
      inviteEmail: 'ontrack.travel.friends.inviteEmail',
      createInvite: 'ontrack.travel.friends.createInvite',
      leaveTrip: 'ontrack.travel.friends.leaveTrip',
      copyJoinLink: 'ontrack.travel.friends.copyJoinLink',
      shareJoinLink: 'ontrack.travel.friends.shareJoinLink',
    },
    currency: {
      close: 'ontrack.travel.currency.close',
      done: 'ontrack.travel.currency.done',
    },
    weather: {
      close: 'ontrack.travel.weather.close',
      done: 'ontrack.travel.weather.done',
      /** Live conditions at the trip destination (layout anchor). */
      current: 'ontrack.travel.weather.current',
    },
    friendRow: {
      action: (target: string, action: string) =>
        `ontrack.travel.friendRow.${target}.${action}`,
    },
    confirmation: {
      open: (kind: string) => `ontrack.travel.confirmation.open.${kind}`,
      close: 'ontrack.travel.confirmation.close',
      importAction: (kind: string) =>
        `ontrack.travel.confirmation.importAction.${kind}`,
    },
    notes: {
      open: (itemId: string) => `ontrack.travel.notes.open.${itemId}`,
      close: 'ontrack.travel.notes.close',
      composer: 'ontrack.travel.notes.composer',
      submit: 'ontrack.travel.notes.submit',
      cancelEdit: 'ontrack.travel.notes.cancelEdit',
      edit: (noteId: string) => `ontrack.travel.notes.edit.${noteId}`,
      delete: (noteId: string) => `ontrack.travel.notes.delete.${noteId}`,
      confirmDelete: 'ontrack.travel.notes.confirmDelete',
    },
    planDetail: {
      /** Unused — prefer `list.tripWeather`. */
      weather: 'ontrack.travel.planDetail.weather',
      /** Unused — prefer `list.currency`. */
      currency: 'ontrack.travel.planDetail.currency',
      addToTimeline: 'ontrack.travel.planDetail.addToTimeline',
      toolsSection: 'ontrack.travel.planDetail.section.tools',
      transportSection: 'ontrack.travel.planDetail.section.transport',
      flightsSection: 'ontrack.travel.planDetail.section.flights',
      groundSection: 'ontrack.travel.planDetail.section.ground',
      staysSection: 'ontrack.travel.planDetail.section.stays',
      rentalsSection: 'ontrack.travel.planDetail.section.rentals',
      timelineSection: 'ontrack.travel.planDetail.section.timeline',
      notesSection: 'ontrack.travel.planDetail.section.notes',
      editNotes: 'ontrack.travel.planDetail.editNotes',
      weatherCard: 'ontrack.travel.planDetail.weatherCard',
      addFlight: 'ontrack.travel.planDetail.addFlight',
      addTransport: 'ontrack.travel.planDetail.addTransport',
      addStay: 'ontrack.travel.planDetail.addStay',
      addRental: 'ontrack.travel.planDetail.addRental',
      backToTravel: 'ontrack.travel.planDetail.backToTravel',
      /** Floating glass Group Chat FAB on itinerary (icon only). */
      groupChat: 'ontrack.travel.planDetail.groupChat',
    },
    timelineAdd: {
      dismiss: 'ontrack.travel.timelineAdd.dismiss',
      close: 'ontrack.travel.timelineAdd.close',
      kind: (kind: string) => `ontrack.travel.timelineAdd.kind.${kind}`,
    },
    timelineDay: {
      toggle: (date: string) => `ontrack.travel.timelineDay.${date}`,
    },
    timeline: {
      progress: 'ontrack.travel.timeline.progress',
      progressBadge: 'ontrack.travel.timeline.progressBadge',
      progressMeta: 'ontrack.travel.timeline.progressMeta',
      traveler: 'ontrack.travel.timeline.traveler',
      now: 'ontrack.travel.timeline.now',
    },
    timelineItem: {
      toggle: (itemId: string, phase: string) =>
        `ontrack.travel.timelineItem.${itemId}.${phase}`,
      editFlight: (itemId: string) =>
        `ontrack.travel.timelineItem.${itemId}.editFlight`,
      /** Edit a moment or activity from the itinerary timeline toolbar. */
      edit: (itemId: string) =>
        `ontrack.travel.timelineItem.${itemId}.edit`,
      openAddress: (itemId: string) =>
        `ontrack.travel.timelineItem.${itemId}.openAddress`,
    },
    flightSearch: {
      back: 'ontrack.travel.flightSearch.back',
      from: 'ontrack.travel.flightSearch.from',
      to: 'ontrack.travel.flightSearch.to',
      departure: 'ontrack.travel.flightSearch.departure',
      return: 'ontrack.travel.flightSearch.return',
      travelers: 'ontrack.travel.flightSearch.travelers',
      currency: 'ontrack.travel.flightSearch.currency',
      searchLive: 'ontrack.travel.flightSearch.searchLive',
      compareGoogle: 'ontrack.travel.flightSearch.compareGoogle',
    },
    staySearch: {
      back: 'ontrack.travel.staySearch.back',
      provider: (providerId: string) =>
        `ontrack.travel.staySearch.provider.${providerId}`,
    },
    addPhotos: {
      dismiss: 'ontrack.travel.addPhotos.dismiss',
      close: 'ontrack.travel.addPhotos.close',
      takePhoto: 'ontrack.travel.addPhotos.takePhoto',
      chooseFromPhotos: 'ontrack.travel.addPhotos.chooseFromPhotos',
      removePhoto: 'ontrack.travel.addPhotos.removePhoto',
      confirmRemovePhoto: 'ontrack.travel.addPhotos.confirmRemovePhoto',
    },
    calendarUpdated: {
      dismiss: 'ontrack.travel.calendarUpdated.dismiss',
      goToCalendar: 'ontrack.travel.calendarUpdated.goToCalendar',
      backToTravel: 'ontrack.travel.calendarUpdated.backToTravel',
    },
    importResult: {
      close: 'ontrack.travel.importResult.close',
      reviewExpense: 'ontrack.travel.importResult.reviewExpense',
    },
    expenses: {
      paidBy: 'ontrack.travel.expenses.paidBy',
      splitWith: 'ontrack.travel.expenses.splitWith',
      /** Stable wait target when the Expenses list sheet is open. */
      list: 'ontrack.travel.expenses.list',
      addExpense: 'ontrack.travel.expenses.addExpense',
      submitExpense: 'ontrack.travel.expenses.submitExpense',
      saveExpense: 'ontrack.travel.expenses.saveExpense',
      deleteExpense: 'ontrack.travel.expenses.deleteExpense',
      deleteExpenseFooter: 'ontrack.travel.expenses.deleteExpenseFooter',
      confirmDelete: 'ontrack.travel.expenses.confirmDelete',
      close: 'ontrack.travel.expenses.close',
      row: (expenseId: string) => `ontrack.travel.expenses.row.${expenseId}`,
    },
    removeConfirm: {
      dismiss: 'ontrack.travel.removeConfirm.dismiss',
      close: 'ontrack.travel.removeConfirm.close',
      cancel: 'ontrack.travel.removeConfirm.cancel',
      confirm: 'ontrack.travel.removeConfirm.confirm',
      open: 'ontrack.travel.removeConfirm.open',
    },
    itineraryAdd: {
      close: 'ontrack.travel.itineraryAdd.close',
      importScreenshots: 'ontrack.travel.itineraryAdd.importScreenshots',
      importDocument: 'ontrack.travel.itineraryAdd.importDocument',
      tripType: (value: 'one-way' | 'round-trip') =>
        `ontrack.travel.itineraryAdd.tripType.${value}`,
      title: 'ontrack.travel.itineraryAdd.title',
      date: 'ontrack.travel.itineraryAdd.date',
      time: 'ontrack.travel.itineraryAdd.time',
      endDate: 'ontrack.travel.itineraryAdd.endDate',
      endTime: 'ontrack.travel.itineraryAdd.endTime',
      returnTitle: 'ontrack.travel.itineraryAdd.returnTitle',
      returnDate: 'ontrack.travel.itineraryAdd.returnDate',
      returnTime: 'ontrack.travel.itineraryAdd.returnTime',
      returnEndDate: 'ontrack.travel.itineraryAdd.returnEndDate',
      returnEndTime: 'ontrack.travel.itineraryAdd.returnEndTime',
      returnAirline: 'ontrack.travel.itineraryAdd.returnAirline',
      returnFlightNumber: 'ontrack.travel.itineraryAdd.returnFlightNumber',
      returnFrom: 'ontrack.travel.itineraryAdd.returnFrom',
      returnTo: 'ontrack.travel.itineraryAdd.returnTo',
      returnLayoverDuration: 'ontrack.travel.itineraryAdd.returnLayoverDuration',
      returnConnectionAirport:
        'ontrack.travel.itineraryAdd.returnConnectionAirport',
      details: 'ontrack.travel.itineraryAdd.details',
      bookingUrl: 'ontrack.travel.itineraryAdd.bookingUrl',
      submit: 'ontrack.travel.itineraryAdd.submit',
    },
    chat: {
      close: 'ontrack.travel.chat.close',
      enableNotifications: 'ontrack.travel.chat.enableNotifications',
      dismissNotifications: 'ontrack.travel.chat.dismissNotifications',
      menu: 'ontrack.travel.chat.menu',
      settingsClose: 'ontrack.travel.chat.settingsClose',
      settingsEnableNotifications:
        'ontrack.travel.chat.settingsEnableNotifications',
      composer: 'ontrack.travel.chat.composer',
      send: 'ontrack.travel.chat.send',
      replyCancel: 'ontrack.travel.chat.replyCancel',
      messageActions: 'ontrack.travel.chat.messageActions',
      menuReply: 'ontrack.travel.chat.menuReply',
      menuCopy: 'ontrack.travel.chat.menuCopy',
      menuEdit: 'ontrack.travel.chat.menuEdit',
      menuDelete: 'ontrack.travel.chat.menuDelete',
      reaction: (emoji: string) =>
        `ontrack.travel.chat.reaction.${encodeURIComponent(emoji)}`,
    },
  },
} as const;
