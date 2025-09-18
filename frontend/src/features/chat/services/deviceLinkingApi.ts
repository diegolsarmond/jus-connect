import { wahaService } from "@/services/waha";

export interface DeviceSessionEngineInfo {
  grpc?: { client?: string | null; stream?: string | null } | null;
  gows?: { found?: boolean; connected?: boolean } | null;
}

export interface DeviceSessionInfo {
  name: string;
  status: string;
  config?: Record<string, unknown> | null;
  engine?: DeviceSessionEngineInfo | null;
}

interface ApiEmpresa {
  id?: number | string | null;
  nome_empresa?: string | null;
  nome?: string | null;
  ativo?: boolean | string | number | null;
}

interface CompanySummary {
  id: number;
  name: string;
  isActive: boolean;
}

const fallbackSessionName = "Jusconnect";

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const removeAccents = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC");

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toBooleanOrUndefined = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (["1", "true", "sim", "ativo", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "nao", "não", "inativo", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

const sanitizeSessionInfo = (value: unknown, fallbackName: string): DeviceSessionInfo => {
  if (!value || typeof value !== "object") {
    return { name: fallbackName, status: "UNKNOWN" };
  }
  const record = value as Record<string, unknown>;
  const name = normalizeString(record.name) ?? fallbackName;
  const status = normalizeString(record.status) ?? "UNKNOWN";
  return {
    name,
    status,
    config: (record.config as Record<string, unknown> | null | undefined) ?? null,
    engine: (record.engine as DeviceSessionEngineInfo | null | undefined) ?? null,
  };
};

const parseErrorResponse = async (response: Response): Promise<string> => {
  try {
    const data = (await response.clone().json()) as Record<string, unknown>;
    const errorMessage = normalizeString(data?.error) ?? normalizeString(data?.message);
    if (errorMessage) {
      return errorMessage;
    }
  } catch (error) {
    // Ignore JSON parse errors and fall back to reading text content below.
  }

  try {
    const text = await response.text();
    const normalized = text.trim();
    if (normalized) {
      return normalized;
    }
  } catch (error) {
    // Ignore text parse errors.
  }

  return `WAHA API respondeu com status ${response.status}`;
};

const buildWahaUrl = (baseUrl: string, path: string): string => {
  if (!path.startsWith("/")) {
    return `${baseUrl}/${path}`;
  }
  return `${baseUrl}${path}`;
};

export const deriveSessionName = (companyName?: string | null): string => {
  const normalizedOriginal = normalizeString(companyName);
  if (normalizedOriginal) {
    return normalizedOriginal;
  }

  if (!companyName) {
    return fallbackSessionName;
  }

  const normalized = removeAccents(companyName)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");

  return normalized.length > 0 ? normalized : fallbackSessionName;
};

export const fetchPreferredCompany = async (): Promise<CompanySummary | null> => {
  const response = await fetch("/api/empresas", { headers: { Accept: "application/json" } });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return null;
  }

  const companies: CompanySummary[] = [];

  for (const item of payload) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as ApiEmpresa;
    const id = toNumberOrNull(record.id);
    const name = normalizeString(record.nome_empresa) ?? normalizeString(record.nome);

    if (id === null || !name) {
      continue;
    }

    const isActive = toBooleanOrUndefined(record.ativo) ?? true;
    companies.push({ id, name, isActive });
  }

  if (companies.length === 0) {
    return null;
  }

  const activeCompany = companies.find((company) => company.isActive);
  return activeCompany ?? companies[0]!;
};

export const fetchDeviceSession = async (sessionName: string): Promise<DeviceSessionInfo | null> => {
  const config = await wahaService.getResolvedConfig();
  const url = buildWahaUrl(config.baseUrl, `/api/sessions/${encodeURIComponent(sessionName)}`);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Api-Key": config.apiKey,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  return sanitizeSessionInfo(data, sessionName);
};

export const createDeviceSession = async (
  sessionName: string,
  companyName?: string,
): Promise<DeviceSessionInfo> => {
  const config = await wahaService.getResolvedConfig();
  const url = buildWahaUrl(config.baseUrl, "/api/sessions");
  const payload = {
    name: sessionName,
    start: true,
    config: {
      metadata: {
        "jusconnect.company": companyName ?? sessionName,
        "jusconnect.createdAt": new Date().toISOString(),
      },
      noweb: {
        markOnline: true,
        store: {
          enabled: true,
          fullSync: false,
        },
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Api-Key": config.apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  return sanitizeSessionInfo(data, sessionName);
};

export const ensureDeviceSession = async (
  sessionName: string,
  companyName?: string,
): Promise<DeviceSessionInfo> => {
  const existing = await fetchDeviceSession(sessionName);
  if (existing) {
    return existing;
  }

  await createDeviceSession(sessionName, companyName);
  const created = await fetchDeviceSession(sessionName);
  if (created) {
    return created;
  }

  throw new Error("Sessão criada, mas não foi possível confirmar o status.");
};

export const logoutDeviceSession = async (sessionName: string): Promise<void> => {
  const config = await wahaService.getResolvedConfig();
  const url = buildWahaUrl(
    config.baseUrl,
    `/api/sessions/${encodeURIComponent(sessionName)}/logout`,
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-Api-Key": config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Não foi possível ler o QR Code."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Falha ao carregar o QR Code."));
    };
    reader.readAsDataURL(blob);
  });

export const fetchSessionQrCode = async (sessionName: string): Promise<string | null> => {
  const config = await wahaService.getResolvedConfig();
  const url = buildWahaUrl(
    config.baseUrl,
    `/api/${encodeURIComponent(sessionName)}/auth/qr?format=image`,
  );

  const response = await fetch(url, {
    headers: {
      Accept: "image/png",
      "X-Api-Key": config.apiKey,
    },
  });

  if (response.status === 404 || response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const blob = await response.blob();
  if (!blob || blob.size === 0) {
    return null;
  }

  return blobToDataUrl(blob);
};
