import ExpoModulesCore
import Foundation

private let voiceDirName = "ontrack-voice"
private let snapshotFileName = "snapshot.json"
private let pendingFileName = "pending.json"
private let pendingChanged = Notification.Name("OnTrackVoicePendingChanged")

private enum VoiceFiles {
  static let lock = NSLock()

  static var directory: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let dir = base.appendingPathComponent(voiceDirName, isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  static var snapshotURL: URL { directory.appendingPathComponent(snapshotFileName) }
  static var pendingURL: URL { directory.appendingPathComponent(pendingFileName) }

  static func readJSON(_ url: URL) -> [String: Any] {
    guard let data = try? Data(contentsOf: url),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return [:] }
    return json
  }

  static func writeJSON(_ json: [String: Any], to url: URL) {
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

  static func pendingOps() -> [[String: Any]] {
    (readJSON(pendingURL)["ops"] as? [[String: Any]]) ?? []
  }

  static func mergePending(into snapshot: [String: Any], pending: [[String: Any]]) -> [String: Any] {
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
          "name": kindHint == "grocery" ? "Groceries" : "Inbox",
          "kind": kindHint == "grocery" ? "grocery" : "checklist",
          "canEdit": true,
          "updatedAt": ISO8601DateFormatter().string(from: Date()),
          "openTitles": [title],
        ], at: 0)
      }
    }
    return ["lists": lists]
  }
}

public final class OnTrackVoiceListsModule: Module {
  private var pendingObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("OnTrackVoiceLists")
    Events("onPending")

    OnStartObserving("onPending") {
      guard self.pendingObserver == nil else { return }
      self.pendingObserver = NotificationCenter.default.addObserver(
        forName: pendingChanged,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onPending", [:])
      }
    }

    OnStopObserving("onPending") {
      self.removePendingObserver()
    }

    OnDestroy {
      self.removePendingObserver()
    }

    AsyncFunction("publishSnapshotAsync") { (json: String) in
      VoiceFiles.lock.lock()
      defer { VoiceFiles.lock.unlock() }
      let parsed = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] ?? [:]
      let merged = VoiceFiles.mergePending(into: parsed, pending: VoiceFiles.pendingOps())
      VoiceFiles.writeJSON(merged, to: VoiceFiles.snapshotURL)
    }

    AsyncFunction("takePendingAsync") { () -> [[String: Any]] in
      VoiceFiles.lock.lock()
      defer { VoiceFiles.lock.unlock() }
      let ops = VoiceFiles.pendingOps()
      VoiceFiles.writeJSON(["ops": []], to: VoiceFiles.pendingURL)
      return ops
    }
  }

  private func removePendingObserver() {
    if let pendingObserver {
      NotificationCenter.default.removeObserver(pendingObserver)
      self.pendingObserver = nil
    }
  }
}
