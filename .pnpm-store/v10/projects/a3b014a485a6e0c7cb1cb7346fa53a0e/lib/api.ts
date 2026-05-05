import type {
  UserPublic,
  ServiceRequestPublic,
  AttachmentPublic,
  AuthTokenResponse,
  AccessTokenResponse,
  LoginResponse,
  MfaSetupResponse,
  ServiceType,
  RequestStatus,
} from "./types";
import { MOCK_USERS, MOCK_REQUESTS, MOCK_ATTACHMENTS } from "./mock-data";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const ENABLE_MOCK_API = process.env.NEXT_PUBLIC_ENABLE_MOCK_API === "true";
const API_MODE = BASE_URL ? "real" : ENABLE_MOCK_API ? "mock" : "invalid";

export const FRONTEND_CONFIG_ERROR =
  "Frontend is not configured: set NEXT_PUBLIC_API_URL or explicitly enable mock mode.";

export function isFrontendConfigError(error: unknown): boolean {
  return error instanceof Error && error.message === FRONTEND_CONFIG_ERROR;
}

if (API_MODE === "mock" && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn("NEXT_PUBLIC_ENABLE_MOCK_API=true. Using explicit mock API mode.");
}

function ensureFrontendConfigured(): void {
  if (API_MODE === "invalid") {
    throw new Error(FRONTEND_CONFIG_ERROR);
  }
}

let mockRequests: ServiceRequestPublic[] = [...MOCK_REQUESTS];
let mockAttachments: AttachmentPublic[] = [...MOCK_ATTACHMENTS];

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", token);
}

function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("mock_user_id");
}

async function refreshAccessToken(): Promise<string | null> {
  ensureFrontendConfigured();

  const refreshToken = getRefreshToken();
  if (!refreshToken || API_MODE !== "real") {
    return null;
  }

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as AccessTokenResponse;
  setAccessToken(data.access_token);
  return data.access_token;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
  retryOnAuthFailure = true
): Promise<T> {
  ensureFrontendConfigured();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (
      auth &&
      retryOnAuthFailure &&
      path !== "/auth/refresh" &&
      path !== "/auth/logout"
    ) {
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        return request<T>(path, options, auth, false);
      }
    }

    if (typeof window !== "undefined") {
      clearStoredAuth();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    throw new Error("Требуется авторизация.");
  }

  if (res.status === 403) {
    if (
      typeof window !== "undefined" &&
      window.location.pathname !== "/no-permission"
    ) {
      window.location.href = "/no-permission";
    }
    throw new Error("Нет доступа.");
  }

  if (!res.ok) {
    let message = `Ошибка запроса: ${res.status}`;
    try {
      const body = await res.json();
      if (Array.isArray(body?.detail)) {
        message =
          body.detail
            .map((d: { msg?: string }) => d.msg)
            .filter(Boolean)
            .join("; ") || message;
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

function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMockUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mock_user_id");
}

export const authApi = {
  register: async (data: {
    full_name: string;
    email: string;
    iin: string;
    password: string;
  }): Promise<UserPublic> => {
    if (API_MODE === "real") {
      return request<UserPublic>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
        false
      );
    }
    ensureFrontendConfigured();
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
    const { password: _, ...publicUser } = newUser;
    return publicUser;
  },

  login: async (data: {
    email: string;
    password: string;
  }): Promise<LoginResponse> => {
    if (API_MODE === "real") {
      return request<LoginResponse>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
        false
      );
    }
    ensureFrontendConfigured();
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
    if (typeof window !== "undefined") {
      localStorage.setItem("mock_user_id", user.id);
    }
    return {
      access_token: `mock_token_${user.id}`,
      refresh_token: `mock_refresh_${user.id}`,
      token_type: "bearer",
    };
  },

  verifyMfaLogin: async (data: {
    mfa_token: string;
    code: string;
  }): Promise<AuthTokenResponse> => {
    if (API_MODE === "real") {
      return request<AuthTokenResponse>(
        "/auth/mfa/verify",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
        false
      );
    }
    ensureFrontendConfigured();
    await delay();
    if (!/^\d{6}$/.test(data.code)) {
      throw new Error("Invalid MFA verification.");
    }
    const userId = data.mfa_token.replace("mock_mfa_", "");
    const user = MOCK_USERS.find((candidate) => candidate.id === userId);
    if (!user) throw new Error("Invalid MFA verification.");
    if (typeof window !== "undefined") {
      localStorage.setItem("mock_user_id", user.id);
    }
    return {
      access_token: `mock_token_${user.id}`,
      refresh_token: `mock_refresh_${user.id}`,
      token_type: "bearer",
    };
  },

  me: async (): Promise<UserPublic> => {
    if (API_MODE === "real") {
      return request<UserPublic>("/auth/me");
    }
    ensureFrontendConfigured();
    await delay(100);
    const userId = getMockUserId();
    const user = MOCK_USERS.find((candidate) => candidate.id === userId);
    if (!user) throw new Error("Unauthorized");
    const { password: _, ...publicUser } = user;
    return publicUser;
  },

  setupMfa: async (): Promise<MfaSetupResponse> => {
    if (API_MODE === "real") {
      return request<MfaSetupResponse>("/auth/mfa/setup", { method: "POST" });
    }
    ensureFrontendConfigured();
    await delay();
    const userId = getMockUserId();
    const user = MOCK_USERS.find((candidate) => candidate.id === userId);
    if (!user) throw new Error("Unauthorized");
    return {
      otpauth_uri: `otpauth://totp/Gossector:${encodeURIComponent(
        user.email
      )}?secret=MOCKSECRET123456&issuer=Gossector`,
    };
  },

  confirmMfa: async (data: { code: string }): Promise<UserPublic> => {
    if (API_MODE === "real") {
      return request<UserPublic>("/auth/mfa/confirm", {
        method: "POST",
        body: JSON.stringify(data),
      });
    }
    ensureFrontendConfigured();
    await delay();
    if (!/^\d{6}$/.test(data.code)) throw new Error("Invalid MFA code.");
    const userId = getMockUserId();
    const user = MOCK_USERS.find((candidate) => candidate.id === userId);
    if (!user) throw new Error("Unauthorized");
    user.mfa_enabled = true;
    const { password: _, ...publicUser } = user;
    return publicUser;
  },

  refresh: async (): Promise<AccessTokenResponse> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error("Требуется авторизация.");
    }

    if (API_MODE === "real") {
      return request<AccessTokenResponse>(
        "/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
        false,
        false
      );
    }

    ensureFrontendConfigured();
    await delay();
    return { access_token: "mock_refreshed_token", token_type: "bearer" };
  },

  logout: async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return;
    }

    if (API_MODE === "real") {
      await request(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
        false,
        false
      );
      return;
    }

    ensureFrontendConfigured();
    await delay();
  },
};

