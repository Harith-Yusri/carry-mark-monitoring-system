package my.edu.uitm.carrymark

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.tooling.preview.Preview
import androidx.core.graphics.toColorInt
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import my.edu.uitm.carrymark.model.Assessment
import my.edu.uitm.carrymark.model.Student
import my.edu.uitm.carrymark.model.SubjectResult
import my.edu.uitm.carrymark.model.StudentNotification
import my.edu.uitm.carrymark.data.SupabaseProvider
import my.edu.uitm.carrymark.ui.theme.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SupabaseProvider.initialize(applicationContext)
        enableEdgeToEdge()
        setContent { StudentApp() }
    }
}

private sealed interface Screen {
    data object Login : Screen
    data object Dashboard : Screen
    data object Progress : Screen
    data object Settings : Screen
    data class Detail(val subject: SubjectResult) : Screen
    data class Dispute(val subject: SubjectResult) : Screen
}

@Composable
private fun StudentApp() {
    val isDarkMode = remember { mutableStateOf(true) }
    val studentViewModel: StudentViewModel = viewModel()
    val uiState by studentViewModel.state.collectAsStateWithLifecycle()
    CarryMarkTheme(darkTheme = isDarkMode.value) {
        val screen = remember {
            mutableStateOf<Screen>(if (uiState.student != null) Screen.Dashboard else Screen.Login)
        }
        LaunchedEffect(uiState.student) {
            if (uiState.student != null && screen.value == Screen.Login) {
                screen.value = Screen.Dashboard
            } else if (uiState.student == null && screen.value != Screen.Login) {
                screen.value = Screen.Login
            }
        }
        LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
            if (uiState.student != null) studentViewModel.refresh()
        }
        when (val current = screen.value) {
            Screen.Login -> LoginScreen(
                isLoading = uiState.loading,
                serverError = uiState.error,
                onClearError = studentViewModel::clearError,
                onLogin = { matrix, password, keepSignedIn ->
                    studentViewModel.signIn(matrix, password, keepSignedIn) {
                        screen.value = Screen.Dashboard
                    }
                }
            )
            Screen.Dashboard -> DashboardScreen(
                student = uiState.student,
                subjects = uiState.subjects,
                notifications = uiState.notifications,
                actionLoading = uiState.actionLoading,
                actionError = uiState.error,
                onClearError = studentViewModel::clearError,
                onJoinClass = { code, onSuccess -> studentViewModel.joinClass(code, onSuccess) },
                onSubject = { screen.value = Screen.Detail(it) },
                onNavigate = { screen.value = it }
            )
            Screen.Progress -> ProgressScreen(
                subjects = uiState.subjects,
                onNavigate = { screen.value = it }
            )
            Screen.Settings -> SettingsScreen(
                student = uiState.student,
                notificationsEnabled = uiState.notificationsEnabled,
                isDarkMode = isDarkMode.value,
                onToggleDarkMode = { isDarkMode.value = !isDarkMode.value },
                onNavigate = { screen.value = it },
                onLogout = {
                    studentViewModel.signOut { screen.value = Screen.Login }
                }
            )
            is Screen.Detail -> DetailScreen(
                subject = current.subject,
                onBack = { screen.value = Screen.Dashboard },
                onDispute = { screen.value = Screen.Dispute(current.subject) }
            )
            is Screen.Dispute -> DisputeScreen(
                subject = current.subject,
                isSubmitting = uiState.actionLoading,
                serverError = uiState.error,
                onClearError = studentViewModel::clearError,
                onBack = { screen.value = Screen.Detail(current.subject) },
                onSubmit = { assessment, explanation, onSuccess ->
                    studentViewModel.submitDispute(
                        current.subject,
                        assessment,
                        explanation,
                        onSuccess
                    )
                },
                onSubmitted = { screen.value = Screen.Detail(current.subject) }
            )
        }
    }
}

