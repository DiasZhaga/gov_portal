export type Role = "citizen" | "operator" | "admin";

export type ServiceType =
  | "birth_certificate"
  | "residence_certificate"
  | "tax_clearance";

export type RequestStatus =
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected";

export interface UserPublic {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface ServiceRequestPublic {
  id: string;
  service_type: ServiceType;
  title: string;
  description: string;
  status: RequestStatus;
  public_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttachmentPublic {
  id: string;
  request_id: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}
