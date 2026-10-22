package de.krischi.prio.widget

import android.security.keystore.KeyGenParameterSpec
import java.io.InputStream
import java.io.OutputStream
import java.security.Key
import java.security.KeyStoreSpi
import java.security.Provider
import java.security.SecureRandom
import java.security.cert.Certificate
import java.security.spec.AlgorithmParameterSpec
import java.util.Collections
import java.util.Date
import javax.crypto.KeyGenerator
import javax.crypto.KeyGeneratorSpi
import javax.crypto.SecretKey

/** Nur das Geräte-Schlüsselverzeichnis wird ersetzt; die Sitzungsverschlüsselung läuft echt. */
class TestKeyStore : Provider("AndroidKeyStore", 1.0, "In-memory Android keystore for native tests") {
    init {
        put("KeyStore.AndroidKeyStore", Store::class.java.name)
        put("KeyGenerator.AES", Generator::class.java.name)
    }
    companion object { val keys = mutableMapOf<String, SecretKey>() }
    class Generator : KeyGeneratorSpi() {
        private lateinit var alias: String
        override fun engineInit(parameters: AlgorithmParameterSpec, random: SecureRandom?) { alias = (parameters as KeyGenParameterSpec).keystoreAlias }
        override fun engineInit(random: SecureRandom?) = error("Alias required")
        override fun engineInit(size: Int, random: SecureRandom?) = error("Alias required")
        override fun engineGenerateKey(): SecretKey = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey().also { keys[alias] = it }
    }
    class Store : KeyStoreSpi() {
        override fun engineGetKey(alias: String, password: CharArray?): Key? = keys[alias]
        override fun engineGetCertificateChain(alias: String): Array<Certificate>? = null
        override fun engineGetCertificate(alias: String): Certificate? = null
        override fun engineGetCreationDate(alias: String): Date? = if (keys.containsKey(alias)) Date(0) else null
        override fun engineSetKeyEntry(alias: String, key: Key, password: CharArray?, chain: Array<out Certificate>?) { keys[alias] = key as SecretKey }
        override fun engineSetKeyEntry(alias: String, key: ByteArray, chain: Array<out Certificate>?) = error("Unsupported key encoding")
        override fun engineSetCertificateEntry(alias: String, certificate: Certificate) = error("Not a certificate store")
        override fun engineDeleteEntry(alias: String) { keys.remove(alias) }
        override fun engineAliases() = Collections.enumeration(keys.keys)
        override fun engineContainsAlias(alias: String) = keys.containsKey(alias)
        override fun engineSize() = keys.size
        override fun engineIsKeyEntry(alias: String) = keys.containsKey(alias)
        override fun engineIsCertificateEntry(alias: String) = false
        override fun engineGetCertificateAlias(certificate: Certificate): String? = null
        override fun engineStore(stream: OutputStream?, password: CharArray?) = Unit
        override fun engineLoad(stream: InputStream?, password: CharArray?) = Unit
    }
}
