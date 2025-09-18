export interface AuthUser {
  id: number;
  nome_completo: string;
  email: string;
  perfil: number | null;
  status?: boolean | null;
  modulos: string[];
  empresa_id: number | null;
  empresa_nome: string | null;
  setor_id: number | null;
  setor_nome: string | null;
}

export interface LoginCredentials {
  email: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  expiresIn?: number;
  user: AuthUser;
}
