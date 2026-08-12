/** Profile / legal / auth / onboarding agent-ui testIDs (composed into agentUiIdsShell). */

export const agentUiIdsShellProfile = {
  profile: {
    avatar: 'ontrack.profile.avatar',
    /** Hero display name (prefs / SSO / default Guest) — opens identity editor. */
    displayName: 'ontrack.profile.displayName',
    /** Hero blurb under the name (preferences `goal`). */
    blurb: 'ontrack.profile.blurb',
    avatarEditor: {
      close: 'ontrack.profile.avatar.close',
      save: 'ontrack.profile.avatar.save',
      mode: (mode: string) => `ontrack.profile.avatar.mode.${mode}`,
      takePhoto: 'ontrack.profile.avatar.takePhoto',
      chooseLibrary: 'ontrack.profile.avatar.chooseLibrary',
      searchIcons: 'ontrack.profile.avatar.searchIcons',
    },
    identityEditor: {
      close: 'ontrack.profile.identity.close',
      save: 'ontrack.profile.identity.save',
      name: 'ontrack.profile.identity.name',
      goal: 'ontrack.profile.identity.goal',
    },
    /** Hero caption while unsigned — local name is not a cloud account. */
    guestStatus: 'ontrack.profile.guestStatus',
    homeLocation: 'ontrack.profile.homeLocation',
    currentLocation: 'ontrack.profile.currentLocation',
    /** Far-right control — refresh Current from device geolocation. */
    currentLocationLocate: 'ontrack.profile.currentLocationLocate',
    locationSuggestion: (fieldTestID: string, index: number) =>
      `${fieldTestID}.suggestion.${index}`,
    locationSuggestionsDismiss: (fieldTestID: string) =>
      `${fieldTestID}.suggestionsDismiss`,
    agents: 'ontrack.profile.agents',
    nutrition: 'ontrack.profile.nutrition',
    calendarSync: 'ontrack.profile.calendarSync',
    designSystem: 'ontrack.profile.designSystem',
    apiUsage: 'ontrack.profile.apiUsage',
    developer: 'ontrack.profile.developer',
    usageAnalytics: 'ontrack.profile.usageAnalytics',
    resetData: 'ontrack.profile.resetData',
    signOut: 'ontrack.profile.signOut',
    createOrSignIn: 'ontrack.profile.createOrSignIn',
    /** Active SSO method under the account email (`Apple` or `Google`). */
    accountProviders: 'ontrack.profile.accountProviders',
    deleteAccount: 'ontrack.profile.deleteAccount',
    privacy: 'ontrack.profile.privacy',
    terms: 'ontrack.profile.terms',
    tmdb: 'ontrack.profile.tmdb',
    theme: (themeId: string) => `ontrack.profile.theme.${themeId}`,
    addon: (addonId: string) => `ontrack.profile.addon.${addonId}`,
    version: 'ontrack.profile.version',
    section: {
      account: 'ontrack.profile.section.account',
      accountSyncing: 'ontrack.profile.section.accountSyncing',
      appearance: 'ontrack.profile.section.appearance',
      developer: 'ontrack.profile.section.developer',
      preferences: 'ontrack.profile.section.preferences',
      features: 'ontrack.profile.section.features',
      addons: 'ontrack.profile.section.addons',
      legal: 'ontrack.profile.section.legal',
      dangerZone: 'ontrack.profile.section.dangerZone',
      disclaimers: 'ontrack.profile.section.disclaimers',
      appInformation: 'ontrack.profile.section.appInformation',
    },
  },
  calendarSync: {
    screen: 'ontrack.calendarSync.screen',
    connect: 'ontrack.calendarSync.connect',
    reconnect: 'ontrack.calendarSync.reconnect',
    sync: 'ontrack.calendarSync.sync',
    disconnectKeep: 'ontrack.calendarSync.disconnectKeep',
    disconnectRemove: 'ontrack.calendarSync.disconnectRemove',
    confirmDisconnectRemove: 'ontrack.calendarSync.confirmDisconnectRemove',
    direction: (direction: string) => `ontrack.calendarSync.direction.${direction}`,
  },
  /** Privacy Policy / Terms of Use document body (`/privacy`, `/terms`). */
  legal: {
    document: 'ontrack.legal.document',
  },
  auth: {
    apple: 'ontrack.auth.apple',
    google: 'ontrack.auth.google',
    guest: 'ontrack.auth.guest',
    switchAccount: 'ontrack.auth.switchAccount',
    dismissError: 'ontrack.auth.dismissError',
    privacy: 'ontrack.auth.privacy',
    terms: 'ontrack.auth.terms',
    themeMode: 'ontrack.auth.themeMode',
    dataChoice: {
      merge: 'ontrack.auth.dataChoice.merge',
      discardDevice: 'ontrack.auth.dataChoice.discardDevice',
      keepDevice: 'ontrack.auth.dataChoice.keepDevice',
      startFresh: 'ontrack.auth.dataChoice.startFresh',
      cancel: 'ontrack.auth.dataChoice.cancel',
    },
    section: {
      hero: 'ontrack.auth.section.hero',
      constellation: 'ontrack.auth.section.constellation',
      providers: 'ontrack.auth.section.providers',
    },
  },
  onboarding: {
    getStarted: 'ontrack.onboarding.getStarted',
    skip: 'ontrack.onboarding.skip',
    name: 'ontrack.onboarding.name',
    goal: 'ontrack.onboarding.goal',
    signIn: 'ontrack.onboarding.signIn',
  },
} as const;
