import { InquiriesTable } from "@/components/admin/InquiriesTable";

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return <InquiriesTable initialQuery={q ?? ""} />;
}
