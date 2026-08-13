export const conference = {
  organization: "Philippine Nurses Association, Inc.",
  siteName: "Philippine Nurses Association, Inc. Website",
  shortName: "PNA",
  logo: {
    src: "/images/pna-logo.webp",
    alt: "Philippine Nurses Association, Inc. logo",
  },
  conferenceName: "2026 National Conference & General Assembly",
  theme:
    "Strengthening Institutions Through Collaborative Governance and National Excellence",
  tagline:
    "Advancing public service, institutional integrity, and inclusive national development across the Republic of the Philippines.",
  membershipRenewalUrl: "https://www.philippinenurses.org",
  hero: {
    headline: "Advancing Governance, Service, and National Development",
    description:
      "The Philippine Nurses Association, Inc. convenes senior government officials, institutional leaders, and sector representatives for a formal program of policy dialogue, technical exchange, and strategic collaboration at the Philippine International Convention Center.",
    eventCardTitle: "National Conference & General Assembly",
    limitedSeats: "Registration Open! Limited Capacity",
    video: {
      src: "/videos/hero-conference.mp4",
      srcWebm: "/videos/hero-conference.webm",
      poster: "/images/hero-conference-source.jpg",
    },
  },
  about: {
    summary:
      "The Philippine Nurses Association, Inc. serves as a national forum for constructive engagement among government agencies, local government units, the private sector, and the academic community. Our annual conference provides a structured platform to address priority development concerns through evidence-based discussion and coordinated action.",
    mission:
      "Established to promote unity, professional excellence, and accountable governance, the Association facilitates meaningful partnerships that support the nation’s development agenda and strengthen public institutions.",
  },
  benefits: [
    {
      title: "Institutional Network",
      description:
        "Engage with senior representatives from national agencies, local government, industry, and academe.",
    },
    {
      title: "Technical Program",
      description:
        "Participate in plenary addresses, policy forums, and specialized workshops led by subject-matter experts.",
    },
    {
      title: "Professional Accreditation",
      description:
        "Fulfill continuing professional development requirements through accredited conference sessions.",
    },
    {
      title: "Policy Outcomes",
      description:
        "Contribute to resolutions and collaborative initiatives that inform national development priorities.",
    },
  ],
  cta: {
    title: "Official Registration Now Open",
    description:
      "Secure your participation before the registration deadline on {regularDeadline}. Delegates are encouraged to complete registration promptly to confirm attendance and conference materials.",
  },
  dates: {
    start: "October 19, 2026",
    end: "October 21, 2026",
    display: "October 19 to 21, 2026",
  },
  venue: {
    name: "Philippine International Convention Center",
    address: "CCP Complex, Roxas Boulevard, Pasay City, Metro Manila",
    city: "Metro Manila, Philippines",
  },
  contact: {
    email: "pnanatcon2026@gmail.com",
    phone: "+63 960 620 7919",
    registrationEmail: "pnanatcon2026@gmail.com",
  },
  registration: {
    earlyBirdDeadline: "October 6, 2026",
    regularDeadline: "October 6, 2026",
    registrationClosesAt: "October 6, 2026, at 12:00 MN",
    includes:
      "2 snacks, lunch and conference kit for the 3 day event",
    bankTransfer: {
      accountName: "Philippine Nurses Association, Inc.",
      accountNumber: "3061-0869-26",
      bankName: "Bank of the Philippine Islands (BPI)",
    },
    fees: {
      earlyBird: {
        amount: 7300,
        label: "Early Bird Rate",
        caption: "First 500 registrants, or until the early bird deadline (whichever comes first)",
        cap: 500,
        mode: "slots",
      },
      regular: {
        amount: 7800,
        label: "Regular Rate (For PNA Members)",
        caption: "",
      },
      seniorPwd: {
        amount: 7300,
        label: "Senior Citizen/PWD Rate (For PNA Members)",
        caption: "",
      },
      nonMember: {
        amount: 8300,
        label: "Non-Member Rate",
        caption: "",
      },
    },
  },
  stats: [
    { value: "500+", label: "Anticipated Delegates" },
    { value: "40+", label: "Distinguished Speakers" },
    { value: "15+", label: "Technical Sessions" },
    { value: "3", label: "Conference Days" },
  ],
  pages: {
    about: {
      title: "About the Conference",
      subtitle:
        "An overview of the conference mandate, objectives, and institutional significance of the 2026 National Conference & General Assembly.",
    },
    register: {
      title: "Official Registration",
      subtitle:
        "Complete the registration form below to confirm your participation in the 2026 National Conference & General Assembly.",
    },
    contact: {
      title: "Contact the Secretariat",
      subtitle:
        "For official inquiries regarding conference participation, registration, or institutional coordination.",
    },
  },
} as const;

