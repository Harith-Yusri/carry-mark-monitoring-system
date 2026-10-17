package my.edu.uitm.carrymark

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import my.edu.uitm.carrymark.data.StudentRepository
import my.edu.uitm.carrymark.model.Student
import my.edu.uitm.carrymark.model.SubjectResult
import my.edu.uitm.carrymark.model.StudentNotification

data class StudentUiState(
    val loading: Boolean = false,
    val student: Student? = null,
    val subjects: List<SubjectResult> = emptyList(),
    val notifications: List<StudentNotification> = emptyList(),
    val notificationsEnabled: Boolean? = null,
    val error: String? = null,
    val actionLoading: Boolean = false
)

class StudentViewModel(
    private val repository: StudentRepository = StudentRepository()
) : ViewModel() {
    private val _state = MutableStateFlow(StudentUiState(loading = true))
    val state: StateFlow<StudentUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            runCatching {
                if (!repository.awaitSession()) return@runCatching null
                repository.loadPortal().also { payload ->
                    if (payload.student == null) repository.signOut()
                }
            }.onSuccess { payload ->
                _state.value = if (payload?.student != null) {
                    StudentUiState(
                        student = payload.student,
                        subjects = payload.subjects,
                        notifications = payload.notifications,
                        notificationsEnabled = payload.notificationsEnabled
                    )
                } else {
                    StudentUiState()
                }
            }.onFailure { error ->
                _state.value = StudentUiState(error = friendlyMessage(error))
            }
        }
    }

    fun clearError() {
        _state.update { it.copy(error = null) }
    }

    fun signIn(
        studentId: String,
        password: String,
        keepSignedIn: Boolean,
        onSuccess: () -> Unit
    ) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            runCatching {
                repository.signIn(studentId, password, keepSignedIn)
                repository.loadPortal()
            }.onSuccess { payload ->
                if (payload.student == null) {
                    repository.signOut()
                    _state.value = StudentUiState(
                        error = "This login is not linked to an active student account."
                    )
                } else {
                    _state.value = StudentUiState(
                        student = payload.student,
                        subjects = payload.subjects,
                        notifications = payload.notifications,
                        notificationsEnabled = payload.notificationsEnabled
                    )
                    onSuccess()
                }
            }.onFailure { error ->
                runCatching { repository.signOut() }
                _state.value = StudentUiState(error = friendlyMessage(error))
            }
        }
    }

    fun refresh() {
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            runCatching { repository.loadPortal() }
                .onSuccess { payload ->
                    if (payload.student == null) {
                        repository.signOut()
                        _state.value = StudentUiState(
                            error = "Your student profile could not be found. Please contact the administrator."
                        )
                    } else {
                        _state.update {
                            it.copy(
                                loading = false,
                                student = payload.student,
                                subjects = payload.subjects,
                                notifications = payload.notifications,
                                notificationsEnabled = payload.notificationsEnabled
                            )
                        }
                    }
                }
                .onFailure { error ->
                    _state.value = if (repository.hasSession()) {
                        _state.value.copy(loading = false, error = friendlyMessage(error))
                    } else {
                        StudentUiState(error = friendlyMessage(error))
                    }
                }
        }
    }

    fun joinClass(code: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _state.update { it.copy(actionLoading = true, error = null) }
            runCatching {
                repository.joinClass(code)
                repository.loadPortal()
            }.onSuccess { payload ->
                _state.update {
                    it.copy(
                        actionLoading = false,
                        student = payload.student,
                        subjects = payload.subjects,
                        notifications = payload.notifications,
                        notificationsEnabled = payload.notificationsEnabled
                    )
                }
                onSuccess()
            }.onFailure { error ->
                if (BuildConfig.DEBUG) Log.e("StudentViewModel", "Join class failed", error)
                _state.value = if (repository.hasSession()) {
                    _state.value.copy(actionLoading = false, error = joinClassMessage(error))
                } else {
                    StudentUiState(error = joinClassMessage(error))
                }
            }
        }
    }

    fun submitDispute(
        subject: SubjectResult,
        assessment: String,
        explanation: String,
        onSuccess: () -> Unit
    ) {
        viewModelScope.launch {
            _state.update { it.copy(actionLoading = true, error = null) }
            runCatching {
                require(subject.offeringId.isNotBlank()) { "This subject is missing its database reference." }
                repository.submitDispute(subject.offeringId, assessment, explanation)
            }.onSuccess {
                _state.update { it.copy(actionLoading = false) }
                onSuccess()
            }.onFailure { error ->
                _state.value = if (repository.hasSession()) {
                    _state.value.copy(actionLoading = false, error = friendlyMessage(error))
                } else {
                    StudentUiState(error = friendlyMessage(error))
                }
            }
        }
    }

    fun signOut(onComplete: () -> Unit) {
        viewModelScope.launch {
            runCatching { repository.signOut() }
            _state.value = StudentUiState()
            onComplete()
        }
    }

    private fun friendlyMessage(error: Throwable): String {
        val message = error.message.orEmpty()
        return when {
            message.contains("invalid_credentials", ignoreCase = true) ||
                message.contains("Invalid login credentials", ignoreCase = true) ->
                "Invalid Student ID or password."
            message.contains("already enrolled", ignoreCase = true) ->
                "You are already enrolled in this subject."
            message.contains("class is full", ignoreCase = true) ->
                "This class is full."
            message.contains("invitation code", ignoreCase = true) ->
                "The class code is invalid or inactive."
            message.contains("network", ignoreCase = true) ||
                message.contains("Unable to resolve host", ignoreCase = true) ->
                "Unable to connect. Check your internet connection and try again."
            message.contains("session expired", ignoreCase = true) ||
                message.contains("not authenticated", ignoreCase = true) ->
                "Your session has expired. Please sign in again."
            else -> "Something went wrong. Please try again."
        }
    }

    private fun joinClassMessage(error: Throwable): String {
        val message = error.message.orEmpty()
        return when {
            message.contains("different programme", ignoreCase = true) ||
                message.contains("same programme", ignoreCase = true) ||
                message.contains("student and class must belong", ignoreCase = true) ->
                "You cannot join this class because it belongs to a different programme."
            message.contains("already enrolled", ignoreCase = true) ->
                "You are already enrolled in this subject."
            message.contains("class is full", ignoreCase = true) ->
                "This class is full. Please contact your lecturer."
            message.contains("invitation code", ignoreCase = true) ||
                message.contains("class code", ignoreCase = true) ->
                "The class code is invalid or inactive."
            message.contains("session expired", ignoreCase = true) ||
                message.contains("not authenticated", ignoreCase = true) ->
                "Your session has expired. Please sign in again."
            message.contains("network", ignoreCase = true) ||
                message.contains("Unable to resolve host", ignoreCase = true) ||
                message.contains("timeout", ignoreCase = true) ->
                "Unable to connect. Check your internet connection and try again."
            else -> "Unable to join this class. Check the class code and try again."
        }
    }
}
