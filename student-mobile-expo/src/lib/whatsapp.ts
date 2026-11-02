import { Linking } from "react-native";

export const WHATSAPP_OPEN_ERROR = "Unable to open WhatsApp. Please contact your lecturer directly.";

export function normalizeMalaysianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `6${digits}` : digits;
  return /^601\d{8,9}$/.test(normalized) ? normalized : null;
}

export function consultationMessage(studentName: string, studentId: string, className: string, subjectCode: string, subjectName: string) {
  const subject = subjectName ? `${subjectCode} (${subjectName})` : subjectCode;
  const classAndSubject = [className.trim(), subject].filter(Boolean).join(" / ");
  return `Assalamualaikum Dr./Sir/Madam, I am ${studentName} (${studentId}) from ${classAndSubject}. I would like to consult regarding my continuous assessment status and my eligibility to sit for the final examination. Thank you.`;
}

export function whatsappClickToChatUrl(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export async function openWhatsApp(phone: string, message: string) {
  try {
    await Linking.openURL(whatsappClickToChatUrl(phone, message));
  } catch {
    throw new Error(WHATSAPP_OPEN_ERROR);
  }
}
