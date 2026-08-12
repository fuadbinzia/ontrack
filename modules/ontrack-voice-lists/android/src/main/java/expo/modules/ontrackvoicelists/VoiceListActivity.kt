package expo.modules.ontrackvoicelists

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

class VoiceListActivity : Activity(), TextToSpeech.OnInitListener {
  private var tts: TextToSpeech? = null
  private var pendingSpeech: String? = null
  private val handler = Handler(Looper.getMainLooper())

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    pendingSpeech = handle(intent)
    tts = TextToSpeech(this, this)
    handler.postDelayed({ if (!isFinishing) finish() }, 8_000)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    pendingSpeech = handle(intent)
    speakOrFinish()
  }

  override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
      tts?.language = Locale.getDefault()
      tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) = Unit
        override fun onDone(utteranceId: String?) {
          handler.post { finish() }
        }
        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) {
          handler.post { finish() }
        }
      })
    }
    speakOrFinish()
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    tts?.shutdown()
    tts = null
    super.onDestroy()
  }

  private fun speakOrFinish() {
    val text = pendingSpeech
    if (text.isNullOrBlank()) {
      finish()
      return
    }
    val engine = tts ?: return
    engine.speak(text, TextToSpeech.QUEUE_FLUSH, Bundle(), "ontrack-voice")
  }

  private fun handle(intent: Intent): String {
    val uri = intent.data
    val action = uri?.host ?: inferAction(intent)
    val title = firstExtra(
      intent,
      uri,
      "title",
      "name",
      "item",
      "thing.name",
      "itemList.item.name",
    )
    val list = firstExtra(
      intent,
      uri,
      "list",
      "query",
      "listName",
      "thing.description",
      "itemList.name",
    ) ?: if (action == "add") null else firstExtra(intent, uri, "thing.name", "name")
    val kindHint = kindHintFrom(list, uri?.getQueryParameter("kind"))
    return when (action) {
      "add" -> OnTrackVoiceStore.addItem(applicationContext, title.orEmpty(), list, kindHint).spoken
      else -> OnTrackVoiceStore.readItems(applicationContext, list, kindHint)
    }
  }

  private fun inferAction(intent: Intent): String {
    val extras = listOf("title", "name", "item", "thing.name", "itemList.item.name")
    return if (extras.any { !intent.getStringExtra(it).isNullOrBlank() }) "add" else "read"
  }

  private fun kindHintFrom(list: String?, kind: String?): String? {
    val text = list.orEmpty()
    if (kind == "grocery" || kind == "checklist") return kind
    if (Regex("""\b(grocer(?:y|ies)|shopping|supermarket)\b""", RegexOption.IGNORE_CASE).containsMatchIn(text)) {
      return "grocery"
    }
    if (Regex("""\b(to-?do|todo|checklist|task|tasks)\b""", RegexOption.IGNORE_CASE).containsMatchIn(text)) {
      return "checklist"
    }
    return kind
  }

  private fun firstExtra(intent: Intent, uri: Uri?, vararg keys: String): String? {
    for (key in keys) {
      val fromUri = uri?.getQueryParameter(key)
      if (!fromUri.isNullOrBlank()) return fromUri
      val fromExtra = intent.getStringExtra(key)
      if (!fromExtra.isNullOrBlank()) return fromExtra
    }
    return null
  }
}
