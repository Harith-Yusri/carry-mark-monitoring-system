/** Display-only wording: stored status values and API identifiers stay unchanged. */
export function releaseTerminology(text: string): string {
  return text.replace(/\bfinali[sz](?:ation|ed|es|e|ing)\b/gi, word => {
    const lower = word.toLowerCase();
    const replacement = lower.endsWith('ation') ? 'release'
      : lower.endsWith('ed') ? 'released'
      : lower.endsWith('es') ? 'releases'
      : lower.endsWith('ing') ? 'releasing' : 'release';
    if (word === word.toUpperCase()) return replacement.toUpperCase();
    return word[0] === word[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
  });
}

export function submissionStatusLabel(status: string): string {
  return /^in progress$/i.test(status) ? 'Pending' : releaseTerminology(status);
}
