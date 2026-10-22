package de.krischi.prio.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.net.Uri
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.*
import androidx.glance.action.*
import androidx.glance.appwidget.*
import androidx.glance.appwidget.action.*
import androidx.glance.appwidget.lazy.*
import androidx.glance.layout.*
import androidx.glance.text.*
import androidx.glance.unit.ColorProvider
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import de.krischi.prio.MainActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext

class PrioWidget : GlanceAppWidget() {
    // Responsive Größen statt eines abgeschnittenen Desktop-Layouts.
    override val sizeMode = SizeMode.Responsive(setOf(DpSize(220.dp, 164.dp), DpSize(280.dp, 220.dp), DpSize(340.dp, 300.dp), DpSize(460.dp, 240.dp)))
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val store = WidgetStore.get(context); val widgetId = (id as AppWidgetId).appWidgetId
        val views = store.revision.map { withContext(Dispatchers.IO) { WidgetView.read(store, widgetId, WidgetSession.user(context)) } }
        val initial = withContext(Dispatchers.IO) { WidgetView.read(store, widgetId, WidgetSession.user(context)) }
        provideContent { val view by views.collectAsState(initial); Content(context, widgetId, view) }
    }

    @Composable internal fun Content(context: Context, widgetId: Int, view: WidgetView) {
        val design = WidgetDesign(context); val size = LocalSize.current
        val rich = size.width >= 280.dp && size.height >= 220.dp
        val large = size.width >= 340.dp
        val ink = ColorProvider(Color(design.color("ink"))); val muted = ColorProvider(Color(design.color("ink-muted")))
        val settings = actionStartActivity(Intent(context, WidgetConfigurationActivity::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId).setData(Uri.parse("prio-widget:configure/$widgetId")))
        Column(GlanceModifier.fillMaxSize().background(Color(design.color("page")).copy(alpha = view.opacity)).appWidgetBackground().cornerRadius(24.dp).padding(horizontal = 8.dp)) {
            Row(GlanceModifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(GlanceModifier.defaultWeight().fillMaxHeight().clickable(open(context, view, "list")).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Image(ImageProvider(design.icon(context, view.icon)), null, GlanceModifier.size(20.dp), colorFilter = ColorFilter.tint(muted))
                    Spacer(GlanceModifier.width(8.dp))
                    Text(view.title, style = TextStyle(color = ink, fontSize = design.font("title").sp, fontWeight = FontWeight.Bold), maxLines = 1)
                }
                if (large) IconControl(context, design, "Sync", "Aktualisieren", actionRunCallback<RefreshWidget>())
                IconControl(context, design, "Plus", "Neue Aufgabe", open(context, view, "create"))
                IconControl(context, design, "Settings", "Widget einrichten", settings)
            }
            if (!view.configured) {
                Box(GlanceModifier.fillMaxSize().clickable(if (view.userId == null) open(context, view, "list") else settings).padding(8.dp), contentAlignment = Alignment.Center) {
                    Text(view.message ?: "Widget einrichten", style = TextStyle(color = muted, fontSize = design.font("body").sp))
                }
            } else if (view.tasks.isEmpty()) {
                Box(GlanceModifier.defaultWeight().fillMaxWidth().clickable(open(context, view, "list")), contentAlignment = Alignment.Center) {
                    Text(view.message ?: "Keine offenen Aufgaben", style = TextStyle(color = muted, fontSize = design.font("body").sp))
                }
            } else {
                LazyColumn(GlanceModifier.defaultWeight().fillMaxWidth()) {
                    items(view.tasks.take(100), itemId = { java.util.UUID.fromString(it.getString("id")).let { uuid -> (uuid.mostSignificantBits xor uuid.leastSignificantBits) and Long.MAX_VALUE } }) { task ->
                        val deferred = task.optBoolean("deferred")
                        Column(GlanceModifier.fillMaxWidth()) {
                        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Box(GlanceModifier.size(48.dp).clickable(actionRunCallback<CompleteWidgetTask>(actionParametersOf(taskKey to task.getString("id"), userKey to view.userId!!)))
                                .semantics { contentDescription = "${task.getString("title")} erledigen" }, contentAlignment = Alignment.Center) {
                                Image(ImageProvider(checkboxBitmap(design)), null, GlanceModifier.size(20.dp))
                            }
                            Column(GlanceModifier.defaultWeight().clickable(open(context, view, "task", task.getString("id"), task.getString("listId"))).padding(top = 6.dp, bottom = 6.dp, end = 4.dp)) {
                                Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    Text(task.getString("title"), GlanceModifier.defaultWeight(), style = TextStyle(color = if (deferred) muted else ink, fontSize = design.font("body").sp), maxLines = if (rich) 2 else 1)
                                }
                            }
                            if (task.optInt("checklistTotal") > 0) {
                                Box(GlanceModifier.size(48.dp).clickable(actionRunCallback<ToggleWidgetChecklist>(actionParametersOf(taskKey to task.getString("id"), userKey to view.userId!!)))
                                    .semantics { contentDescription = "Checkliste ${if (task.optBoolean("expanded")) "einklappen" else "ausklappen"}" }, contentAlignment = Alignment.Center) {
                                    Text("${task.getInt("checklistDone")}/${task.getInt("checklistTotal")} ${if (task.optBoolean("expanded")) "▴" else "▾"}", style = TextStyle(color = muted, fontSize = design.font("label").sp))
                                }
                            }
                            if (view.listId == null) Box(GlanceModifier.width(24.dp).height(48.dp), contentAlignment = Alignment.Center) {
                                Image(ImageProvider(design.icon(context, task.text("listIcon"))), task.text("listName"), GlanceModifier.size(16.dp), colorFilter = ColorFilter.tint(muted))
                            }
                        }
                        if (rich && !task.isNull("priority")) {
                            Row(GlanceModifier.fillMaxWidth().padding(start = 48.dp, end = 4.dp, bottom = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                                val rankRole = when (task.optInt("rank")) { 1 -> "priority-gold"; 2 -> "priority-silver"; 3 -> "priority-bronze"; else -> "ink-muted" }
                                Image(ImageProvider(design.icon(context, "Priority")), "Priorität", GlanceModifier.size(14.dp), colorFilter = ColorFilter.tint(ColorProvider(Color(design.color(rankRole)))))
                                Spacer(GlanceModifier.width(4.dp))
                                Image(ImageProvider(priorityBitmap(design, task.getDouble("priority").toFloat())), null, GlanceModifier.defaultWeight().height(4.dp), contentScale = ContentScale.FillBounds)
                            }
                        }
                        if (rich && task.optBoolean("showDue")) {
                            Row(GlanceModifier.fillMaxWidth().padding(start = 48.dp, end = 4.dp, bottom = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                                Image(ImageProvider(design.icon(context, "Calendar")), null, GlanceModifier.size(14.dp), colorFilter = ColorFilter.tint(muted))
                                Spacer(GlanceModifier.width(4.dp))
                                Text(task.getString("due"), GlanceModifier.defaultWeight(), TextStyle(color = if (task.optBoolean("overdue")) ColorProvider(Color(design.color("danger"))) else muted, fontSize = design.font("label").sp), maxLines = 1)
                            }
                        }
                        if (rich && deferred) Text("Nächste Wiederholung", GlanceModifier.padding(start = 48.dp, bottom = 3.dp), style = TextStyle(color = muted, fontSize = design.font("label").sp))
                        if (task.optBoolean("expanded")) task.array("checklist").objects().forEach { point ->
                            val checked = point.optBoolean("completed")
                            Row(GlanceModifier.fillMaxWidth().padding(start = 32.dp).clickable(actionRunCallback<CompleteWidgetTask>(actionParametersOf(taskKey to task.getString("id"), userKey to view.userId!!, checklistKey to point.getString("id"), completedKey to !checked)))
                                .semantics { contentDescription = "${point.getString("text")}: ${if (checked) "erledigt" else "offen"}" }, verticalAlignment = Alignment.CenterVertically) {
                                Box(GlanceModifier.size(48.dp), contentAlignment = Alignment.Center) { Image(ImageProvider(checkboxBitmap(design, checked)), null, GlanceModifier.size(20.dp)) }
                                Text(point.getString("text"), GlanceModifier.defaultWeight().padding(end = 4.dp, top = 6.dp, bottom = 6.dp), TextStyle(color = if (checked) muted else ink, fontSize = design.font("body").sp), maxLines = 2)
                            }
                        }
                        Box(GlanceModifier.fillMaxWidth().height(1.dp).background(Color(design.color("line-soft")) )) {}
                        }
                    }
                    if (view.tasks.size > 100) item { Text("Weitere Aufgaben in Prio", GlanceModifier.fillMaxWidth().height(48.dp).clickable(open(context, view, "list")), TextStyle(color = muted)) }
                }
            }
            if (view.message != null && view.tasks.isNotEmpty()) Text(view.message, GlanceModifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), TextStyle(color = muted, fontSize = design.font("label").sp), maxLines = 1)
        }
    }
    @Composable private fun IconControl(context: Context, design: WidgetDesign, icon: String, label: String, action: Action) {
        Box(GlanceModifier.size(48.dp).clickable(action), contentAlignment = Alignment.Center) {
            Image(ImageProvider(design.icon(context, icon)), label, GlanceModifier.size(20.dp), colorFilter = ColorFilter.tint(ColorProvider(Color(design.color("ink-muted")))))
        }
    }
    private fun open(context: Context, view: WidgetView, action: String, taskId: String? = null, taskList: String? = null): Action {
        val uri = Uri.Builder().scheme("prio-widget").authority("open").appendQueryParameter("action", action)
            .appendQueryParameter("account", view.userId ?: "").appendQueryParameter("list", taskList ?: view.listId ?: "").appendQueryParameter("task", taskId ?: "").build()
        return actionStartActivity(Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP))
    }
    internal fun priorityBitmap(design: WidgetDesign, value: Float): Bitmap {
        val bitmap = Bitmap.createBitmap(256, 6, Bitmap.Config.ARGB_8888); val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG); paint.color = design.color("line-soft")
        canvas.drawRoundRect(0f, 0f, 256f, 6f, 3f, 3f, paint)
        canvas.save(); canvas.clipRect(0f, 0f, 256 * (value / 10).coerceIn(0f, 1f), 6f)
        paint.shader = LinearGradient(0f, 0f, 256f, 0f, intArrayOf(design.color("priority-start"), design.color("priority-middle"), design.color("priority-end")), null, Shader.TileMode.CLAMP)
        canvas.drawRoundRect(0f, 0f, 256f, 6f, 3f, 3f, paint); canvas.restore(); return bitmap
    }
    private fun checkboxBitmap(design: WidgetDesign, checked: Boolean = false): Bitmap {
        val bitmap = Bitmap.createBitmap(40, 40, Bitmap.Config.ARGB_8888)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = design.color("line-strong"); style = Paint.Style.STROKE; strokeWidth = 3f }
        val canvas = Canvas(bitmap)
        if (checked) { paint.style = Paint.Style.FILL; paint.color = design.color("brand"); canvas.drawRoundRect(3f, 3f, 37f, 37f, 3f, 3f, paint); paint.style = Paint.Style.STROKE; paint.color = design.color("on-brand"); canvas.drawPath(android.graphics.Path().apply { moveTo(10f, 20f); lineTo(17f, 27f); lineTo(31f, 13f) }, paint) }
        else canvas.drawRoundRect(3f, 3f, 37f, 37f, 3f, 3f, paint)
        return bitmap
    }
}

