import type {
  UserPublic,
  ServiceRequestPublic,
  AttachmentPublic,
  LoginResponse,
  MfaSetupResponse,
  TokenResponse,
  ServiceType,
  RequestStatus,
} from "./types";
import {
  MOCK_USERS,
  MOCK_REQUESTS,
  MOCK_ATTACHMENTS,
} from "./mock-data";

// ── Config ────────────────────────────────────────────────────────
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const IS_MOCK = BASE_URL.length === 0;

if (IS_MOCK && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn("NEXT_PUBLIC_API_URL is not set. Using mock API data.");
}

// ── In-memory mock store (persisted per session via module scope) ──
let mockRequests: ServiceRequestPublic[] = [...MOCK_REQUESTS];
let mockAttachments: AttachmentPublic[] = [...MOCK_ATTACHMENTS];

// ── Token helpers ─────────────────────────────────────────────────
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

// ── Real HTTP client ──────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    throw new Error("Требуется авторизация.");
  }

  if (res.status === 403) {
    if (typeof window !== "undefined" && window.location.pathname !== "/no-permission") {
      window.location.href = "/no-permission";
    }
    throw new Error("Нет доступа.");
  }

  if (!res.ok) {
    let message = `Ошибка запроса: ${res.status}`;
    try {
      const body = await res.json();
      if (Array.isArray(body?.detail)) {
        message = body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ") || message;
      } else if (typeof body?.detail === "string") {
        message = body.detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Mock delay helper ─────────────────────────────────────────────
function delay(ms = 400): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getMockUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mock_user_id");
}

// ── Auth API ──────────────────────────────────────────────────────
export const authApi = {
  register: async (data: {
    full_name: string;
    email: string;
    iin: string;
    password: string;
  }): Promise<UserPublic> => {
    if (!IS_MOCK) {
      return request<UserPublic>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }, false);
    }
    await delay();
    const existing = MOCK_USERS.find(
      (u) => u.email === data.email || u.iin_masked.endsWith(data.iin.slice(-4))
    );
    if (existing) throw new Error("Registration could not be completed.");
    const newUser: UserPublic & { password: string } = {
      id: `u${Date.now()}`,
      full_name: data.full_name,
      email: data.email,
      iin_masked: `********${data.iin.slice(-4)}`,
      password: data.password,
      role: "citizen",
      mfa_enabled: false,
      created_at: new Date().toISOString(),
    };
    MOCK_USERS.push(newUser);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...pub } = newUser;
    return pub;
  },

  login: async (data: {
    email: string;
    password: string;
  }): Promise<LoginResponse> => {
    if (!IS_MOCK) {
      return request<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }, false);
    }
    await delay();
    const user = MOCK_USERS.find(
      (u) => u.email === data.email && u.password === data.password
    );
    if (!user) throw new Error("Invalid email or password.");
    if (user.mfa_enabled) {
      return {
        mfa_required: true,
        mfa_token: `mock_mfa_${user.id}`,
        token_type: "mfa",
      };
    }
    // Store user id so me() can look it up
    if (typeof window !== "undefined") {
      localStorage.setItem("mock_user_id", user.id);
    }
    return { access_token: `mock_token_${user.id}`, token_type: "bearer" };
  },

  verifyMfaLogin: async (data: {
    mfa_token: string;
    code: string;
  }): Promise<TokenResponse> => {
    if (!IS_MOCK) {
      return request<TokenResponse>("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify(data),
      }, false);
    }
    await delay();
    if (!/^\d{6}$/.test(data.code)) throw new Error("Invalid MFA verification.");
    const userId = data.mfa_token.replace("mock_mfa_", "");
    const user = MOCK_USERS.find((u) => u.id === userId);
    if (!user) throw new Error("Invalid MFA verification.");
    if (typeof window !== "undefined") {
      localStorage.setItem("mock_user_id", user.id);
    }
    return { access_token: `mock_token_${user.id}`, token_type: "bearer" };
  },

  me: async (): Promise<UserPublic> => {
    if (!IS_MOCK) return request<UserPublic>("/auth/me");
    await delay(100);
    const uid = getMockUserId();
    const user = MOCK_USERS.find((u) => u.id === uid);
    if (!user) throw new Error("Unauthorized");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...pub } = user;
    return pub;
  },

  setupMfa: async (): Promise<MfaSetupResponse> => {
    if (!IS_MOCK) {
      return request<MfaSetupResponse>("/auth/mfa/setup", { method: "POST" });
    }
    await delay();
    const uid = getMockUserId();
    const user = MOCK_USERS.find((u) => u.id === uid);
    if (!user) throw new Error("Unauthorized");
    return {
      otpauth_uri: `otpauth://totp/Gossector:${encodeURIComponent(user.email)}?secret=MOCKSECRET123456&issuer=Gossector`,
    };
  },

  confirmMfa: async (data: { code: string }): Promise<UserPublic> => {
    if (!IS_MOCK) {
      return request<UserPublic>("/auth/mfa/confirm", {
        method: "POST",
        body: JSON.stringify(data),
      });
    }
    await delay();
    if (!/^\d{6}$/.test(data.code)) throw new Error("Invalid MFA code.");
    const uid = getMockUserId();
    const user = MOCK_USERS.find((u) => u.id === uid);
    if (!user) throw new Error("Unauthorized");
    user.mfa_enabled = true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...pub } = user;
    return pub;
  },
};

