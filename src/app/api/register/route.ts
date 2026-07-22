import { NextResponse } from "next/server";
import { conference, type RegistrationCategory } from "@/lib/conference";
import { getEmailValidationError, getPhoneValidationError } from "@/lib/form-validation";
import { createRegistration } from "@/lib/registrations";
import { getActiveEvent, getOpenEventById } from "@/lib/events";
import { sendRegistrationPendingEmail } from "@/lib/mail-templates";

const validCategories = Object.keys(conference.registration.fees) as RegistrationCategory[];

export async function POST(request: Request) {
  try {
    const body = await request.json();

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

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const emailError = getEmailValidationError(email ?? "");
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }

    const phoneError = getPhoneValidationError(phone ?? "");
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 });
    }

    if (!organization?.trim() || !position?.trim()) {
      return NextResponse.json(
        { error: "Organization and position are required." },
        { status: 400 }
      );
    }

    if (!category || !validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Please select a valid registration category." },
        { status: 400 }
      );
    }

    if (feeTier && feeTier !== "early" && feeTier !== "regular") {
      return NextResponse.json(
        { error: "Please select a valid payment amount." },
        { status: 400 }
      );
    }

    if (!address?.trim() || !city?.trim() || !province?.trim()) {
      return NextResponse.json({ error: "Complete address is required." }, { status: 400 });
    }

    if (!agreeToTerms) {
      return NextResponse.json(
        { error: "You must agree to the terms and conditions." },
        { status: 400 }
      );
    }

    let targetEvent = eventId ? await getOpenEventById(eventId) : await getActiveEvent();

    if (eventId && !targetEvent) {
      return NextResponse.json(
        { error: "This event is not open for registration." },
        { status: 400 }
      );
    }

    if (!targetEvent) {
      return NextResponse.json(
        { error: "No event is currently open for registration." },
        { status: 400 }
      );
    }

    const registration = await createRegistration({
      firstName,
      lastName,
      middleInitial,
      email,
      phone,
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
        registration: {
          referenceNumber: registration.referenceNumber,
          firstName: registration.firstName,
          lastName: registration.lastName,
          middleInitial: registration.middleInitial,
          email: registration.email,
          category: registration.category,
          feeTier: registration.feeTier,
          paymentAmount: registration.paymentAmount,
          eventTitle: targetEvent.title,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
