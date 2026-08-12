import AppIntents
import Foundation

@available(iOS 16.0, *)
struct AddChecklistItemIntent: AppIntent {
  static var title: LocalizedStringResource = "Add checklist item"
  static var description = IntentDescription("Adds an item to an onTrack checklist.")
  static var openAppWhenRun = false

  @Parameter(title: "Item")
  var title: String

  @Parameter(title: "List")
  var listName: String?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let result = OnTrackVoiceStore.addItem(
      title: title,
      listName: listName,
      kindHint: listName == nil ? "checklist" : nil
    )
    return .result(dialog: IntentDialog(stringLiteral: result.spoken))
  }
}

@available(iOS 16.0, *)
struct AddGroceryItemIntent: AppIntent {
  static var title: LocalizedStringResource = "Add grocery item"
  static var description = IntentDescription("Adds an item to an onTrack grocery list.")
  static var openAppWhenRun = false

  @Parameter(title: "Item")
  var title: String

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let result = OnTrackVoiceStore.addItem(title: title, listName: nil, kindHint: "grocery")
    return .result(dialog: IntentDialog(stringLiteral: result.spoken))
  }
}

@available(iOS 16.0, *)
struct ReadChecklistIntent: AppIntent {
  static var title: LocalizedStringResource = "Read checklist"
  static var description = IntentDescription("Reads open items on an onTrack checklist.")
  static var openAppWhenRun = false

  @Parameter(title: "List")
  var listName: String?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let spoken = OnTrackVoiceStore.readItems(
      listName: listName,
      kindHint: listName == nil ? "checklist" : nil
    )
    return .result(dialog: IntentDialog(stringLiteral: spoken))
  }
}

@available(iOS 16.0, *)
struct ReadGroceryListIntent: AppIntent {
  static var title: LocalizedStringResource = "Read grocery list"
  static var description = IntentDescription("Reads open items on an onTrack grocery list.")
  static var openAppWhenRun = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let spoken = OnTrackVoiceStore.readItems(listName: nil, kindHint: "grocery")
    return .result(dialog: IntentDialog(stringLiteral: spoken))
  }
}

@available(iOS 16.0, *)
struct OnTrackVoiceShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddChecklistItemIntent(),
      phrases: [
        "Add \(\.$title) to my checklist in \(.applicationName)",
        "Add \(\.$title) to my to do list in \(.applicationName)",
        "Add \(\.$title) to \(\.$listName) in \(.applicationName)",
      ],
      shortTitle: "Add checklist item",
      systemImageName: "checklist"
    )
    AppShortcut(
      intent: AddGroceryItemIntent(),
      phrases: [
        "Add \(\.$title) to my grocery list in \(.applicationName)",
        "Add \(\.$title) to my shopping list in \(.applicationName)",
      ],
      shortTitle: "Add grocery item",
      systemImageName: "cart"
    )
    AppShortcut(
      intent: ReadChecklistIntent(),
      phrases: [
        "What's on my checklist in \(.applicationName)",
        "Read my to do list in \(.applicationName)",
        "What's on \(\.$listName) in \(.applicationName)",
      ],
      shortTitle: "Read checklist",
      systemImageName: "list.bullet"
    )
    AppShortcut(
      intent: ReadGroceryListIntent(),
      phrases: [
        "What's on my grocery list in \(.applicationName)",
        "Read my shopping list in \(.applicationName)",
      ],
      shortTitle: "Read grocery list",
      systemImageName: "cart"
    )
  }
}