// ── Citizen API ───────────────────────────────────────────────────
export const citizenApi = {
  createRequest: async (data: {
    service_type: ServiceType;
    title: string;
    description: string;
  }): Promise<ServiceRequestPublic> => {
    if (!IS_MOCK) {
      return request<ServiceRequestPublic>("/requests", {
        method: "POST",
        body: JSON.stringify(data),
      });
    }
    await delay();
    const now = new Date().toISOString();
    const newReq: ServiceRequestPublic = {
      id: `r${Date.now()}`,
      ...data,
      status: "submitted",
      public_comment: null,
      created_at: now,
      updated_at: now,
    };
    mockRequests = [newReq, ...mockRequests];
    return newReq;
  },

  getMyRequests: async (): Promise<ServiceRequestPublic[]> => {
    if (!IS_MOCK) return request<ServiceRequestPublic[]>("/requests/my");
    await delay();
    // Citizen u1 owns all mock requests; new requests are also returned
    return [...mockRequests];
  },

  getRequest: async (id: string): Promise<ServiceRequestPublic> => {
    if (!IS_MOCK) return request<ServiceRequestPublic>(`/requests/${id}`);
    await delay();
    const req = mockRequests.find((r) => r.id === id);
    if (!req) throw new Error("Request not found.");
    return req;
  },

  uploadAttachment: async (id: string, file: File): Promise<AttachmentPublic> => {
    if (!IS_MOCK) {
      const form = new FormData();
      form.append("file", file);
      return request<AttachmentPublic>(`/requests/${id}/attachments`, {
        method: "POST",
        body: form,
      });
    }
    await delay(800);
    const attachment: AttachmentPublic = {
      id: `a${Date.now()}`,
      request_id: id,
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      uploaded_at: new Date().toISOString(),
    };
    mockAttachments = [attachment, ...mockAttachments];
    return attachment;
  },
};

// ── Operator API ──────────────────────────────────────────────────
export const operatorApi = {
  getAllRequests: async (): Promise<ServiceRequestPublic[]> => {
    if (!IS_MOCK) return request<ServiceRequestPublic[]>("/operator/requests");
    await delay();
    return [...mockRequests];
  },

  updateStatus: async (
    id: string,
    data: { status: RequestStatus; public_comment?: string }
  ): Promise<ServiceRequestPublic> => {
    if (!IS_MOCK) {
      return request<ServiceRequestPublic>(`/operator/requests/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    }
    await delay();
    const idx = mockRequests.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Request not found.");
    const updated: ServiceRequestPublic = {
      ...mockRequests[idx],
      status: data.status,
      public_comment: data.public_comment ?? mockRequests[idx].public_comment,
      updated_at: new Date().toISOString(),
    };
    mockRequests = mockRequests.map((r) => (r.id === id ? updated : r));
    return updated;
  },
};
