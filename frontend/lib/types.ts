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
  iin_masked: string;
  role: Role;
  mfa_enabled: boolean;
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

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: "bearer";
}

export interface LoginMfaRequiredResponse {
  mfa_required: true;
  mfa_token: string;
  token_type: "mfa";
}

export type LoginResponse = AuthTokenResponse | LoginMfaRequiredResponse;

export interface MfaSetupResponse {
  otpauth_uri: string;
}
