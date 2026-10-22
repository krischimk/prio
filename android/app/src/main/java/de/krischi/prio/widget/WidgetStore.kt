package de.krischi.prio.widget

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.MutableStateFlow

internal fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
internal fun JSONObject.array(key: String): JSONArray = optJSONArray(key) ?: JSONArray()
internal fun JSONObject.text(key: String): String? = if (isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

/** Alle veränderlichen Widget-Daten liegen dauerhaft in SQLite, nie in Glance. */
class WidgetStore private constructor(context: Context) : SQLiteOpenHelper(context, "prio-widget.db", null, 1) {
    val revision = MutableStateFlow(0L)
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE state (key TEXT PRIMARY KEY,value TEXT NOT NULL)")
        db.execSQL("CREATE TABLE outbox (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,task_id TEXT NOT NULL,body TEXT NOT NULL)")
        db.execSQL("CREATE TABLE configs (id INTEGER PRIMARY KEY,body TEXT NOT NULL)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    @Synchronized fun read(key: String): String? = readableDatabase.rawQuery("SELECT value FROM state WHERE key=?", arrayOf(key)).use { if (it.moveToFirst()) it.getString(0) else null }
    @Synchronized fun write(key: String, value: String) { writableDatabase.insertWithOnConflict("state", null, ContentValues().apply { put("key", key); put("value", value) }, SQLiteDatabase.CONFLICT_REPLACE); revision.value++ }
    @Synchronized fun snapshot(): JSONObject = JSONObject(read("snapshot") ?: "{}")
    @Synchronized fun publish(snapshot: JSONObject) {
        require(snapshot.optInt("protocol") == WidgetContract.PROTOCOL)
        write("snapshot", snapshot.toString())
    }
    @Synchronized fun clearAccount() {
        writableDatabase.beginTransaction()
        try { writableDatabase.delete("outbox", null, null); writableDatabase.delete("state", "key IN ('snapshot','error')", null); writableDatabase.setTransactionSuccessful() }
        finally { writableDatabase.endTransaction(); revision.value++ }
    }
    @Synchronized fun config(id: Int): JSONObject? = readableDatabase.rawQuery("SELECT body FROM configs WHERE id=?", arrayOf(id.toString())).use { if (it.moveToFirst()) JSONObject(it.getString(0)) else null }
    @Synchronized fun configure(id: Int, config: JSONObject) { writableDatabase.insertWithOnConflict("configs", null, ContentValues().apply { put("id", id); put("body", config.toString()) }, SQLiteDatabase.CONFLICT_REPLACE); revision.value++ }
    @Synchronized fun removeConfig(id: Int) { writableDatabase.delete("configs", "id=?", arrayOf(id.toString())) }
    @Synchronized fun enqueue(userId: String, taskId: String, now: String = Instant.now().toString(), checklist: JSONObject? = null): JSONObject {
        require(snapshot().optString("userId") == userId)
        val existing = commands(userId).lastOrNull { it.getString("taskId") == taskId && it.optJSONObject("checklist")?.text("id") == checklist?.text("id") }
        if (existing != null && (checklist == null || existing.getJSONObject("checklist").getBoolean("completed") == checklist.getBoolean("completed"))) return existing
        val command = JSONObject().put("id", UUID.randomUUID().toString()).put("userId", userId).put("taskId", taskId).put("at", now)
        checklist?.let { command.put("checklist", it) }
        snapshot().optJSONObject("local")?.optJSONObject(taskId)?.let { command.put("local", it) }
        // Erst fsync/SQLite-Bestätigung, dann wird das Kästchen neu gezeichnet.
        writableDatabase.insertOrThrow("outbox", null, ContentValues().apply { put("id", command.getString("id")); put("user_id", userId); put("task_id", taskId); put("body", command.toString()) })
        revision.value++
        return command
    }
    @Synchronized fun commands(userId: String): List<JSONObject> = readableDatabase.rawQuery("SELECT body FROM outbox WHERE user_id=? ORDER BY rowid", arrayOf(userId)).use { cursor -> buildList { while (cursor.moveToNext()) add(JSONObject(cursor.getString(0))) } }
    @Synchronized fun acknowledge(id: String, userId: String) { writableDatabase.delete("outbox", "id=? AND user_id=?", arrayOf(id, userId)); revision.value++ }
    @Synchronized fun acceptResponse(userId: String, response: JSONObject) {
        require(response.getJSONObject("snapshot").getString("userId") == userId)
        writableDatabase.beginTransaction()
        try {
            // Anzeige und Quittungen werden zusammen festgeschrieben.
            publish(response.getJSONObject("snapshot"))
            response.array("acknowledged").let { ids -> for (i in 0 until ids.length()) acknowledge(ids.getString(i), userId) }
            write("error", if (response.array("conflicts").length() > 0) "conflict" else "")
            writableDatabase.setTransactionSuccessful()
        } finally { writableDatabase.endTransaction() }
    }
    companion object {
        @Volatile private var instance: WidgetStore? = null
        @JvmStatic fun get(context: Context): WidgetStore = instance ?: synchronized(this) { instance ?: WidgetStore(context.applicationContext).also { instance = it } }
        internal fun resetForTest() = synchronized(this) { instance?.close(); instance = null }
    }
}

/** SDK und Worker besitzen jeweils höchstens eine Lease; kein paralleles Refresh. */
object WidgetLocks {
    private val semaphores = mapOf("auth" to Semaphore(1, true), "queue" to Semaphore(1, true))
    private val leases = mutableMapOf<String, String>()
    fun acquire(name: String, timeoutMs: Long = 30000): String {
        require(name in semaphores)
        check(semaphores.getValue(name).tryAcquire(timeoutMs.coerceAtLeast(1), TimeUnit.MILLISECONDS)) { "Widget lock timeout" }
        return UUID.randomUUID().toString().also { synchronized(leases) { leases[it] = name } }
    }
    fun release(lease: String) { synchronized(leases) { leases.remove(lease) }?.let { semaphores.getValue(it).release() } }
    fun <T> with(name: String, block: () -> T): T { val lease = acquire(name); try { return block() } finally { release(lease) } }
}
