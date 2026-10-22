package de.krischi.prio.widget

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import android.graphics.drawable.GradientDrawable
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject

/** Eigene Konfiguration je Exemplar; Android öffnet sie auch über „Bearbeiten“. */
class WidgetConfigurationActivity : Activity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private var draft: JSONObject? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    override fun onCreate(savedInstanceState: Bundle?) {
        val dark = WidgetStore.get(this).read("theme") == "dark" || WidgetStore.get(this).read("theme") != "light" && resources.configuration.uiMode and 0x30 == 0x20
        setTheme(if (dark) android.R.style.Theme_Material_NoActionBar else android.R.style.Theme_Material_Light_NoActionBar)
        super.onCreate(savedInstanceState)
        WindowCompat.enableEdgeToEdge(window)
        draft = savedInstanceState?.getString("draft")?.let(::JSONObject)
        setResult(RESULT_CANCELED)
        widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }
    }
    override fun onResume() { super.onResume(); if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) render() }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun render() {
        val store = WidgetStore.get(this); val user = WidgetSession.user(this)
        val snapshot = store.snapshot(); val design = WidgetDesign(this)
        val config = draft?.takeIf { it.text("userId") == user } ?: store.config(widgetId)?.takeIf { it.text("userId") == user } ?: JSONObject().put("userId", user).put("sort", "manual")
        draft = config
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(12), dp(16), dp(12)); setBackgroundColor(design.color("page")) }
        val scroll = ScrollView(this).apply { addView(root); setBackgroundColor(design.color("page")) }
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); WindowInsetsCompat.CONSUMED
        }
        setContentView(scroll)
        fun text(value: String, heading: Boolean = false) = TextView(this).apply {
            text = value; textSize = design.font(if (heading) "section" else "body"); setTextColor(design.color(if (heading) "ink-strong" else "ink-muted")); setPadding(0, dp(12), 0, dp(8)); root.addView(this)
        }
        fun button(value: String, icon: String, onClick: () -> Unit): Button = Button(this).apply {
            text = value; textSize = design.font("body"); isAllCaps = false; minHeight = dp(48); setTextColor(design.color("ink")); gravity = android.view.Gravity.CENTER_VERTICAL
            background = GradientDrawable().apply { setColor(design.color("surface")); cornerRadius = dp(10).toFloat() }
            setPadding(dp(12), 0, dp(12), 0)
            getDrawable(design.icon(this@WidgetConfigurationActivity, icon))?.mutate()?.also { it.setTint(design.color("ink-muted")); it.setBounds(0, 0, dp(20), dp(20)); setCompoundDrawables(it, null, null, null); compoundDrawablePadding = dp(10) }
            layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) }; root.addView(this); setOnClickListener { onClick() }
        }
        fun select(title: String, labels: List<String>, current: Int, icons: List<String>, chosen: (Int) -> Unit) {
            val adapter = object : ArrayAdapter<String>(this, android.R.layout.simple_list_item_single_choice, labels) {
                override fun getView(position: Int, convertView: View?, parent: android.view.ViewGroup): View {
                    return (super.getView(position, convertView, parent) as CheckedTextView).apply {
                        setTextColor(design.color("ink")); minHeight = dp(48)
                        getDrawable(design.icon(this@WidgetConfigurationActivity, icons[position]))?.mutate()?.also { it.setTint(design.color("ink-muted")); it.setBounds(0, 0, dp(20), dp(20)); setCompoundDrawables(it, null, null, null); compoundDrawablePadding = dp(12) }
                    }
                }
            }
            AlertDialog.Builder(this).setTitle(title).setSingleChoiceItems(adapter, current) { dialog, which -> chosen(which); dialog.dismiss(); render() }.setNegativeButton("Abbrechen", null).create().apply { show(); window?.setBackgroundDrawableResource(android.R.color.transparent); window?.setBackgroundDrawable(GradientDrawable().apply { setColor(design.color("raised")); cornerRadius = dp(16).toFloat() }) }
        }
        text("Prio · Widget", true)
        if (user == null || snapshot.text("userId") != user) {
            text("Öffne Prio und melde dich an. Danach kannst du dieses Widget einrichten.")
            button("Prio öffnen", "Overview") { startActivity(Intent(this, de.krischi.prio.MainActivity::class.java)); finish() }
            return
        }
        val opacity = text("Deckkraft · ${(config.optDouble("opacity", 1.0) * 100).toInt()} %")
        root.addView(SeekBar(this).apply {
            max = 100; progress = (config.optDouble("opacity", 1.0) * 100).toInt(); minimumHeight = dp(48)
            progressTintList = android.content.res.ColorStateList.valueOf(design.color("brand-soft")); thumbTintList = progressTintList
            contentDescription = "Deckkraft des Widget-Hintergrunds"
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(bar: SeekBar, value: Int, fromUser: Boolean) { config.put("opacity", value / 100.0); opacity.text = "Deckkraft · $value %" }
                override fun onStartTrackingTouch(bar: SeekBar) = Unit
                override fun onStopTrackingTouch(bar: SeekBar) = Unit
            })
        })
        val lists = snapshot.array("lists").objects()
        val listNames = listOf("Gesamtansicht") + lists.map { it.getString("name") }
        val listIds = listOf<String?>(null) + lists.map { it.getString("id") }
        val icons = listOf("Overview") + lists.map { it.text("icon") ?: "BulletList" }
        text("Ansicht")
        val index = listIds.indexOf(config.text("listId")).coerceAtLeast(0)
        button(listNames[index], icons[index]) { select("Liste oder Gesamtansicht", listNames, index, icons) { config.put("listId", listIds[it]).put("tags", JSONArray()) } }
        text("Sortierung")
        val sorts = listOf("manual", "priority", "newest", "due"); val labels = listOf("Manuelle Reihenfolge", "Höchste Priorität zuerst", "Neueste zuerst", "Nächste Fälligkeit zuerst")
        val sortIcons = listOf("BulletList", "Priority", "Plus", "Calendar"); val sort = sorts.indexOf(config.optString("sort", "manual")).coerceAtLeast(0)
        button(labels[sort], sortIcons[sort]) { select("Sortierung", labels, sort, sortIcons) { config.put("sort", sorts[it]) } }
        val tags = snapshot.array("tasks").objects().filter { config.text("listId") == null || it.getString("listId") == config.getString("listId") }
            .flatMap { task -> val names = task.array("tags"); val keys = task.array("tagKeys"); (0 until names.length()).map { keys.getString(it) to names.getString(it) } }
            .plus(config.array("tags").let { values -> (0 until values.length()).map { values.getString(it) to values.getString(it) } }).distinctBy { it.first }.sortedBy { it.second }
        if (tags.isNotEmpty()) {
            text("Tags · alle ausgewählten müssen passen")
            val selected = config.array("tags").let { values -> (0 until values.length()).map { values.getString(it) }.toMutableSet() }
            tags.forEach { (key, name) -> root.addView(CheckBox(this).apply {
                text = name; textSize = design.font("body"); minHeight = dp(48); setTextColor(design.color("ink")); buttonTintList = android.content.res.ColorStateList.valueOf(design.color("brand-soft")); isChecked = key in selected
                setOnCheckedChangeListener { _, checked -> if (checked) selected.add(key) else selected.remove(key); config.put("tags", JSONArray(selected.toList())) }
            }) }
        }
        text("Änderungen aus Prio erscheinen sofort. Der Hintergrundabgleich wird von Android gesteuert; normalerweise frühestens alle 15 Minuten.")
        button("Jetzt aktualisieren", "Sync") { WidgetWorker.request(this); Toast.makeText(this, "Abgleich vorgemerkt", Toast.LENGTH_SHORT).show() }
        button("Widget speichern", "Overview") {
            if (WidgetSession.user(this) != user) { draft = null; render(); return@button }
            store.configure(widgetId, config); WidgetWorker.schedule(this); WidgetWorker.request(this)
            scope.launch { PrioWidget().update(this@WidgetConfigurationActivity, androidx.glance.appwidget.AppWidgetId(widgetId)); setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)); finish() }
        }.apply { setTextColor(design.color("on-brand")); background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(design.color("brand"), design.color("brand-soft"))).apply { cornerRadius = dp(10).toFloat() } }
    }
    override fun onDestroy() { scope.cancel(); super.onDestroy() }
    override fun onSaveInstanceState(state: Bundle) { state.putString("draft", draft?.toString()); super.onSaveInstanceState(state) }
}
