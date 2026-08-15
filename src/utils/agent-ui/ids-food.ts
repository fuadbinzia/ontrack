/** Food agent-ui testIDs (composed into AgentUiIds). */

export const agentUiIdsFood = {
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
      more: 'ontrack.food.home.more',
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
} as const;
