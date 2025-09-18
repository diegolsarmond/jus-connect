export interface AuthUser {
  id: number;
  nome_completo: string;
  email: string;
  perfil: number | null;
  status?: boolean | null;
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
