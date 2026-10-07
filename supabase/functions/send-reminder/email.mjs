export function pendingSections(offerings) {
  return offerings.flatMap(offering => (offering.class_sections ?? [])
    .filter(section => {
      const submissions = Array.isArray(section.submissions) ? section.submissions : [section.submissions];
      return !submissions.some(submission => submission?.status === 'finalised');
    })
    .map(section => `${offering.subjects.code} (${section.programmes?.code ?? offering.programmes?.code ?? 'Programme not set'}) — ${offering.subject_name_override ?? offering.subjects.name}, Section ${section.label}`));
}

export function reminderText(name, sections) {
  return `Dear ${name},\n\nPlease submit and finalise the outstanding carry marks for the following classes:\n\n${sections.map(section => `• ${section}`).join('\n')}\n\nPlease sign in to the Carry Mark Monitoring System to complete your submission. If you need assistance, contact your faculty administrator.\n\nThank you,\nFaculty Administration`;
}
