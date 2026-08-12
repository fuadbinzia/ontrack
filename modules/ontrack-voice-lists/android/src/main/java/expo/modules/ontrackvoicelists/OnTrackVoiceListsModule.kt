package expo.modules.ontrackvoicelists

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OnTrackVoiceListsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OnTrackVoiceLists")
    Events("onPending")

    OnCreate {
      OnTrackVoiceStore.onPending = {
        sendEvent("onPending", emptyMap<String, Any>())
      }
    }

    OnDestroy {
      OnTrackVoiceStore.onPending = null
    }

    AsyncFunction("publishSnapshotAsync") { json: String ->
      val context = appContext.reactContext ?: appContext.currentActivity
        ?: error("The app is not ready.")
      OnTrackVoiceStore.publishSnapshot(context.applicationContext, json)
    }

    AsyncFunction("takePendingAsync") {
      val context = appContext.reactContext ?: appContext.currentActivity
        ?: error("The app is not ready.")
      OnTrackVoiceStore.takePending(context.applicationContext)
    }
  }
}
