package my.edu.uitm.carrymark.data

import android.content.Context
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import my.edu.uitm.carrymark.BuildConfig

object SupabaseProvider {
    lateinit var client: SupabaseClient
        private set

    lateinit var sessionManager: SecureSessionManager
        private set

    fun initialize(context: Context) {
        if (::client.isInitialized) return
        sessionManager = SecureSessionManager(context.applicationContext)
        client = createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY
        ) {
            install(Auth) {
                alwaysAutoRefresh = true
                autoLoadFromStorage = true
                autoSaveToStorage = true
                sessionManager = SupabaseProvider.sessionManager
            }
            install(Postgrest)
        }
    }
}
