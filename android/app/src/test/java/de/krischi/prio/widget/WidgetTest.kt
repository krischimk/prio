package de.krischi.prio.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.ExperimentalGlanceRemoteViewsApi
import androidx.glance.appwidget.GlanceRemoteViews
import androidx.glance.appwidget.AppWidgetId
import androidx.glance.action.actionParametersOf
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.security.Security

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WidgetTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private lateinit var store: WidgetStore
    private val user = "00000000-0000-4000-8000-000000000001"
    private val list = "10000000-0000-4000-8000-000000000001"
    private val task = "20000000-0000-4000-8000-000000000001"
    private fun snapshot() = JSONObject().put("protocol", 1).put("userId", user).put("generatedAt", "2026-10-21T10:00:00Z")
        .put("lists", JSONArray().put(JSONObject().put("id", list).put("name", "Alltag").put("icon", "std:prio").put("overview", true)))
        .put("tasks", JSONArray().put(row(task, "Präsentation vorbereiten", 8.4, 0, listOf("uni", "wichtig")))
            .put(row("20000000-0000-4000-8000-000000000002", "Einkaufen", null, 1, listOf("privat")))
            .put(row("20000000-0000-4000-8000-000000000003", "Lange Aufgabe mit einem Titel, der in kleinen Widgets gekürzt werden muss", 5.0, 2, listOf("uni"))))
        .put("reminders", JSONArray()).put("local", JSONObject())
    private fun row(id: String, title: String, priority: Double?, order: Int, tags: List<String>) = JSONObject()
        .put("id", id).put("listId", list).put("title", title).put("priority", priority ?: JSONObject.NULL)
        .put("listName", "Alltag").put("listIcon", "std:flash")
        .put("manualOrder", order).put("priorityOrder", if (order == 1) 2 else if (order == 2) 1 else 0).put("newestOrder", 2 - order)
        .put("due", "In 3 Tagen (Sa)").put("dueAt", "2026-10-24T10:00:00Z").put("overdue", false)
        .put("tagKeys", JSONArray(tags)).put("tags", JSONArray(tags)).put("checklistDone", 2).put("checklistTotal", 5).put("deferred", order == 2)
        .put("checklist", JSONArray().put(JSONObject().put("id", "a").put("text", "Unterlagen sammeln").put("completed", false))
            .put(JSONObject().put("id", "b").put("text", "Folien vorbereiten").put("completed", true)))
    private fun config(listId: String? = list, tags: List<String> = emptyList(), sort: String = "manual") = JSONObject().put("userId", user).put("listId", listId ?: JSONObject.NULL).put("tags", JSONArray(tags)).put("sort", sort)
    @Before fun setup() { WidgetStore.resetForTest(); store = WidgetStore.get(context); store.clearAccount(); store.publish(snapshot()); store.configure(1, config()); store.write("theme", "dark") }
    private fun descendants(view: View): List<View> = listOf(view) + if (view is ViewGroup) (0 until view.childCount).flatMap { descendants(view.getChildAt(it)) } else emptyList()

    @Test fun offlineQueueIsDurableAndDoubleTapsKeepTheSameCommand() {
        val command = store.enqueue(user, task, "2026-10-21T10:00:00Z")
        assertEquals(command.toString(), store.enqueue(user, task).toString())
        // Die neue Verbindung liest ausschließlich den dauerhaften SQLite-Stand.
        val reopened = android.database.sqlite.SQLiteDatabase.openDatabase(context.getDatabasePath("prio-widget.db").path, null, android.database.sqlite.SQLiteDatabase.OPEN_READONLY)
        reopened.rawQuery("SELECT body FROM outbox", null).use { assertTrue(it.moveToFirst()); assertEquals(command.toString(), it.getString(0)); assertFalse(it.moveToNext()) }; reopened.close()
        assertEquals(2, WidgetView.read(store, 1, user).tasks.size)
        assertEquals(1, WidgetView.read(store, 1, user).pending)
        store.acceptResponse(user, JSONObject().put("snapshot", snapshot().put("tasks", JSONArray(snapshot().array("tasks").objects().drop(1))))
            .put("acknowledged", JSONArray().put(command.getString("id"))).put("conflicts", JSONArray()))
        assertTrue(store.commands(user).isEmpty()); assertEquals(2, WidgetView.read(store, 1, user).tasks.size)
    }
    @Test fun multipleInstancesFilterAndSortIndependentlyAndDoNotRevealAnotherAccount() {
        store.configure(2, config(tags = listOf("uni", "wichtig"), sort = "priority"))
        store.configure(3, config(sort = "newest"))
        assertEquals(3, WidgetView.read(store, 1, user).tasks.size)
        assertEquals(listOf(task), WidgetView.read(store, 2, user).tasks.map { it.getString("id") })
        assertEquals("20000000-0000-4000-8000-000000000003", WidgetView.read(store, 3, user).tasks[0].getString("id"))
        assertTrue(WidgetView.read(store, 1, "other-account").tasks.isEmpty())
        store.clearAccount(); assertTrue(WidgetView.read(store, 1, null).tasks.isEmpty()); assertTrue(store.commands(user).isEmpty())
    }
    @Test fun responseAndAcknowledgementAreAtomicAndBoundToTheAccount() {
        val command = store.enqueue(user, task)
        try { store.acceptResponse(user, JSONObject().put("snapshot", snapshot().put("userId", "other")).put("acknowledged", JSONArray().put(command.getString("id")))); fail() } catch (_: IllegalArgumentException) { }
        assertEquals(1, store.commands(user).size); assertEquals(user, store.snapshot().getString("userId"))
    }
    @Test fun checklistTogglesStayOrderedAndIndependentOfTheMainTask() {
        val point = JSONObject().put("id", "a").put("completed", true)
        val first = store.enqueue(user, task, checklist = point)
        assertEquals(first.toString(), store.enqueue(user, task, checklist = point).toString())
        var view = WidgetView.read(store, 1, user)
        assertEquals(3, view.tasks.size)
        assertTrue(view.tasks[0].array("checklist").getJSONObject(0).getBoolean("completed"))
        assertEquals(2, view.tasks[0].getInt("checklistDone"))
        assertFalse(view.tasks[0].getBoolean("showDue")); assertTrue(view.tasks[1].getBoolean("showDue"))
        store.enqueue(user, task, checklist = JSONObject().put("id", "a").put("completed", false))
        view = WidgetView.read(store, 1, user)
        assertFalse(view.tasks[0].array("checklist").getJSONObject(0).getBoolean("completed"))
        assertEquals(2, store.commands(user).size)
        store.enqueue(user, task)
        assertEquals(2, WidgetView.read(store, 1, user).tasks.size)
    }
    @Test fun checklistCallbackExpandsAndCollapsesOfflineWithoutOpeningTheApp() = runBlocking {
        Security.addProvider(TestKeyStore())
        try {
            TestKeyStore.keys.clear()
            File(context.noBackupFilesDir, "prio-session.enc").delete()
            WidgetSession.write(context, JSONObject().put("prio.auth", JSONObject().put("user", JSONObject().put("id", user)).toString()))
            assertEquals(user, WidgetSession.user(context))
            val manager = android.appwidget.AppWidgetManager.getInstance(context)
            shadowOf(manager).addBoundWidget(1, android.appwidget.AppWidgetProviderInfo().apply {
                provider = android.content.ComponentName(context, PrioWidgetReceiver::class.java)
            })
            androidx.work.WorkManager.initialize(context, androidx.work.Configuration.Builder().build())
            store.configure(2, config())
            store.write("error", "offline")
            val parameters = actionParametersOf(taskKey to task, userKey to user)
            ToggleWidgetChecklist().onAction(context, AppWidgetId(1), parameters)
            assertTrue(WidgetView.read(store, 1, user).tasks[0].getBoolean("expanded"))
            assertFalse(WidgetView.read(store, 2, user).tasks[0].getBoolean("expanded"))
            WidgetStore.resetForTest(); store = WidgetStore.get(context)
            assertTrue(WidgetView.read(store, 1, user).tasks[0].getBoolean("expanded"))
            ToggleWidgetChecklist().onAction(context, AppWidgetId(1), parameters)
            assertFalse(WidgetView.read(store, 1, user).tasks[0].getBoolean("expanded"))
            assertTrue(store.commands(user).isEmpty())
        } finally { Security.removeProvider("AndroidKeyStore") }
    }
    @Test fun sessionAndQueueLeasesSerializeBackgroundAndForegroundWork() {
        val lease = WidgetLocks.acquire("auth")
        val executor = Executors.newSingleThreadExecutor(); val future = executor.submit<String> { WidgetLocks.acquire("auth", 2000) }
        assertFalse(future.isDone); WidgetLocks.release(lease)
        WidgetLocks.release(future.get(2, TimeUnit.SECONDS)); executor.shutdown()
    }
    @Test fun designUsesTheCurrentGeneratedOriginalPaletteAndIcons() {
        val source = JSONObject(context.assets.open("widget-design.json").bufferedReader().use { it.readText() })
        for (theme in listOf("dark", "light")) {
            store.write("theme", theme); val design = WidgetDesign(context)
            assertEquals(android.graphics.Color.parseColor(source.getJSONObject(theme).getString("brand")), design.color("brand"))
            assertTrue(design.icon(context, "std:prio") != 0); assertTrue(design.icon(context, "Priority") != 0)
            val bitmap = PrioWidget().priorityBitmap(design, 5f)
            assertNotEquals(bitmap.getPixel(20, 3), bitmap.getPixel(100, 3))
            assertEquals(design.color("line-soft"), bitmap.getPixel(220, 3))
        }
    }
    @OptIn(ExperimentalGlanceRemoteViewsApi::class)
    @Test fun opacityIsPersonalToEachWidgetAndOnlyChangesItsBackground() = runBlocking {
        assertEquals(1f, WidgetView.read(store, 1, user).opacity)
        store.configure(2, config().put("opacity", 0.35))
        assertEquals(0.35f, WidgetView.read(store, 2, user).opacity)
        assertEquals(1f, WidgetView.read(store, 1, user).opacity)
        WidgetStore.resetForTest(); store = WidgetStore.get(context)
        assertEquals(0.35f, WidgetView.read(store, 2, user).opacity)
        val composition = GlanceRemoteViews().compose(context, DpSize(340.dp, 300.dp)) { PrioWidget().Content(context, 2, WidgetView.read(store, 2, user)) }
        val parent = android.appwidget.AppWidgetHostView(context)
        val view = composition.remoteViews.apply(context, parent)
        parent.addView(view)
        parent.measure(View.MeasureSpec.makeMeasureSpec(340, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(300, View.MeasureSpec.EXACTLY)); parent.layout(0, 0, 340, 300)
        val bitmap = Bitmap.createBitmap(340, 300, Bitmap.Config.ARGB_8888); parent.draw(Canvas(bitmap))
        val backgroundAlpha = android.graphics.Color.alpha(bitmap.getPixel(2, 150))
        assertTrue("Only the background receives the opacity: $backgroundAlpha", backgroundAlpha in 88..90)
        assertTrue("Text and controls remain opaque", (0 until 340).any { x -> (0 until 300).any { y -> android.graphics.Color.alpha(bitmap.getPixel(x, y)) == 255 } })
    }
    @Test fun everyExportedIconHasAVisibleNativeDrawing() {
        val source = JSONObject(context.assets.open("widget-design.json").bufferedReader().use { it.readText() }).getJSONObject("icons")
        val failures = mutableListOf<String>()
        for (key in source.keys()) {
            try {
                val icon = context.getDrawable(WidgetDesign(context).icon(context, key))!!
                val bitmap = Bitmap.createBitmap(48, 48, Bitmap.Config.ARGB_8888)
                icon.setBounds(0, 0, 48, 48); icon.draw(Canvas(bitmap))
                if ((0 until 48).none { x -> (0 until 48).any { y -> android.graphics.Color.alpha(bitmap.getPixel(x, y)) > 0 } }) failures.add("$key: empty")
            } catch (error: Exception) { failures.add("$key: ${error.cause?.message ?: error.message}") }
        }
        assertTrue(failures.joinToString("\n"), failures.isEmpty())
    }
    @OptIn(ExperimentalGlanceRemoteViewsApi::class)
    @Test fun checklistUpdatesInAnExistingLauncherView() = runBlocking {
        val composer = GlanceRemoteViews()
        suspend fun content() = composer.compose(context, DpSize(340.dp, 300.dp)) { PrioWidget().Content(context, 1, WidgetView.read(store, 1, user)) }.remoteViews
        val activity = org.robolectric.Robolectric.buildActivity(android.app.Activity::class.java).setup().get()
        val parent = android.appwidget.AppWidgetHostView(activity)
        val view = content().apply(activity, parent)
        parent.addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        activity.setContentView(parent)
        for (expanded in listOf(false, true, false, true)) {
            store.configure(1, config().put("expanded", JSONArray(if (expanded) listOf(task) else emptyList<String>())))
            content().reapply(activity, view)
            shadowOf(Looper.getMainLooper()).idle()
            parent.measure(View.MeasureSpec.makeMeasureSpec(340, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(300, View.MeasureSpec.EXACTLY)); parent.layout(0, 0, 340, 300)
            val texts = descendants(parent).filterIsInstance<TextView>().map { it.text.toString() }
            assertTrue("The existing launcher view must contain the task: $texts", texts.contains("Präsentation vorbereiten"))
            assertEquals("The existing launcher view must reflect checklist expansion: $texts", expanded, texts.contains("Unterlagen sammeln"))
        }
    }
    @OptIn(ExperimentalGlanceRemoteViewsApi::class)
    @Test fun overviewKeepsOriginIconsOnTheRightAndPriorityTracksTheSameWidth() = runBlocking {
        val snapshot = snapshot()
        snapshot.array("tasks").getJSONObject(1).put("priority", 4).put("checklist", JSONArray())
        store.publish(snapshot); store.configure(1, config(null))
        for (width in listOf(220, 340)) {
            val composition = GlanceRemoteViews().compose(context, DpSize(width.dp, 400.dp)) { PrioWidget().Content(context, 1, WidgetView.read(store, 1, user)) }
            val activity = org.robolectric.Robolectric.buildActivity(android.app.Activity::class.java).setup().get()
            val parent = android.appwidget.AppWidgetHostView(activity)
            parent.addView(composition.remoteViews.apply(activity, parent))
            activity.setContentView(parent)
            shadowOf(Looper.getMainLooper()).idle()
            parent.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(400, View.MeasureSpec.EXACTLY)); parent.layout(0, 0, width, 400)
            val origin = descendants(parent).first { it is android.widget.ImageView && it.contentDescription?.toString() == "Alltag" }
            val toggle = descendants(parent).first { it.contentDescription?.toString() == "Checkliste ausklappen" }
            val originLocation = IntArray(2); val toggleLocation = IntArray(2)
            origin.getLocationOnScreen(originLocation); toggle.getLocationOnScreen(toggleLocation)
            assertTrue("Origin icon belongs to the right of the checklist button", originLocation[0] > toggleLocation[0])
            if (width >= 280) {
                val tracks = descendants(parent).filter { it.contentDescription?.toString() == "Priorität" }.map { icon -> (icon.parent as ViewGroup).let { it.getChildAt(it.childCount - 1) }.width }
                assertTrue("Both rated rows must be visible", tracks.size >= 2)
                assertTrue("A checklist button must not shrink the priority track: $tracks", tracks.all { it == tracks[0] && it > 0 })
            }
            val bitmap = Bitmap.createBitmap(width, 400, Bitmap.Config.ARGB_8888); parent.draw(Canvas(bitmap))
            File("../../test-results/widget-native/overview-$width.png").apply { parentFile.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
    @OptIn(ExperimentalGlanceRemoteViewsApi::class)
    @Test fun actualGlanceLayoutsRenderInBothThemesAndPhoneSizes() = runBlocking {
        val destination = File("../../test-results/widget-native").apply { mkdirs() }
        for (theme in listOf("dark", "light")) for ((width, height) in listOf(220 to 164, 340 to 300, 460 to 240)) {
            store.write("theme", theme)
            store.configure(1, config().put("expanded", JSONArray().put(task)))
            val composition = GlanceRemoteViews().compose(context, DpSize(width.dp, height.dp)) { PrioWidget().Content(context, 1, WidgetView.read(store, 1, user)) }
            val activity = org.robolectric.Robolectric.buildActivity(android.app.Activity::class.java).setup().get()
            val parent = android.appwidget.AppWidgetHostView(activity); val view = composition.remoteViews.apply(activity, parent)
            parent.addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            activity.setContentView(parent)
            shadowOf(Looper.getMainLooper()).idle()
            val density = context.resources.displayMetrics.density
            val w = (width * density).toInt(); val h = (height * density).toInt()
            parent.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY)); parent.layout(0, 0, w, h)
            val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); parent.draw(Canvas(bitmap))
            File(destination, "$theme-$width-$height.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            fun texts(view: View): List<String> = (if (view is TextView) listOf(view.text.toString()) else emptyList()) + (if (view is ViewGroup) (0 until view.childCount).flatMap { texts(view.getChildAt(it)) } else emptyList())
            assertTrue("Widget header must render", texts(parent).contains("Alltag"))
            assertTrue("Task title must render inside real RemoteViews", texts(parent).any { it.contains("Präsentation") })
            assertTrue("Checklist must render inside real RemoteViews", texts(parent).contains("Unterlagen sammeln"))
            val toggle = descendants(parent).first { it.contentDescription?.toString() == "Checkliste einklappen" }
            // Glance legt die Semantik innen und den Android-Klickrahmen außen an.
            val clickArea = generateSequence(toggle) { it.parent as? View }.first { it.hasOnClickListeners() }
            assertTrue("The checklist expander has a real launcher click action", clickArea.performClick())
            assertNotNull("The collection click must be delivered", shadowOf(activity).nextStartedActivity)
            // Robolectric übernimmt beim IntentSender nur die Vorlage. Der echte
            // Fill-in-Auftrag liegt am Android-Klicklistener und wird separat geprüft.
            val listener = shadowOf(clickArea).onClickListener!!
            val action = listener.javaClass.declaredFields.first { it.type.name == "android.widget.RemoteViews\$SetOnClickResponse" }.apply { isAccessible = true }.get(listener)
            val response = org.robolectric.util.ReflectionHelpers.getField<Any>(action, "mResponse")
            val intent = org.robolectric.util.ReflectionHelpers.getField<android.content.Intent>(response, "mFillIntent")
            @Suppress("DEPRECATION") val callback = intent.getParcelableExtra<android.content.Intent>("ACTION_INTENT")!!
            assertEquals(ToggleWidgetChecklist::class.java.name, callback.getStringExtra("ActionCallbackBroadcastReceiver:callbackClass"))
            assertEquals(task, callback.getBundleExtra("ActionCallbackBroadcastReceiver:parameters")!!.getString("task"))
        }
    }
}
