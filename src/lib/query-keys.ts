export const queryKeys = {
  registrations: {
    all: ["registrations"] as const,
    lookup: (reference: string, email: string) =>
      [...queryKeys.registrations.all, "lookup", reference, email.trim().toLowerCase()] as const,
  },
} as const;
