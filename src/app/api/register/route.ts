import { NextResponse } from "next/server";
import { conference, type RegistrationCategory } from "@/lib/conference";
import {
  getEmailValidationError,
  getNameLengthError,
  getRegistrationPhoneValidationError,
  toPhMobileInternational,
} from "@/lib/form-validation";
import {
  createGroupRegistrations,
  createRegistration,
  MAX_GROUP_SIZE,
} from "@/lib/registrations";
import { getActiveEvent, getOpenEventById } from "@/lib/events";
import { sendRegistrationPendingEmail } from "@/lib/mail-templates";
import type { GroupMemberInput, RegistrationInput } from "@/lib/types/admin";
const validCategories = Object.keys(conference.registration.fees) as RegistrationCategory[];

function validatePersonContact(person: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  label?: string;
}): { error?: string; phone?: string } {
  const label = person.label ? `${person.label}: ` : "";

  const lastNameError = getNameLengthError(person.lastName ?? "", "lastName", "Surname");
  if (lastNameError) return { error: `${label}${lastNameError}` };

  const firstNameError = getNameLengthError(person.firstName ?? "", "firstName", "First name");
  if (firstNameError) return { error: `${label}${firstNameError}` };

  const emailError = getEmailValidationError(person.email ?? "");
  if (emailError) return { error: `${label}${emailError}` };

  const phoneError = getRegistrationPhoneValidationError(person.phone ?? "");
  if (phoneError) return { error: `${label}${phoneError}` };

  const normalizedPhone = toPhMobileInternational(person.phone ?? "");
  if (!normalizedPhone) {
    return {
      error: `${label}Enter a valid mobile number starting with 9 (e.g. 9606207919).`,
    };
  }

  return { phone: normalizedPhone };
}

function validateSharedFields(body: {
  organization?: string;
  position?: string;
  category?: string;
  feeTier?: string;
  address?: string;
  city?: string;
  province?: string;
  agreeToTerms?: boolean;
}): { error?: string } {
  if (!body.organization?.trim() || !body.position?.trim()) {
    return { error: "Organization and position are required." };
  }

  if (!body.category || !validCategories.includes(body.category as RegistrationCategory)) {
    return { error: "Please select a valid registration category." };
  }

  if (body.feeTier && body.feeTier !== "early" && body.feeTier !== "regular") {
    return { error: "Please select a valid payment amount." };
  }

  if (!body.address?.trim() || !body.city?.trim() || !body.province?.trim()) {
    return { error: "Complete address is required." };
  }

  if (!body.agreeToTerms) {
    return { error: "You must agree to the terms and conditions." };
  }

  return {};
}

async function resolveTargetEvent(eventId: unknown) {
  const id = typeof eventId === "string" ? eventId : undefined;
  let targetEvent = id ? await getOpenEventById(id) : await getActiveEvent();

  if (id && !targetEvent) {
    return { error: "This event is not open for registration." as const };
  }

  if (!targetEvent) {
    return { error: "No event is currently open for registration." as const };
  }

  return { event: targetEvent };
}