internal val taskKey = ActionParameters.Key<String>("task")
internal val userKey = ActionParameters.Key<String>("account")
internal val checklistKey = ActionParameters.Key<String>("checklist")
internal val completedKey = ActionParameters.Key<Boolean>("completed")
class ToggleWidgetChecklist : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        withContext(Dispatchers.IO) {
            if (WidgetSession.user(context) != parameters[userKey]) return@withContext
            val store = WidgetStore.get(context); val config = store.config((glanceId as AppWidgetId).appWidgetId) ?: return@withContext
            val expanded = config.array("expanded").let { values -> (0 until values.length()).map { values.getString(it) }.toMutableSet() }
            val task = parameters[taskKey] ?: return@withContext
            if (!expanded.add(task)) expanded.remove(task)
            store.configure(glanceId.appWidgetId, config.put("expanded", org.json.JSONArray(expanded.toList())))
        }
        PrioWidget().update(context, glanceId)
    }
}
class CompleteWidgetTask : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        withContext(Dispatchers.IO) {
            val user = parameters[userKey] ?: return@withContext; val task = parameters[taskKey] ?: return@withContext
            if (WidgetSession.user(context) != user) return@withContext
            val checklist = parameters[checklistKey]?.let { org.json.JSONObject().put("id", it).put("completed", parameters[completedKey] ?: true) }
            WidgetStore.get(context).enqueue(user, task, checklist = checklist)
            WidgetNotifications.replace(context, WidgetStore.get(context).snapshot().array("reminders"))
            WidgetWorker.request(context)
        }
        PrioWidget().updateAll(context)
    }
}
class RefreshWidget : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) { WidgetWorker.request(context) }
}
class PrioWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = PrioWidget()
    override fun onEnabled(context: Context) { super.onEnabled(context); WidgetWorker.schedule(context); WidgetWorker.request(context) }
    override fun onDeleted(context: Context, appWidgetIds: IntArray) { super.onDeleted(context, appWidgetIds); appWidgetIds.forEach { WidgetStore.get(context).removeConfig(it) } }
    override fun onDisabled(context: Context) { super.onDisabled(context); androidx.work.WorkManager.getInstance(context).cancelUniqueWork("prio-widget-periodic") }
}
