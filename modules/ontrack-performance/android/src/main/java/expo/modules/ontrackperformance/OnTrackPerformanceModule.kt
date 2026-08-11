package expo.modules.ontrackperformance

import android.app.ActivityManager
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Configuration
import android.net.TrafficStats
import android.os.BatteryManager
import android.os.Build
import android.os.Debug
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class OnTrackPerformanceModule : Module(), ComponentCallbacks2 {
  private var memoryPressure = false

  override fun definition() = ModuleDefinition {
    Name("OnTrackPerformance")
    Events("onMemoryWarning")

    OnCreate {
      appContext.reactContext?.applicationContext?.registerComponentCallbacks(this@OnTrackPerformanceModule)
    }

    OnDestroy {
      appContext.reactContext?.applicationContext?.unregisterComponentCallbacks(this@OnTrackPerformanceModule)
    }

    AsyncFunction("getSnapshotAsync") {
      snapshot()
    }
  }

  private fun snapshot(): Map<String, Any> {
    val context = appContext.reactContext ?: error("The app is not ready.")
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val pid = Process.myPid()
    val details = activityManager.getProcessMemoryInfo(intArrayOf(pid)).firstOrNull()
    val systemMemory = ActivityManager.MemoryInfo().also(activityManager::getMemoryInfo)
    val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val status = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val uid = Process.myUid()

    val result = mutableMapOf<String, Any>(
      "timestampMs" to System.currentTimeMillis().toDouble(),
      "processId" to pid,
      "processName" to if (Build.VERSION.SDK_INT >= 33) Process.myProcessName() else context.packageName,
      "uptimeMs" to processUptimeMs(),
      "cumulativeCpuMs" to Process.getElapsedCpuTime().toDouble(),
      "processorCount" to Runtime.getRuntime().availableProcessors(),
      "threadCount" to (File("/proc/self/task").list()?.size ?: 0),
      "memoryBytes" to ((details?.totalPss ?: 0).toLong() * 1024),
      "totalMemoryBytes" to systemMemory.totalMem,
      "availableMemoryBytes" to systemMemory.availMem,
      "batteryState" to batteryStateLabel(status),
      "lowPowerMode" to powerManager.isPowerSaveMode,
      "thermalState" to thermalStateLabel(powerManager),
      "memoryPressure" to (memoryPressure || systemMemory.lowMemory)
    )
    details?.let {
      memoryStat(it, "summary.native-heap")?.let { value -> result["nativeHeapBytes"] = value }
      memoryStat(it, "summary.java-heap")?.let { value -> result["javaHeapBytes"] = value }
      memoryStat(it, "summary.graphics")?.let { value -> result["graphicsBytes"] = value }
      memoryStat(it, "summary.code")?.let { value -> result["codeBytes"] = value }
      memoryStat(it, "summary.stack")?.let { value -> result["stackBytes"] = value }
      memoryStat(it, "summary.system")?.let { value -> result["systemMemoryBytes"] = value }
    }
    if (level >= 0 && scale > 0) result["batteryLevel"] = level.toDouble() / scale.toDouble()
    val received = TrafficStats.getUidRxBytes(uid)
    val sent = TrafficStats.getUidTxBytes(uid)
    if (received >= 0) result["networkReceivedBytes"] = received
    if (sent >= 0) result["networkSentBytes"] = sent
    return result
  }

  private fun memoryStat(info: Debug.MemoryInfo, name: String): Long? {
    if (Build.VERSION.SDK_INT < 23) return null
    return info.getMemoryStat(name)?.toLongOrNull()?.times(1024)
  }

  private fun processUptimeMs(): Long = if (Build.VERSION.SDK_INT >= 24) {
    SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime()
  } else {
    SystemClock.elapsedRealtime()
  }

  private fun batteryStateLabel(status: Int): String = when (status) {
    BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
    BatteryManager.BATTERY_STATUS_FULL -> "full"
    BatteryManager.BATTERY_STATUS_DISCHARGING, BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "unplugged"
    else -> "unknown"
  }

  private fun thermalStateLabel(powerManager: PowerManager): String {
    if (Build.VERSION.SDK_INT < 29) return "unknown"
    return when (powerManager.currentThermalStatus) {
      PowerManager.THERMAL_STATUS_NONE -> "nominal"
      PowerManager.THERMAL_STATUS_LIGHT, PowerManager.THERMAL_STATUS_MODERATE -> "fair"
      PowerManager.THERMAL_STATUS_SEVERE -> "serious"
      PowerManager.THERMAL_STATUS_CRITICAL, PowerManager.THERMAL_STATUS_EMERGENCY,
      PowerManager.THERMAL_STATUS_SHUTDOWN -> "critical"
      else -> "unknown"
    }
  }

  override fun onTrimMemory(level: Int) {
    memoryPressure = level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW
    if (!memoryPressure) return
    sendEvent(
      "onMemoryWarning",
      bundleOf(
        "timestampMs" to System.currentTimeMillis().toDouble(),
        "level" to if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL) "critical" else "warning"
      )
    )
  }

  override fun onLowMemory() {
    memoryPressure = true
    sendEvent(
      "onMemoryWarning",
      bundleOf("timestampMs" to System.currentTimeMillis().toDouble(), "level" to "critical")
    )
  }

  override fun onConfigurationChanged(newConfig: Configuration) = Unit
}