export const citizenApi = {
  createRequest: async (data: {
    service_type: ServiceType;
    title: string;
    description: string;
  }): Promise<ServiceRequestPublic> => {
    if (API_MODE === "real") {
      return request<ServiceRequestPublic>("/requests", {
        method: "POST",
        body: JSON.stringify(data),
      });
    }
    ensureFrontendConfigured();
    await delay();
    const now = new Date().toISOString();
    const newRequest: ServiceRequestPublic = {
      id: `r${Date.now()}`,
      ...data,
      status: "submitted",
      public_comment: null,
      created_at: now,
      updated_at: now,
    };
    mockRequests = [newRequest, ...mockRequests];
    return newRequest;
  },

  getMyRequests: async (): Promise<ServiceRequestPublic[]> => {
    if (API_MODE === "real") {
      return request<ServiceRequestPublic[]>("/requests/my");
    }
    ensureFrontendConfigured();
    await delay();
    return [...mockRequests];
  },

  getRequest: async (id: string): Promise<ServiceRequestPublic> => {
    if (API_MODE === "real") {
      return request<ServiceRequestPublic>(`/requests/${id}`);
    }
    ensureFrontendConfigured();
    await delay();
    const requestItem = mockRequests.find((item) => item.id === id);
    if (!requestItem) throw new Error("Request not found.");
    return requestItem;
  },

  getRequestAttachments: async (id: string): Promise<AttachmentPublic[]> => {
    if (API_MODE === "real") {
      return request<AttachmentPublic[]>(`/requests/${id}/attachments`);
    }
    ensureFrontendConfigured();
    await delay();
    return mockAttachments
      .filter((attachment) => attachment.request_id === id)
      .sort((left, right) => right.uploaded_at.localeCompare(left.uploaded_at));
  },

  uploadAttachment: async (
    id: string,
    file: File
  ): Promise<AttachmentPublic> => {
    if (API_MODE === "real") {
      const form = new FormData();
      form.append("file", file);
      return request<AttachmentPublic>(`/requests/${id}/attachments`, {
        method: "POST",
        body: form,
      });
    }
    ensureFrontendConfigured();
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

  downloadAttachment: async (attachment: AttachmentPublic): Promise<void> => {
    if (API_MODE === "real") {
      const tryDownload = async (retryOnAuthFailure: boolean): Promise<void> => {
        const headers: Record<string, string> = {};
        const token = getAccessToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(
          `${BASE_URL}/attachments/${attachment.id}/download`,
          { headers }
        );

        if (res.status === 401) {
          if (retryOnAuthFailure) {
            const newAccessToken = await refreshAccessToken();
            if (newAccessToken) {
              return tryDownload(false);
            }
          }

          if (typeof window !== "undefined") {
            clearStoredAuth();
            if (window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
          }
          throw new Error("Требуется авторизация.");
        }

        if (res.status === 403) {
          if (
            typeof window !== "undefined" &&
            window.location.pathname !== "/no-permission"
          ) {
            window.location.href = "/no-permission";
          }
          throw new Error("Нет доступа.");
        }

        if (!res.ok) {
          let message = `Ошибка загрузки: ${res.status}`;
          try {
            const body = await res.json();
            if (typeof body?.detail === "string") {
              message = body.detail;
            }
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }

        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = attachment.original_filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      };

      return tryDownload(true);
    }

    ensureFrontendConfigured();
    await delay();
    const blob = new Blob(
      [`Mock attachment: ${attachment.original_filename}`],
      { type: attachment.mime_type || "application/octet-stream" }
    );
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = attachment.original_filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  },
};

export const operatorApi = {
  getAllRequests: async (): Promise<ServiceRequestPublic[]> => {
    if (API_MODE === "real") {
      return request<ServiceRequestPublic[]>("/operator/requests");
    }
    ensureFrontendConfigured();
    await delay();
    return [...mockRequests];
  },

  updateStatus: async (
    id: string,
    data: { status: RequestStatus; public_comment?: string }
  ): Promise<ServiceRequestPublic> => {
    if (API_MODE === "real") {
      return request<ServiceRequestPublic>(`/operator/requests/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    }
    ensureFrontendConfigured();
    await delay();
    const index = mockRequests.findIndex((item) => item.id === id);
    if (index === -1) throw new Error("Request not found.");
    const updatedRequest: ServiceRequestPublic = {
      ...mockRequests[index],
      status: data.status,
      public_comment: data.public_comment ?? mockRequests[index].public_comment,
      updated_at: new Date().toISOString(),
    };
    mockRequests = mockRequests.map((item) => (item.id === id ? updatedRequest : item));
    return updatedRequest;
  },
};
