import AppKit
import Foundation
import Vision

/// Fast OCR for iOS Simulator screenshots. Prints one JSON object:
/// {
///   "blocking": bool,
///   "phrases": [String],
///   "buttons": [String],
///   "targets": [{ "label": String, "x": Double, "y": Double }],  // normalized center, top-left origin
///   "text": String
/// }

let blockingNeedles = [
  // Real Apple Account *system* sheets — avoid Profile "Apple Account" copy.
  "apple account verification",
  "apple id",
  "enter the password",
  "verification failed",
  "update apple id",
  "sign in to apple",
  "open in",
  // Location permission — agents must Allow While Using App (not Don't Allow).
  "use your location",
  "your location?",
  "location services",
  // Expo dev-client intro — Continue / close so verify is not stuck under it.
  // "runtime version" is intro chrome too (not tools-only).
  "developer menu",
  "this is the developer menu",
  "useful tools in development",
  "development builds",
  "dev tools",
  "runtime version",
  // Expo Dev Menu tools sheet (Reload / Fast refresh) — Escape / close.
  "toggle performance monitor",
  "toggle element inspector",
  "fast refresh",
  "open devtools",
  "source code explorer",
]

/// Soft dismiss (account / soft-deny sheets). Never preferred for location.
let dismissNeedles = [
  "not now",
  "cancel",
  "close",
  "later",
  "don't allow",
  "dont allow",
  "done",
]

/// Affirmative actions — Open-in → Open; location → Allow While Using App; dev menu → Continue.
let acceptNeedles = [
  "open",
  "allow while using app",
  "allow while using the app",
  "allow once",
  "always allow",
  "allow",
  "continue",
]

guard CommandLine.arguments.count > 1 else {
  fputs("usage: ios_ocr_alert <screenshot.png>\n", stderr)
  exit(2)
}

let path = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: path),
      let tiff = image.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let cgImage = rep.cgImage
else {
  fputs("error: could not read image\n", stderr)
  exit(2)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .fast
request.usesLanguageCorrection = false
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
  try handler.perform([request])
} catch {
  fputs("error: OCR failed: \(error)\n", stderr)
  exit(2)
}

func isButtonLabel(_ normalized: String, needles: [String]) -> Bool {
  needles.contains { needle in
    // Exact match for short affirmatives — titles like
    // "Allow 'onTrack' to use your location?" / "Open in …" / auth
    // "Continue with Apple" must not become targets.
    if needle == "open" || needle == "allow" || needle == "continue" {
      return normalized == needle
    }
    return normalized == needle || normalized.contains(needle)
  }
}

var lines: [String] = []
var targets: [[String: Any]] = []
for observation in request.results ?? [] {
  guard let candidate = observation.topCandidates(1).first else { continue }
  let text = candidate.string
  lines.append(text)
  let normalized = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
  let isDismiss = isButtonLabel(normalized, needles: dismissNeedles)
  let isAccept = isButtonLabel(normalized, needles: acceptNeedles)
  guard isDismiss || isAccept else { continue }
  // Vision boxes are normalized, origin bottom-left. Convert center to top-left origin.
  let box = observation.boundingBox
  let cx = box.origin.x + box.size.width / 2
  let cyTopLeft = 1 - (box.origin.y + box.size.height / 2)
  targets.append([
    "label": text,
    "x": cx,
    "y": cyTopLeft,
    "action": isAccept ? "accept" : "dismiss",
  ])
}

let joined = lines.joined(separator: "\n")
let lower = joined.lowercased()
let phrases = blockingNeedles.filter { lower.contains($0) }
let buttons = targets.compactMap { $0["label"] as? String }

let payload: [String: Any] = [
  "blocking": !phrases.isEmpty,
  "phrases": phrases,
  "buttons": buttons,
  "targets": targets,
  "text": joined,
]

let data = try! JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data([0x0A]))
exit(0)
