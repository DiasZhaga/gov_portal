import type { UserPublic, ServiceRequestPublic, AttachmentPublic, LoginResponse } from "./types";

// ── Mock users ──────────────────────────────────────────────────
export const MOCK_USERS: (UserPublic & { password: string })[] = [
  {
    id: "u1",
    full_name: "Jane Smith",
    email: "citizen@demo.com",
    password: "password",
    role: "citizen",
    created_at: "2025-01-10T08:00:00Z",
  },
  {
    id: "u2",
    full_name: "Mark Operator",
    email: "operator@demo.com",
    password: "password",
    role: "operator",
    created_at: "2025-01-05T08:00:00Z",
  },
];

// ── Mock requests ────────────────────────────────────────────────
export const MOCK_REQUESTS: ServiceRequestPublic[] = [
  {
    id: "r1",
    service_type: "birth_certificate",
    title: "Birth certificate for my newborn child",
    description:
      "My child was born on March 15, 2025 at City General Hospital. I need an official birth certificate for registration purposes.",
    status: "approved",
    public_comment: "Your birth certificate has been approved and will be mailed within 5 business days.",
    created_at: "2025-03-20T10:30:00Z",
    updated_at: "2025-03-25T14:00:00Z",
  },
  {
    id: "r2",
    service_type: "residence_certificate",
    title: "Proof of residence for visa application",
    description:
      "I need a residence certificate for my Schengen visa application. I have been living at my current address for 3 years.",
    status: "in_review",
    public_comment: null,
    created_at: "2025-04-01T09:00:00Z",
    updated_at: "2025-04-03T11:00:00Z",
  },
  {
    id: "r3",
    service_type: "tax_clearance",
    title: "Tax clearance certificate for property purchase",
    description:
      "I am purchasing a property and the notary requires a tax clearance certificate showing no outstanding liabilities.",
    status: "submitted",
    public_comment: null,
    created_at: "2025-04-08T16:00:00Z",
    updated_at: "2025-04-08T16:00:00Z",
  },
  {
    id: "r4",
    service_type: "birth_certificate",
    title: "Replacement birth certificate — original lost",
    description:
      "My original birth certificate was lost during a home move. I need a replacement copy for identity verification.",
    status: "rejected",
    public_comment:
      "Request rejected due to insufficient identification documents. Please re-submit with a valid government-issued photo ID.",
    created_at: "2025-02-14T08:00:00Z",
    updated_at: "2025-02-20T10:00:00Z",
  },
];

// ── Mock attachments ─────────────────────────────────────────────
export const MOCK_ATTACHMENTS: AttachmentPublic[] = [
  {
    id: "a1",
    request_id: "r1",
    original_filename: "hospital-discharge.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 245760,
    uploaded_at: "2025-03-20T10:35:00Z",
  },
];
