package my.edu.uitm.carrymark.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontLoadingStrategy
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import my.edu.uitm.carrymark.R

// Light Scheme
val BrandLight = Color(0xFF702082)
val BgLight = Color(0xFFF2F4F8)
val SurfaceLight = Color(0xFFFFFFFF)
val InputLight = Color(0xFFE8EBF2)
val TextPrimaryLight = Color(0xFF0F1117)
val TextSecondaryLight = Color(0xFF374151)
val TextMutedLight = Color(0xFF6B7280)
val SuccessLight = Color(0xFF16A34A)
val WarningLight = Color(0xFFB45309)
val DangerLight = Color(0xFFDC2626)

// Dark Scheme
val BrandDark = Color(0xFF702082)
val BgDark = Color(0xFF0B0E17)
val SurfaceDark = Color(0xFF131829)
val InputDark = Color(0xFF1A1F2E)
val TextPrimaryDark = Color(0xFFE8EAF0)
val TextSecondaryDark = Color(0xFF9CA3AF)
val TextMutedDark = Color(0xFF8B93A7)
val SuccessDark = Color(0xFF22C55E)
val WarningDark = Color(0xFFD4A72C)
val DangerDark = Color(0xFFEF4444)

// Legacy compatibility mapping (for current MainActivity usages)
val Maroon get() = BrandLight // Will be handled by theme logic in components
val Gold get() = WarningLight
val Green get() = SuccessLight
val Red get() = DangerLight
val Muted get() = TextMutedLight
val Page get() = BgLight
val DeepDark get() = BgDark
val InputFieldBg get() = InputDark
val InputFieldBorder get() = Color.Transparent // Border logic might need adjustment if elevation is off
val LabelGrey get() = TextSecondaryLight

private val LightColors = lightColorScheme(
    primary = BrandLight,
    onPrimary = Color.White,
    background = BgLight,
    onBackground = TextPrimaryLight,
    surface = SurfaceLight,
    onSurface = TextPrimaryLight,
    surfaceVariant = InputLight,
    onSurfaceVariant = TextSecondaryLight,
    error = DangerLight,
    onError = Color.White
)

private val DarkColors = darkColorScheme(
    primary = BrandDark,
    onPrimary = Color.White,
    background = BgDark,
    onBackground = TextPrimaryDark,
    surface = SurfaceDark,
    onSurface = TextPrimaryDark,
    surfaceVariant = InputDark,
    onSurfaceVariant = TextSecondaryDark,
    error = DangerDark,
    onError = Color.White
)

val Shapes = Shapes(
    small = androidx.compose.foundation.shape.RoundedCornerShape(5.dp), // Inputs
    medium = androidx.compose.foundation.shape.RoundedCornerShape(6.dp), // Buttons
    large = androidx.compose.foundation.shape.RoundedCornerShape(8.dp) // Cards
)

// Font Families
val OutfitFontFamily = FontFamily(Font(R.font.outfit, loadingStrategy = FontLoadingStrategy.OptionalLocal))
val InterFontFamily = FontFamily(Font(R.font.inter, loadingStrategy = FontLoadingStrategy.OptionalLocal))
val DmMonoFontFamily = FontFamily(Font(R.font.dm_mono, loadingStrategy = FontLoadingStrategy.OptionalLocal))

// Typography Scale
val Typography = Typography(
    displayLarge = TextStyle(
        fontFamily = OutfitFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp,
        lineHeight = 38.sp
    ),
    headlineLarge = TextStyle(
        fontFamily = OutfitFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 34.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = OutfitFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 24.sp,
        lineHeight = 30.sp
    ),
    headlineSmall = TextStyle(
        fontFamily = OutfitFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        lineHeight = 26.sp
    ),
    titleLarge = TextStyle(
        fontFamily = OutfitFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 24.sp
    ),
    titleMedium = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    bodySmall = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 19.sp
    ),
    labelLarge = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    labelMedium = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 18.sp
    ),
    labelSmall = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp
    )
)

// Academic Typography
data class AcademicTypography(
    val academicLarge: TextStyle = TextStyle(
        fontFamily = DmMonoFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 30.sp,
        lineHeight = 36.sp
    ),
    val academicMedium: TextStyle = TextStyle(
        fontFamily = DmMonoFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 22.sp
    ),
    val academicSmall: TextStyle = TextStyle(
        fontFamily = DmMonoFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 18.sp
    ),
    val academicLabel: TextStyle = TextStyle(
        fontFamily = DmMonoFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.6.sp
    )
)

val LocalAcademicTypography = staticCompositionLocalOf { AcademicTypography() }

// Academic Typography & Status Colors
data class CarryMarkExtraColors(
    val success: Color,
    val warning: Color,
    val danger: Color,
    val muted: Color
)

val LocalCarryMarkExtraColors = staticCompositionLocalOf {
    CarryMarkExtraColors(
        success = SuccessLight,
        warning = WarningLight,
        danger = DangerLight,
        muted = TextMutedLight
    )
}

@Composable
fun CarryMarkTheme(
    darkTheme: Boolean,
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColors else LightColors
    val extraColors = if (darkTheme) {
        CarryMarkExtraColors(
            success = SuccessDark,
            warning = WarningDark,
            danger = DangerDark,
            muted = TextMutedDark
        )
    } else {
        CarryMarkExtraColors(
            success = SuccessLight,
            warning = WarningLight,
            danger = DangerLight,
            muted = TextMutedLight
        )
    }

    CompositionLocalProvider(
        LocalAcademicTypography provides AcademicTypography(),
        LocalCarryMarkExtraColors provides extraColors
    ) {
        MaterialTheme(
            colorScheme = colors,
            typography = Typography,
            shapes = Shapes,
            content = content
        )
    }
}
