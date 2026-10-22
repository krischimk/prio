package de.krischi.prio.widget

import android.content.Context
import androidx.work.*
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean

class WidgetHttpError(val status: Int) : Exception("Widget HTTP $status")
internal fun widgetPost(url: String, body: JSONObject, headers: Map<String, String>): JSONObject {
    val connection = URL(url).openConnection() as HttpURLConnection
    try {
        connection.requestMethod = "POST"; connection.connectTimeout = 15000; connection.readTimeout = 25000
        connection.instanceFollowRedirects = false; connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }
        connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        if (connection.responseCode !in 200..299) throw WidgetHttpError(connection.responseCode)
        val bytes = connection.inputStream.use { input ->
            val output = ByteArrayOutputStream(); val buffer = ByteArray(8192)
            while (true) { val count = input.read(buffer); if (count < 0) break; check(output.size() + count <= 16 * 1024 * 1024) { "Widget response too large" }; output.write(buffer, 0, count) }
            output.toByteArray()
        }
        return JSONObject(String(bytes, Charsets.UTF_8))
    } finally { connection.disconnect() }
}

class WidgetWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        requested.set(false)
        val context = applicationContext; val store = WidgetStore.get(context)
        return try {
            WidgetLocks.with("queue") {
                val session = WidgetLocks.with("auth") { session(context, store) } ?: return@with Result.success()
                val userId = session.getJSONObject("user").getString("id")
                val endpoint = JSONObject(store.read("backend") ?: return@with Result.success()).getString("endpoint")
                val response = widgetPost(endpoint, JSONObject().put("protocol", WidgetContract.PROTOCOL).put("timeZone", TimeZone.getDefault().id)
                    .put("commands", JSONArray(store.commands(userId).take(100))), mapOf("Authorization" to "Bearer ${session.getString("access_token")}"))
                // Eine Antwort des vorherigen Kontos darf nach einem Logout nie erscheinen.
                if (WidgetSession.user(context) == userId) {
                    store.acceptResponse(userId, response)
                    WidgetNotifications.replace(context, response.getJSONObject("snapshot").array("reminders"))
                    runBlocking { PrioWidget().updateAll(context) }
                }
                if (store.commands(userId).size >= 100) Result.retry() else Result.success()
            }
        } catch (error: Exception) {
            store.write("error", if (error is WidgetHttpError && error.status in listOf(400, 401, 403)) "auth" else "offline")
            runBlocking { PrioWidget().updateAll(context) }
            if (error is WidgetHttpError && error.status in listOf(400, 401, 403)) Result.failure() else Result.retry()
        }
    }
    private fun session(context: Context, store: WidgetStore): JSONObject? {
        val all = WidgetSession.read(context)
        var session = all.text("prio.auth")?.let(::JSONObject) ?: return null
        if (session.optLong("expires_at") <= System.currentTimeMillis() / 1000 + 90) {
            val backend = JSONObject(store.read("backend") ?: return null)
            session = widgetPost("${backend.getString("url")}/auth/v1/token?grant_type=refresh_token",
                JSONObject().put("refresh_token", session.getString("refresh_token")), mapOf("apikey" to backend.getString("publishableKey")))
            if (!session.has("expires_at")) session.put("expires_at", System.currentTimeMillis() / 1000 + session.getLong("expires_in"))
            all.put("prio.auth", session.toString()); WidgetSession.write(context, all)
        }
        return session
    }
    companion object {
        private val requested = AtomicBoolean(false)
        fun schedule(context: Context) {
            val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("prio-widget-periodic", ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<WidgetWorker>(15, TimeUnit.MINUTES).setConstraints(constraints).build())
        }
        fun request(context: Context) {
            if (!requested.compareAndSet(false, true)) return
            // Ein laufender Auftrag bleibt bestehen, genau ein Folgedurchlauf ist
            // durch APPEND_OR_REPLACE gesichert; Netzwerk läuft nie im Receiver.
            WorkManager.getInstance(context).enqueueUniqueWork("prio-widget-refresh", ExistingWorkPolicy.APPEND_OR_REPLACE,
                OneTimeWorkRequestBuilder<WidgetWorker>().setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
        }
    }
}
