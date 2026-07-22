const honorifics = new Set(["Hon.", "Dr.", "Atty.", "Engr.", "Prof."]);

export function getSpeakerInitials(name: string): string {
  return name
    .split(" ")
    .filter((part) => part && !honorifics.has(part))
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
