/**
 * Hit the reminders cron endpoint.
 * Usage: CRON_SECRET=... node scripts/send-reminders.js
 * Optional: SITE_URL=http://localhost:3000
 */
const secret = process.env.CRON_SECRET;
const base = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

if (!secret) {
  console.error("Set CRON_SECRET before running reminders.");
  process.exit(1);
}

async function main() {
  const res = await fetch(`${base}/api/cron/reminders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
  const body = await res.text();
  console.log(res.status, body);
  if (!res.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
