"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  lookupRegistration,
  submitGroupRegistration,
  submitRegistration,
  type GroupMemberInput,
  type RegistrationInput,
} from "@/lib/api/registrations";
import { queryKeys } from "@/lib/query-keys";

export function useSubmitRegistration() {
  return useMutation({
    mutationFn: submitRegistration,
  });
}

export function useSubmitGroupRegistration() {
  return useMutation({
    mutationFn: submitGroupRegistration,
  });
}

export function useRegistrationLookup(reference: string, enabled = false) {
  return useQuery({
    queryKey: queryKeys.registrations.lookup(reference),
    queryFn: () => lookupRegistration(reference),
    enabled: enabled && reference.trim().length > 0,
    retry: false,
  });
}

export type { RegistrationInput, GroupMemberInput };
