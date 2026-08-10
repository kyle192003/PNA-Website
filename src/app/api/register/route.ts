import { NextResponse } from "next/server";
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
import type {
  FoodPreference,
  GroupMemberInput,
  MembershipType,
  RegistrationInput,
  RegistrationModeChoice,
  RegistrationRateChoice,
  SponsorConsent,
} from "@/lib/types/admin";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

const membershipTypes: MembershipType[] = ["lifetime", "regular", "non_member"];
const rates: RegistrationRateChoice[] = ["regular", "seniorPwd"];
const modes: RegistrationModeChoice[] = ["single", "group"];
const foods: FoodPreference[] = ["regular", "vegetarian", "no_pork", "allergy"];
const sponsors: SponsorConsent[] = ["yes", "no"];

function validatePersonContact(person: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  label?: string;
}): { error?: string; phone?: string } {
  const label = person.label ? `${person.label}: ` : "";

  const lastNameError = getNameLengthError(person.lastName ?? "", "lastName", "Last name");
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

function validatePrimaryFields(
  body: Record<string, unknown>,
  phone: string
): { error?: string; input?: RegistrationInput } {
  if (typeof body.middleName !== "string" || !body.middleName.trim()) {
    return { error: "Middle name is required." };
  }
  if (typeof body.dateOfBirth !== "string" || !body.dateOfBirth.trim()) {
    return { error: "Date of birth is required." };
  }
  if (typeof body.gender !== "string" || !body.gender.trim()) {
    return { error: "Gender is required." };
  }
  if (
    typeof body.organization !== "string" ||
    !body.organization.trim() ||
    typeof body.institutionAddress !== "string" ||
    !body.institutionAddress.trim() ||
    typeof body.position !== "string" ||
    !body.position.trim()
  ) {
    return {
      error: "Institution/company name, address, and position are required.",
    };
  }
  if (!membershipTypes.includes(body.membershipType as MembershipType)) {
    return { error: "Please select a valid membership type." };
  }
  if (typeof body.pnaIdNumber !== "string" || !body.pnaIdNumber.trim()) {
    return { error: "PNA ID number is required." };
  }
  if (
    typeof body.pnaZone !== "string" ||
    !body.pnaZone.trim() ||
    typeof body.pnaChapter !== "string" ||
    !body.pnaChapter.trim()
  ) {
    return { error: "PNA zone/region and chapter are required." };
  }
  if (
    typeof body.prcLicenseNumber !== "string" ||
    !body.prcLicenseNumber.trim() ||
    typeof body.prcInitialRegistrationDate !== "string" ||
    !body.prcInitialRegistrationDate.trim() ||
    typeof body.prcExpirationDate !== "string" ||
    !body.prcExpirationDate.trim()
  ) {
    return { error: "Complete PRC license details are required." };
  }
  if (!rates.includes(body.registrationRate as RegistrationRateChoice)) {
    return { error: "Please choose Regular or Senior Citizen/PWD rate." };
  }
  if (
    body.registrationRate === "seniorPwd" &&
    (typeof body.seniorPwdIdNumber !== "string" || !body.seniorPwdIdNumber.trim())
  ) {
    return { error: "Senior Citizen/PWD ID number is required for this rate." };
  }
  if (!foods.includes(body.foodPreference as FoodPreference)) {
    return { error: "Please select a food preference." };
  }
  if (
    body.foodPreference === "allergy" &&
    (typeof body.foodAllergyNote !== "string" || !body.foodAllergyNote.trim())
  ) {
    return { error: "Please describe the food allergy." };
  }
  if (!sponsors.includes(body.sponsorConsent as SponsorConsent)) {
    return { error: "Please answer the sponsor consent question." };
  }
  if (!body.dataPrivacyConsent) {
    return { error: "Data privacy consent is required." };
  }
  if (typeof body.paymentReference !== "string" || !body.paymentReference.trim()) {
    return { error: "Payment reference number is required." };
  }

  return {
    input: {
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      middleName: String(body.middleName ?? ""),
      email: String(body.email ?? ""),
      phone,
      dateOfBirth: String(body.dateOfBirth ?? ""),
      age: typeof body.age === "number" ? body.age : Number(body.age) || null,
      gender: String(body.gender ?? ""),
      organization: String(body.organization ?? ""),
      institutionAddress: String(body.institutionAddress ?? ""),
      position: String(body.position ?? ""),
      membershipType: body.membershipType as MembershipType,
      pnaIdNumber: String(body.pnaIdNumber ?? ""),
      pnaZone: String(body.pnaZone ?? ""),
      pnaChapter: String(body.pnaChapter ?? ""),
      prcLicenseNumber: String(body.prcLicenseNumber ?? ""),
      prcInitialRegistrationDate: String(body.prcInitialRegistrationDate ?? ""),
      prcExpirationDate: String(body.prcExpirationDate ?? ""),
      registrationMode: "single",
      registrationRate: body.registrationRate as RegistrationRateChoice,
      seniorPwdIdNumber:
        body.registrationRate === "seniorPwd"
          ? String(body.seniorPwdIdNumber ?? "")
          : undefined,
      foodPreference: body.foodPreference as FoodPreference,
      foodAllergyNote:
        typeof body.foodAllergyNote === "string" ? body.foodAllergyNote : undefined,
      sponsorConsent: body.sponsorConsent as SponsorConsent,
      dataPrivacyConsent: Boolean(body.dataPrivacyConsent),
      paymentReference: String(body.paymentReference ?? ""),
    },
  };
}

function toRegistrationResponse(registration: {
  referenceNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  middleInitial?: string;
  email: string;
  category: string;
  feeTier?: string;
  appliedFeeKey?: string;
  feeLabel?: string;
  paymentAmount?: number;
  groupId?: string | null;
  groupRole?: string | null;
  groupSize?: number | null;
}) {
  return {
    referenceNumber: registration.referenceNumber,
    firstName: registration.firstName,
    lastName: registration.lastName,
    middleName: registration.middleName,
    middleInitial: registration.middleInitial,
    email: registration.email,
    category: registration.category,
    feeTier: registration.feeTier,
    appliedFeeKey: registration.appliedFeeKey,
    feeLabel: registration.feeLabel,
    paymentAmount: registration.paymentAmount,
    groupId: registration.groupId ?? null,
    groupRole: registration.groupRole ?? null,
    groupSize: registration.groupSize ?? null,
  };
}

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit(`register:${ip}`, 10, 60_000);
    if (!limited.ok) {
      return rateLimitResponse(limited.retryAfterSeconds);
    }

    const body = await request.json();
    const mode = body.mode === "group" ? "group" : "individual";

    if (mode === "group") {
      const primarySource = (body.primary ?? body) as Record<string, unknown>;
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

      const primaryContact = validatePersonContact({
        firstName: typeof primarySource.firstName === "string" ? primarySource.firstName : "",
        lastName: typeof primarySource.lastName === "string" ? primarySource.lastName : "",
        email: typeof primarySource.email === "string" ? primarySource.email : "",
        phone: typeof primarySource.phone === "string" ? primarySource.phone : "",
        label: "Primary registrant",
      });
      if (primaryContact.error || !primaryContact.phone) {
        return NextResponse.json({ error: primaryContact.error }, { status: 400 });
      }

      const primaryValidated = validatePrimaryFields(primarySource, primaryContact.phone);
      if (primaryValidated.error || !primaryValidated.input) {
        return NextResponse.json({ error: primaryValidated.error }, { status: 400 });
      }

      const members: GroupMemberInput[] = [];
      for (let i = 0; i < rawMembers.length; i++) {
        const raw = (rawMembers[i] ?? {}) as Record<string, unknown>;
        const label = `Participant ${i + 2}`;
        const contact = validatePersonContact({
          firstName: typeof raw.firstName === "string" ? raw.firstName : "",
          lastName: typeof raw.lastName === "string" ? raw.lastName : "",
          email: typeof raw.email === "string" ? raw.email : "",
          phone: typeof raw.phone === "string" ? raw.phone : "",
          label,
        });
        if (contact.error || !contact.phone) {
          return NextResponse.json({ error: contact.error }, { status: 400 });
        }
        if (typeof raw.middleName !== "string" || !raw.middleName.trim()) {
          return NextResponse.json({ error: `${label}: Middle name is required.` }, { status: 400 });
        }
        if (typeof raw.dateOfBirth !== "string" || !raw.dateOfBirth.trim()) {
          return NextResponse.json(
            { error: `${label}: Date of birth is required.` },
            { status: 400 }
          );
        }
        if (
          typeof raw.prcLicenseNumber !== "string" ||
          !raw.prcLicenseNumber.trim() ||
          typeof raw.prcInitialRegistrationDate !== "string" ||
          !raw.prcInitialRegistrationDate.trim() ||
          typeof raw.prcExpirationDate !== "string" ||
          !raw.prcExpirationDate.trim()
        ) {
          return NextResponse.json(
            { error: `${label}: Complete PRC license details are required.` },
            { status: 400 }
          );
        }
        if (!rates.includes(raw.registrationRate as RegistrationRateChoice)) {
          return NextResponse.json(
            { error: `${label}: Please choose Regular or Senior Citizen/PWD rate.` },
            { status: 400 }
          );
        }
        if (
          raw.registrationRate === "seniorPwd" &&
          (typeof raw.seniorPwdIdNumber !== "string" || !raw.seniorPwdIdNumber.trim())
        ) {
          return NextResponse.json(
            { error: `${label}: Senior Citizen/PWD ID number is required for this rate.` },
            { status: 400 }
          );
        }
        if (!foods.includes(raw.foodPreference as FoodPreference)) {
          return NextResponse.json(
            { error: `${label}: Please select a food preference.` },
            { status: 400 }
          );
        }
        if (
          raw.foodPreference === "allergy" &&
          (typeof raw.foodAllergyNote !== "string" || !raw.foodAllergyNote.trim())
        ) {
          return NextResponse.json(
            { error: `${label}: Please describe the food allergy.` },
            { status: 400 }
          );
        }

        members.push({
          firstName: String(raw.firstName ?? ""),
          lastName: String(raw.lastName ?? ""),
          middleName: String(raw.middleName ?? ""),
          email: String(raw.email ?? ""),
          phone: contact.phone,
          dateOfBirth: String(raw.dateOfBirth ?? ""),
          prcLicenseNumber: String(raw.prcLicenseNumber ?? ""),
          prcInitialRegistrationDate: String(raw.prcInitialRegistrationDate ?? ""),
          prcExpirationDate: String(raw.prcExpirationDate ?? ""),
          foodPreference: raw.foodPreference as FoodPreference,
          foodAllergyNote:
            typeof raw.foodAllergyNote === "string" ? raw.foodAllergyNote : undefined,
          registrationRate: raw.registrationRate as RegistrationRateChoice,
          seniorPwdIdNumber:
            raw.registrationRate === "seniorPwd"
              ? String(raw.seniorPwdIdNumber ?? "")
              : undefined,
        });
      }

      const eventResult = await resolveTargetEvent(primarySource.eventId ?? body.eventId);
      if ("error" in eventResult) {
        return NextResponse.json({ error: eventResult.error }, { status: 400 });
      }

      const primary: RegistrationInput = {
        ...primaryValidated.input,
        registrationMode: "group",
        eventId: eventResult.event.id,
      };

      const created = await createGroupRegistrations({ primary, members });
      const primaryRecord = created.find((r) => r.groupRole === "primary") ?? created[0];

      for (const registration of created) {
        try {
          await sendRegistrationPendingEmail(registration, {
            id: eventResult.event.id,
            title: eventResult.event.title,
            datesDisplay: eventResult.event.datesDisplay,
            venueName: eventResult.event.venueName,
            venueAddress: eventResult.event.venueAddress,
            venueMapsUrl: eventResult.event.venueMapsUrl,
          });
        } catch (mailError) {
          console.error("[register] confirmation email failed:", mailError);
        }
      }

      return NextResponse.json(
        {
          message: "Group registration successful.",
          registration: toRegistrationResponse(primaryRecord),
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

    const contact = validatePersonContact({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
    });
    if (contact.error || !contact.phone) {
      return NextResponse.json({ error: contact.error }, { status: 400 });
    }

    if (!modes.includes(body.registrationMode)) {
      return NextResponse.json(
        { error: "Please select single or group registration." },
        { status: 400 }
      );
    }

    if (body.registrationMode === "group") {
      return NextResponse.json(
        {
          error:
            "Group registration must be submitted with all participants (mode: group).",
        },
        { status: 400 }
      );
    }

    const validated = validatePrimaryFields(body as Record<string, unknown>, contact.phone);
    if (validated.error || !validated.input) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const eventResult = await resolveTargetEvent(body.eventId);
    if ("error" in eventResult) {
      return NextResponse.json({ error: eventResult.error }, { status: 400 });
    }

    const input: RegistrationInput = {
      ...validated.input,
      registrationMode: "single",
      eventId: eventResult.event.id,
    };

    const registration = await createRegistration(input);

    try {
      await sendRegistrationPendingEmail(registration, {
        id: eventResult.event.id,
        title: eventResult.event.title,
        datesDisplay: eventResult.event.datesDisplay,
        venueName: eventResult.event.venueName,
        venueAddress: eventResult.event.venueAddress,
        venueMapsUrl: eventResult.event.venueMapsUrl,
      });
    } catch (mailError) {
      console.error("[register] confirmation email failed:", mailError);
    }

    return NextResponse.json(toRegistrationResponse(registration));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
