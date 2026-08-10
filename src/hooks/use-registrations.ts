"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  lookupRegistration,
  submitRegistration,
  type RegistrationInput,
} from "@/lib/api/registrations";
import { queryKeys } from "@/lib/query-keys";

export function useSubmitRegistration() {
  return useMutation({
    mutationFn: submitRegistration,
  });
}

export function useRegistrationLookup(
  reference: string,
  email: string,
  enabled = false
) {
  return useQuery({
    queryKey: queryKeys.registrations.lookup(reference, email),
    queryFn: () => lookupRegistration(reference, email),
    enabled: enabled && reference.trim().length > 0 && email.trim().length > 0,
    retry: false,
  });
}

export type { RegistrationInput };