@Composable
private fun LoginScreen(
    isLoading: Boolean,
    serverError: String?,
    onClearError: () -> Unit,
    onLogin: (String, String, Boolean) -> Unit
) {
    var matrix by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Surface(
        color = MaterialTheme.colorScheme.background,
        modifier = Modifier.fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp)
        ) {
            Spacer(Modifier.height(8.dp))
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    color = MaterialTheme.colorScheme.primary,
                    shape = MaterialTheme.shapes.large,
                    modifier = Modifier.size(48.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.School,
                            null,
                            tint = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
                Spacer(Modifier.width(16.dp))
                Column {
                    Text(
                        "UiTM Carry Mark",
                        color = MaterialTheme.colorScheme.onBackground,
                        style = MaterialTheme.typography.titleLarge
                    )
                    Text(
                        "Student Portal",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            Spacer(Modifier.height(48.dp))

            Text(
                "Welcome Back",
                color = MaterialTheme.colorScheme.onBackground,
                style = MaterialTheme.typography.displayLarge
            )
            Text(
                "Sign in with your UiTM Student ID",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge
            )

            Spacer(Modifier.height(40.dp))

            // Student ID Field
            Text(
                "STUDENT ID",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium,
                letterSpacing = 1.sp
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = matrix,
                onValueChange = { matrix = it; errorMessage = null; onClearError() },
                placeholder = { 
                    Text(
                        "Enter your Student ID",
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                        style = MaterialTheme.typography.bodyLarge
                    ) 
                },
                textStyle = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = Color.Transparent,
                    focusedTextColor = MaterialTheme.colorScheme.onSurface,
                    unfocusedTextColor = MaterialTheme.colorScheme.onSurface
                ),
                shape = MaterialTheme.shapes.small
            )

            Spacer(Modifier.height(24.dp))

            // Password Field
            Text(
                "PASSWORD",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium,
                letterSpacing = 1.sp
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it; errorMessage = null; onClearError() },
                placeholder = { 
                    Text(
                        "••••••••", 
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                        style = MaterialTheme.typography.bodyLarge
                    ) 
                },
                textStyle = MaterialTheme.typography.bodyLarge,
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = Color.Transparent,
                    focusedTextColor = MaterialTheme.colorScheme.onSurface,
                    unfocusedTextColor = MaterialTheme.colorScheme.onSurface
                ),
                shape = MaterialTheme.shapes.small
            )

            Spacer(Modifier.height(16.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = rememberMe,
                    onCheckedChange = { rememberMe = it },
                    colors = CheckboxDefaults.colors(
                        checkedColor = MaterialTheme.colorScheme.primary,
                        uncheckedColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        checkmarkColor = Color.White
                    )
                )
                Text(
                    "Keep me signed in",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(start = 4.dp)
                )
            }

            if (errorMessage != null || serverError != null) {
                Spacer(Modifier.height(8.dp))
                Text(
                    errorMessage ?: serverError.orEmpty(),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Spacer(Modifier.height(32.dp))

            Button(
                onClick = {
                    if (matrix.isBlank() || password.isBlank()) {
                        errorMessage = "Please enter your Student ID and password"
                    } else {
                        onLogin(matrix, password, rememberMe)
                    }
                },
                enabled = !isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = MaterialTheme.shapes.medium,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.AutoMirrored.Filled.Login, null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            "Login",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            Text(
                "Forgot password? Contact your faculty administrator.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )

            Spacer(Modifier.weight(1f))
            Spacer(Modifier.height(24.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DashboardScreen(
    student: Student?,
    subjects: List<SubjectResult>,
    notifications: List<StudentNotification>,
    actionLoading: Boolean,
    actionError: String?,
    onClearError: () -> Unit,
    onJoinClass: (String, () -> Unit) -> Unit,
    onSubject: (SubjectResult) -> Unit,
    onNavigate: (Screen) -> Unit
) {
    val showJoinDialog = remember { mutableStateOf(false) }
    val showNotificationDialog = remember { mutableStateOf(false) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            MainNavigationBar(selectedScreen = Screen.Dashboard, onNavigate = onNavigate)
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp)
        ) {
            Spacer(Modifier.height(24.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "My Subjects",
                        color = MaterialTheme.colorScheme.onBackground,
                        style = MaterialTheme.typography.headlineLarge
                    )
                    Text(
                        student?.semester.orEmpty(),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
                
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Button(
                        onClick = { showJoinDialog.value = true },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                        contentPadding = PaddingValues(horizontal = 12.dp),
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.height(40.dp)
                    ) {
                        Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Join Class", style = MaterialTheme.typography.labelLarge)
                    }
                    
                    Spacer(Modifier.width(12.dp))
                    
                    Box {
                        Surface(
                            onClick = { showNotificationDialog.value = true },
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            shape = MaterialTheme.shapes.large,
                            modifier = Modifier.size(48.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Default.NotificationsNone,
                                    null,
                                    tint = MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.size(24.dp)
                                )
                                if (notifications.isNotEmpty()) {
                                    Surface(
                                        color = MaterialTheme.colorScheme.primary,
                                        shape = CircleShape,
                                        modifier = Modifier.size(8.dp).align(Alignment.TopEnd).offset(x = (-12).dp, y = 12.dp)
                                    ) {}
                                }
                            }
                        }

                        DropdownMenu(
                            expanded = showNotificationDialog.value,
                            onDismissRequest = { showNotificationDialog.value = false },
                            modifier = Modifier
                                .width(320.dp)
                                .background(Color(0xFF131829), RoundedCornerShape(24.dp)),
                            containerColor = Color(0xFF131829),
                            shape = RoundedCornerShape(24.dp),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
                        ) {
                            NotificationDropdownContent(notifications)
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                items(subjects) { subject ->
                    SubjectCard(subject) { onSubject(subject) }
                }
                if (subjects.isEmpty()) {
                    item {
                        Text(
                            "You are not enrolled in any classes yet. Use Join Class when your lecturer provides an invitation code.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
    }

    if (showJoinDialog.value) {
        JoinClassDialog(
            isLoading = actionLoading,
            error = actionError,
            onClearError = onClearError,
            onJoin = { code ->
                onJoinClass(code) { showJoinDialog.value = false }
            },
            onDismiss = {
                onClearError()
                showJoinDialog.value = false
            }
        )
    }
}

@Composable
private fun NotificationDropdownContent(notifications: List<StudentNotification>) {
    val statusColors = LocalCarryMarkExtraColors.current
    Column(Modifier.padding(20.dp)) {
        Text(
            "NOTIFICATIONS",
            color = Color(0xFF6B7280),
            style = MaterialTheme.typography.labelMedium,
            letterSpacing = 1.sp
        )
        
        Spacer(Modifier.height(16.dp))
        
        if (notifications.isNotEmpty()) {
            notifications.take(5).forEach { notification ->
              Row(verticalAlignment = Alignment.Top, modifier = Modifier.padding(bottom = 16.dp)) {
                Icon(
                    Icons.Default.CheckCircle,
                    null,
                    tint = statusColors.success,
                    modifier = Modifier.size(20.dp).offset(y = 2.dp)
                )
                Spacer(Modifier.width(16.dp))
                Column {
                    Text(
                        notification.title,
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge,
                        lineHeight = 22.sp
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        notification.body,
                        color = Color(0xFF6B7280),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
              }
            }
        } else {
            Text(
                "No new notifications",
                color = Color(0xFF9CA3AF),
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun JoinClassDialog(
    isLoading: Boolean,
    error: String?,
    onClearError: () -> Unit,
    onJoin: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val academicTypography = LocalAcademicTypography.current
    val joinCode = remember { mutableStateOf("") }
    
    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        Surface(
            color = Color(0xFF131829), // Dark background as requested
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Join a Class",
                            color = Color.White,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Enter the code given by your lecturer",
                            color = Color(0xFF9CA3AF),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    Surface(
                        onClick = onDismiss,
                        color = Color.White.copy(alpha = 0.05f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.size(32.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Default.Close,
                                null,
                                tint = Color(0xFF9CA3AF),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                Spacer(Modifier.height(32.dp))

                Text(
                    "CLASS JOIN CODE",
                    color = Color(0xFF6B7280),
                    style = academicTypography.academicLabel,
                    letterSpacing = 1.sp
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = joinCode.value,
                    onValueChange = { joinCode.value = it; onClearError() },
                    placeholder = { 
                        Text(
                            "E.G. ITT-4X9", 
                            color = Color(0xFF4B5563),
                            style = academicTypography.academicMedium
                        ) 
                    },
                    textStyle = academicTypography.academicMedium.copy(color = Color.White),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        focusedBorderColor = Color(0xFF702082),
                        unfocusedBorderColor = Color(0xFF1F2937),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    shape = RoundedCornerShape(12.dp)
                )

                if (error != null) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        error,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                Spacer(Modifier.height(24.dp))

                Button(
                    onClick = { onJoin(joinCode.value) },
                    enabled = joinCode.value.isNotBlank() && !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF702082))
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.AutoMirrored.Filled.Login, null, modifier = Modifier.size(20.dp), tint = Color.White.copy(alpha = 0.7f))
                        Spacer(Modifier.width(8.dp))
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(
                                "Join Class",
                                color = Color.White,
                                style = MaterialTheme.typography.titleMedium
                            )
                        }
                    }
                }
            }
        }
    }
}


@Composable
private fun SubjectCard(subject: SubjectResult, onClick: () -> Unit) {
    val statusColors = LocalCarryMarkExtraColors.current
    Surface(
        onClick = onClick,
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        modifier = Modifier.fillMaxWidth(),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(Modifier.padding(20.dp)) {
            val academicTypography = LocalAcademicTypography.current
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            subject.code,
                            color = MaterialTheme.colorScheme.primary,
                            style = academicTypography.academicMedium
                        )
                        Spacer(Modifier.width(8.dp))
                        StatusTag(
                            if (subject.isFinalised) "FINALISED" else "PENDING",
                            if (subject.isFinalised) statusColors.success else statusColors.warning
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        subject.name,
                        color = MaterialTheme.colorScheme.onSurface,
                        style = MaterialTheme.typography.titleLarge
                    )
                    Text(
                        subject.lecturer,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                
                Column(horizontalAlignment = Alignment.End) {
                    if (subject.carryMark != null) {
                        Text(
                            "%.0f".format(subject.carryMark),
                            color = if (subject.isFinalised) statusColors.success else MaterialTheme.colorScheme.onSurface,
                            style = academicTypography.academicLarge
                        )
                        Text(
                            "/ ${subject.carryMaximum.toInt()}",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = academicTypography.academicMedium
                        )
                    } else {
                        Text(
                            "—",
                            color = MaterialTheme.colorScheme.onSurface,
                            style = academicTypography.academicLarge
                        )
                    }
                }
            }
            
            Spacer(Modifier.height(20.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    subject.lastUpdated?.take(10)?.let { "Updated $it" } ?: "No marks recorded",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = academicTypography.academicSmall
                )
                Icon(
                    Icons.Default.ChevronRight,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@Composable
private fun StatusTag(text: String, color: Color) {
    val academicTypography = LocalAcademicTypography.current
    Surface(
        color = color.copy(alpha = 0.2f),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(4.dp)
    ) {
        Text(
            text,
            color = color,
            style = academicTypography.academicLabel,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailScreen(subject: SubjectResult, onBack: () -> Unit, onDispute: () -> Unit) {
    val academicTypography = LocalAcademicTypography.current
    val statusColors = LocalCarryMarkExtraColors.current
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            Column(
                Modifier
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        onClick = onBack,
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = MaterialTheme.shapes.large,
                        modifier = Modifier.size(width = 84.dp, height = 40.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(Icons.Default.ChevronLeft, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(2.dp))
                            Text("Back", color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.labelLarge)
                        }
                    }
                    Text(subject.code, color = MaterialTheme.colorScheme.primary, style = academicTypography.academicMedium)
                }
                Spacer(Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom
                ) {
                    Column {
                        Text(subject.name, color = MaterialTheme.colorScheme.onBackground, style = MaterialTheme.typography.titleLarge)
                        Text(subject.lecturer, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item { CarryMarkMainCard(subject) }
            item {
                Spacer(Modifier.height(8.dp))
                Text(
                    "CONTINUOUS ASSESSMENT BREAKDOWN",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall,
                    letterSpacing = 1.sp
                )
            }
            items(subject.assessments) { assessment ->
                AssessmentRow(assessment)
            }
            item {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 8.dp)) {
                    Icon(Icons.Default.CheckCircle, null, tint = statusColors.success, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Graded", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.width(16.dp))
                    Icon(Icons.Default.Schedule, null, tint = statusColors.warning, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Pending", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
            item { EligibilityCard(subject) }
            
            if (subject.carryMark != null) {
                item {
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = onDispute, 
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurfaceVariant),
                        shape = MaterialTheme.shapes.medium,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Icon(Icons.Default.Flag, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Report a mark issue", style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        }
    }
}

@Composable
private fun CarryMarkMainCard(subject: SubjectResult) {
    val academicTypography = LocalAcademicTypography.current
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        modifier = Modifier.fillMaxWidth(),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.3f))
    ) {
        Row(
            modifier = Modifier.padding(24.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    if (subject.isFinalised) "FINALISED CARRY MARK" else "CARRY MARK (PENDING FINALISATION)",
                    color = if (subject.isFinalised) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                    letterSpacing = 0.5.sp
                )
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        subject.carryMark?.let { "%.0f".format(it) } ?: "—",
                        color = MaterialTheme.colorScheme.onSurface,
                        style = academicTypography.academicLarge.copy(fontSize = 48.sp, fontWeight = FontWeight.Bold)
                    )
                    Text(
                        " / ${subject.carryMaximum.toInt()}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = academicTypography.academicMedium,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                }
                Text(
                    if (subject.isFinalised) "Finalised carry mark · ${subject.carryMaximum.toInt()}% of final grade" else "Pending finalisation by lecturer",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Surface(
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                shape = CircleShape,
                modifier = Modifier.size(64.dp),
                border = BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        if (subject.isFinalised) Icons.Default.BarChart else Icons.Default.Lock,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun AssessmentRow(assessment: Assessment) {
    val academicTypography = LocalAcademicTypography.current
    val statusColors = LocalCarryMarkExtraColors.current
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            assessment.name,
            color = MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f)
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${assessment.score?.toInt() ?: "—"}",
                color = MaterialTheme.colorScheme.onSurface,
                style = academicTypography.academicMedium
            )
            Text(
                "/${assessment.maximum.toInt()}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = academicTypography.academicSmall
            )
            Spacer(Modifier.width(16.dp))
            Text(
                "${assessment.weight}%",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = academicTypography.academicSmall
            )
            Spacer(Modifier.width(16.dp))
            Icon(
                if (assessment.score != null) Icons.Default.CheckCircle else Icons.Default.Schedule,
                null,
                tint = if (assessment.score != null) statusColors.success else statusColors.warning,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
private fun EligibilityCard(subject: SubjectResult) {
    val academicTypography = LocalAcademicTypography.current
    val statusColors = LocalCarryMarkExtraColors.current
    if (subject.isFinalised) {
        val eligible = subject.isEligible == true
        val resultColor = if (eligible) statusColors.success else statusColors.danger
        Surface(
            color = Color.Transparent,
            shape = MaterialTheme.shapes.large,
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.dp, resultColor.copy(alpha = 0.5f))
        ) {
            Column(Modifier.padding(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (eligible) Icons.Default.CheckCircle else Icons.Default.Cancel,
                        null,
                        tint = resultColor,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(
                        if (eligible) "Eligible for Final Examination" else "Not Eligible for Final Examination",
                        color = resultColor,
                        style = MaterialTheme.typography.titleMedium
                    )
                }
                Spacer(Modifier.height(12.dp))
                Text(
                    "Your carry mark of ${subject.carryMark?.toInt() ?: 0}/${subject.carryMaximum.toInt()} " +
                        "${if (eligible) "meets" else "does not meet"} the minimum requirement of " +
                        "${subject.eligibleThreshold.toInt()}/${subject.carryMaximum.toInt()}.",
                    color = resultColor,
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(Modifier.height(20.dp))
                Box(contentAlignment = Alignment.CenterEnd) {
                    LinearProgressIndicator(
                        progress = {
                            ((subject.carryMark?.toFloat() ?: 0f) / subject.carryMaximum.toFloat())
                                .coerceIn(0f, 1f)
                        },
                        modifier = Modifier.fillMaxWidth().height(8.dp),
                        color = resultColor,
                        trackColor = resultColor.copy(alpha = 0.2f),
                        strokeCap = StrokeCap.Round
                    )
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "${((subject.carryMark ?: 0.0) / subject.carryMaximum * 100).toInt()}%",
                    color = resultColor,
                    style = academicTypography.academicSmall,
                    modifier = Modifier.align(Alignment.End)
                )
            }
        }
    } else {
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = MaterialTheme.shapes.large,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(Modifier.padding(20.dp), verticalAlignment = Alignment.Top) {
                Icon(Icons.Default.Lock, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(16.dp))
                Text(
                    "Examination eligibility and finalised carry mark will be shown here once your lecturer formally submits the marks.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                    lineHeight = 20.sp
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DisputeScreen(
    subject: SubjectResult,
    isSubmitting: Boolean,
    serverError: String?,
    onClearError: () -> Unit,
    onBack: () -> Unit,
    onSubmit: (String, String, () -> Unit) -> Unit,
    onSubmitted: () -> Unit
) {
    val assessment = remember { mutableStateOf("") }
    val explanation = remember { mutableStateOf("") }
    val showConfirmation = remember { mutableStateOf(false) }
    val statusColors = LocalCarryMarkExtraColors.current
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Report mark issue",
                        style = MaterialTheme.typography.titleLarge
                    ) 
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } }
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp)) {
            Text(
                "${subject.code} • ${subject.name}", 
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                "Explain which assessment looks incorrect.", 
                color = statusColors.muted,
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(20.dp))
            OutlinedTextField(
                value = assessment.value,
                onValueChange = { assessment.value = it; onClearError() },
                label = { 
                    Text(
                        "Assessment name",
                        style = MaterialTheme.typography.bodyMedium
                    ) 
                },
                textStyle = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.small
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = explanation.value,
                onValueChange = { explanation.value = it; onClearError() },
                label = { 
                    Text(
                        "What is the issue?",
                        style = MaterialTheme.typography.bodyMedium
                    ) 
                },
                textStyle = MaterialTheme.typography.bodyLarge,
                minLines = 5,
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.small
            )
            if (serverError != null) {
                Spacer(Modifier.height(8.dp))
                Text(
                    serverError,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = {
                    onSubmit(assessment.value, explanation.value) {
                        showConfirmation.value = true
                    }
                },
                enabled = assessment.value.isNotBlank() && explanation.value.isNotBlank() && !isSubmitting,
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium
            ) { 
                if (isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        "Submit report",
                        style = MaterialTheme.typography.labelLarge
                    )
                }
            }
        }
    }
    if (showConfirmation.value) {
        AlertDialog(
            onDismissRequest = { showConfirmation.value = false },
            icon = { Icon(Icons.Default.CheckCircle, null) },
            title = { 
                Text(
                    "Report recorded",
                    style = MaterialTheme.typography.headlineSmall
                ) 
            },
            text = { 
                Text(
                    "Your report has been sent to the lecturer and will be tracked under your account.",
                    style = MaterialTheme.typography.bodyMedium
                ) 
            },
            confirmButton = { 
                TextButton(onClick = onSubmitted) { 
                    Text(
                        "Done",
                        style = MaterialTheme.typography.labelLarge
                    ) 
                } 
            }
        )
    }
}

@Composable
private fun MainNavigationBar(selectedScreen: Screen, onNavigate: (Screen) -> Unit) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.onSurface
    ) {
        NavigationBarItem(
            selected = selectedScreen == Screen.Dashboard,
            onClick = { onNavigate(Screen.Dashboard) },
            icon = { Icon(Icons.Default.Book, null) },
            label = { Text("Subjects") },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = MaterialTheme.colorScheme.primary,
                selectedTextColor = MaterialTheme.colorScheme.primary,
                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                indicatorColor = Color.Transparent
            )
        )
        NavigationBarItem(
            selected = selectedScreen == Screen.Progress,
            onClick = { onNavigate(Screen.Progress) },
            icon = { Icon(Icons.Default.BarChart, null) },
            label = { Text("Progress") },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = MaterialTheme.colorScheme.primary,
                selectedTextColor = MaterialTheme.colorScheme.primary,
                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                indicatorColor = Color.Transparent
            )
        )
        NavigationBarItem(
            selected = selectedScreen == Screen.Settings,
            onClick = { onNavigate(Screen.Settings) },
            icon = { Icon(Icons.Default.Settings, null) },
            label = { Text("Settings") },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = MaterialTheme.colorScheme.primary,
                selectedTextColor = MaterialTheme.colorScheme.primary,
                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                indicatorColor = Color.Transparent
            )
        )
    }
}

@Composable
private fun ProgressScreen(subjects: List<SubjectResult>, onNavigate: (Screen) -> Unit) {
    val academicTypography = LocalAcademicTypography.current
    val recordedMarks = subjects.mapNotNull { it.carryMark }
    val avgMark = if (recordedMarks.isEmpty()) 0.0 else recordedMarks.average()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            MainNavigationBar(selectedScreen = Screen.Progress, onNavigate = onNavigate)
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp),
            contentPadding = PaddingValues(vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Text(
                        "My Progress",
                        color = MaterialTheme.colorScheme.onBackground,
                        style = MaterialTheme.typography.headlineLarge
                    )
                    if (recordedMarks.isNotEmpty()) {
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                "%.0f".format(avgMark),
                                color = MaterialTheme.colorScheme.primary,
                                style = academicTypography.academicLarge
                            )
                            Text(
                                "avg. carry mark",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }

            if (subjects.isEmpty()) {
                item {
                    Text(
                        "No subject progress is available. Join a class to begin tracking carry marks.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else {
                item {
                    ChartSection("CARRY MARKS BY SUBJECT") {
                        CarryMarkBarChart(subjects)
                    }
                }

                item {
                    ChartSection("PERFORMANCE BY COMPONENT TYPE") {
                        PerformanceRadarChart(subjects)
                    }
                }

                item {
                    Text(
                        "SUBJECT SUMMARY",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium,
                        letterSpacing = 1.sp
                    )
                }

                items(subjects) { subject ->
                    SummaryItem(subject)
                }
            }
            
            // Added some extra space at the bottom to ensure everything is visible above the navigation bar
            item {
                Spacer(Modifier.height(48.dp))
            }
        }
    }
}

@Composable
private fun ChartSection(title: String, content: @Composable () -> Unit) {
    Column {
        Text(
            title,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
            letterSpacing = 1.sp
        )
        Spacer(Modifier.height(16.dp))
        Surface(
            color = MaterialTheme.colorScheme.surface,
            shape = MaterialTheme.shapes.large,
            modifier = Modifier.fillMaxWidth()
        ) {
            Box(
                modifier = Modifier
                    .padding(24.dp)
                    .height(200.dp),
                contentAlignment = Alignment.Center
            ) {
                content()
            }
        }
    }
}

@Composable
private fun CarryMarkBarChart(subjects: List<SubjectResult>) {
    val labelColor = MaterialTheme.colorScheme.onSurfaceVariant.toArgb()
    val barColor = MaterialTheme.colorScheme.primary
    androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
        if (subjects.isEmpty()) return@Canvas
        val bottomPadding = 30.dp.toPx()
        val leftPadding = 40.dp.toPx()
        val chartHeight = size.height - bottomPadding
        val chartWidth = size.width - leftPadding
        
        val barWidth = 40.dp.toPx()
        val spacing = (chartWidth - (barWidth * subjects.size)) / (subjects.size + 1)
        val maxMark = subjects.maxOf { it.carryMaximum.toFloat() }
        
        // Draw axis labels (Y-axis)
        val axisLabels = listOf(0f, maxMark * 0.3f, maxMark * 0.6f, maxMark)
        axisLabels.forEach { label ->
            val y = chartHeight - (label / maxMark * chartHeight)
            
            drawContext.canvas.nativeCanvas.drawText(
                label.toInt().toString(),
                5.dp.toPx(),
                y + 5.dp.toPx(),
                android.graphics.Paint().apply {
                    color = labelColor
                    textSize = 12.sp.toPx()
                    typeface = android.graphics.Typeface.MONOSPACE
                }
            )
        }

        subjects.forEachIndexed { index, subject ->
            val mark = subject.carryMark?.toFloat() ?: 0f
            val barHeight = (mark / maxMark) * chartHeight
            val x = leftPadding + spacing + index * (barWidth + spacing)
            
            // Draw Bar
            drawRoundRect(
                color = barColor,
                topLeft = androidx.compose.ui.geometry.Offset(x, chartHeight - barHeight),
                size = androidx.compose.ui.geometry.Size(barWidth, barHeight),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(4.dp.toPx())
            )

            // Draw subject code (X-axis)
            drawContext.canvas.nativeCanvas.drawText(
                subject.code,
                x + (barWidth / 2),
                size.height - 5.dp.toPx(),
                android.graphics.Paint().apply {
                    color = labelColor
                    textSize = 11.sp.toPx()
                    typeface = android.graphics.Typeface.MONOSPACE
                    textAlign = android.graphics.Paint.Align.CENTER
                }
            )
        }
    }
}

@Composable
private fun PerformanceRadarChart(subjects: List<SubjectResult>) {
    val labelColor = MaterialTheme.colorScheme.onSurfaceVariant.toArgb()
    val brandColor = MaterialTheme.colorScheme.primary
    val assessments = subjects.flatMap { it.assessments }
    val categories = assessments.map { it.assessmentType.trim() }.filter { it.isNotEmpty() }.distinct()
    val dataPoints = categories.map { category ->
        val percentages = assessments.filter { it.assessmentType.equals(category, ignoreCase = true) }
            .mapNotNull { assessment ->
                assessment.score?.let { (it / assessment.maximum).toFloat().coerceIn(0f, 1f) }
            }
        if (percentages.isEmpty()) 0f else percentages.average().toFloat()
    }

    if (categories.isEmpty()) {
        Text("No assessed component data yet", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        return
    }

    androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
        val bottomPadding = 34.dp.toPx()
        val chartHeight = size.height - bottomPadding
        val slotWidth = size.width / categories.size
        val barWidth = minOf(38.dp.toPx(), slotWidth * .55f)
        categories.forEachIndexed { index, label ->
            val barHeight = chartHeight * dataPoints[index]
            val x = slotWidth * index + (slotWidth - barWidth) / 2
            drawRoundRect(
                color = brandColor,
                topLeft = androidx.compose.ui.geometry.Offset(x, chartHeight - barHeight),
                size = androidx.compose.ui.geometry.Size(barWidth, barHeight),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(4.dp.toPx())
            )
            drawContext.canvas.nativeCanvas.drawText(
                label.take(12),
                x + barWidth / 2,
                size.height - 8.dp.toPx(),
                android.graphics.Paint().apply {
                    color = labelColor
                    textSize = 11.sp.toPx()
                    typeface = android.graphics.Typeface.MONOSPACE
                    textAlign = android.graphics.Paint.Align.CENTER
                }
            )
        }
    }
}

@Composable
private fun SummaryItem(subject: SubjectResult) {
    val academicTypography = LocalAcademicTypography.current
    val statusColors = LocalCarryMarkExtraColors.current
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    subject.code,
                    color = MaterialTheme.colorScheme.primary,
                    style = academicTypography.academicSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    subject.name,
                    color = MaterialTheme.colorScheme.onSurface,
                    style = MaterialTheme.typography.titleMedium
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                if (subject.carryMark != null) {
                    Text(
                        "%.0f".format(subject.carryMark),
                        color = statusColors.success,
                        style = academicTypography.academicMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "/ ${subject.carryMaximum.toInt()}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = academicTypography.academicSmall
                    )
                } else {
                    Text(
                        "Pending",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    student: Student?,
    notificationsEnabled: Boolean?,
    isDarkMode: Boolean,
    onToggleDarkMode: () -> Unit,
    onNavigate: (Screen) -> Unit, 
    onLogout: () -> Unit
) {
    val statusColors = LocalCarryMarkExtraColors.current
    val showLogoutDialog = remember { mutableStateOf(false) }
    
    val interactionSource = remember { MutableInteractionSource() }
    val isHovered by interactionSource.collectIsHoveredAsState()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            MainNavigationBar(selectedScreen = Screen.Settings, onNavigate = onNavigate)
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp),
            contentPadding = PaddingValues(vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            item {
                Text(
                    "Settings",
                    color = MaterialTheme.colorScheme.onBackground,
                    style = MaterialTheme.typography.headlineLarge
                )
            }

            // PROFILE SECTION
            item {
                SettingsSectionTitle("PROFILE")
                Spacer(Modifier.height(16.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = MaterialTheme.shapes.large,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(Modifier.padding(20.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                                shape = CircleShape,
                                modifier = Modifier.size(64.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Default.Person,
                                        null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(32.dp)
                                    )
                                }
                            }
                            Spacer(Modifier.width(16.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    student?.name.orEmpty(),
                                    color = MaterialTheme.colorScheme.onSurface,
                                    style = MaterialTheme.typography.titleMedium
                                )
                                Text(
                                    student?.matrixNumber.orEmpty(),
                                    color = statusColors.muted,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                        
                        Spacer(Modifier.height(24.dp))
                        
                        SettingsRow("Programme", student?.programme.orEmpty())
                        HorizontalDivider(Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.surfaceVariant, thickness = 0.5.dp)
                        SettingsRow("Faculty", student?.faculty.orEmpty())
                        HorizontalDivider(Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.surfaceVariant, thickness = 0.5.dp)
                        SettingsRow("Semester", student?.semester ?: "Not recorded")
                        HorizontalDivider(Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.surfaceVariant, thickness = 0.5.dp)
                        SettingsRow("Academic Advisor", student?.academicAdvisor ?: "Not recorded")
                    }
                }
            }

            // PUSH NOTIFICATIONS SECTION
            item {
                SettingsSectionTitle("PUSH NOTIFICATIONS")
                Spacer(Modifier.height(16.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = MaterialTheme.shapes.large,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(Modifier.padding(20.dp)) {
                        Text(
                            "Notifications are controlled by the current academic-term policy.",
                            color = statusColors.muted,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(16.dp))
                        SettingsRow("Finalisation alerts", when (notificationsEnabled) { true -> "Enabled"; false -> "Disabled"; null -> "Not configured" })
                    }
                }
            }

            // APP SECTION
            item {
                SettingsSectionTitle("APP")
                Spacer(Modifier.height(16.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = MaterialTheme.shapes.large,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(Modifier.padding(20.dp)) {
                        SettingsRow("App Version", "${BuildConfig.VERSION_NAME} (Build ${BuildConfig.VERSION_CODE})")
                        HorizontalDivider(Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.surfaceVariant, thickness = 0.5.dp)
                        SettingsRow("Language", "English")
                        HorizontalDivider(Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.surfaceVariant, thickness = 0.5.dp)
                        
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "Appearance",
                                color = MaterialTheme.colorScheme.onSurface,
                                style = MaterialTheme.typography.bodyLarge
                            )
                            Surface(
                                onClick = onToggleDarkMode,
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                                shape = MaterialTheme.shapes.small,
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                                modifier = Modifier.height(36.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        if (isDarkMode) Icons.Default.NightlightRound else Icons.Default.WbSunny,
                                        null,
                                        tint = if (isDarkMode) MaterialTheme.colorScheme.primary else statusColors.warning,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        if (isDarkMode) "Dark" else "Light",
                                        color = MaterialTheme.colorScheme.onSurface,
                                        style = MaterialTheme.typography.labelLarge
                                    )
                                }
                            }
                        }
                    }
                }
            }

            item {
                OutlinedButton(
                    onClick = { showLogoutDialog.value = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = MaterialTheme.shapes.large,
                    interactionSource = interactionSource,
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (isHovered) Color(0xFFEF4444) else Color.Transparent,
                        contentColor = if (isHovered) Color.White else MaterialTheme.colorScheme.error
                    ),
                    border = BorderStroke(1.dp, if (isHovered) Color.Transparent else MaterialTheme.colorScheme.error.copy(alpha = 0.4f))
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.AutoMirrored.Filled.Logout, null, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Log Out", style = MaterialTheme.typography.titleMedium)
                    }
                }
            }

            item {
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    if (showLogoutDialog.value) {
        LogoutConfirmationDialog(
            onConfirm = {
                showLogoutDialog.value = false
                onLogout()
            },
            onDismiss = { showLogoutDialog.value = false }
        )
    }
}

@Composable
private fun LogoutConfirmationDialog(onConfirm: () -> Unit, onDismiss: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    val isHovered by interactionSource.collectIsHoveredAsState()

    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        Surface(
            color = Color(0xFF131829),
            shape = RoundedCornerShape(28.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Surface(
                    color = Color(0xFF702082).copy(alpha = 0.1f),
                    shape = CircleShape,
                    modifier = Modifier.size(64.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.AutoMirrored.Filled.Logout,
                            null,
                            tint = Color(0xFF702082),
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }
                
                Spacer(Modifier.height(24.dp))
                
                Text(
                    "Log Out?",
                    color = Color.White,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(Modifier.height(12.dp))
                
                Text(
                    "You will be returned to the login screen. Any unsaved changes will be lost.",
                    color = Color(0xFF9CA3AF),
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    lineHeight = 20.sp
                )
                
                Spacer(Modifier.height(32.dp))
                
                Button(
                    onClick = onConfirm,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    interactionSource = interactionSource,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isHovered) Color.Red else Color(0xFFEF4444)
                    )
                ) {
                    Text(
                        "Yes, Log Out",
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                
                Spacer(Modifier.height(12.dp))
                
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFF1F2937))
                ) {
                    Text(
                        "Cancel",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
        }
    }
}


@Composable
private fun SettingsSectionTitle(title: String) {
    Text(
        title,
        color = LocalCarryMarkExtraColors.current.muted,
        style = MaterialTheme.typography.labelMedium,
        letterSpacing = 1.sp
    )
}

@Composable
private fun SettingsRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            label,
            modifier = Modifier.weight(0.4f),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium
        )
        Text(
            value,
            modifier = Modifier.weight(0.6f),
            color = MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium
        )
    }
}

@Preview(showBackground = true, apiLevel = 35)
@Composable
private fun SettingsPreview() {
    CarryMarkTheme(darkTheme = true) {
        SettingsScreen(
            student = null,
            notificationsEnabled = null,
            isDarkMode = true,
            onToggleDarkMode = {},
            onNavigate = {}, 
            onLogout = {}
        )
    }
}

@Preview(showBackground = true, apiLevel = 35)
@Composable
private fun DashboardPreview() {
    CarryMarkTheme(darkTheme = true) {
        DashboardScreen(
            student = null,
            subjects = emptyList(),
            notifications = emptyList(),
            actionLoading = false,
            actionError = null,
            onClearError = {},
            onJoinClass = { _, _ -> },
            onSubject = {},
            onNavigate = {}
        )
    }
}

@Preview(showBackground = true, apiLevel = 35)
@Composable
private fun ProgressPreview() {
    CarryMarkTheme(darkTheme = true) {
        ProgressScreen(subjects = emptyList(), onNavigate = {})
    }
}
