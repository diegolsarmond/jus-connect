export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'advogado' | 'estagiario' | 'secretario';
  escritorio: string;
  oab?: {
    numero: string;
    uf: string;
  };
  especialidades: string[];
  tarifaPorHora?: number;
  timezone: string;
  idioma: string;
  avatar?: string;
  ativo: boolean;
  ultimoLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserFormData {
  name: string;
  email: string;
  phone: string;
  role: User['role'];
  escritorio: string;
  oabNumero?: string;
  oabUf?: string;
  especialidades: string[];
  tarifaPorHora?: number;
  timezone: string;
  idioma: string;
  avatar?: string;
  lgpdConsent: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  description: string;
  timestamp: Date;
  performedBy: string;
  performedById?: string | null;
}

export interface UserSession {
  id: string;
  userId: string;
  device: string;
  location: string | null;
  lastActivity: Date;
  isActive: boolean;
  createdAt?: Date;
  revokedAt?: Date | null;
  isCurrent?: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}