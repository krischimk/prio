package de.krischi.prio.widget

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import org.json.JSONObject
import org.json.JSONArray

class WidgetDesign(context: Context) {
    private val source = JSONObject(context.assets.open("widget-design.json").bufferedReader().use { it.readText() })
    private val preference = WidgetStore.get(context).read("theme") ?: "system"
    private val dark = preference == "dark" || preference == "system" && context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
    private val palette = source.getJSONObject(if (dark) "dark" else "light")
    fun color(role: String): Int = Color.parseColor(palette.getString(role))
    fun font(role: String): Float = source.getJSONObject("fonts").getDouble(role).toFloat()
    fun icon(context: Context, key: String?): Int {
        val names = source.getJSONObject("icons")
        val name = names.optString(key ?: "", names.getString("BulletList"))
        return context.resources.getIdentifier(name, "drawable", context.packageName)
    }
}

data class WidgetView(val userId: String?, val title: String, val listId: String?, val icon: String?, val tasks: List<JSONObject>, val pending: Int, val message: String?, val configured: Boolean, val opacity: Float = 1f) {
    companion object {
        fun read(store: WidgetStore, widgetId: Int, activeUser: String?): WidgetView {
            val snapshot = store.snapshot(); val config = store.config(widgetId)
            if (activeUser == null || snapshot.text("userId") != activeUser || config?.text("userId") != activeUser)
                return WidgetView(activeUser, "Prio", null, "Overview", emptyList(), 0, if (activeUser == null) "Prio öffnen und anmelden" else "Widget einrichten", false)
            val listId = config.text("listId")
            val lists = snapshot.array("lists").objects()
            val list = lists.firstOrNull { it.getString("id") == listId }
            val allowed = if (listId != null) setOf(listId).filter { list != null }.toSet() else lists.filter { it.optBoolean("overview") }.map { it.getString("id") }.toSet()
            val tags = config.array("tags").let { values -> (0 until values.length()).map { values.getString(it) }.toSet() }
            val commands = store.commands(activeUser); val completed = commands.filter { !it.has("checklist") }.map { it.getString("taskId") }.toSet()
            val expanded = config.array("expanded").let { values -> (0 until values.length()).map { values.getString(it) }.toSet() }
            val tasks = snapshot.array("tasks").objects().filter { task -> task.getString("listId") in allowed && task.getString("id") !in completed &&
                task.array("tagKeys").let { values -> (0 until values.length()).map { values.getString(it) }.toSet().containsAll(tags) } }
            tasks.forEach { task ->
                val points = task.array("checklist").objects()
                var done = task.optInt("checklistDone", points.count { it.optBoolean("completed") })
                commands.filter { it.getString("taskId") == task.getString("id") && it.has("checklist") }.forEach { command ->
                    val change = command.getJSONObject("checklist")
                    points.firstOrNull { it.getString("id") == change.getString("id") }?.let { point ->
                        val checked = change.getBoolean("completed")
                        if (point.optBoolean("completed") != checked) done += if (checked) 1 else -1
                        point.put("completed", checked)
                    }
                }
                task.put("checklistDone", done).put("checklistTotal", task.optInt("checklistTotal", points.size))
                task.put("checklist", JSONArray(points.filter { !task.optBoolean("checklistHideCompleted") || !it.optBoolean("completed") }))
                task.put("expanded", task.getString("id") in expanded)
                task.put("showDue", task.isNull("priority") && task.text("due") != null)
            }
            val ordered = when (config.optString("sort", "manual")) {
                "priority" -> tasks.sortedBy { it.getInt("priorityOrder") }
                "newest" -> tasks.sortedBy { it.getInt("newestOrder") }
                "due" -> tasks.sortedWith(compareBy({ it.text("dueAt") ?: "~" }, { it.getInt("manualOrder") }))
                else -> tasks.sortedBy { it.getInt("manualOrder") }
            }
            ordered.filter { !it.isNull("priority") }.sortedBy { it.getInt("priorityOrder") }.take(3).forEachIndexed { index, task -> task.put("rank", index + 1) }
            val message = when {
                listId != null && list == null -> "Liste nicht mehr verfügbar"
                store.read("error") == "conflict" -> "Änderung in Prio prüfen"
                store.read("error") == "auth" -> "Zum Abgleichen Prio öffnen"
                commands.isNotEmpty() -> "${commands.size} Änderung${if (commands.size == 1) "" else "en"} wartet${if (commands.size == 1) "" else "n"}"
                store.read("error") == "offline" -> "Offline · gespeicherter Stand"
                else -> null
            }
            return WidgetView(activeUser, list?.getString("name") ?: "Gesamtansicht", listId, list?.text("icon") ?: if (listId == null) "Overview" else "BulletList", ordered, commands.size, message, true, config.optDouble("opacity", 1.0).toFloat().coerceIn(0f, 1f))
        }
    }
}
