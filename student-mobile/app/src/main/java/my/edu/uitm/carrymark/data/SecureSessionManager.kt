package my.edu.uitm.carrymark.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private const val SESSION_PREFERENCES = "carrymark_secure_auth"
private const val ENCRYPTED_SESSION_KEY = "encrypted_supabase_session"
private const val KEY_ALIAS = "carrymark_supabase_session_key"
private const val TRANSFORMATION = "AES/GCM/NoPadding"
private const val INACTIVITY_LIMIT_MS = 7L * 24 * 60 * 60 * 1000

@Serializable
private data class StoredSession(
    val session: UserSession,
    val lastActivityEpochMillis: Long
)

/**
 * Keeps the live Supabase session in memory and, only when requested by the
 * user, stores its access/refresh tokens encrypted with an Android Keystore key.
 */
class SecureSessionManager(context: Context) : SessionManager {
    private val preferences = context.applicationContext.getSharedPreferences(
        SESSION_PREFERENCES,
        Context.MODE_PRIVATE
    )
    private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
    private var memorySession: UserSession? = null
    private var lastActivityEpochMillis: Long? = null
    private var persistenceEnabled = preferences.contains(ENCRYPTED_SESSION_KEY)

    @Synchronized
    fun setPersistenceEnabled(enabled: Boolean) {
        persistenceEnabled = enabled
        if (!enabled) {
            preferences.edit().remove(ENCRYPTED_SESSION_KEY).apply()
        } else {
            persistMemorySession()
        }
    }

    @Synchronized
    fun recordActivity() {
        if (memorySession == null) return
        lastActivityEpochMillis = System.currentTimeMillis()
        persistMemorySession()
    }

    @Synchronized
    fun expireIfInactive(): Boolean {
        if (memorySession == null || !isInactive(lastActivityEpochMillis)) return false
        clearAll()
        return true
    }

    override suspend fun saveSession(session: UserSession) {
        synchronized(this) {
            memorySession = session
            if (lastActivityEpochMillis == null) {
                lastActivityEpochMillis = System.currentTimeMillis()
            }
            persistMemorySession()
        }
    }

    override suspend fun loadSession(): UserSession? {
        return synchronized(this) {
            memorySession?.let { session ->
                if (isInactive(lastActivityEpochMillis)) {
                    clearAll()
                    return@synchronized null
                }
                return@synchronized session
            }

            val encrypted = preferences.getString(ENCRYPTED_SESSION_KEY, null)
                ?: return@synchronized null
            val stored = runCatching { json.decodeFromString<StoredSession>(decrypt(encrypted)) }
                .getOrElse {
                    clearAll()
                    return@synchronized null
                }
            if (isInactive(stored.lastActivityEpochMillis)) {
                clearAll()
                return@synchronized null
            }
            persistenceEnabled = true
            memorySession = stored.session
            lastActivityEpochMillis = stored.lastActivityEpochMillis
            stored.session
        }
    }

    override suspend fun deleteSession() {
        synchronized(this) { clearAll() }
    }

    @Synchronized
    private fun persistMemorySession() {
        val session = memorySession ?: return
        val lastActivity = lastActivityEpochMillis ?: return
        if (!persistenceEnabled) return
        val encoded = json.encodeToString(StoredSession(session, lastActivity))
        preferences.edit().putString(ENCRYPTED_SESSION_KEY, encrypt(encoded)).apply()
    }

    private fun isInactive(lastActivity: Long?): Boolean {
        if (lastActivity == null) return true
        val now = System.currentTimeMillis()
        return now < lastActivity || now - lastActivity >= INACTIVITY_LIMIT_MS
    }

    private fun clearAll() {
        memorySession = null
        lastActivityEpochMillis = null
        persistenceEnabled = false
        preferences.edit().remove(ENCRYPTED_SESSION_KEY).apply()
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val initializationVector = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
        val encryptedValue = Base64.encodeToString(
            cipher.doFinal(value.toByteArray(Charsets.UTF_8)),
            Base64.NO_WRAP
        )
        return "$initializationVector:$encryptedValue"
    }

    private fun decrypt(value: String): String {
        val parts = value.split(':', limit = 2)
        require(parts.size == 2) { "Invalid encrypted session." }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            getOrCreateKey(),
            GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP))
        )
        return cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)).toString(Charsets.UTF_8)
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build()
            )
            generateKey()
        }
    }
}
