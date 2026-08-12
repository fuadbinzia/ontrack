import ExpoModulesCore
import Foundation

public final class OnTrackVoiceListsModule: Module {
  private var pendingObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("OnTrackVoiceLists")
    Events("onPending")

    OnStartObserving("onPending") {
      guard self.pendingObserver == nil else { return }
      self.pendingObserver = NotificationCenter.default.addObserver(
        forName: OnTrackVoiceStore.pendingChanged,
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
      OnTrackVoiceStore.publishSnapshot(json)
    }

    AsyncFunction("takePendingAsync") { () -> [[String: Any]] in
      OnTrackVoiceStore.takePending()
    }
  }

  private func removePendingObserver() {
    if let pendingObserver {
      NotificationCenter.default.removeObserver(pendingObserver)
      self.pendingObserver = nil
    }
  }
}
