package expo.modules.ontrackvoicelists

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

internal data class VoiceListItem(
  val id: String,
  val name: String,
  val kind: String,
  val canEdit: Boolean,
  val updatedAt: String,
  val openTitles: MutableList<String>,
)

internal data class VoiceAddResult(val spoken: String)

internal object OnTrackVoiceStore {
  const val PENDING_EVENT = "onPending"
  var onPending: (() -> Unit)? = null

  private val lock = Any()

  private fun nowIso(): String {
    val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    format.timeZone = TimeZone.getTimeZone("UTC")
    return format.format(Date())
  }

  private fun dir(context: Context): File {
    val folder = File(context.filesDir, "ontrack-voice")
    if (!folder.exists()) folder.mkdirs()
    return folder
  }

  private fun snapshotFile(context: Context) = File(dir(context), "snapshot.json")
  private fun pendingFile(context: Context) = File(dir(context), "pending.json")

  fun publishSnapshot(context: Context, json: String) {
    synchronized(lock) {
      val parsed = runCatching { JSONObject(json) }.getOrElse { JSONObject() }
      val merged = mergePending(parsed, readPending(context))
      writeJson(snapshotFile(context), merged)
    }
  }

  fun takePending(context: Context): List<Map<String, Any?>> {
    synchronized(lock) {
      val ops = readPending(context)
      writeJson(pendingFile(context), JSONObject().put("ops", JSONArray()))
      return ops.map { op ->
        mapOf(
          "id" to op.optString("id"),
          "title" to op.optString("title"),
          "listId" to op.optString("listId").ifBlank { null },
          "listName" to op.optString("listName").ifBlank { null },
          "kindHint" to op.optString("kindHint").ifBlank { null },
          "createdAt" to op.optString("createdAt"),
        )
      }
    }
  }

  fun addItem(context: Context, rawTitle: String, listName: String?, kindHint: String?): VoiceAddResult {
    val title = rawTitle.trim()
    if (title.isEmpty()) return VoiceAddResult("What should I add?")

    synchronized(lock) {
      val lists = readLists(context)
      val match = matchList(lists, listName, kindHint)?.takeIf { it.canEdit }
      val targetName = match?.name ?: displayName(listName, kindHint)
      val targetKind = match?.kind ?: if (kindHint == "grocery" || isGrocery(listName)) "grocery" else "checklist"
      val op = JSONObject()
        .put("id", UUID.randomUUID().toString())
        .put("title", title)
        .put("listName", targetName)
        .put("kindHint", kindHint ?: if (targetKind == "grocery") "grocery" else "checklist")
        .put("createdAt", nowIso())
      match?.id?.let { op.put("listId", it) }

      val pending = JSONArray()
      readPending(context).forEach { pending.put(it) }
      pending.put(op)
      writeJson(pendingFile(context), JSONObject().put("ops", pending))

      val existing = lists.indexOfFirst { it.id == match?.id || it.name.equals(targetName, ignoreCase = true) }
      if (existing >= 0) {
        if (lists[existing].openTitles.none { it.equals(title, ignoreCase = true) }) {
          lists[existing].openTitles.add(0, title)
        }
        lists[existing] = lists[existing].copy(updatedAt = nowIso())
      } else {
        lists.add(
          0,
          VoiceListItem(
            id = match?.id ?: "voice-inbox",
            name = targetName,
            kind = targetKind,
            canEdit = true,
            updatedAt = nowIso(),
            openTitles = mutableListOf(title),
          ),
        )
      }
      writeLists(context, lists)
      onPending?.invoke()
      return VoiceAddResult("Added $title to $targetName.")
    }
  }

  fun readItems(context: Context, listName: String?, kindHint: String?): String {
    synchronized(lock) {
      val lists = readLists(context)
      if (lists.isEmpty()) return "You don't have a list in onTrack yet."
      val match = matchList(lists, listName, kindHint) ?: lists[0]
      if (match.openTitles.isEmpty()) return "${match.name} has no open items."
      return "${match.name}: ${spokenList(match.openTitles)}."
    }
  }

  private fun mergePending(snapshot: JSONObject, pending: List<JSONObject>): JSONObject {
    val lists = snapshot.optJSONArray("lists") ?: JSONArray()
    val mutable = mutableListOf<JSONObject>()
    for (i in 0 until lists.length()) mutable.add(lists.getJSONObject(i))
    for (op in pending) {
      val title = op.optString("title").trim()
      if (title.isEmpty()) continue
      val listId = op.optString("listId")
      val listName = op.optString("listName")
      val kindHint = op.optString("kindHint")
      val index = mutable.indexOfFirst { item ->
        (listId.isNotBlank() && item.optString("id") == listId) ||
          (listName.isNotBlank() && item.optString("name").equals(listName, true)) ||
          (kindHint.isNotBlank() && item.optString("kind") == kindHint)
      }
      if (index >= 0) {
        val titles = mutable[index].optJSONArray("openTitles") ?: JSONArray()
        val exists = (0 until titles.length()).any { titles.getString(it).equals(title, true) }
        if (!exists) {
          val next = JSONArray().put(title)
          for (i in 0 until titles.length()) next.put(titles.getString(i))
          mutable[index].put("openTitles", next)
        }
      } else {
        mutable.add(
          0,
          JSONObject()
            .put("id", "voice-inbox")
            .put("name", if (kindHint == "grocery") "Groceries" else "To Do")
            .put("kind", if (kindHint == "grocery") "grocery" else "checklist")
            .put("canEdit", true)
            .put("updatedAt", nowIso())
            .put("openTitles", JSONArray().put(title)),
        )
      }
    }
    val out = JSONArray()
    mutable.forEach { out.put(it) }
    return JSONObject().put("lists", out)
  }

