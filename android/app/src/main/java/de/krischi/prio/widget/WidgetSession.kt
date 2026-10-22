package de.krischi.prio.widget

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

/** Sitzung im Android Keystore verschlüsselt, vom Gerätebackup ausgeschlossen. */
object WidgetSession {
    private const val alias = "prio-widget-session-v1"
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Synchronized fun read(context: Context): JSONObject {
        val file = AtomicFile(File(context.noBackupFilesDir, "prio-session.enc"))
        if (!file.baseFile.exists()) return JSONObject()
        val stored = JSONObject(String(file.readFully(), Charsets.UTF_8))
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(stored.getString("iv"), Base64.NO_WRAP)))
        return JSONObject(String(cipher.doFinal(Base64.decode(stored.getString("body"), Base64.NO_WRAP)), Charsets.UTF_8))
    }
    @Synchronized fun write(context: Context, value: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val json = JSONObject().put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .put("body", Base64.encodeToString(cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8)), Base64.NO_WRAP))
        val file = AtomicFile(File(context.noBackupFilesDir, "prio-session.enc")); val output = file.startWrite()
        try { output.write(json.toString().toByteArray(Charsets.UTF_8)); file.finishWrite(output) } catch (error: Throwable) { file.failWrite(output); throw error }
    }
    fun user(context: Context): String? = read(context).text("prio.auth")?.let { JSONObject(it).optJSONObject("user")?.text("id") }
}
