import ExpoModulesCore
import Darwin
import Foundation
import MachO
import UIKit

public final class OnTrackPerformanceModule: Module {
  private var memoryWarningObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("OnTrackPerformance")
    Events("onMemoryWarning")

    OnCreate {
      UIDevice.current.isBatteryMonitoringEnabled = true
    }

    OnStartObserving("onMemoryWarning") {
      guard self.memoryWarningObserver == nil else { return }
      self.memoryWarningObserver = NotificationCenter.default.addObserver(
        forName: UIApplication.didReceiveMemoryWarningNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onMemoryWarning", [
          "timestampMs": Date().timeIntervalSince1970 * 1000,
          "level": "critical"
        ])
      }
    }

    OnStopObserving("onMemoryWarning") {
      self.removeMemoryWarningObserver()
    }

    OnDestroy {
      self.removeMemoryWarningObserver()
      UIDevice.current.isBatteryMonitoringEnabled = false
    }

    AsyncFunction("getSnapshotAsync") { () -> [String: Any] in
      return self.snapshot()
    }.runOnQueue(.main)
  }

  private func removeMemoryWarningObserver() {
    if let observer = memoryWarningObserver {
      NotificationCenter.default.removeObserver(observer)
      memoryWarningObserver = nil
    }
  }

  private func snapshot() -> [String: Any] {
    let process = ProcessInfo.processInfo
    var result: [String: Any] = [
      "timestampMs": Date().timeIntervalSince1970 * 1000,
      "processId": Int(process.processIdentifier),
      "processName": process.processName,
      "uptimeMs": OnTrackProcessUptimeMilliseconds(process.processIdentifier),
      "cumulativeCpuMs": cumulativeCpuMilliseconds(),
      "processorCount": process.activeProcessorCount,
      "threadCount": currentThreadCount(),
      "memoryBytes": currentMemoryFootprint(),
      "totalMemoryBytes": process.physicalMemory,
      "batteryState": batteryStateLabel(UIDevice.current.batteryState),
      "lowPowerMode": process.isLowPowerModeEnabled,
      "thermalState": thermalStateLabel(process.thermalState),
      "memoryPressure": false
    ]

    let level = UIDevice.current.batteryLevel
    if level >= 0 { result["batteryLevel"] = Double(level) }
    if #available(iOS 13.0, *) {
      result["availableMemoryBytes"] = UInt64(os_proc_available_memory())
    }
    return result
  }

  private func currentMemoryFootprint() -> UInt64 {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(
      MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size
    )
    let status = withUnsafeMutablePointer(to: &info) { pointer in
      pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    return status == KERN_SUCCESS ? info.phys_footprint : 0
  }

  private func cumulativeCpuMilliseconds() -> Double {
    var usage = rusage()
    guard getrusage(RUSAGE_SELF, &usage) == 0 else { return 0 }
    let user = Double(usage.ru_utime.tv_sec) * 1000 + Double(usage.ru_utime.tv_usec) / 1000
    let system = Double(usage.ru_stime.tv_sec) * 1000 + Double(usage.ru_stime.tv_usec) / 1000
    return user + system
  }

  private func currentThreadCount() -> Int {
    var threads: thread_act_array_t?
    var count: mach_msg_type_number_t = 0
    guard task_threads(mach_task_self_, &threads, &count) == KERN_SUCCESS else { return 0 }
    if let threads {
      vm_deallocate(
        mach_task_self_,
        vm_address_t(UInt(bitPattern: threads)),
        vm_size_t(Int(count) * MemoryLayout<thread_t>.stride)
      )
    }
    return Int(count)
  }

  private func thermalStateLabel(_ state: ProcessInfo.ThermalState) -> String {
    switch state {
    case .nominal: return "nominal"
    case .fair: return "fair"
    case .serious: return "serious"
    case .critical: return "critical"
    @unknown default: return "unknown"
    }
  }

  private func batteryStateLabel(_ state: UIDevice.BatteryState) -> String {
    switch state {
    case .charging: return "charging"
    case .full: return "full"
    case .unplugged: return "unplugged"
    case .unknown: return "unknown"
    @unknown default: return "unknown"
    }
  }
}