export type EventFeeKey = keyof typeof conference.registration.fees;

/** @deprecated Legacy category keys kept for older registration records. */
export type RegistrationCategory =
  | EventFeeKey
  | "committee"
  | "speaker"
  | "member"
  | "government"
  | "private"
  | "student";

export type { PaymentStatus, RegistrationRecord as Registration } from "@/lib/types/admin";

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/about", label: "About" },
  { href: "/register", label: "Register" },
  { href: "/contact", label: "Contact" },
] as const;

export const PNA_ZONES = [
  "NCR",
  "CAR",
  "Region 1",
  "Region 2",
  "Region 3",
  "Region 4",
  "Region 5",
  "Region 6",
  "Region 7",
  "Region 8",
  "Region 9",
  "Region 10",
  "Region 11",
  "Region 12",
  "BARMM",
  "CARAGA",
  "Foreign-based",
] as const;

export type PnaZone = (typeof PNA_ZONES)[number];

/** NCR chapters are cities grouped under Zone 1–6 (each place is its own chapter). */
export const PNA_NCR_CHAPTER_GROUPS = [
  { group: "Zone 1", chapters: ["Manila"] },
  {
    group: "Zone 2",
    chapters: ["Caloocan", "Malabon", "Navotas", "Valenzuela"],
  },
  { group: "Zone 3", chapters: ["Quezon City", "Marikina"] },
  { group: "Zone 4", chapters: ["San Juan", "Pasig", "Mandaluyong"] },
  { group: "Zone 5", chapters: ["Makati", "Taguig", "Pateros"] },
  {
    group: "Zone 6",
    chapters: ["Pasay", "Parañaque", "Muntinlupa", "Las Piñas"],
  },
] as const;

export type PnaChapterOption = {
  value: string;
  label: string;
  group?: string;
};

export const PNA_NCR_ZONES = PNA_NCR_CHAPTER_GROUPS.map((group) => group.group);

export function isNcrRegion(zone: string): boolean {
  return zone === "NCR";
}

function ncrChapterValue(zoneLabel: string, chapter: string): string {
  return `${zoneLabel} — ${chapter}`;
}

const NCR_CHAPTER_OPTIONS: readonly PnaChapterOption[] = PNA_NCR_CHAPTER_GROUPS.flatMap(
  ({ group, chapters }) =>
    chapters.map((chapter) => ({
      value: ncrChapterValue(group, chapter),
      label: chapter,
      group,
    }))
);

/** Reads Zone 1–6 from a stored NCR chapter value such as `Zone 1 — Manila`. */
export function parseNcrZoneFromChapter(chapter: string): string {
  const normalized = chapter.replace(/^NCR\s+/i, "").trim();
  return (
    PNA_NCR_ZONES.find(
      (zone) =>
        normalized === zone ||
        normalized.startsWith(`${zone} — `) ||
        normalized.startsWith(`${zone} - `)
    ) ?? ""
  );
}

