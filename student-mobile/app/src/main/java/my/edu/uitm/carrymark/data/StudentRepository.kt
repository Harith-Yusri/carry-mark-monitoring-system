package my.edu.uitm.carrymark.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.SignOutScope
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import my.edu.uitm.carrymark.model.StudentPortalPayload

class StudentRepository {
    private val client = SupabaseProvider.client

    fun hasSession(): Boolean = client.auth.currentSessionOrNull() != null

    suspend fun awaitSession(): Boolean {
        client.auth.awaitInitialization()
        return hasSession()
    }

    suspend fun signIn(studentId: String, password: String, keepSignedIn: Boolean) {
        val normalizedId = studentId.trim().lowercase()
        SupabaseProvider.sessionManager.setPersistenceEnabled(keepSignedIn)
        try {
            client.auth.signInWith(Email) {
                email = "$normalizedId@student.uitm.edu.my"
                this.password = password
            }
            SupabaseProvider.sessionManager.recordActivity()
        } catch (error: Throwable) {
            client.auth.clearSession()
            throw error
        }
    }

    suspend fun signOut() {
        try {
            client.auth.signOut(SignOutScope.LOCAL)
        } finally {
            // Guarantees removal of both memory-only and encrypted saved data,
            // even when the network request to revoke the session fails.
            client.auth.clearSession()
        }
    }

    suspend fun loadPortal(): StudentPortalPayload {
        requireActiveSession()
        return client.postgrest.rpc("get_my_mobile_portal").decodeAs<StudentPortalPayload>()
            .also { SupabaseProvider.sessionManager.recordActivity() }
    }

    suspend fun joinClass(code: String) {
        requireActiveSession()
        client.postgrest.rpc(
            function = "join_class_by_code",
            parameters = buildJsonObject { put("invitation_code", code.trim()) }
        )
        SupabaseProvider.sessionManager.recordActivity()
    }

    suspend fun submitDispute(offeringId: String, assessment: String, explanation: String) {
        requireActiveSession()
        client.postgrest.rpc(
            function = "submit_mark_dispute",
            parameters = buildJsonObject {
                put("target_offering", offeringId)
                put("target_assessment", assessment.trim())
                put("target_explanation", explanation.trim())
            }
        )
        SupabaseProvider.sessionManager.recordActivity()
    }

    private suspend fun requireActiveSession() {
        if (SupabaseProvider.sessionManager.expireIfInactive()) {
            client.auth.clearSession()
            throw IllegalStateException("Your session expired after 7 days of inactivity. Please sign in again.")
        }
        if (!hasSession()) {
            throw IllegalStateException("Your session has expired. Please sign in again.")
        }
    }
}