function toRegistrationResponse(
  registration: {
    referenceNumber: string;
    firstName: string;
    lastName: string;
    middleInitial: string;
    email: string;
    category: RegistrationCategory;
    feeTier: string;
    paymentAmount: number;
    groupId?: string | null;
    groupRole?: string | null;
    groupSize?: number | null;
  },
  eventTitle: string
) {
  return {
    referenceNumber: registration.referenceNumber,
    firstName: registration.firstName,
    lastName: registration.lastName,
    middleInitial: registration.middleInitial,
    email: registration.email,
    category: registration.category,
    feeTier: registration.feeTier,
    paymentAmount: registration.paymentAmount,
    eventTitle,
    groupId: registration.groupId ?? null,
    groupRole: registration.groupRole ?? null,
    groupSize: registration.groupSize ?? null,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = body.mode === "group" ? "group" : "individual";

    if (mode === "group") {
      const primarySource = body.primary ?? body;
      const rawMembers: unknown[] = Array.isArray(body.members) ? body.members : [];

      if (rawMembers.length < 1) {
        return NextResponse.json(
          { error: "Add at least one additional participant for group registration." },
          { status: 400 }
        );
      }

      if (1 + rawMembers.length > MAX_GROUP_SIZE) {
        return NextResponse.json(
          { error: `Group registration allows up to ${MAX_GROUP_SIZE} participants.` },
          { status: 400 }
        );
      }

      const shared = validateSharedFields(primarySource);
      if (shared.error) {
        return NextResponse.json({ error: shared.error }, { status: 400 });
      }

      const primaryContact = validatePersonContact({
        ...primarySource,
        label: "Primary registrant",
      });
      if (primaryContact.error || !primaryContact.phone) {
        return NextResponse.json({ error: primaryContact.error }, { status: 400 });
      }

      const members: GroupMemberInput[] = [];
      for (let i = 0; i < rawMembers.length; i++) {
        const raw = rawMembers[i] as Record<string, unknown>;
        const contact = validatePersonContact({
          firstName: typeof raw.firstName === "string" ? raw.firstName : "",
          lastName: typeof raw.lastName === "string" ? raw.lastName : "",
          email: typeof raw.email === "string" ? raw.email : "",
          phone: typeof raw.phone === "string" ? raw.phone : "",
          label: `Participant ${i + 2}`,
        });
        if (contact.error || !contact.phone) {
          return NextResponse.json({ error: contact.error }, { status: 400 });
        }
        members.push({
          firstName: String(raw.firstName ?? ""),
          lastName: String(raw.lastName ?? ""),
          middleInitial: typeof raw.middleInitial === "string" ? raw.middleInitial : "",
          email: String(raw.email ?? ""),
          phone: contact.phone,
        });
      }

      const eventResult = await resolveTargetEvent(primarySource.eventId ?? body.eventId);
      if ("error" in eventResult) {
        return NextResponse.json({ error: eventResult.error }, { status: 400 });
      }
      const targetEvent = eventResult.event;

      const primary: RegistrationInput = {
        firstName: primarySource.firstName,
        lastName: primarySource.lastName,
        middleInitial: primarySource.middleInitial,
        email: primarySource.email,
        phone: primaryContact.phone,
        organization: primarySource.organization,
        position: primarySource.position,
        category: primarySource.category,
        feeTier:
          primarySource.feeTier === "regular" || primarySource.feeTier === "early"
            ? primarySource.feeTier
            : undefined,
        address: primarySource.address,
        city: primarySource.city,
        province: primarySource.province,
        dietaryRequirements: primarySource.dietaryRequirements,
        specialNeeds: primarySource.specialNeeds,
        agreeToTerms: primarySource.agreeToTerms,
        eventId: targetEvent.id,
      };

      const created = await createGroupRegistrations({ primary, members });
      const primaryRecord = created.find((r) => r.groupRole === "primary") ?? created[0];

      for (const registration of created) {
        void sendRegistrationPendingEmail(registration, targetEvent).catch((error) => {
          console.error("[register] pending email error:", error);
        });
      }

      return NextResponse.json(
        {
          message: "Group registration successful.",
          registration: toRegistrationResponse(primaryRecord, targetEvent.title),
          group: {
            groupId: primaryRecord.groupId,
            groupSize: primaryRecord.groupSize,
            totalPaymentAmount: created.reduce((sum, r) => sum + (r.paymentAmount ?? 0), 0),
            participants: created.map((r) => ({
              referenceNumber: r.referenceNumber,
              firstName: r.firstName,
              lastName: r.lastName,
              middleInitial: r.middleInitial,
              email: r.email,
              groupRole: r.groupRole,
            })),
          },
        },
        { status: 201 }
      );
    }

    const {
      firstName,
      lastName,
      middleInitial,
      email,
      phone,
      organization,
      position,
      category,
      feeTier,
      address,
      city,
      province,
      dietaryRequirements,
      specialNeeds,
      agreeToTerms,
      eventId,
    } = body;

    const contact = validatePersonContact({ firstName, lastName, email, phone });
    if (contact.error || !contact.phone) {
      return NextResponse.json({ error: contact.error }, { status: 400 });
    }

    const shared = validateSharedFields({
      organization,
      position,
      category,
      feeTier,
      address,
      city,
      province,
      agreeToTerms,
    });
    if (shared.error) {
      return NextResponse.json({ error: shared.error }, { status: 400 });
    }

    const eventResult = await resolveTargetEvent(eventId);
    if ("error" in eventResult) {
      return NextResponse.json({ error: eventResult.error }, { status: 400 });
    }
    const targetEvent = eventResult.event;

    const registration = await createRegistration({
      firstName,
      lastName,
      middleInitial,
      email,
      phone: contact.phone,
      organization,
      position,
      category,
      feeTier: feeTier === "regular" || feeTier === "early" ? feeTier : undefined,
      address,
      city,
      province,
      dietaryRequirements,
      specialNeeds,
      agreeToTerms,
      eventId: targetEvent.id,
    });

    void sendRegistrationPendingEmail(registration, targetEvent).catch((error) => {
      console.error("[register] pending email error:", error);
    });

    return NextResponse.json(
      {
        message: "Registration successful.",
        registration: toRegistrationResponse(registration, targetEvent.title),
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    const status = message.includes("already exists") || message.includes("Duplicate email")
      ? 409
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
