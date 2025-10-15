import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchPlanLimitsForCompany, countCompanyResource } from '../services/planLimitsService';
import { createEmailConfirmationToken } from '../services/emailConfirmationService';
import { invalidateUserModulesCache } from '../middlewares/moduleAuthorization';

import {
  createPasswordResetRequest,
  generateTemporaryPassword,
} from '../services/passwordResetService';
import { hashPassword } from '../utils/passwordUtils';
import { newUserWelcomeEmailService } from '../services/newUserWelcomeEmailService';
import { fetchAuthenticatedUserEmpresa, parseOptionalInteger } from '../utils/authUser';
import { sanitizeDigits } from '../utils/sanitizeDigits';


let welcomeEmailService = newUserWelcomeEmailService;

export const __setWelcomeEmailServiceForTests = (
  service: typeof newUserWelcomeEmailService
) => {
  welcomeEmailService = service;
};

export const __resetWelcomeEmailServiceForTests = () => {
  welcomeEmailService = newUserWelcomeEmailService;
};

const parseStatus = (value: unknown): boolean | 'invalid' => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    return 'invalid';
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === '') {
      return 'invalid';
    }

    if (
      [
        'true',
        '1',
        't',
        'y',
        'yes',
        'sim',
        'ativo',
        'active',
      ].includes(normalized)
    ) {
      return true;
    }

    if (
      [
        'false',
        '0',
        'f',
        'n',
        'no',
        'nao',
        'não',
        'inativo',
        'inactive',
      ].includes(normalized)
    ) {
      return false;
    }

    return 'invalid';
  }

  return 'invalid';
};

const normalizeOptionalCpf = (value: unknown): string | null | 'invalid' => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return 'invalid';
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const digits = sanitizeDigits(trimmed);

  if (!digits || digits.length !== 11) {
    return 'invalid';
  }

  return digits;
};

const normalizeOptionalTelefone = (value: unknown): string | null | 'invalid' => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return 'invalid';
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const digits = sanitizeDigits(trimmed);

  if (!digits || digits.length < 10 || digits.length > 11) {
    return 'invalid';
  }

  return digits;
};

const baseUsuarioSelect =
  'SELECT u.id, u.nome_completo, u.cpf, u.email, u.perfil, u.empresa, u.setor, u.oab, p.oab_number, p.oab_uf, u.status, u.telefone, u.ultimo_login, u.observacoes, u.welcome_email_pending, u.datacriacao FROM public.usuarios u LEFT JOIN public.user_profiles p ON p.user_id = u.id';

type UsuarioRow = {
  id: number;
  nome_completo: string;
  cpf: string | null;
  email: string;
  perfil: string | null;
  empresa: number | null;
  setor: number | null;
  oab: string | null;
  oab_number: string | null;
  oab_uf: string | null;
  status: boolean;
  telefone: string | null;
  ultimo_login: Date | string | null;
  observacoes: string | null;
  welcome_email_pending: boolean;
  datacriacao: Date | string;
};

type UsuarioResponse = Omit<UsuarioRow, 'cpf'>;

const mapUsuarioRowToResponse = (row: UsuarioRow): UsuarioResponse => {
  const {
    id,
    nome_completo,
    email,
    perfil,
    empresa,
    setor,
    oab,
    oab_number,
    oab_uf,
    status,
    telefone,
    ultimo_login,
    observacoes,
    welcome_email_pending,
    datacriacao,
  } = row;

  return {
    id,
    nome_completo,
    email,
    perfil,
    empresa,
    setor,
    oab,
    oab_number,
    oab_uf,
    status,
    telefone,
    ultimo_login,
    observacoes,
    welcome_email_pending,
    datacriacao,
  };
};