/** Chapters available per PNA zone/region. */
export const PNA_CHAPTERS_BY_ZONE: Record<PnaZone, readonly string[]> = {
  NCR: NCR_CHAPTER_OPTIONS.map((option) => option.value),
  CAR: [
    "Baguio City",
    "Mountain Province",
    "Benguet",
    "Ifugao",
    "Abra",
    "Kalinga",
    "Apayao",
  ],
  "Region 1": ["Pangasinan", "La Union", "Ilocos Norte", "Ilocos Sur"],
  "Region 2": [
    "Batanes",
    "Cagayan North",
    "Cagayan South",
    "Isabela",
    "Quirino",
    "Nueva Vizcaya",
  ],
  "Region 3": [
    "Aurora",
    "Bataan",
    "Bulacan",
    "Nueva Ecija",
    "Pampanga",
    "Tarlac",
    "Zambales-Olongapo City",
  ],
  "Region 4": [
    "Batangas",
    "Cavite",
    "Laguna",
    "Quezon",
    "Rizal",
    "Marinduque",
    "Occidental Mindoro",
    "Oriental Mindoro",
    "Palawan",
    "Romblon",
  ],
  "Region 5": [
    "Albay",
    "Camarines Norte",
    "Naga City",
    "Iriga City-Rinconada",
    "Catanduanes",
    "Masbate",
    "Sorsogon",
    "Camarines Sur",
  ],
  "Region 6": [
    "Antique",
    "Capiz",
    "Iloilo",
    "Negros Occidental",
    "Aklan",
    "Guimaras",
    "San Carlos City",
  ],
  "Region 7": ["Cebu", "Negros Oriental", "Siquijor", "Bohol"],
  "Region 8": [
    "North Leyte",
    "Southern Leyte",
    "Northwestern Leyte",
    "Eastern Samar",
    "Northern Samar",
    "Northwest Samar",
    "Samar",
    "Biliran",
  ],
  "Region 9": [
    "Zamboanga City",
    "Zamboanga del Norte",
    "Zamboanga del Sur",
    "Zamboanga Sibugay",
    "Isabela City",
    "Sulu",
  ],
  "Region 10": [
    "Bukidnon",
    "Camiguin",
    "Misamis Occidental",
    "Misamis Oriental",
    "Iligan City/ Lanao del Norte",
  ],
  "Region 11": ["Davao del Norte", "Davao City", "Davao del Sur", "Davao Oriental"],
  "Region 12": [
    "North Cotabato (Kidapawan)",
    "South Cotabato",
    "General Santos City",
    "Sultan Kudarat",
    "Midsayap",
    "Sarangani",
  ],
  BARMM: [
    "Basilan",
    "Cotabato City Maguindanao",
    "Marawi City & Lanao del Sur",
    "Tawi-tawi",
  ],
  CARAGA: [
    "Agusan del Sur",
    "Surigao del Norte",
    "Surigao del Sur I",
    "Surigao del Sur District II Bislig",
    "Agusan del Norte Butuan City",
    "Dinagat Island",
  ],
  "Foreign-based": [
    "Filipino Nurses Association of Emirates (FNAE)",
    "Filipino Nurses of Saudi Arabia (FILNASA)",
    "PNA Bahrain",
    "PNA Brunei",
    "PNA Ireland",
    "PNA Jeddah",
    "PNA Qatar",
    "PNA United Arab Emirates (PNA UAE)",
    "PNA Germany",
    "PNA Hail Region, KSA",
    "PNA Italy",
    "PNA Norway",
    "PNA Switzerland",
    "PNA United Kingdom",
    "PNA Oman",
  ],
};

export function getPnaChaptersForZone(zone: string, ncrZone = ""): readonly string[] {
  if (!zone) return [];
  if (zone === "NCR") {
    const options = ncrZone
      ? NCR_CHAPTER_OPTIONS.filter((option) => option.group === ncrZone)
      : NCR_CHAPTER_OPTIONS;
    return options.map((option) => option.value);
  }
  return PNA_CHAPTERS_BY_ZONE[zone as PnaZone] ?? [];
}

/** Chapter select options. For NCR, pass the selected Zone 1–6 to list that zone’s cities. */
export function getPnaChapterSelectOptions(
  zone: string,
  ncrZone = ""
): readonly PnaChapterOption[] {
  if (!zone) return [];
  if (zone === "NCR") {
    if (!ncrZone) return [];
    return getPnaChaptersForZone(zone, ncrZone).map((value) => {
      const option = NCR_CHAPTER_OPTIONS.find((item) => item.value === value);
      return { value, label: option?.label ?? value };
    });
  }
  return getPnaChaptersForZone(zone).map((chapter) => ({
    value: chapter,
    label: chapter,
  }));
}

export const objectives = [
  {
    title: "Promote Collaborative Governance",
    description:
      "Foster structured partnerships among national government agencies, local government units, and civil society organizations in addressing development priorities.",
  },
  {
    title: "Facilitate Knowledge Exchange",
    description:
      "Provide a formal venue for sharing best practices, program innovations, and lessons learned from institutions across the country.",
  },
  {
    title: "Support Professional Development",
    description:
      "Deliver accredited continuing professional development sessions for public officials, practitioners, and sector professionals.",
  },
  {
    title: "Advance Policy Resolutions",
    description:
      "Conduct the General Assembly to deliberate and adopt resolutions that guide the Association’s advocacy and institutional programs.",
  },
  {
    title: "Reaffirm National Commitment",
    description:
      "Strengthen collective resolve toward inclusive progress, good governance, and institutional excellence.",
  },
  {
    title: "Expand Strategic Partnerships",
    description:
      "Enable delegates to establish professional relationships that extend beyond the conference period.",
  },
] as const;

export const attendees = [
  "National and local government officials",
  "PNA members and affiliated organizations",
  "Private sector and industry association representatives",
  "Members of the academic and research community",
  "Civil society and non-government organization leaders",
  "International delegates and development partners",
] as const;
