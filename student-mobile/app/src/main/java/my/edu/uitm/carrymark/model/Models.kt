package my.edu.uitm.carrymark.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Assessment(
    val name: String,
    @SerialName("assessment_type")
    val assessmentType: String,
    val score: Double?,
    val maximum: Double,
    @SerialName("carry_contribution")
    val carryContribution: Double?,
    val weight: Int
)

@Serializable
data class SubjectResult(
    @SerialName("offering_id")
    val offeringId: String,
    val code: String,
    val name: String,
    val lecturer: String,
    val group: String,
    @SerialName("carry_mark")
    val carryMark: Double?,
    @SerialName("carry_maximum")
    val carryMaximum: Double,
    val eligible: Boolean? = null,
    @SerialName("eligible_threshold")
    val eligibleThreshold: Double,
    @SerialName("is_finalised")
    val isFinalised: Boolean,
    @SerialName("last_updated")
    val lastUpdated: String? = null,
    val assessments: List<Assessment>
) {
    val isEligible: Boolean? get() = eligible
}

@Serializable
data class Student(
    @SerialName("matrix_number")
    val matrixNumber: String,
    val name: String,
    val programme: String,
    val faculty: String,
    val semester: String?,
    @SerialName("academic_advisor")
    val academicAdvisor: String?
)

@Serializable
data class StudentNotification(
    val id: String,
    val title: String,
    val body: String,
    @SerialName("created_at")
    val createdAt: String
)

@Serializable
data class StudentPortalPayload(
    val student: Student? = null,
    val subjects: List<SubjectResult> = emptyList(),
    @SerialName("notifications_enabled")
    val notificationsEnabled: Boolean? = null,
    val notifications: List<StudentNotification> = emptyList()
)
