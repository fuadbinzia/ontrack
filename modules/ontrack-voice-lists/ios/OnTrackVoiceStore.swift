import Foundation

enum OnTrackVoiceStore {
  static let pendingChanged = Notification.Name("OnTrackVoicePendingChanged")

  private static let lock = NSLock()
  private static let iso = ISO8601DateFormatter()

  private static var directory: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let dir = base.appendingPathComponent("ontrack-voice", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  private static var snapshotURL: URL { directory.appendingPathComponent("snapshot.json") }
  private static var pendingURL: URL { directory.appendingPathComponent("pending.json") }

  struct ListItem {
    var id: String
    var name: String
    var kind: String
    var canEdit: Bool
    var updatedAt: String
    var openTitles: [String]
  }

  struct AddResult {
    let spoken: String
  }

  static func publishSnapshot(_ json: String) {
    lock.lock()
    defer { lock.unlock() }
    let parsed = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] ?? [:]
    writeJSON(mergePending(into: parsed, pending: readPending()), to: snapshotURL)
  }

  static func takePending() -> [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    let ops = readPending()
    writeJSON(["ops": []], to: pendingURL)
    return ops
  }

  static func addItem(title rawTitle: String, listName: String?, kindHint: String?) -> AddResult {
    let title = rawTitle.trimmingCharacters(in: .whitespacesAndNewlines)
    if title.isEmpty { return AddResult(spoken: "What should I add?") }

    lock.lock()
    defer { lock.unlock() }

    var lists = readLists()
    var match = matchList(lists, hint: listName, kindHint: kindHint)
    if match?.canEdit != true { match = nil }

    let targetName = match?.name ?? displayName(listName: listName, kindHint: kindHint)
    let targetKind = match?.kind ?? ((kindHint == "grocery" || isGrocery(listName)) ? "grocery" : "checklist")
    let targetId = match?.id
    var op: [String: Any] = [
      "id": UUID().uuidString,
      "title": title,
      "listName": targetName,
      "kindHint": kindHint ?? (targetKind == "grocery" ? "grocery" : "checklist"),
      "createdAt": iso.string(from: Date()),
    ]
    if let targetId { op["listId"] = targetId }

    var pending = readPending()
    pending.append(op)
    writeJSON(["ops": pending], to: pendingURL)

    if let index = lists.firstIndex(where: { $0.id == targetId || $0.name.caseInsensitiveCompare(targetName) == .orderedSame }) {
      if !lists[index].openTitles.contains(where: { $0.caseInsensitiveCompare(title) == .orderedSame }) {
        lists[index].openTitles.insert(title, at: 0)
      }
      lists[index].updatedAt = iso.string(from: Date())
    } else {
      lists.insert(
        ListItem(
          id: targetId ?? "voice-inbox",
          name: targetName,
          kind: targetKind,
          canEdit: true,
          updatedAt: iso.string(from: Date()),
          openTitles: [title]
        ),
        at: 0
      )
    }
    writeLists(lists)
    NotificationCenter.default.post(name: pendingChanged, object: nil)
    return AddResult(spoken: "Added \(title) to \(targetName).")
  }

  static func readItems(listName: String?, kindHint: String?) -> String {
    lock.lock()
    defer { lock.unlock() }
    let lists = readLists()
    if lists.isEmpty { return "You don't have a list in onTrack yet." }
    guard let match = matchList(lists, hint: listName, kindHint: kindHint) else {
      return missingListMessage(listName: listName, kindHint: kindHint)
    }
    let titles = match.openTitles
    if titles.isEmpty { return "\(match.name) has no open items." }
    return "\(match.name): \(spokenList(titles))."
  }

  private static func missingListMessage(listName: String?, kindHint: String?) -> String {
    if let query = nameQuery(listName) {
      return "You don't have a \(query) list in onTrack yet."
    }
    if kindHint == "grocery" || isGrocery(listName) {
      return "You don't have a grocery list in onTrack yet."
    }
    return "You don't have a checklist in onTrack yet."
  }

  private static func matchList(_ lists: [ListItem], hint: String?, kindHint: String?) -> ListItem? {
    let editable = lists.filter(\.canEdit)
    let pool = editable.isEmpty ? lists : editable
    guard !pool.isEmpty else { return nil }
    let kind = kindHint ?? inferredKind(hint)
    let byKind = kind == nil ? pool : pool.filter { $0.kind == kind }
    if kind != nil && byKind.isEmpty { return nil }
    let candidates = byKind.isEmpty ? pool : byKind
    if let query = nameQuery(hint)?.lowercased() {
      if let exact = candidates.first(where: { $0.name.lowercased() == query })
        ?? pool.first(where: { $0.name.lowercased() == query }) {
        return exact
      }
      if let partial = candidates.first(where: { $0.name.lowercased().contains(query) })
        ?? pool.first(where: { $0.name.lowercased().contains(query) }) {
        return partial
      }
    }
    return candidates.sorted { $0.updatedAt > $1.updatedAt }.first
  }

