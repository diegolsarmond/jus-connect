"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetUsuarioSenha = exports.deleteUsuario = exports.updateUsuario = exports.createUsuario = exports.getUsuarioById = exports.listUsuariosByEmpresa = exports.listUsuarios = void 0;
const db_1 = __importDefault(require("../services/db"));
const passwordResetService_1 = require("../services/passwordResetService");
const parseOptionalId = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return null;
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
            return 'invalid';
        }
        return parsed;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || !Number.isInteger(value)) {
            return 'invalid';
        }
        return value;
    }
    return 'invalid';
};
const parseStatus = (value) => {
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
        if ([
            'true',
            '1',
            't',
            'y',
            'yes',
            'sim',
            'ativo',
            'active',
        ].includes(normalized)) {
            return true;
        }
        if ([
            'false',
            '0',
            'f',
            'n',
            'no',
            'nao',
            'não',
            'inativo',
            'inactive',
        ].includes(normalized)) {
            return false;
        }
        return 'invalid';
    }
    return 'invalid';
};
const baseUsuarioSelect = 'SELECT u.id, u.nome_completo, u.cpf, u.email, u.perfil, u.empresa, u.setor, u.oab, u.status, u.senha, u.telefone, u.ultimo_login, u.observacoes, u.datacriacao FROM public.usuarios u';
const fetchAuthenticatedUserEmpresa = async (userId) => {
    const empresaUsuarioResult = await db_1.default.query('SELECT empresa FROM public.usuarios WHERE id = $1 LIMIT 1', [userId]);
    if (empresaUsuarioResult.rowCount === 0) {
        return {
            success: false,
            status: 404,
            message: 'Usuário autenticado não encontrado',
        };
    }
    const empresaAtualResult = parseOptionalId(empresaUsuarioResult.rows[0].empresa);
    if (empresaAtualResult === 'invalid') {
        return {
            success: false,
            status: 500,
            message: 'Não foi possível identificar a empresa do usuário autenticado.',
        };
    }
    return {
        success: true,
        empresaId: empresaAtualResult,
    };
};
const listUsuarios = async (req, res) => {
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const result = await db_1.default.query(baseUsuarioSelect);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listUsuarios = listUsuarios;
const listUsuariosByEmpresa = async (req, res) => {
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
            return res.json([]);
        }
        const result = await db_1.default.query(`${baseUsuarioSelect} WHERE u.empresa = $1`, [
            empresaId,
        ]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listUsuariosByEmpresa = listUsuariosByEmpresa;
const getUsuarioById = async (req, res) => {
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
        const result = await db_1.default.query(`${baseUsuarioSelect} WHERE u.id = $1 AND u.empresa IS NOT DISTINCT FROM $2::INT`, [id, empresaId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getUsuarioById = getUsuarioById;
const createUsuario = async (req, res) => {
    const { nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, } = req.body;
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const parsedStatus = parseStatus(status);
        if (parsedStatus === 'invalid') {
            return res.status(400).json({ error: 'Status inválido' });
        }
        const empresaIdResult = parseOptionalId(empresa);
        if (empresaIdResult === 'invalid') {
            return res.status(400).json({ error: 'ID de empresa inválido' });
        }
        const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const empresaAtualResult = empresaLookup.empresaId;
        if (empresaIdResult !== null && empresaAtualResult !== null && empresaIdResult !== empresaAtualResult) {
            return res
                .status(403)
                .json({ error: 'Usuários só podem criar usuários vinculados à sua própria empresa.' });
        }
        if (empresaIdResult !== null && empresaAtualResult === null) {
            return res
                .status(403)
                .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
        }
        const empresaId = empresaAtualResult;
        if (empresaId !== null) {
            const empresaExists = await db_1.default.query('SELECT 1 FROM public.empresas WHERE id = $1', [empresaId]);
            if (empresaExists.rowCount === 0) {
                return res.status(400).json({ error: 'Empresa informada não existe' });
            }
        }
        const setorIdResult = parseOptionalId(setor);
        if (setorIdResult === 'invalid') {
            return res.status(400).json({ error: 'ID de setor inválido' });
        }
        const setorId = setorIdResult;
        if (setorId !== null) {
            const setorExists = await db_1.default.query('SELECT 1 FROM public.escritorios WHERE id = $1', [setorId]);
            if (setorExists.rowCount === 0) {
                return res
                    .status(400)
                    .json({ error: 'Setor informado não existe' });
            }
        }
        const result = await db_1.default.query('INSERT INTO public.usuarios (nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING id, nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao', [
            nome_completo,
            cpf,
            email,
            perfil,
            empresaId,
            setorId,
            oab,
            parsedStatus,
            senha,
            telefone,
            ultimo_login,
            observacoes,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createUsuario = createUsuario;
const updateUsuario = async (req, res) => {
    const { id } = req.params;
    const { nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, } = req.body;
    try {
        const parsedStatus = parseStatus(status);
        if (parsedStatus === 'invalid') {
            return res.status(400).json({ error: 'Status inválido' });
        }
        const empresaIdResult = parseOptionalId(empresa);
        if (empresaIdResult === 'invalid') {
            return res.status(400).json({ error: 'ID de empresa inválido' });
        }
        const empresaId = empresaIdResult;
        if (empresaId !== null) {
            const empresaExists = await db_1.default.query('SELECT 1 FROM public.empresas WHERE id = $1', [empresaId]);
            if (empresaExists.rowCount === 0) {
                return res.status(400).json({ error: 'Empresa informada não existe' });
            }
        }
        const setorIdResult = parseOptionalId(setor);
        if (setorIdResult === 'invalid') {
            return res.status(400).json({ error: 'ID de setor inválido' });
        }
        const setorId = setorIdResult;
        if (setorId !== null) {
            const setorExists = await db_1.default.query('SELECT 1 FROM public.escritorios WHERE id = $1', [setorId]);
            if (setorExists.rowCount === 0) {
                return res
                    .status(400)
                    .json({ error: 'Setor informado não existe' });
            }
        }
        const result = await db_1.default.query('UPDATE public.usuarios SET nome_completo = $1, cpf = $2, email = $3, perfil = $4, empresa = $5, setor = $6, oab = $7, status = $8, senha = $9, telefone = $10, ultimo_login = $11, observacoes = $12 WHERE id = $13 RETURNING id, nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao', [
            nome_completo,
            cpf,
            email,
            perfil,
            empresaId,
            setorId,
            oab,
            parsedStatus,
            senha,
            telefone,
            ultimo_login,
            observacoes,
            id,
        ]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateUsuario = updateUsuario;
const deleteUsuario = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM public.usuarios WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteUsuario = deleteUsuario;
const resetUsuarioSenha = async (req, res) => {
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
        const targetUserResult = await db_1.default.query('SELECT id, nome_completo, email, empresa FROM public.usuarios WHERE id = $1 LIMIT 1', [targetUserId]);
        if (targetUserResult.rowCount === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        const targetUserRow = targetUserResult.rows[0];
        const targetUserEmail = typeof targetUserRow.email === 'string' ? targetUserRow.email.trim() : '';
        if (!targetUserEmail) {
            return res.status(400).json({ error: 'Usuário não possui e-mail cadastrado.' });
        }
        const targetEmpresaIdResult = parseOptionalId(targetUserRow.empresa);
        if (targetEmpresaIdResult === 'invalid') {
            return res
                .status(500)
                .json({ error: 'Não foi possível validar a empresa associada ao usuário informado.' });
        }
        const requesterEmpresaId = empresaLookup.empresaId;
        if (requesterEmpresaId !== null &&
            targetEmpresaIdResult !== null &&
            requesterEmpresaId !== targetEmpresaIdResult) {
            return res
                .status(403)
                .json({ error: 'Usuário não possui permissão para resetar a senha deste colaborador.' });
        }
        await (0, passwordResetService_1.createPasswordResetRequest)({
            id: targetUserRow.id,
            nome_completo: typeof targetUserRow.nome_completo === 'string'
                ? targetUserRow.nome_completo
                : 'Usuário',
            email: targetUserEmail,
        });
        return res.status(200).json({
            message: 'Senha redefinida com sucesso. Enviamos as instruções para o e-mail cadastrado.',
        });
    }
    catch (error) {
        console.error('Erro ao resetar senha do usuário', error);
        return res.status(500).json({ error: 'Não foi possível redefinir a senha do usuário.' });
    }
};
exports.resetUsuarioSenha = resetUsuarioSenha;
