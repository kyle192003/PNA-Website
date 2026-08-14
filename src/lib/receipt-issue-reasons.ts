/** One-click reasons used by admin and accountant review. */
export const RECEIPT_ISSUE_REASONS = [
  "Receipt is blurry — please re-upload a clearer photo.",
  "Reference number is missing or unreadable on the receipt.",
  "Amount does not match the registration fee.",
  "Incomplete proof — please upload the full receipt/screenshot.",
] as const;

export type ReceiptIssueReason = (typeof RECEIPT_ISSUE_REASONS)[number];