  private static func inferredKind(_ text: String?) -> String? {
    guard let text else { return nil }
    if isGrocery(text) { return "grocery" }
    if text.range(of: #"\b(to-?do|todo|checklist|task|tasks)\b"#, options: .regularExpression) != nil {
      return "checklist"
    }
    return nil
  }

  private static func isGrocery(_ text: String?) -> Bool {
    guard let text else { return false }
    return text.range(of: #"\b(grocer(?:y|ies)|shopping|supermarket)\b"#, options: .regularExpression) != nil
  }

  private static func nameQuery(_ text: String?) -> String? {
    let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if trimmed.isEmpty { return nil }
    if trimmed.range(
      of: #"^(my\s+)?((grocery|groceries|shopping|supermarket|to-?do|todo|checklist|task|tasks)(\s+list)?|list)$"#,
      options: [.regularExpression, .caseInsensitive]
    ) != nil {
      return nil
    }
    return trimmed
  }

  private static func displayName(listName: String?, kindHint: String?) -> String {
    if let query = nameQuery(listName) { return query }
    if kindHint == "grocery" || isGrocery(listName) { return "Groceries" }
    return "To Do"
  }

  private static func spokenList(_ titles: [String]) -> String {
    let visible = Array(titles.prefix(8))
    let extra = titles.count - visible.count
    let joined: String
    switch visible.count {
    case 1: joined = visible[0]
    case 2: joined = "\(visible[0]) and \(visible[1])"
    default:
      let head = visible.dropLast().joined(separator: ", ")
      joined = "\(head), and \(visible.last!)"
    }
    if extra > 0 { return "\(joined), and \(extra) more" }
    return joined
  }

  private static func mergePending(into snapshot: [String: Any], pending: [[String: Any]]) -> [String: Any] {
    var lists = (snapshot["lists"] as? [[String: Any]]) ?? []
    for op in pending {
      let title = (op["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      guard !title.isEmpty else { continue }
      let listId = op["listId"] as? String
      let listName = op["listName"] as? String
      let kindHint = op["kindHint"] as? String
      let index = lists.firstIndex { list in
        if let listId, (list["id"] as? String) == listId { return true }
        if let listName, (list["name"] as? String)?.caseInsensitiveCompare(listName) == .orderedSame {
          return true
        }
        if let kindHint, (list["kind"] as? String) == kindHint { return true }
        return false
      }
      if let index {
        var titles = (lists[index]["openTitles"] as? [String]) ?? []
        if !titles.contains(where: { $0.caseInsensitiveCompare(title) == .orderedSame }) {
          titles.insert(title, at: 0)
          lists[index]["openTitles"] = titles
        }
      } else {
        lists.insert([
          "id": "voice-inbox",
          "name": kindHint == "grocery" ? "Groceries" : "To Do",
          "kind": kindHint == "grocery" ? "grocery" : "checklist",
          "canEdit": true,
          "updatedAt": iso.string(from: Date()),
          "openTitles": [title],
        ], at: 0)
      }
    }
    return ["lists": lists]
  }

  private static func readLists() -> [ListItem] {
    let json = readJSON(snapshotURL)
    let raw = json["lists"] as? [[String: Any]] ?? []
    return raw.compactMap { item in
      guard let id = item["id"] as? String, let name = item["name"] as? String else { return nil }
      return ListItem(
        id: id,
        name: name,
        kind: item["kind"] as? String ?? "checklist",
        canEdit: item["canEdit"] as? Bool ?? true,
        updatedAt: item["updatedAt"] as? String ?? "",
        openTitles: item["openTitles"] as? [String] ?? []
      )
    }
  }

  private static func writeLists(_ lists: [ListItem]) {
    let payload: [[String: Any]] = lists.map { list in
      [
        "id": list.id,
        "name": list.name,
        "kind": list.kind,
        "canEdit": list.canEdit,
        "updatedAt": list.updatedAt,
        "openTitles": list.openTitles,
      ]
    }
    writeJSON(["lists": payload], to: snapshotURL)
  }

  private static func readPending() -> [[String: Any]] {
    (readJSON(pendingURL)["ops"] as? [[String: Any]]) ?? []
  }

  private static func readJSON(_ url: URL) -> [String: Any] {
    guard let data = try? Data(contentsOf: url),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return [:] }
    return json
  }

  private static func writeJSON(_ json: [String: Any], to url: URL) {
    guard JSONSerialization.isValidJSONObject(json),
          let data = try? JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
    else { return }
    let tmp = url.appendingPathExtension("tmp")
    do {
      try data.write(to: tmp, options: .atomic)
      _ = try FileManager.default.replaceItemAt(url, withItemAt: tmp)
    } catch {
      try? data.write(to: url, options: .atomic)
      try? FileManager.default.removeItem(at: tmp)
    }
  }
}
