import ExpoModulesCore
import Foundation
import UIKit

enum TravelDocumentInbox {
  static let pendingChanged = Notification.Name("TravelDocumentInboxPendingChanged")
  private static let pendingUrlKey = "ontrack.pending-document-url"
  private static let supportedExtensions = Set(["csv", "tsv", "xls", "xlsx", "pdf"])

  static func capture(_ url: URL) {
    guard url.isFileURL, supportedExtensions.contains(url.pathExtension.lowercased()) else {
      return
    }
    UserDefaults.standard.set(url.absoluteString, forKey: pendingUrlKey)
    NotificationCenter.default.post(
      name: pendingChanged,
      object: nil,
      userInfo: ["url": url.absoluteString]
    )
  }

  static func takePendingUrl() -> String? {
    let value = UserDefaults.standard.string(forKey: pendingUrlKey)
    UserDefaults.standard.removeObject(forKey: pendingUrlKey)
    return value
  }
}

public final class TravelDocumentReaderAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    TravelDocumentInbox.capture(url)
    return false
  }
}