export const listUsuarios = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(`${baseUsuarioSelect} WHERE u.empresa = $1`, [
      empresaId,
    ]);
    res.json(result.rows.map((row) => mapUsuarioRowToResponse(row as UsuarioRow)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listUsuariosByEmpresa = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(`${baseUsuarioSelect} WHERE u.empresa = $1`, [
      empresaId,
    ]);
    res.json(result.rows.map((row) => mapUsuarioRowToResponse(row as UsuarioRow)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUsuarioById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    const result = await pool.query(
      empresaId === null
        ? `${baseUsuarioSelect} WHERE u.id = $1`
        : `${baseUsuarioSelect} WHERE u.id = $1 AND u.empresa IS NOT DISTINCT FROM $2::INT`,
      empresaId === null ? [id] : [id, empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(mapUsuarioRowToResponse(result.rows[0] as UsuarioRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUsuario = async (req: Request, res: Response) => {
  const {
    nome_completo,
    cpf,
    email,
    perfil,
    empresa,
    setor,
    oab,
    status,
    telefone,
    ultimo_login,
    observacoes,
  } = req.body;

  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const parsedStatus = parseStatus(status);
    if (parsedStatus === 'invalid') {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const empresaIdResult = parseOptionalInteger(empresa);
    if (empresaIdResult === 'invalid') {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const empresaAtualResult = empresaLookup.empresaId;

    let empresaId = empresaAtualResult;

    if (empresaIdResult !== null) {
      if (empresaAtualResult !== null && empresaIdResult !== empresaAtualResult) {
        return res
          .status(403)
          .json({ error: 'Usuários só podem criar usuários vinculados à sua própria empresa.' });
      }

      empresaId = empresaIdResult;
    }

    if (empresaId !== null) {
      const empresaExists = await pool.query(
        'SELECT 1 FROM public.empresas WHERE id = $1',
        [empresaId]
      );
      if (empresaExists.rowCount === 0) {
        return res.status(400).json({ error: 'Empresa informada não existe' });
      }

      const planLimits = await fetchPlanLimitsForCompany(empresaId);
      if (planLimits?.limiteUsuarios != null) {
        const usuariosCount = await countCompanyResource(empresaId, 'usuarios');
        if (usuariosCount >= planLimits.limiteUsuarios) {
          return res
            .status(403)
            .json({ error: 'Limite de usuários do plano atingido.' });
        }
      }
    }

    const setorIdResult = parseOptionalInteger(setor);
    if (setorIdResult === 'invalid') {
      return res.status(400).json({ error: 'ID de setor inválido' });
    }
    const setorId = setorIdResult;

    if (setorId !== null) {
      const setorExists = await pool.query(
        'SELECT 1 FROM public.escritorios WHERE id = $1',
        [setorId]
      );
      if (setorExists.rowCount === 0) {
        return res
          .status(400)
          .json({ error: 'Setor informado não existe' });
      }
    }

    const normalizedEmail = typeof email === 'string' ? email.trim() : '';

    if (normalizedEmail.length === 0) {
      return res.status(400).json({ error: 'E-mail é obrigatório para criação de usuário.' });
    }

    const cpfNormalizado = normalizeOptionalCpf(cpf);
    if (cpfNormalizado === 'invalid') {
      return res.status(400).json({ error: 'CPF deve conter 11 dígitos.' });
    }

    const telefoneNormalizado = normalizeOptionalTelefone(telefone);
    if (telefoneNormalizado === 'invalid') {
      return res
        .status(400)
        .json({ error: 'Telefone deve conter 10 ou 11 dígitos.' });
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(temporaryPassword);

    const result = await pool.query(
      'INSERT INTO public.usuarios (nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, must_change_password, telefone, ultimo_login, observacoes, welcome_email_pending, datacriacao) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11, $12, TRUE, NOW()) RETURNING id, nome_completo, cpf, email, perfil, empresa, setor, oab, status, telefone, ultimo_login, observacoes, welcome_email_pending, datacriacao',
      [
        nome_completo,
        cpf,
        normalizedEmail,
        perfil,
        empresaId,
        setorId,
        oab,
        parsedStatus,
        hashedPassword,
        telefone,
        ultimo_login,
        observacoes,
      ]
    );

    const createdUser = result.rows[0];
    const rawCreatedUserId = (createdUser as { id?: unknown })?.id;
    const createdUserIdResult = parseOptionalInteger(rawCreatedUserId);

    if (typeof createdUserIdResult !== 'number') {
      console.error('ID inválido retornado ao criar usuário.');

      try {
        if (rawCreatedUserId !== undefined) {
          await pool.query('UPDATE public.usuarios SET welcome_email_pending = TRUE WHERE id = $1', [
            rawCreatedUserId,
          ]);
        }
      } catch (cleanupError) {
        console.error('Falha ao remover usuário após erro de identificação', cleanupError);
      }

      return res
        .status(500)
        .json({ error: 'Não foi possível enviar a senha provisória para o novo usuário.' });
    }

    const createdUserId = createdUserIdResult;
    const userNameForEmail =
      typeof nome_completo === 'string' && nome_completo.trim().length > 0
        ? nome_completo
        : 'Usuário';

    let confirmationLink: string;

    try {
      confirmationLink = await createEmailConfirmationToken({
        id: createdUserId,
        nome_completo: userNameForEmail,
        email: normalizedEmail,
      });
    } catch (tokenError) {
      console.error('Erro ao gerar link de confirmação para novo usuário', tokenError);

      try {
        await pool.query('UPDATE public.usuarios SET welcome_email_pending = TRUE WHERE id = $1', [
          createdUserId,
        ]);
      } catch (cleanupError) {
        console.error('Falha ao remover usuário após erro na geração de link de confirmação', cleanupError);
      }

      return res
        .status(500)
        .json({ error: 'Não foi possível enviar a senha provisória para o novo usuário.' });
    }

    try {
      await welcomeEmailService.sendWelcomeEmail({
        to: normalizedEmail,
        userName: userNameForEmail,
        temporaryPassword,
        confirmationLink,
      });
    } catch (emailError) {
      console.error('Erro ao enviar senha provisória para novo usuário', emailError);

      try {
        await pool.query('UPDATE public.usuarios SET welcome_email_pending = TRUE WHERE id = $1', [
          createdUserId,
        ]);
      } catch (cleanupError) {
        console.error('Falha ao remover usuário após erro no envio de e-mail', cleanupError);
      }

      return res
        .status(500)
        .json({ error: 'Não foi possível enviar a senha provisória para o novo usuário.' });
    }

    try {
      await pool.query('UPDATE public.usuarios SET welcome_email_pending = FALSE WHERE id = $1', [
        createdUserId,
      ]);
      (createdUser as { welcome_email_pending?: boolean }).welcome_email_pending = false;
    } catch (cleanupError) {
      console.error('Falha ao remover usuário após erro no envio de e-mail', cleanupError);
    }

    res.status(201).json(mapUsuarioRowToResponse(createdUser as UsuarioRow));
  } catch (error) {
    const pgError = error as { code?: string | number; message?: unknown } | null;

    if (pgError && typeof pgError === 'object') {
      const code = pgError.code != null ? String(pgError.code) : undefined;
      const message = typeof pgError.message === 'string' ? pgError.message : '';

      if (code === '23505' || message.toLowerCase().includes('duplicate key value')) {
        return res.status(409).json({ error: 'E-mail já cadastrado.' });
      }

      if (code === '23503' || message.toLowerCase().includes('foreign key')) {
        return res
          .status(400)
          .json({ error: 'Não foi possível criar o usuário com os vínculos informados.' });
      }

      if (
        (code && ['57P03', '08006', '08001'].includes(code)) ||
        message.toLowerCase().includes('not accepting connections') ||
        message.toLowerCase().includes('database system is starting up')
      ) {
        return res
          .status(503)
          .json({ error: 'Serviço temporariamente indisponível. Tente novamente mais tarde.' });
      }
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    nome_completo,
    cpf,
    email,
    perfil,
    empresa,
    setor,
    oab,
    status,
    senha,
    telefone,
    ultimo_login,
    observacoes,
  } = req.body;

  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const targetLookup = await pool.query(
      'SELECT empresa FROM public.usuarios WHERE id = $1 LIMIT 1',
      [id]
    );

    if (targetLookup.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const targetEmpresaResult = parseOptionalInteger(
      (targetLookup.rows[0] as { empresa: unknown }).empresa
    );

    if (targetEmpresaResult === 'invalid') {
      return res
        .status(500)
        .json({ error: 'Não foi possível validar a empresa associada ao usuário informado.' });
    }

    const requesterEmpresaId = empresaLookup.empresaId;

    const parsedStatus = parseStatus(status);
    if (parsedStatus === 'invalid') {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const empresaIdResult = parseOptionalInteger(empresa);
    if (empresaIdResult === 'invalid') {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }
    const empresaId = empresaIdResult;

    if (
      requesterEmpresaId !== null &&
      targetEmpresaResult !== null &&
      requesterEmpresaId !== targetEmpresaResult
    ) {
      return res
        .status(403)
        .json({ error: 'Usuário não possui permissão para atualizar este colaborador.' });
    }

    if (
      requesterEmpresaId !== null &&
      empresaId !== null &&
      requesterEmpresaId !== empresaId
    ) {
      return res
        .status(403)
        .json({ error: 'Usuário não possui permissão para atualizar este colaborador.' });
    }

    if (empresaId !== null) {
      const empresaExists = await pool.query(
        'SELECT 1 FROM public.empresas WHERE id = $1',
        [empresaId]
      );
      if (empresaExists.rowCount === 0) {
        return res.status(400).json({ error: 'Empresa informada não existe' });
      }
    }

    const setorIdResult = parseOptionalInteger(setor);
    if (setorIdResult === 'invalid') {
      return res.status(400).json({ error: 'ID de setor inválido' });
    }
    const setorId = setorIdResult;

    if (setorId !== null) {
      const setorExists = await pool.query(
        'SELECT 1 FROM public.escritorios WHERE id = $1',
        [setorId]
      );
      if (setorExists.rowCount === 0) {
        return res
          .status(400)
          .json({ error: 'Setor informado não existe' });
      }
    }

    const cpfNormalizado = normalizeOptionalCpf(cpf);
    if (cpfNormalizado === 'invalid') {
      return res.status(400).json({ error: 'CPF deve conter 11 dígitos.' });
    }

    const telefoneNormalizado = normalizeOptionalTelefone(telefone);
    if (telefoneNormalizado === 'invalid') {
      return res
        .status(400)
        .json({ error: 'Telefone deve conter 10 ou 11 dígitos.' });
    }

    let senhaParaAtualizar = senha;
    if (
      typeof senha === 'string' &&
      senha.length > 0 &&
      !senha.startsWith('argon2:') &&
      !senha.startsWith('sha256:')
    ) {
      senhaParaAtualizar = await hashPassword(senha);
    }

    const result = await pool.query(
      'UPDATE public.usuarios SET nome_completo = $1, cpf = $2, email = $3, perfil = $4, empresa = $5, setor = $6, oab = $7, status = $8, senha = $9, telefone = $10, ultimo_login = $11, observacoes = $12 WHERE id = $13 RETURNING id, nome_completo, cpf, email, perfil, empresa, setor, oab, status, telefone, ultimo_login, observacoes, welcome_email_pending, datacriacao',
      [
        nome_completo,
        cpfNormalizado,
        email,
        perfil,
        empresaId,
        setorId,
        oab,
        parsedStatus,
        senhaParaAtualizar,
        telefoneNormalizado,
        ultimo_login,
        observacoes,
        id,
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    invalidateUserModulesCache(id);
    res.json(mapUsuarioRowToResponse(result.rows[0] as UsuarioRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const targetLookup = await pool.query(
      'SELECT empresa FROM public.usuarios WHERE id = $1 LIMIT 1',
      [id]
    );

    if (targetLookup.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const targetEmpresaResult = parseOptionalInteger(
      (targetLookup.rows[0] as { empresa: unknown }).empresa
    );

    if (targetEmpresaResult === 'invalid') {
      return res
        .status(500)
        .json({ error: 'Não foi possível validar a empresa associada ao usuário informado.' });
    }

    const requesterEmpresaId = empresaLookup.empresaId;

    if (
      requesterEmpresaId !== null &&
      targetEmpresaResult !== null &&
      requesterEmpresaId !== targetEmpresaResult
    ) {
      return res
        .status(403)
        .json({ error: 'Usuário não possui permissão para remover este colaborador.' });
    }

    const result = await pool.query(
      'DELETE FROM public.usuarios WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    invalidateUserModulesCache(id);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetUsuarioSenha = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: 'Token inválido.' });
  }

  const { id } = req.params;

  const targetUserId = Number.parseInt(id, 10);

  if (!Number.isFinite(targetUserId)) {
    return res.status(400).json({ error: 'ID de usuário inválido.' });
  }

  try {
    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const targetUserResult = await pool.query(
      'SELECT id, nome_completo, email, empresa FROM public.usuarios WHERE id = $1 LIMIT 1',
      [targetUserId]
    );

    if (targetUserResult.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const targetUserRow = targetUserResult.rows[0] as {
      id: number;
      nome_completo: unknown;
      email: unknown;
      empresa: unknown;
    };

    const targetUserEmail = typeof targetUserRow.email === 'string' ? targetUserRow.email.trim() : '';

    if (!targetUserEmail) {
      return res.status(400).json({ error: 'Usuário não possui e-mail cadastrado.' });
    }

    const targetEmpresaIdResult = parseOptionalInteger(targetUserRow.empresa);

    if (targetEmpresaIdResult === 'invalid') {
      return res
        .status(500)
        .json({ error: 'Não foi possível validar a empresa associada ao usuário informado.' });
    }

    const requesterEmpresaId = empresaLookup.empresaId;

    if (
      requesterEmpresaId !== null &&
      targetEmpresaIdResult !== null &&
      requesterEmpresaId !== targetEmpresaIdResult
    ) {
      return res
        .status(403)
        .json({ error: 'Usuário não possui permissão para resetar a senha deste colaborador.' });
    }

    await createPasswordResetRequest({
      id: targetUserRow.id,
      nome_completo:
        typeof targetUserRow.nome_completo === 'string'
          ? targetUserRow.nome_completo
          : 'Usuário',
      email: targetUserEmail,
    });

    return res.status(200).json({
      message: 'Senha redefinida com sucesso. Enviamos as instruções para o e-mail cadastrado.',
    });
  } catch (error) {
    console.error('Erro ao resetar senha do usuário', error);
    return res.status(500).json({ error: 'Não foi possível redefinir a senha do usuário.' });
  }
};

