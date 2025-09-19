import { Request, Response } from 'express';
import pool from '../services/db';
import { verifyPassword } from '../utils/passwordUtils';
import { signToken } from '../utils/tokenUtils';
import { authConfig } from '../constants/auth';
import { fetchPerfilModules } from '../services/moduleService';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const login = async (req: Request, res: Response) => {
  const { email, senha } = req.body as { email?: unknown; senha?: unknown };

  if (typeof email !== 'string' || typeof senha !== 'string') {
    res.status(400).json({ error: 'Credenciais inválidas.' });
    return;
  }

  try {
    const normalizedEmail = normalizeEmail(email);

    const userResult = await pool.query(
      `SELECT u.id,
              u.nome_completo,
              u.email,
              u.senha,
              u.status,
              u.perfil,
              u.empresa AS empresa_id,
              emp.nome_empresa AS empresa_nome,
              u.setor AS setor_id,
              esc.nome AS setor_nome
         FROM public.usuarios u
         LEFT JOIN public.empresas emp ON emp.id = u.empresa
         LEFT JOIN public.escritorios esc ON esc.id = u.setor
        WHERE LOWER(u.email) = $1
        LIMIT 1`,
      [normalizedEmail]
    );

    if (userResult.rowCount === 0) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    const user = userResult.rows[0] as {
      id: number;
      nome_completo: string;
      email: string;
      senha: string | null;
      status: boolean | null;
      perfil: number | string | null;
      empresa_id: number | null;
      empresa_nome: string | null;
      setor_id: number | null;
      setor_nome: string | null;
    };

    if (user.status === false) {
      res.status(403).json({ error: 'Usuário inativo.' });
      return;
    }

    const passwordMatches = await verifyPassword(senha, user.senha);

    if (!passwordMatches) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    const token = signToken(
      {
        sub: user.id,
        email: user.email,
        name: user.nome_completo,
      },
      authConfig.secret,
      authConfig.expirationSeconds
    );

    const modulos = await fetchPerfilModules(user.perfil);

    res.json({
      token,
      expiresIn: authConfig.expirationSeconds,
      user: {
        id: user.id,
        nome_completo: user.nome_completo,
        email: user.email,
        perfil: user.perfil,
        modulos,
        empresa_id: user.empresa_id,
        empresa_nome: user.empresa_nome,
        setor_id: user.setor_id,
        setor_nome: user.setor_nome,
      },
    });
  } catch (error) {
    console.error('Erro ao realizar login', error);
    res.status(500).json({ error: 'Não foi possível concluir a autenticação.' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT u.id,
              u.nome_completo,
              u.email,
              u.perfil,
              u.status,
              u.empresa AS empresa_id,
              emp.nome_empresa AS empresa_nome,
              u.setor AS setor_id,
              esc.nome AS setor_nome
         FROM public.usuarios u
         LEFT JOIN public.empresas emp ON emp.id = u.empresa
         LEFT JOIN public.escritorios esc ON esc.id = u.setor
        WHERE u.id = $1
        LIMIT 1`,
      [req.auth.userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const user = result.rows[0];

    const modulos = await fetchPerfilModules(user.perfil);

    res.json({
      id: user.id,
      nome_completo: user.nome_completo,
      email: user.email,
      perfil: user.perfil,
      status: user.status,
      empresa_id: user.empresa_id,
      empresa_nome: user.empresa_nome,
      setor_id: user.setor_id,
      setor_nome: user.setor_nome,
      modulos,
    });
  } catch (error) {
    console.error('Erro ao carregar usuário autenticado', error);
    res.status(500).json({ error: 'Não foi possível carregar os dados do usuário.' });
  }
};
