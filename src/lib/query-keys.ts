export const queryKeys = {
  registrations: {
    all: ["registrations"] as const,
    lookup: (reference: string) =>
      [...queryKeys.registrations.all, "lookup", reference] as const,
  },
} as const;
