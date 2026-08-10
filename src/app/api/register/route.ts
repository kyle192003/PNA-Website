import { NextResponse } from "next/server";
import {
  getEmailValidationError,
  getNameLengthError,
  getRegistrationPhoneValidationError,
  toPhMobileInternational,
} from "@/lib/form-validation";
import { createRegistration } from "@/lib/registrations";
import { getActiveEvent, getOpenEventById } from "@/lib/events";
import { sendRegistrationPendingEmail } from "@/lib/mail-templates";
import type {
  FoodPreference,
  MembershipType,
  RegistrationGroupMemberNote,
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

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit(`register:${ip}`, 10, 60_000);
    if (!limited.ok) {
      return rateLimitResponse(limited.retryAfterSeconds);
    }

    const body = await request.json();
    const contact = validatePersonContact({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
    });
    if (contact.error || !contact.phone) {
      return NextResponse.json({ error: contact.error }, { status: 400 });
    }

    if (!body.middleName?.trim()) {
      return NextResponse.json({ error: "Middle name is required." }, { status: 400 });
    }
    if (!body.dateOfBirth?.trim()) {
      return NextResponse.json({ error: "Date of birth is required." }, { status: 400 });
    }
    if (!body.gender?.trim()) {
      return NextResponse.json({ error: "Gender is required." }, { status: 400 });
    }
    if (!body.organization?.trim() || !body.institutionAddress?.trim() || !body.position?.trim()) {
      return NextResponse.json(
        { error: "Institution/company name, address, and position are required." },
        { status: 400 }
      );
    }
    if (!membershipTypes.includes(body.membershipType)) {
      return NextResponse.json({ error: "Please select a valid membership type." }, { status: 400 });
    }
    if (!body.pnaIdNumber?.trim()) {
      return NextResponse.json({ error: "PNA ID number is required." }, { status: 400 });
    }
    if (!body.pnaZone?.trim() || !body.pnaChapter?.trim()) {
      return NextResponse.json({ error: "PNA zone/region and chapter are required." }, { status: 400 });
    }
    if (
      !body.prcLicenseNumber?.trim() ||
      !body.prcInitialRegistrationDate?.trim() ||
      !body.prcExpirationDate?.trim()
    ) {
      return NextResponse.json({ error: "Complete PRC license details are required." }, { status: 400 });
    }
    if (!modes.includes(body.registrationMode)) {
      return NextResponse.json({ error: "Please select single or group registration." }, { status: 400 });
    }
    if (!rates.includes(body.registrationRate)) {
      return NextResponse.json({ error: "Please choose Regular or Senior Citizen/PWD rate." }, { status: 400 });
    }
    if (body.registrationRate === "seniorPwd" && !body.seniorPwdIdNumber?.trim()) {
      return NextResponse.json(
        { error: "Senior Citizen/PWD ID number is required for this rate." },
        { status: 400 }
      );
    }
    if (!foods.includes(body.foodPreference)) {
      return NextResponse.json({ error: "Please select a food preference." }, { status: 400 });
    }
    if (!sponsors.includes(body.sponsorConsent)) {
      return NextResponse.json({ error: "Please answer the sponsor consent question." }, { status: 400 });
    }
    if (!body.dataPrivacyConsent) {
      return NextResponse.json({ error: "Data privacy consent is required." }, { status: 400 });
    }
    if (!body.paymentReference?.trim()) {
      return NextResponse.json({ error: "Payment reference number is required." }, { status: 400 });
    }

    const eventResult = await resolveTargetEvent(body.eventId);
    if ("error" in eventResult) {
      return NextResponse.json({ error: eventResult.error }, { status: 400 });
    }

    const groupMembersNote = Array.isArray(body.groupMembersNote)
      ? (body.groupMembersNote as RegistrationGroupMemberNote[])
      : [];

    if (body.registrationMode === "group" && groupMembersNote.length < 1) {
      return NextResponse.json(
        { error: "For group registration, list at least one other group member." },
        { status: 400 }
      );
    }

    const input: RegistrationInput = {
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName,
      email: body.email,
      phone: contact.phone,
      dateOfBirth: body.dateOfBirth,
      age: typeof body.age === "number" ? body.age : Number(body.age) || null,
      gender: body.gender,
      organization: body.organization,
      institutionAddress: body.institutionAddress,
      position: body.position,
      membershipType: body.membershipType,
      pnaIdNumber: body.pnaIdNumber,
      pnaZone: body.pnaZone,
      pnaChapter: body.pnaChapter,
      prcLicenseNumber: body.prcLicenseNumber,
      prcInitialRegistrationDate: body.prcInitialRegistrationDate,
      prcExpirationDate: body.prcExpirationDate,
      registrationMode: body.registrationMode,
      registrationRate: body.registrationRate,
      seniorPwdIdNumber: body.seniorPwdIdNumber,
      groupMembersNote,
      foodPreference: body.foodPreference,
      foodAllergyNote: body.foodAllergyNote,
      sponsorConsent: body.sponsorConsent,
      dataPrivacyConsent: Boolean(body.dataPrivacyConsent),
      paymentReference: body.paymentReference,
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

    return NextResponse.json({
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