  private fun matchList(lists: List<VoiceListItem>, hint: String?, kindHint: String?): VoiceListItem? {
    val editable = lists.filter { it.canEdit }
    val pool = editable.ifEmpty { lists }
    if (pool.isEmpty()) return null
    val kind = kindHint ?: inferredKind(hint)
    val byKind = if (kind == null) pool else pool.filter { it.kind == kind }
    if (kind != null && byKind.isEmpty()) return null
    val candidates = byKind.ifEmpty { pool }
    val query = nameQuery(hint)?.lowercase()
    if (query != null) {
      candidates.firstOrNull { it.name.lowercase() == query }?.let { return it }
      pool.firstOrNull { it.name.lowercase() == query }?.let { return it }
      candidates.firstOrNull { it.name.lowercase().contains(query) }?.let { return it }
      pool.firstOrNull { it.name.lowercase().contains(query) }?.let { return it }
    }
    return candidates.maxByOrNull { it.updatedAt }
  }

  fun resolveKindHint(listName: String?, explicit: String?): String? {
    if (explicit == "grocery" || explicit == "checklist") return explicit
    return inferredKind(listName) ?: explicit
  }

  private fun inferredKind(text: String?): String? {
    if (text.isNullOrBlank()) return null
    if (isGrocery(text)) return "grocery"
    if (Regex("""\b(to-?do|todo|checklist|task|tasks)\b""", RegexOption.IGNORE_CASE).containsMatchIn(text)) {
      return "checklist"
    }
    return null
  }

  private fun isGrocery(text: String?): Boolean {
    if (text.isNullOrBlank()) return false
    return Regex("""\b(grocer(?:y|ies)|shopping|supermarket)\b""", RegexOption.IGNORE_CASE).containsMatchIn(text)
  }

  private fun nameQuery(text: String?): String? {
    val trimmed = text?.trim().orEmpty()
    if (trimmed.isEmpty()) return null
    val generic = Regex(
      """^(my\s+)?((grocery|groceries|shopping|supermarket|to-?do|todo|checklist|task|tasks)(\s+list)?|list)$""",
      RegexOption.IGNORE_CASE,
    )
    return if (generic.matches(trimmed)) null else trimmed
  }

  private fun displayName(listName: String?, kindHint: String?): String {
    nameQuery(listName)?.let { return it }
    if (kindHint == "grocery" || isGrocery(listName)) return "Groceries"
    return "To Do"
  }

  private fun spokenList(titles: List<String>): String {
    val visible = titles.take(8)
    val extra = titles.size - visible.size
    val joined = when (visible.size) {
      1 -> visible[0]
      2 -> "${visible[0]} and ${visible[1]}"
      else -> "${visible.dropLast(1).joinToString(", ")}, and ${visible.last()}"
    }
    return if (extra > 0) "$joined, and $extra more" else joined
  }

  private fun readLists(context: Context): MutableList<VoiceListItem> {
    val raw = readJson(snapshotFile(context)).optJSONArray("lists") ?: JSONArray()
    val lists = mutableListOf<VoiceListItem>()
    for (i in 0 until raw.length()) {
      val item = raw.getJSONObject(i)
      val titles = item.optJSONArray("openTitles") ?: JSONArray()
      val open = mutableListOf<String>()
      for (t in 0 until titles.length()) open.add(titles.getString(t))
      lists.add(
        VoiceListItem(
          id = item.optString("id"),
          name = item.optString("name"),
          kind = item.optString("kind", "checklist"),
          canEdit = item.optBoolean("canEdit", true),
          updatedAt = item.optString("updatedAt"),
          openTitles = open,
        ),
      )
    }
    return lists
  }

  private fun writeLists(context: Context, lists: List<VoiceListItem>) {
    val array = JSONArray()
    lists.forEach { list ->
      val titles = JSONArray()
      list.openTitles.forEach { titles.put(it) }
      array.put(
        JSONObject()
          .put("id", list.id)
          .put("name", list.name)
          .put("kind", list.kind)
          .put("canEdit", list.canEdit)
          .put("updatedAt", list.updatedAt)
          .put("openTitles", titles),
      )
    }
    writeJson(snapshotFile(context), JSONObject().put("lists", array))
  }

  private fun readPending(context: Context): List<JSONObject> {
    val raw = readJson(pendingFile(context)).optJSONArray("ops") ?: JSONArray()
    return (0 until raw.length()).map { raw.getJSONObject(it) }
  }

  private fun readJson(file: File): JSONObject {
    if (!file.exists()) return JSONObject()
    return runCatching { JSONObject(file.readText()) }.getOrElse { JSONObject() }
  }

  private fun writeJson(file: File, json: JSONObject) {
    val tmp = File(file.parentFile, "${file.name}.tmp")
    tmp.writeText(json.toString())
    if (!tmp.renameTo(file)) {
      file.writeText(json.toString())
      tmp.delete()
    }
  }
}
