export interface ParticipantNameFields {
  firstName: string;
  lastName: string;
  middleInitial?: string | null;
}

function normalizeMiddleInitial(middleInitial?: string | null): string {
  const cleaned = middleInitial?.trim().replace(/\./g, "");
  if (!cleaned) return "";
  return `${cleaned.charAt(0).toUpperCase()}.`;
}

export function formatParticipantName(person: ParticipantNameFields): string {
  const surname = person.lastName.trim().toUpperCase();
  const firstName = person.firstName.trim();
  const middleInitial = normalizeMiddleInitial(person.middleInitial);

  if (middleInitial) {
    return `${surname}, ${firstName}, ${middleInitial}`;
  }

  return `${surname}, ${firstName}`;
}

export function getParticipantInitials(person: ParticipantNameFields): string {
  const last = person.lastName.trim().charAt(0);
  const first = person.firstName.trim().charAt(0);
  return `${last}${first}`.toUpperCase();
}

export function getParticipantSearchText(person: ParticipantNameFields & {
  referenceNumber?: string;
  email?: string;
  organization?: string;
}): string {
  return [
    person.referenceNumber,
    person.lastName,
    person.firstName,
    person.middleInitial,
    formatParticipantName(person),
    person.email,
    person.organization,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function compareParticipantsByName(
  a: ParticipantNameFields,
  b: ParticipantNameFields
): number {
  const lastNameCompare = a.lastName.localeCompare(b.lastName, "en", {
    sensitivity: "base",
  });
  if (lastNameCompare !== 0) return lastNameCompare;

  const firstNameCompare = a.firstName.localeCompare(b.firstName, "en", {
    sensitivity: "base",
  });
  if (firstNameCompare !== 0) return firstNameCompare;

  return (a.middleInitial ?? "").localeCompare(b.middleInitial ?? "", "en", {
    sensitivity: "base",
  });
}
