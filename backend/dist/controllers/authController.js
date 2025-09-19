"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = exports.login = void 0;
const db_1 = __importDefault(require("../services/db"));
const passwordUtils_1 = require("../utils/passwordUtils");
const tokenUtils_1 = require("../utils/tokenUtils");
const auth_1 = require("../constants/auth");
const moduleService_1 = require("../services/moduleService");
const normalizeEmail = (email) => email.trim().toLowerCase();
const login = async (req, res) => {
    const { email, senha } = req.body;
    if (typeof email !== 'string' || typeof senha !== 'string') {
        res.status(400).json({ error: 'Credenciais inválidas.' });
        return;
    }
    try {
        const normalizedEmail = normalizeEmail(email);
        const userResult = await db_1.default.query(`SELECT u.id,
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
        LIMIT 1`, [normalizedEmail]);
        if (userResult.rowCount === 0) {
            res.status(401).json({ error: 'E-mail ou senha incorretos.' });
            return;
        }
        const user = userResult.rows[0];
        if (user.status === false) {
            res.status(403).json({ error: 'Usuário inativo.' });
            return;
        }
        const passwordMatches = await (0, passwordUtils_1.verifyPassword)(senha, user.senha);
        if (!passwordMatches) {
            res.status(401).json({ error: 'E-mail ou senha incorretos.' });
            return;
        }
        const token = (0, tokenUtils_1.signToken)({
            sub: user.id,
            email: user.email,
            name: user.nome_completo,
        }, auth_1.authConfig.secret, auth_1.authConfig.expirationSeconds);
        const modulos = await (0, moduleService_1.fetchPerfilModules)(user.perfil);
        res.json({
            token,
            expiresIn: auth_1.authConfig.expirationSeconds,
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
    }
    catch (error) {
        console.error('Erro ao realizar login', error);
        res.status(500).json({ error: 'Não foi possível concluir a autenticação.' });
    }
};
exports.login = login;
const getCurrentUser = async (req, res) => {
    if (!req.auth) {
        res.status(401).json({ error: 'Token inválido.' });
        return;
    }
    try {
        const result = await db_1.default.query(`SELECT u.id,
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
        LIMIT 1`, [req.auth.userId]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Usuário não encontrado.' });
            return;
        }
        const user = result.rows[0];
        const modulos = await (0, moduleService_1.fetchPerfilModules)(user.perfil);
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
    }
    catch (error) {
        console.error('Erro ao carregar usuário autenticado', error);
        res.status(500).json({ error: 'Não foi possível carregar os dados do usuário.' });
    }
};
exports.getCurrentUser = getCurrentUser;
