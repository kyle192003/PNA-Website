import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLayoutWrapper } from "@/components/admin/AdminLayoutWrapper";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { countNewInquiries } from "@/lib/inquiries";
import { countParticipantsUnderReview } from "@/lib/registrations";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!verifySessionToken(token)) {
    redirect("/");
  }

  const [newInquiryCount, underReviewCount] = await Promise.all([
    countNewInquiries(),
    countParticipantsUnderReview(),
  ]);

  return (
    <main className="flex-grow-1">
      <AdminLayoutWrapper newInquiryCount={newInquiryCount} underReviewCount={underReviewCount}>
        {children}
      </AdminLayoutWrapper>
    </main>
  );
}
