package de.krischi.prio

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import de.krischi.prio.widget.*
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.util.concurrent.Executors

@CapacitorPlugin(name = "PrioWidget")
class PrioWidgetPlugin : Plugin() {
    private val executor = Executors.newCachedThreadPool()
    private val leases = java.util.Collections.synchronizedSet(mutableSetOf<String>())
    private fun execute(call: PluginCall, work: () -> JSObject) { executor.execute { try { call.resolve(work()) } catch (_: Exception) { call.reject("Widget-Vorgang fehlgeschlagen.") } } }
    private fun redraw() = runBlocking { PrioWidget().updateAll(context) }
    private fun active() = AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, PrioWidgetReceiver::class.java)).isNotEmpty()
    @PluginMethod fun prepare(call: PluginCall) = execute(call) {
        val url = call.getString("url")!!; val endpoint = call.getString("endpoint")!!
        require(URI(url).scheme == "https" || BuildConfig.DEBUG && URI(url).host in listOf("127.0.0.1", "localhost", "10.0.2.2"))
        require(URI(endpoint).scheme == "https" || BuildConfig.DEBUG)
        WidgetStore.get(context).write("backend", JSONObject().put("url", url).put("publishableKey", call.getString("publishableKey")).put("endpoint", endpoint).toString())
        val all = WidgetSession.read(context)
        if (!all.has("prio.auth")) call.getString("legacy")?.let { all.put("prio.auth", it); WidgetSession.write(context, all) }
        if (active()) { WidgetWorker.schedule(context); WidgetWorker.request(context) }
        JSObject().put("session", all.opt("prio.auth") ?: JSONObject.NULL)
    }
    @PluginMethod fun storageGet(call: PluginCall) = execute(call) { JSObject().put("value", WidgetSession.read(context).opt(call.getString("key")!!) ?: JSONObject.NULL) }
    @PluginMethod fun storageSet(call: PluginCall) = execute(call) {
        val key = call.getString("key")!!; val value = call.getString("value")!!; val all = WidgetSession.read(context)
        if (key == "prio.auth") {
            val before = all.text(key)?.let(::JSONObject)?.optJSONObject("user")?.text("id")
            val after = JSONObject(value).getJSONObject("user").getString("id")
            if (before != null && before != after) { WidgetNotifications.cancelAccount(context); WidgetStore.get(context).clearAccount() }
        }
        all.put(key, value); WidgetSession.write(context, all); JSObject()
    }
    @PluginMethod fun storageRemove(call: PluginCall) = execute(call) {
        val key = call.getString("key")!!; val all = WidgetSession.read(context); all.remove(key); WidgetSession.write(context, all)
        if (key == "prio.auth") { WidgetNotifications.cancelAccount(context); WidgetStore.get(context).clearAccount(); redraw() }
        JSObject()
    }
    @PluginMethod fun acquire(call: PluginCall) = execute(call) { val lease = WidgetLocks.acquire(call.getString("name")!!, call.getLong("timeout", 30000L)!!); leases.add(lease); JSObject().put("lease", lease) }
    @PluginMethod fun release(call: PluginCall) = execute(call) { call.getString("lease")?.let { if (leases.remove(it)) WidgetLocks.release(it) }; JSObject() }
    @PluginMethod fun publish(call: PluginCall) = execute(call) {
        val snapshot = call.getObject("snapshot")!!; val user = WidgetSession.user(context)
        require(snapshot.getString("userId") == user)
        val store = WidgetStore.get(context)
        if (call.getBoolean("initial", false) != true || store.snapshot().text("userId") != user) store.publish(snapshot)
        redraw(); JSObject()
    }
    @PluginMethod fun commands(call: PluginCall) = execute(call) { JSObject().put("commands", JSONArray(WidgetStore.get(context).commands(WidgetSession.user(context) ?: ""))) }
    @PluginMethod fun acknowledge(call: PluginCall) = execute(call) { WidgetStore.get(context).acknowledge(call.getString("id")!!, WidgetSession.user(context) ?: ""); JSObject() }
    @PluginMethod fun theme(call: PluginCall) = execute(call) { val theme = call.getString("preference")!!; require(theme in listOf("system", "dark", "light")); WidgetStore.get(context).write("theme", theme); redraw(); JSObject() }
    @PluginMethod fun reminders(call: PluginCall) = execute(call) { JSObject().put("count", WidgetNotifications.replace(context, call.getArray("candidates") ?: JSONArray())) }
    @PluginMethod fun reminderCount(call: PluginCall) = execute(call) { JSObject().put("count", JSONArray(WidgetStore.get(context).read("reminder-plan") ?: "[]").objects().count { java.time.Instant.parse(it.getString("at")).toEpochMilli() > System.currentTimeMillis() }) }
    override fun handleOnDestroy() { synchronized(leases) { leases.toList().forEach { WidgetLocks.release(it) }; leases.clear() }; super.handleOnDestroy() }
}
