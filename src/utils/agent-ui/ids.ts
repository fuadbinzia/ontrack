/** Stable agent-facing testIDs. Convention: ontrack.<feature>.<surface>.<control> */

export const AgentUiIds = {
  tabs: {
    today: 'ontrack.tabs.today',
    calendar: 'ontrack.tabs.calendar',
    checklists: 'ontrack.tabs.checklists',
    social: 'ontrack.tabs.social',
    insights: 'ontrack.tabs.insights',
    profile: 'ontrack.tabs.profile',
    workouts: 'ontrack.tabs.workouts',
    plants: 'ontrack.tabs.plants',
    travel: 'ontrack.tabs.travel',
    visionBoard: 'ontrack.tabs.visionBoard',
    games: 'ontrack.tabs.games',
    vehicles: 'ontrack.tabs.vehicles',
    health: 'ontrack.tabs.health',
    food: 'ontrack.tabs.food',
    carouselPrev: 'ontrack.tabs.carousel.prev',
    carouselNext: 'ontrack.tabs.carousel.next',
    /** Layout anchor for the page-matching bottom nav fill (not tappable). */
    dock: 'ontrack.tabs.dock',
  },
  health: {
    settings: 'ontrack.health.settings',
    section: (section: string) => `ontrack.health.section.${section}`,
    connect: 'ontrack.health.body.connect',
    refresh: 'ontrack.health.body.refresh',
    openAppleHealth: 'ontrack.health.body.openAppleHealth',
    sleepHandoff: 'ontrack.health.body.sleepHandoff',
    range: (days: number) => `ontrack.health.body.range.${days}`,
    checkIn: 'ontrack.health.mind.checkIn',
    addFactor: 'ontrack.health.mind.addFactor',
    moodEntry: (id: string) => `ontrack.health.mind.entry.${id}`,
    editFactor: (id: string) => `ontrack.health.mind.factor.${id}.edit`,
    addPlaybook: 'ontrack.health.mind.addPlaybook',
    editPlaybook: (id: string) => `ontrack.health.playbook.${id}.edit`,
    startPlaybook: (id: string) => `ontrack.health.playbook.${id}.start`,
    completePlaybook: (id: string) =>
      `ontrack.health.playbookRun.${id}.complete`,
    cancelPlaybook: (id: string) => `ontrack.health.playbookRun.${id}.cancel`,
    call988: 'ontrack.health.support.call988',
    text988: 'ontrack.health.support.text988',
    emotion: (id: string) => `ontrack.health.checkIn.emotion.${id}`,
    intensity: (id: string, value: number) =>
      `ontrack.health.checkIn.intensity.${id}.${value}`,
    factor: (id: string) => `ontrack.health.checkIn.factor.${id}`,
    note: 'ontrack.health.checkIn.note',
    customEmotion: 'ontrack.health.checkIn.customEmotion',
    addCustomEmotion: 'ontrack.health.checkIn.addCustomEmotion',
    stateKind: (kind: string) => `ontrack.health.checkIn.stateKind.${kind}`,
    valence: (value: string) => `ontrack.health.checkIn.valence.${value}`,
    saveCheckIn: 'ontrack.health.checkIn.save',
    factorName: 'ontrack.health.factor.name',
    factorCategory: (category: string) =>
      `ontrack.health.factor.category.${category}`,
    factorEmotion: (id: string) => `ontrack.health.factor.emotion.${id}`,
    saveFactor: 'ontrack.health.factor.save',
    deleteFactor: 'ontrack.health.factor.delete',
    playbookName: 'ontrack.health.playbook.name',
    playbookEmotion: (group: string, id: string) =>
      `ontrack.health.playbook.${group}.${id}`,
    playbookSteps: 'ontrack.health.playbook.steps',
    playbookDuration: 'ontrack.health.playbook.duration',
    savePlaybook: 'ontrack.health.playbook.save',
    deletePlaybook: 'ontrack.health.playbook.delete',
    suggestPlaybook: 'ontrack.health.playbook.suggest',
    useSuggestion: (index: number) =>
      `ontrack.health.playbook.suggestion.${index}.use`,
    settingsConnect: 'ontrack.health.settings.connect',
    openAppleHealthSettings: 'ontrack.health.settings.openAppleHealth',
    stateSync: (value: string) => `ontrack.health.settings.stateSync.${value}`,
    reset: 'ontrack.health.settings.reset',
  },
  vehicles: {
    add: 'ontrack.vehicles.list.add',
    vehicle: (vehicleId: string) =>
      `ontrack.vehicles.list.vehicle.${vehicleId}`,
    settings: 'ontrack.vehicles.detail.settings',
    section: (section: string) => `ontrack.vehicles.detail.section.${section}`,
    saveOdometer: 'ontrack.vehicles.detail.saveOdometer',
    overviewSettingsTip: (vehicleId: string) =>
      `ontrack.vehicles.detail.overviewSettingsTip.${vehicleId}`,
    new: {
      nickname: 'ontrack.vehicles.new.nickname',
      year: 'ontrack.vehicles.new.year',
      make: 'ontrack.vehicles.new.make',
      model: 'ontrack.vehicles.new.model',
      vin: 'ontrack.vehicles.new.vin',
      odometer: 'ontrack.vehicles.new.odometer',
      save: 'ontrack.vehicles.new.save',
      cancel: 'ontrack.vehicles.new.cancel',
    },
    expenses: {
      title: 'ontrack.vehicles.expenses.title',
      amount: 'ontrack.vehicles.expenses.amount',
      date: 'ontrack.vehicles.expenses.date',
      category: (category: string) =>
        `ontrack.vehicles.expenses.category.${category}`,
      notes: 'ontrack.vehicles.expenses.notes',
      add: 'ontrack.vehicles.expenses.add',
      delete: (expenseId: string) =>
        `ontrack.vehicles.expenses.delete.${expenseId}`,
      confirmDelete: 'ontrack.vehicles.expenses.confirmDelete',
    },
  },
  today: {
    prevDay: 'ontrack.today.prevDay',
    nextDay: 'ontrack.today.nextDay',
    weather: 'ontrack.today.weather',
    /** Layout anchor — only mounted when day completion > 0. */
    progress: 'ontrack.today.progress',
    addActivity: 'ontrack.today.addActivity',
    emptyAddActivity: 'ontrack.today.emptyAddActivity',
    activity: (activityId: string) => `ontrack.today.activity.${activityId}`,
    activityToggle: (activityId: string) =>
      `ontrack.today.activityToggle.${activityId}`,
    location: {
      close: 'ontrack.today.location.close',
      useCurrent: 'ontrack.today.location.useCurrent',
      place: 'ontrack.today.location.place',
      save: 'ontrack.today.location.save',
      clear: 'ontrack.today.location.clear',
    },
  },
  calendar: {
    jumpToday: 'ontrack.calendar.jumpToday',
    prevMonth: 'ontrack.calendar.prevMonth',
    nextMonth: 'ontrack.calendar.nextMonth',
    openDay: 'ontrack.calendar.openDay',
    day: (dateKey: string) => `ontrack.calendar.day.${dateKey}`,
  },
  checklists: {
    editMode: 'ontrack.checklists.editMode',
    collaborators: 'ontrack.checklists.collaborators',
    newListName: 'ontrack.checklists.newListName',
    createList: 'ontrack.checklists.createList',
    newListKind: (kind: string) => `ontrack.checklists.newListKind.${kind}`,
    list: (listId: string) => `ontrack.checklists.list.${listId}`,
    listName: (listId: string) => `ontrack.checklists.listName.${listId}`,
    detail: {
      back: 'ontrack.checklists.detail.back',
      newTask: 'ontrack.checklists.detail.newTask',
      addTask: 'ontrack.checklists.detail.addTask',
      sort: 'ontrack.checklists.detail.sort',
      actions: 'ontrack.checklists.detail.actions',
      editMode: 'ontrack.checklists.detail.editMode',
      task: (taskId: string) => `ontrack.checklists.detail.task.${taskId}`,
    },
  },
  grocery: {
    addRecipe: 'ontrack.grocery.detail.addRecipe',
    settings: 'ontrack.grocery.detail.settings',
    share: 'ontrack.grocery.detail.share',
    copy: 'ontrack.grocery.detail.copy',
    view: (view: string) => `ontrack.grocery.detail.view.${view}`,
    recipe: (recipeId: string) => `ontrack.grocery.detail.recipe.${recipeId}`,
    task: (taskId: string) => `ontrack.grocery.detail.task.${taskId}`,
    combinedItem: (groupId: string) =>
      `ontrack.grocery.detail.combined.${groupId}`,
  },
  recipeImport: {
    cancel: 'ontrack.recipeImport.cancel',
    stop: 'ontrack.recipeImport.stop',
    url: 'ontrack.recipeImport.url',
    analyze: 'ontrack.recipeImport.analyze',
    camera: 'ontrack.recipeImport.camera',
    library: 'ontrack.recipeImport.library',
    mealName: 'ontrack.recipeImport.mealName',
    sourceUrl: 'ontrack.recipeImport.sourceUrl',
    sourceServings: 'ontrack.recipeImport.sourceServings',
    targetServings: 'ontrack.recipeImport.targetServings',
    addIngredient: 'ontrack.recipeImport.ingredient.add',
    ingredientName: (ingredientId: string) =>
      `ontrack.recipeImport.ingredient.${ingredientId}.name`,
    removeIngredient: (ingredientId: string) =>
      `ontrack.recipeImport.ingredient.${ingredientId}.remove`,
    save: 'ontrack.recipeImport.save',
  },
  plants: {
    add: 'ontrack.plants.list.add',
    plant: (plantId: string) => `ontrack.plants.list.plant.${plantId}`,
    detail: {
      edit: 'ontrack.plants.detail.edit',
      amount: 'ontrack.plants.detail.amount',
      logWatering: 'ontrack.plants.detail.logWatering',
      adjustSchedule: 'ontrack.plants.detail.adjustSchedule',
      undoWatering: 'ontrack.plants.detail.undoWatering',
      checkIn: 'ontrack.plants.detail.checkIn',
      delete: 'ontrack.plants.detail.delete',
    },
    new: {
      camera: 'ontrack.plants.new.camera',
      library: 'ontrack.plants.new.library',
      analyze: 'ontrack.plants.new.analyze',
      confirmIdentity: 'ontrack.plants.new.confirmIdentity',
      nickname: 'ontrack.plants.new.nickname',
      buildCarePlan: 'ontrack.plants.new.buildCarePlan',
      save: 'ontrack.plants.new.save',
    },
  },
  peoplePicker: {
    close: 'ontrack.peoplePicker.close',
    search: 'ontrack.peoplePicker.search',
    friend: (friendId: string) => `ontrack.peoplePicker.friend.${friendId}`,
    confirm: 'ontrack.peoplePicker.confirm',
  },
  food: {
    home: {
      /** Layout anchor for the Home suggestions section (not tappable). */
      suggestionsSection: 'ontrack.food.home.section.suggestions',
      search: 'ontrack.food.home.search',
      /** Suggestion hero carousel page → recipe detail. */
      heroCard: (recipeId: string) => `ontrack.food.home.hero.${recipeId}`,
      /** Empty-suggestions CTA → AI ideas. */
      suggestionsAskAi: 'ontrack.food.home.suggestions.askAi',
      /** Quick action tile: scan | askAi | recipes | track | plan | community. */
      quickAction: (action: string) => `ontrack.food.home.quick.${action}`,
      /** Header shortcut → Diet & Preferences. */
      preferences: 'ontrack.food.home.preferences',
      todaySection: 'ontrack.food.home.section.today',
      todayRow: (activityId: string) =>
        `ontrack.food.home.today.${activityId}`,
      todayAdd: 'ontrack.food.home.today.add',
      pantrySection: 'ontrack.food.home.section.pantry',
      /** Empty-pantry CTA → scanner. */
      pantryScan: 'ontrack.food.home.pantry.scan',
      leftoverCard: 'ontrack.food.home.leftover',
      nutritionSection: 'ontrack.food.home.section.nutrition',
      communitySection: 'ontrack.food.home.section.community',
    },
    recipes: {
      /** RecipeCard press target (list and grid layouts). */
      card: (recipeId: string) => `ontrack.food.recipes.card.${recipeId}`,
      /** RecipeCard favorite heart toggle. */
      favorite: (recipeId: string) =>
        `ontrack.food.recipes.card.${recipeId}.favorite`,
      search: 'ontrack.food.recipes.search',
      /** Filter chip (all | quick | healthy | halal | …). */
      filter: (filterId: string) => `ontrack.food.recipes.filter.${filterId}`,
      /** Cuisine category chip (slugged cuisine name). */
      category: (key: string) => `ontrack.food.recipes.category.${key}`,
      featured: 'ontrack.food.recipes.featured',
      /** Layout anchor for the recipe list/grid (not tappable). */
      listSection: 'ontrack.food.recipes.section.list',
      /** Empty-state action (ask AI / clear filters). */
      emptyAction: 'ontrack.food.recipes.empty.action',
    },
    recipeDetail: {
      back: 'ontrack.food.recipeDetail.back',
      favorite: 'ontrack.food.recipeDetail.favorite',
      share: 'ontrack.food.recipeDetail.share',
      /** Share sheet secondary action → system share outside the app. */
      shareExternal: 'ontrack.food.recipeDetail.share.external',
      /** Section segment: overview | ingredients | steps | nutrition. */
      section: (name: string) => `ontrack.food.recipeDetail.section.${name}`,
      addToPlan: 'ontrack.food.recipeDetail.addToPlan',
      startCooking: 'ontrack.food.recipeDetail.startCooking',
      /** Add-to-plan sheet day chip (YYYY-MM-DD). */
      planDay: (dateKey: string) =>
        `ontrack.food.recipeDetail.plan.day.${dateKey}`,
      /** Add-to-plan sheet meal-type segment. */
      planMealType: (mealType: string) =>
        `ontrack.food.recipeDetail.plan.mealType.${mealType}`,
      planServingsMinus: 'ontrack.food.recipeDetail.plan.servings.minus',
      planServingsPlus: 'ontrack.food.recipeDetail.plan.servings.plus',
      /** Cooking sheet: back one step (advance/finish = `sheet.cooking.done`). */
      cookPrev: 'ontrack.food.recipeDetail.cook.prev',
    },
    tracker: {
      prevDay: 'ontrack.food.tracker.prevDay',
      nextDay: 'ontrack.food.tracker.nextDay',
      /** Jump back to today (shown only when off today). */
      today: 'ontrack.food.tracker.today',
      /** Meals region anchor — renders on empty days too (not tappable). */
      mealsSection: 'ontrack.food.tracker.section.meals',
      /** Layout anchor per meal section (breakfast | lunch | dinner | snacks). */
      section: (mealSection: string) =>
        `ontrack.food.tracker.section.${mealSection}`,
      /** Per-section add-meal → existing activity-form meal path. */
      add: (mealSection: string) => `ontrack.food.tracker.add.${mealSection}`,
      /** Scheduled meal row → existing food detail route. */
      row: (activityId: string) => `ontrack.food.tracker.row.${activityId}`,
      nutritionSection: 'ontrack.food.tracker.section.nutrition',
      /** Empty-day CTA → existing activity-form meal path. */
      emptyAdd: 'ontrack.food.tracker.empty.add',
    },
    aiIdeas: {
      /** Multiline "what ingredients do you have" prompt. */
      input: 'ontrack.food.aiIdeas.input',
      /** Pantry/recent ingredient toggle chip (canonical key). */
      chip: (key: string) => `ontrack.food.aiIdeas.chip.${key}`,
      /** Meal-type chip (breakfast | lunch | dinner | snack). */
      mealType: (mealType: string) => `ontrack.food.aiIdeas.mealType.${mealType}`,
      /** Time/complexity chip (quick | standard | relaxed). */
      timeframe: (key: string) => `ontrack.food.aiIdeas.time.${key}`,
      generate: 'ontrack.food.aiIdeas.generate',
      /** Visible active-exclusions line anchor (not tappable). */
      exclusionsSection: 'ontrack.food.aiIdeas.section.exclusions',
      /** Results list layout anchor (not tappable). */
      resultsSection: 'ontrack.food.aiIdeas.section.results',
      /** Suggestion card (suggestion id, e.g. idea-1). */
      result: (id: string) => `ontrack.food.aiIdeas.result.${id}`,
      /** Save suggestion → `useRecipes.saveGeneratedRecipe`. */
      save: (id: string) => `ontrack.food.aiIdeas.result.${id}.save`,
      retry: 'ontrack.food.aiIdeas.retry',
    },
    scan: {
      /** Viewfinder frame layout anchor (not tappable). */
      frameSection: 'ontrack.food.scan.section.frame',
      /** Take a label photo (system camera via image picker). */
      capture: 'ontrack.food.scan.capture',
      /** Pick a label photo from the library. */
      gallery: 'ontrack.food.scan.gallery',
      /** Scan another label (result sheet footer alt action). */
      retake: 'ontrack.food.scan.retake',
      /** Retry analysis after an error (photo kept). */
      retry: 'ontrack.food.scan.retry',
      /** Reopen the dismissed analysis sheet. */
      reopen: 'ontrack.food.scan.reopen',
      /** Result sheet analysis layout anchor (not tappable). */
      resultSection: 'ontrack.food.scan.section.result',
      /** Low-confidence correction step layout anchor (not tappable). */
      reviewSection: 'ontrack.food.scan.section.review',
      /** Editable detected-ingredient field (list index). */
      reviewItem: (index: number) => `ontrack.food.scan.review.item.${index}`,
      /** Remove a detected ingredient (list index). */
      reviewRemove: (index: number) => `ontrack.food.scan.review.remove.${index}`,
      /** Add a missed ingredient row. */
      reviewAdd: 'ontrack.food.scan.review.add',
    },
    ingredients: {
      search: 'ontrack.food.ingredients.search',
      /** Knowledge list layout anchor (not tappable). */
      listSection: 'ontrack.food.ingredients.section.list',
      /** IngredientSafetyRow (key = canonical key or slugged name). */
      row: (key: string) => `ontrack.food.ingredients.row.${key}`,
      /** CountryRestrictionRow (lowercase ISO country code). */
      country: (countryCode: string) =>
        `ontrack.food.ingredients.country.${countryCode.toLowerCase()}`,
      detail: {
        back: 'ontrack.food.ingredients.detail.back',
        /** Detail body layout anchor (not tappable). */
        section: 'ontrack.food.ingredients.detail.section',
        /** Evidence source link (list index). */
        source: (index: number) => `ontrack.food.ingredients.detail.source.${index}`,
      },
    },
    preferences: {
      /** Layout anchor for the dietary-preference chip grid (not tappable). */
      dietSection: 'ontrack.food.preferences.section.diet',
      /** Dietary preference toggle chip (halal | kosher | vegan | …). */
      diet: (preference: string) => `ontrack.food.preferences.diet.${preference}`,
      /** Layout anchor for the allergy list (not tappable). */
      allergySection: 'ontrack.food.preferences.section.allergies',
      allergyAdd: 'ontrack.food.preferences.allergy.add',
      /** Allergy row → editor sheet (allergy id). */
      allergyRow: (id: string) => `ontrack.food.preferences.allergy.${id}`,
      /** Editor sheet severity segment (mild | moderate | severe). */
      allergySeverity: (severity: string) =>
        `ontrack.food.preferences.allergy.severity.${severity}`,
      allergyName: 'ontrack.food.preferences.allergy.name',
      allergyNotes: 'ontrack.food.preferences.allergy.notes',
      /** Editor sheet remove action (severe → destructive confirm). */
      allergyRemove: 'ontrack.food.preferences.allergy.remove',
      /** Destructive-confirm button when removing a SEVERE allergy. */
      allergyRemoveConfirm: 'ontrack.food.preferences.allergy.removeConfirm',
      /**
       * Editable list section (intolerances | avoided | priorities |
       * cuisineLikes | cuisineDislikes): anchor, composer, removable chips.
       */
      listSection: (section: string) =>
        `ontrack.food.preferences.section.${section}`,
      listInput: (section: string) => `ontrack.food.preferences.${section}.input`,
      listAdd: (section: string) => `ontrack.food.preferences.${section}.add`,
      listItem: (section: string, slug: string) =>
        `ontrack.food.preferences.${section}.item.${slug}`,
      /** Layout anchor for the privacy toggles (not tappable). */
      privacySection: 'ontrack.food.preferences.section.privacy',
      /** Privacy toggle (shareAllergies | shareDietaryPreferences | shareMeals). */
      privacy: (key: string) => `ontrack.food.preferences.privacy.${key}`,
      /** Pointer to the separate memory-only clinical nutrition profile. */
      clinical: 'ontrack.food.preferences.clinical',
    },
    plan: {
      /** Layout anchor for the week meal-plan panel (not tappable). */
      weekSection: 'ontrack.food.plan.section.week',
      /** Per-day add → plan entry sheet (YYYY-MM-DD). */
      dayAdd: (dateKey: string) => `ontrack.food.plan.day.${dateKey}.add`,
      /** Plan entry row → recipe detail when the entry has a recipe. */
      entry: (id: string) => `ontrack.food.plan.entry.${id}`,
      entryRemove: (id: string) => `ontrack.food.plan.entry.${id}.remove`,
      /** Plan entry sheet meal-type segment. */
      addMealType: (mealType: string) =>
        `ontrack.food.plan.add.mealType.${mealType}`,
      /** Plan entry sheet recipe chip. */
      addRecipe: (recipeId: string) => `ontrack.food.plan.add.recipe.${recipeId}`,
      addCustomTitle: 'ontrack.food.plan.add.customTitle',
      addServingsMinus: 'ontrack.food.plan.add.servings.minus',
      addServingsPlus: 'ontrack.food.plan.add.servings.plus',
      /** Layout anchor for the shopping-list panel (not tappable). */
      shoppingSection: 'ontrack.food.plan.section.shopping',
      /** Grocery list picker chip (todos list id). */
      list: (listId: string) => `ontrack.food.plan.list.${listId}`,
      createList: 'ontrack.food.plan.createList',
      openList: 'ontrack.food.plan.openList',
      generate: 'ontrack.food.plan.generate',
      addItem: 'ontrack.food.plan.addItem',
      /** Combined ingredient row toggle (canonical key group id). */
      item: (key: string) => `ontrack.food.plan.item.${key}`,
      /** Standalone item checkbox toggle (todos task id). */
      other: (taskId: string) => `ontrack.food.plan.other.${taskId}`,
      /** Standalone item copy → grocery item editor sheet. */
      otherEdit: (taskId: string) => `ontrack.food.plan.other.${taskId}.edit`,
      /** Grocery item editor sheet fields + delete. */
      editorName: 'ontrack.food.plan.editor.name',
      editorQuantity: 'ontrack.food.plan.editor.quantity',
      editorUnit: 'ontrack.food.plan.editor.unit',
      editorDelete: 'ontrack.food.plan.editor.delete',
    },
    community: {
      /** Feed tab (forYou | following). */
      tab: (tab: string) => `ontrack.food.community.tab.${tab}`,
      /** Layout anchor for the post feed (not tappable). */
      feedSection: 'ontrack.food.community.section.feed',
      compose: 'ontrack.food.community.compose',
      /** Post card layout anchor (post id, not tappable). */
      post: (id: string) => `ontrack.food.community.post.${id}`,
      like: (id: string) => `ontrack.food.community.post.${id}.like`,
      save: (id: string) => `ontrack.food.community.post.${id}.save`,
      share: (id: string) => `ontrack.food.community.post.${id}.share`,
      /** Post options (hosts Report content). */
      options: (id: string) => `ontrack.food.community.post.${id}.options`,
      viewRecipe: (id: string) => `ontrack.food.community.post.${id}.recipe`,
      /** Suggested-creator follow toggle (author id). */
      follow: (authorId: string) => `ontrack.food.community.follow.${authorId}`,
      composerCaption: 'ontrack.food.community.composer.caption',
      composerRecipe: (recipeId: string) =>
        `ontrack.food.community.composer.recipe.${recipeId}`,
      /** Composer privacy note anchor (not tappable). */
      composerPrivacy: 'ontrack.food.community.composer.section.privacy',
      /** Report sheet reason chip (spam | unsafe | inappropriate | other). */
      reportReason: (key: string) => `ontrack.food.community.report.${key}`,
      /** Report sheet optional details field. */
      reportNote: 'ontrack.food.community.report.note',
    },
    /** Every Food sheet (FoodSheet preset) stamps these for land flows. */
    sheet: {
      close: (name: string) => `ontrack.food.sheet.${name}.close`,
      done: (name: string) => `ontrack.food.sheet.${name}.done`,
    },
    analyze: 'ontrack.food.detail.analyze',
    link: 'ontrack.food.detail.link',
    findMeal: 'ontrack.food.detail.findMeal',
    candidate: (candidateId: string) =>
      `ontrack.food.detail.candidate.${candidateId}`,
    confirmSave: 'ontrack.food.detail.confirmSave',
    analyzeAnother: 'ontrack.food.detail.analyzeAnother',
    edit: 'ontrack.food.detail.edit',
    close: 'ontrack.food.detail.close',
  },
  workouts: {
    customPlanner: 'ontrack.workouts.header.customPlanner',
    planFromScratch: 'ontrack.workouts.today.planFromScratch',
    todayPlan: (activityId: string) =>
      `ontrack.workouts.todayPlan.${activityId}`,
    builderClear: 'ontrack.workouts.builder.clear',
    addToToday: 'ontrack.workouts.builder.addToToday',
    exerciseAdd: (exerciseId: string) =>
      `ontrack.workouts.exercise.${exerciseId}.add`,
    exercisePreview: (exerciseId: string) =>
      `ontrack.workouts.exercise.${exerciseId}.preview`,
    anatomySex: (sex: string) => `ontrack.workouts.explorer.anatomySex.${sex}`,
    bodyView: (view: string) => `ontrack.workouts.explorer.bodyView.${view}`,
    muscleChip: (muscleKey: string) =>
      `ontrack.workouts.explorer.muscle.${muscleKey}`,
    gym: {
      edit: 'ontrack.workouts.gym.edit',
      start: 'ontrack.workouts.gym.start',
      close: 'ontrack.workouts.gym.close',
      completeSet: 'ontrack.workouts.gymActive.completeSet',
      finish: 'ontrack.workouts.gymActive.finish',
    },
  },
  vision: {
    dashboardFilter: 'ontrack.vision.dashboard.filter',
    dashboardAdd: 'ontrack.vision.dashboard.add',
    dashboardViewAll: 'ontrack.vision.dashboard.viewAll',
    dashboardEdit: 'ontrack.vision.dashboard.edit',
    dashboardCategory: (categoryId: string) =>
      `ontrack.vision.dashboard.category.${categoryId}`,
    consolidatedSearch: 'ontrack.vision.consolidated.search',
    consolidatedMore: 'ontrack.vision.consolidated.more',
    consolidatedCategory: (categoryId: string) =>
      `ontrack.vision.consolidated.category.${categoryId}`,
    categoryMode: 'ontrack.vision.category.mode',
    addImage: 'ontrack.vision.category.addImage',
    addAffirmation: 'ontrack.vision.category.addAffirmation',
    addGoal: 'ontrack.vision.category.addGoal',
    canvasItem: (itemId: string) =>
      `ontrack.vision.category.canvasItem.${itemId}`,
    selectionDeselect: 'ontrack.vision.category.selection.deselect',
    selectionEdit: 'ontrack.vision.category.selection.edit',
    selectionLayerBack: 'ontrack.vision.category.selection.layerBack',
    selectionLayerForward: 'ontrack.vision.category.selection.layerForward',
    selectionDelete: 'ontrack.vision.category.selection.delete',
    itemPrimary: 'ontrack.vision.itemEditor.primary',
    itemSecondary: 'ontrack.vision.itemEditor.secondary',
    itemSave: 'ontrack.vision.itemEditor.save',
    itemClose: 'ontrack.vision.itemEditor.close',
  },
  listSettings: {
    name: 'ontrack.listSettings.name',
    saveName: 'ontrack.listSettings.saveName',
    addEditors: 'ontrack.listSettings.addEditors',
    makeEditor: (userId: string) =>
      `ontrack.listSettings.makeEditor.${userId}`,
    makeMember: (userId: string) =>
      `ontrack.listSettings.makeMember.${userId}`,
  },
  profile: {
    avatar: 'ontrack.profile.avatar',
    /** Hero display name (prefs / SSO / default Guest). */
    displayName: 'ontrack.profile.displayName',
    avatarEditor: {
      close: 'ontrack.profile.avatar.close',
      save: 'ontrack.profile.avatar.save',
      mode: (mode: string) => `ontrack.profile.avatar.mode.${mode}`,
      takePhoto: 'ontrack.profile.avatar.takePhoto',
      chooseLibrary: 'ontrack.profile.avatar.chooseLibrary',
      searchIcons: 'ontrack.profile.avatar.searchIcons',
    },
    /** Hero caption while unsigned — local name is not a cloud account. */
    guestStatus: 'ontrack.profile.guestStatus',
    homeLocation: 'ontrack.profile.homeLocation',
    agents: 'ontrack.profile.agents',
    nutrition: 'ontrack.profile.nutrition',
    designSystem: 'ontrack.profile.designSystem',
    apiUsage: 'ontrack.profile.apiUsage',
    developer: 'ontrack.profile.developer',
    usageAnalytics: 'ontrack.profile.usageAnalytics',
    resetData: 'ontrack.profile.resetData',
    signOut: 'ontrack.profile.signOut',
    createOrSignIn: 'ontrack.profile.createOrSignIn',
    deleteAccount: 'ontrack.profile.deleteAccount',
    privacy: 'ontrack.profile.privacy',
    terms: 'ontrack.profile.terms',
    tmdb: 'ontrack.profile.tmdb',
    theme: (themeId: string) => `ontrack.profile.theme.${themeId}`,
    addon: (addonId: string) => `ontrack.profile.addon.${addonId}`,
    version: 'ontrack.profile.version',
    section: {
      account: 'ontrack.profile.section.account',
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
  games: {
    challengeFriend: 'ontrack.games.hub.challengeFriend',
    balloonPopCard: 'ontrack.games.hub.balloonPop',
    balloonPopPlay: 'ontrack.games.balloonPop.play',
    balloonPopRetry: 'ontrack.games.balloonPop.retry',
    balloonPopBack: 'ontrack.games.balloonPop.back',
    balloonPopClose: 'ontrack.games.balloonPop.close',
    balloon: (balloonId: string) =>
      `ontrack.games.balloonPop.balloon.${balloonId}`,
  },
  prompt: {
    close: 'ontrack.prompt.close',
    action: (index: number) => `ontrack.prompt.action.${index}`,
  },
  eventDetail: {
    edit: 'ontrack.eventDetail.edit',
    toggleComplete: 'ontrack.eventDetail.toggleComplete',
    close: 'ontrack.eventDetail.close',
    goBack: 'ontrack.eventDetail.goBack',
  },
  activityForm: {
    choice: (group: string, value: string) =>
      `ontrack.activityForm.choice.${group}.${value}`,
    category: (categoryId: string) =>
      `ontrack.activityForm.category.${categoryId}`,
    guidedTitle: 'ontrack.activityForm.guidedTitle',
    title: 'ontrack.activityForm.title',
    date: 'ontrack.activityForm.date',
    duration: 'ontrack.activityForm.duration',
    startTime: 'ontrack.activityForm.startTime',
    notes: 'ontrack.activityForm.notes',
    pickPhoto: 'ontrack.activityForm.pickPhoto',
    analyzePhoto: 'ontrack.activityForm.analyzePhoto',
    removePhoto: 'ontrack.activityForm.removePhoto',
    save: 'ontrack.activityForm.save',
    back: 'ontrack.activityForm.back',
    cancel: 'ontrack.activityForm.cancel',
    delete: 'ontrack.activityForm.delete',
  },
  apiUsage: {
    screen: 'ontrack.apiUsage.screen',
    back: 'ontrack.apiUsage.back',
    /** Reloads the integrations health snapshot. */
    sync: 'ontrack.apiUsage.sync',
    /** @deprecated Use `sync`. */
    refresh: 'ontrack.apiUsage.sync',
    retry: 'ontrack.apiUsage.retry',
    healthSummary: 'ontrack.apiUsage.healthSummary',
    /** Opens the sort dropdown sheet. */
    sort: 'ontrack.apiUsage.sort',
    sortOption: (mode: string) => `ontrack.apiUsage.sort.${mode}`,
    service: (serviceId: string) => `ontrack.apiUsage.service.${serviceId}`,
  },
  developer: {
    back: 'ontrack.developer.back',
    section: {
      appUpdates: 'ontrack.developer.section.appUpdates',
      navigate: 'ontrack.developer.section.navigate',
      insights: 'ontrack.developer.section.insights',
      runtime: 'ontrack.developer.section.runtime',
      diagnostics: 'ontrack.developer.section.diagnostics',
      tools: 'ontrack.developer.section.tools',
    },
    insights: 'ontrack.developer.insights',
    insightsLocal: 'ontrack.developer.insights.local',
    insightsProduct: 'ontrack.developer.insights.product',
    insightsRefresh: 'ontrack.developer.insights.refresh',
    releaseNotes: 'ontrack.developer.releaseNotes',
    releaseNotesCurrentVersion: 'ontrack.developer.releaseNotes.currentVersion',
    releaseNotesTabs: 'ontrack.developer.releaseNotes.tabs',
    releaseNotesTab: (tab: string) => `ontrack.developer.releaseNotes.tab.${tab}`,
    releaseNotesList: 'ontrack.developer.releaseNotes.list',
    releaseNotesDay: (date: string) => `ontrack.developer.releaseNotes.day.${date}`,
    releaseNotesVersion: (version: string) =>
      `ontrack.developer.releaseNotes.version.${version}`,
    releaseNotesDate: 'ontrack.developer.releaseNotes.date',
    releaseNotesPrev: 'ontrack.developer.releaseNotes.prev',
    releaseNotesNext: 'ontrack.developer.releaseNotes.next',
    devMode: 'ontrack.developer.devMode',
    staySignedIn: 'ontrack.developer.staySignedIn',
    lockSession: 'ontrack.developer.lockSession',
    designSystem: 'ontrack.developer.designSystem',
    apiUsage: 'ontrack.developer.apiUsage',
    env: 'ontrack.developer.env',
    overlay: 'ontrack.developer.overlay',
    sync: 'ontrack.developer.sync',
    seeds: 'ontrack.developer.seeds',
    seed: (name: string) => `ontrack.developer.seed.${name}`,
    routeInput: 'ontrack.developer.routeInput',
    routeGo: 'ontrack.developer.routeGo',
    storage: 'ontrack.developer.storage',
    storageRefresh: 'ontrack.developer.storageRefresh',
    rateLimitReset: 'ontrack.developer.rateLimitReset',
  },
  designSystem: {
    back: 'ontrack.designSystem.back',
    info: 'ontrack.designSystem.info',
    mode: (mode: string) => `ontrack.designSystem.mode.${mode}`,
    catalogGroup: (group: string) => `ontrack.designSystem.catalogGroup.${group}`,
    catalogElement: (id: string) => `ontrack.designSystem.catalogElement.${id}`,
    demo: (name: string) => `ontrack.designSystem.demo.${name}`,
    primary: 'ontrack.designSystem.primary',
    secondary: 'ontrack.designSystem.secondary',
    ghost: 'ontrack.designSystem.ghost',
    delete: 'ontrack.designSystem.delete',
    input: 'ontrack.designSystem.input',
    sheetClose: 'ontrack.designSystem.sheet.close',
    section: (scope: string) => `ontrack.designSystem.section.${scope}`,
    token: (scope: string, key: string) => `ontrack.designSystem.token.${scope}.${key}`,
    resetToken: (scope: string, key: string) => `ontrack.designSystem.resetToken.${scope}.${key}`,
    preset: (scope: string, key: string, hex: string) =>
      `ontrack.designSystem.preset.${scope}.${key}.${hex.replace('#', '').toLowerCase()}`,
    resetAll: 'ontrack.designSystem.resetAll',
    resetAllFooter: 'ontrack.designSystem.resetAll.footer',
    confirmRestoreDefaults: 'ontrack.designSystem.confirmRestoreDefaults',
    historySection: 'ontrack.designSystem.history',
    historyEntry: (id: string) => `ontrack.designSystem.history.entry.${id}`,
    clearHistory: 'ontrack.designSystem.history.clear',
    swatch: (scope: string, key: string) => `ontrack.designSystem.swatch.${scope}.${key}`,
    iconSection: (section: string) => `ontrack.designSystem.iconSection.${section}`,
    icon: (name: string) => `ontrack.designSystem.icon.${name}`,
    fontRole: (role: string) => `ontrack.designSystem.fontRole.${role}`,
    fontPreset: (role: string, id: string) => `ontrack.designSystem.fontPreset.${role}.${id}`,
    fontScale: 'ontrack.designSystem.fontScale',
    resetFonts: 'ontrack.designSystem.resetFonts',
    confirmRestoreFonts: 'ontrack.designSystem.confirmRestoreFonts',
  },
  travel: {
    chrome: {
      /** Layout anchor — flight-path flourish on the main itinerary hero only. */
      flightPath: 'ontrack.travel.chrome.flightPath',
      /** Layout anchor — night stars / day sunshine behind travel page titles. */
      skyDecor: 'ontrack.travel.chrome.skyDecor',
    },
    tripMode: (mode: string) => `ontrack.travel.tripMode.${mode}`,
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
      title: 'ontrack.travel.editTrip.title',
      destination: 'ontrack.travel.editTrip.destination',
      origin: 'ontrack.travel.editTrip.origin',
      startDate: 'ontrack.travel.editTrip.startDate',
      endDate: 'ontrack.travel.editTrip.endDate',
      notes: 'ontrack.travel.editTrip.notes',
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
      openAddress: (itemId: string) =>
        `ontrack.travel.timelineItem.${itemId}.openAddress`,
      share: (itemId: string) =>
        `ontrack.travel.timelineItem.${itemId}.share`,
    },
    itineraryShare: {
      sheet: 'ontrack.travel.itineraryShare.sheet',
      close: 'ontrack.travel.itineraryShare.close',
      save: 'ontrack.travel.itineraryShare.save',
      mode: (mode: 'private' | 'trip' | 'selected') =>
        `ontrack.travel.itineraryShare.mode.${mode}`,
      person: (userId: string) =>
        `ontrack.travel.itineraryShare.person.${userId}`,
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
      composer: 'ontrack.travel.chat.composer',
      send: 'ontrack.travel.chat.send',
    },
  },
  social: {
    header: {
      addFriend: 'ontrack.social.header.addFriend',
      messages: 'ontrack.social.header.messages',
    },
    friends: {
      close: 'ontrack.social.friends.close',
      signIn: 'ontrack.social.friends.signIn',
      seeAll: 'ontrack.social.friends.seeAll',
      add: 'ontrack.social.friends.add',
      friend: (friendId: string) => `ontrack.social.friends.friend.${friendId}`,
    },
    quickAction: (actionId: string) => `ontrack.social.quickAction.${actionId}`,
    upcoming: {
      seeAll: 'ontrack.social.upcoming.seeAll',
      empty: 'ontrack.social.upcoming.empty',
      trip: (tripId: string) => `ontrack.social.upcoming.trip.${tripId}`,
    },
    feedFilter: (filter: string) => `ontrack.social.feed.filter.${filter}`,
    feedItem: (itemId: string) => `ontrack.social.feed.item.${itemId}`,
    feedPollChoice: (itemId: string, choiceId: string) =>
      `ontrack.social.feed.poll.${itemId}.${choiceId}`,
    feedLoadMore: 'ontrack.social.feed.loadMore',
    actionModal: {
      close: 'ontrack.social.actionModal.close',
      primary: 'ontrack.social.actionModal.primary',
    },
    inviteSlug: 'ontrack.social.invite.slug',
    inviteSave: 'ontrack.social.invite.save',
    inviteCopy: 'ontrack.social.invite.copy',
    inviteShare: 'ontrack.social.invite.share',
    friendEmail: 'ontrack.social.friend.email',
    friendSend: 'ontrack.social.friend.send',
    requestAccept: (requestId: string) =>
      `ontrack.social.request.accept.${requestId}`,
    requestDecline: (requestId: string) =>
      `ontrack.social.request.decline.${requestId}`,
    requestCancel: (requestId: string) =>
      `ontrack.social.request.cancel.${requestId}`,
    friendAddToTrip: (friendId: string) =>
      `ontrack.social.friend.addToTrip.${friendId}`,
    friendRemove: (friendId: string) =>
      `ontrack.social.friend.remove.${friendId}`,
  },
  chrome: {
    back: 'ontrack.chrome.back',
    headerBack: 'ontrack.chrome.headerBack',
  },
  errorBoundary: {
    root: 'ontrack.errorBoundary.root',
    retry: 'ontrack.errorBoundary.retry',
    sendReport: 'ontrack.errorBoundary.sendReport',
  },
  agentUi: {
    /** __DEV__ overlay root — present when AgentUiOverlay is mounted. */
    overlayRoot: 'ontrack.agentUi.overlay.root',
    /** Floating per-page overlay toggle (Dev Mode). */
    overlayToggle: 'ontrack.agentUi.overlay.toggle',
  },
  dev: {
    /** __DEV__ floating Light/Dark switcher — triple-tap page to show/hide. */
    themeToggle: 'ontrack.dev.themeToggle',
  },
} as const;

export function tabTestIdForRoute(routeName: string): string | undefined {
  switch (routeName) {
    case 'index':
    case '(today)':
      return AgentUiIds.tabs.today;
    case 'calendar':
      return AgentUiIds.tabs.calendar;
    case 'to-do':
      return AgentUiIds.tabs.checklists;
    case 'social':
      return AgentUiIds.tabs.social;
    case 'insights':
      return AgentUiIds.tabs.insights;
    case 'profile':
      return AgentUiIds.tabs.profile;
    case 'workouts':
      return AgentUiIds.tabs.workouts;
    case 'plants':
      return AgentUiIds.tabs.plants;
    case 'travel':
      return AgentUiIds.tabs.travel;
    case 'vision-board':
      return AgentUiIds.tabs.visionBoard;
    case 'games':
      return AgentUiIds.tabs.games;
    case 'vehicles':
      return AgentUiIds.tabs.vehicles;
    case 'health':
      return AgentUiIds.tabs.health;
    case 'food':
      return AgentUiIds.tabs.food;
    default:
      return undefined;
  }
}
