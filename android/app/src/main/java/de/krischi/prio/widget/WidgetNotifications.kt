package de.krischi.prio.widget

import android.content.Context
import androidx.core.app.NotificationManagerCompat
import com.capacitorjs.plugins.localnotifications.LocalNotification
import com.capacitorjs.plugins.localnotifications.LocalNotificationManager
import com.capacitorjs.plugins.localnotifications.NotificationStorage
import com.getcapacitor.CapConfig
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/** App und Worker verwenden denselben Plan und dieselbe Capacitor-Alarmablage. */
object WidgetNotifications {
    @Synchronized fun replace(context: Context, candidates: JSONArray): Int {
        val store = WidgetStore.get(context)
        val pending = store.commands(WidgetSession.user(context) ?: "").filter { !it.has("checklist") }.map { it.getString("taskId") }.toSet()
        val future = candidates.objects().filter { it.getString("taskId") !in pending && Instant.parse(it.getString("at")).toEpochMilli() > System.currentTimeMillis() }
            .sortedWith(compareBy({ it.getString("at") }, { it.getString("taskId") }))
        val desired = JSONArray(future).toString()
        val allowed = NotificationManagerCompat.from(context).areNotificationsEnabled()
        if (allowed && desired == store.read("reminder-plan")) return future.size
        val storage = NotificationStorage(context)
        val manager = LocalNotificationManager(storage, null, context, CapConfig.loadDefault(context))
        manager.cancelAll()
        if (!allowed) { store.write("reminder-plan", "[]"); return 0 }
        manager.createNotificationChannel()
        val used = mutableSetOf<Int>()
        val requests = future.map { reminder ->
            // Derselbe Zeitpunkt erhält auf App- und Worker-Weg dieselbe Nummer.
            var id = ("${reminder.getString("taskId")}|${reminder.getString("at")}".hashCode() and 0x3fffffff) + 1
            while (!used.add(id)) id++
            val data = JSObject().put("id", id).put("title", reminder.getString("title")).put("body", reminder.getString("body"))
                .put("schedule", JSONObject().put("at", reminder.getString("at")).put("allowWhileIdle", true))
                .put("isExactNotification", false).put("extra", JSONObject().put("taskId", reminder.getString("taskId")))
            LocalNotification.buildNotificationFromJSObject(JSObject(data.toString()))
        }
        check(manager.schedule(null, requests) != null) { "Reminder scheduling failed" }
        storage.appendNotifications(requests)
        store.write("reminder-plan", desired)
        return future.size
    }
    fun cancelAccount(context: Context) {
        LocalNotificationManager(NotificationStorage(context), null, context, CapConfig.loadDefault(context)).cancelAll()
        WidgetStore.get(context).write("reminder-plan", "[]")
    }
}
