"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = exports.refreshToken = exports.login = exports.register = void 0;
const db_1 = __importDefault(require("../services/db"));
const passwordUtils_1 = require("../utils/passwordUtils");
const tokenUtils_1 = require("../utils/tokenUtils");
const auth_1 = require("../constants/auth");
const moduleService_1 = require("../services/moduleService");
const modules_1 = require("../constants/modules");
const subscriptionService_1 = require("../services/subscriptionService");
const TRIAL_DURATION_DAYS = 14;
const GRACE_PERIOD_DAYS = 10;
const parseOptionalInteger = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const normalized = Math.trunc(value);
        return Number.isNaN(normalized) ? null : normalized;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
};
const parseBooleanFlag = (value) => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return null;
        }
        return value !== 0;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return null;
        }
        if (['1', 'true', 't', 'yes', 'y', 'sim', 'on', 'ativo', 'ativa'].includes(normalized)) {
            return true;
        }
        if (['0', 'false', 'f', 'no', 'n', 'nao', 'não', 'off', 'inativo', 'inativa'].includes(normalized)) {
            return false;
        }
    }
    return null;
};
const parseDateValue = (value) => {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            return null;
        }
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return parsed;
    }
    return null;
};
const addDays = (date, days) => {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
};
const calculateLegacyTrialEnd = (startDate) => {
    if (!startDate) {
        return null;
    }
    return addDays(startDate, TRIAL_DURATION_DAYS);
};
const resolveSubscriptionPayload = (row) => {
    const planId = parseOptionalInteger(row.empresa_plano);
    const isActive = parseBooleanFlag(row.empresa_ativo);
    const startedAtDate = (() => {
        const datacadastro = parseDateValue(row.empresa_datacadastro);
        if (datacadastro) {
            return datacadastro;
        }
        return parseDateValue(row.empresa_trial_started_at);
    })();
    const persistedTrialEnd = parseDateValue(row.empresa_trial_ends_at);
    const trialEndsAtDate = persistedTrialEnd ?? calculateLegacyTrialEnd(startedAtDate);
    const currentPeriodEndsAtDate = (() => {
        const stored = parseDateValue(row.empresa_current_period_ends_at);
        if (stored) {
            return stored;
        }
        return parseDateValue(row.empresa_current_period_end);
    })();
    const persistedGracePeriodEndsAt = (() => {
        const stored = parseDateValue(row.empresa_grace_period_ends_at);
        if (stored) {
            return stored;
        }
        return parseDateValue(row.empresa_grace_expires_at);
    })();
    const computedGracePeriodEndsAt = currentPeriodEndsAtDate != null ? addDays(currentPeriodEndsAtDate, GRACE_PERIOD_DAYS) : null;
    const gracePeriodEndsAtDate = (() => {
        if (persistedGracePeriodEndsAt && computedGracePeriodEndsAt) {
            return persistedGracePeriodEndsAt.getTime() >= computedGracePeriodEndsAt.getTime()
                ? persistedGracePeriodEndsAt
                : computedGracePeriodEndsAt;
        }
        return persistedGracePeriodEndsAt ?? computedGracePeriodEndsAt ?? null;
    })();
    if (planId === null) {
        return {
            planId: null,
            status: 'inactive',
            startedAt: startedAtDate ? startedAtDate.toISOString() : null,
            trialEndsAt: null,
            currentPeriodEndsAt: null,
            gracePeriodEndsAt: null,
            isInGoodStanding: false,
            blockingReason: 'inactive',
        };
    }
    if (isActive === false) {
        return {
            planId,
            status: 'inactive',
            startedAt: startedAtDate ? startedAtDate.toISOString() : null,
            trialEndsAt: null,
            currentPeriodEndsAt: null,
            gracePeriodEndsAt: null,
            isInGoodStanding: false,
            blockingReason: 'inactive',
        };
    }
    const now = new Date();
    let status = 'inactive';
    let isInGoodStanding = false;
    if (trialEndsAtDate && now.getTime() < trialEndsAtDate.getTime()) {
        status = 'trialing';
        isInGoodStanding = true;
    }
    else if (currentPeriodEndsAtDate && now.getTime() <= currentPeriodEndsAtDate.getTime()) {
        status = 'active';
        isInGoodStanding = true;
    }
    else if (gracePeriodEndsAtDate && now.getTime() <= gracePeriodEndsAtDate.getTime()) {
        status = 'grace_period';
        isInGoodStanding = true;
    }
    else if (!trialEndsAtDate && !currentPeriodEndsAtDate && !gracePeriodEndsAtDate) {
        status = 'active';
        isInGoodStanding = true;
    }
    else {
        status = 'expired';
    }
    let blockingReason = null;
    if (!isInGoodStanding) {
        if (status === 'expired') {
            const trialEnded = trialEndsAtDate ? now.getTime() >= trialEndsAtDate.getTime() : false;
            const hasCurrentPeriod = currentPeriodEndsAtDate != null;
            const pastGrace = gracePeriodEndsAtDate
                ? now.getTime() > gracePeriodEndsAtDate.getTime()
                : false;
            if (pastGrace) {
                blockingReason = 'grace_period_expired';
            }
            else if (trialEnded && !hasCurrentPeriod) {
                blockingReason = 'trial_expired';
            }
            else {
                blockingReason = 'inactive';
            }
        }
        else {
            blockingReason = 'inactive';
        }
    }
    return {
        planId,
        status,
        startedAt: startedAtDate ? startedAtDate.toISOString() : null,
        trialEndsAt: trialEndsAtDate ? trialEndsAtDate.toISOString() : null,
        currentPeriodEndsAt: currentPeriodEndsAtDate
            ? currentPeriodEndsAtDate.toISOString()
            : null,
        gracePeriodEndsAt: gracePeriodEndsAtDate ? gracePeriodEndsAtDate.toISOString() : null,
        isInGoodStanding,
        blockingReason,
    };
};
const evaluateSubscriptionAccess = (subscription) => {
    if (!subscription) {
        return { isAllowed: true };
    }
    if (subscription.isInGoodStanding) {
        return { isAllowed: true };
    }
    switch (subscription.blockingReason) {
        case 'grace_period_expired':
            return {
                isAllowed: false,
                statusCode: 402,
                message: 'Assinatura expirada após o período de tolerância de 10 dias. Regularize o pagamento para continuar.',
            };
        case 'trial_expired':
            return {
                isAllowed: false,
                statusCode: 403,
                message: 'Período de teste encerrado. Realize uma assinatura para continuar acessando o sistema.',
            };
        default:
            return {
                isAllowed: false,
                statusCode: 403,
                message: 'Assinatura inativa. Entre em contato com o suporte para reativar o acesso.',
            };
    }
};
const normalizeEmail = (email) => email.trim().toLowerCase();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PHONE_LENGTH = 32;
const DEFAULT_PROFILE_NAME = 'Administrador';
const DEFAULT_MODULE_IDS = (0, modules_1.sortModules)(modules_1.SYSTEM_MODULES.map((module) => module.id));
const parseInteger = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseInt(value.trim(), 10);
        if (Number.isFinite(parsed)) {
            return Math.trunc(parsed);
        }
    }
    return null;
};
const sanitizePlanModules = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    const unique = new Set();
    const sanitized = [];
    for (const entry of value) {
        if (typeof entry !== 'string') {
            continue;
        }
        const normalized = (0, modules_1.normalizeModuleId)(entry);
        if (!normalized || unique.has(normalized)) {
            continue;
        }
        unique.add(normalized);
        sanitized.push(normalized);
    }
    return (0, modules_1.sortModules)(sanitized);
};
const shouldFallbackToDefaultPlan = (error) => {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const { code, message } = error;
    if (typeof code === 'string' && ['42P01', '42703', '42501'].includes(code)) {
        return true;
    }
    if (typeof message === 'string') {
        const normalized = message.toLowerCase();
        return normalized.includes('planos') && normalized.includes('does not exist');
    }
    return false;
};
const fetchDefaultPlanDetails = async (client) => {
    try {
        const result = await client.query(`SELECT id, modulos
         FROM public.planos
        WHERE ativo IS DISTINCT FROM FALSE
     ORDER BY id
        LIMIT 1`);
        if (result.rowCount === 0) {
            return { planId: null, modules: DEFAULT_MODULE_IDS };
        }
        const row = result.rows[0];
        const planId = parseInteger(row.id);
        const modules = sanitizePlanModules(row.modulos);
        return {
            planId,
            modules: modules.length > 0 ? modules : DEFAULT_MODULE_IDS,
        };
    }
    catch (error) {
        if (shouldFallbackToDefaultPlan(error)) {
            console.warn('Tabela de planos indisponível durante cadastro. Utilizando módulos padrão.', error);
            return { planId: null, modules: DEFAULT_MODULE_IDS };
        }
        throw error;
    }
};
const register = async (req, res) => {
    const nameValue = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const emailValue = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const companyValue = typeof req.body?.company === 'string' ? req.body.company.trim() : '';
    const passwordValue = typeof req.body?.password === 'string' ? req.body.password : '';
    const phoneValueRaw = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const phoneDigits = phoneValueRaw.replace(/\D+/g, '');
    const phoneValue = phoneValueRaw ? phoneValueRaw : null;
    if (!nameValue) {
        res.status(400).json({ error: 'O nome completo é obrigatório.' });
        return;
    }
    if (!companyValue) {
        res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
        return;
    }
    if (!emailValue || !EMAIL_REGEX.test(emailValue)) {
        res.status(400).json({ error: 'Informe um e-mail válido.' });
        return;
    }
    if (passwordValue.length < MIN_PASSWORD_LENGTH) {
        res
            .status(400)
            .json({ error: `A senha deve conter ao menos ${MIN_PASSWORD_LENGTH} caracteres.` });
        return;
    }
    if (phoneValue && phoneValue.length > MAX_PHONE_LENGTH) {
        res
            .status(400)
            .json({ error: `O telefone deve conter no máximo ${MAX_PHONE_LENGTH} caracteres.` });
        return;
    }
    if (phoneValue && phoneDigits.length > 0 && phoneDigits.length < 10) {
        res.status(400).json({ error: 'Informe um telefone válido com DDD.' });
        return;
    }
    const normalizedEmail = normalizeEmail(emailValue);
    try {
        const duplicateCheck = await db_1.default.query('SELECT 1 FROM public.usuarios WHERE LOWER(email) = $1 LIMIT 1', [normalizedEmail]);
        if ((duplicateCheck.rowCount ?? 0) > 0) {
            res.status(409).json({ error: 'E-mail já cadastrado.' });
            return;
        }
        const client = await db_1.default.connect();
        let transactionActive = false;
        try {
            await client.query('BEGIN');
            transactionActive = true;
            const duplicateCheckTx = await client.query('SELECT 1 FROM public.usuarios WHERE LOWER(email) = $1 LIMIT 1', [normalizedEmail]);
            if ((duplicateCheckTx.rowCount ?? 0) > 0) {
                await client.query('ROLLBACK');
                transactionActive = false;
                res.status(409).json({ error: 'E-mail já cadastrado.' });
                return;
            }
            const { planId, modules } = await fetchDefaultPlanDetails(client);
            let defaultCadence = 'monthly';
            if (planId != null) {
                try {
                    defaultCadence = await (0, subscriptionService_1.resolvePlanCadence)(planId, null);
                }
                catch (cadenceError) {
                    console.warn('Falha ao determinar recorrência padrão do plano durante cadastro.', cadenceError);
                }
            }
            const trialStartedAt = new Date();
            const trialEndsAt = (0, subscriptionService_1.calculateTrialEnd)(trialStartedAt);
            const graceExpiresAt = trialEndsAt;
            const companyLookup = await client.query(`SELECT id, nome_empresa, plano
           FROM public.empresas
          WHERE LOWER(TRIM(nome_empresa)) = LOWER(TRIM($1))
          LIMIT 1`, [companyValue]);
            let companyId;
            let companyName;
            let companyPlanId;
            let createdCompany = false;
            if ((companyLookup.rowCount ?? 0) > 0) {
                const row = companyLookup.rows[0];
                const parsedId = parseInteger(row.id);
                if (parsedId == null) {
                    throw new Error('ID de empresa inválido retornado do banco de dados.');
                }
                companyId = parsedId;
                companyName =
                    typeof row.nome_empresa === 'string'
                        ? row.nome_empresa.trim() || companyValue
                        : companyValue;
                companyPlanId = parseInteger(row.plano);
            }
            else {
                const insertResult = await client.query(`INSERT INTO public.empresas (
             nome_empresa,
             cnpj,
             telefone,
             email,
             plano,
             responsavel,
             ativo,
             datacadastro,
             trial_started_at,
             trial_ends_at,
             current_period_start,
             current_period_end,
             grace_expires_at,
             subscription_cadence
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13)
        RETURNING id, nome_empresa, plano, trial_started_at, trial_ends_at, current_period_start, current_period_end, grace_expires_at, subscription_cadence`, [
                    companyValue,
                    null,
                    phoneValue,
                    normalizedEmail,
                    planId,
                    null,
                    true,
                    trialStartedAt,
                    trialEndsAt,
                    trialStartedAt,
                    trialEndsAt,
                    graceExpiresAt,
                    defaultCadence,
                ]);
                const inserted = insertResult.rows[0];
                const parsedId = parseInteger(inserted.id);
                if (parsedId == null) {
                    throw new Error('Falha ao criar a empresa.');
                }
                companyId = parsedId;
                companyName =
                    typeof inserted.nome_empresa === 'string'
                        ? inserted.nome_empresa.trim() || companyValue
                        : companyValue;
                companyPlanId = planId ?? parseInteger(inserted.plano);
                createdCompany = true;
            }
            const existingPerfil = await client.query(`SELECT id, nome, ativo, datacriacao
           FROM public.perfis
          WHERE idempresa IS NOT DISTINCT FROM $1
            AND LOWER(TRIM(nome)) = LOWER(TRIM($2))
          LIMIT 1`, [companyId, DEFAULT_PROFILE_NAME]);
            let perfilId;
            let perfilNome;
            if ((existingPerfil.rowCount ?? 0) > 0) {
                const perfilRow = existingPerfil.rows[0];
                const parsedPerfilId = parseInteger(perfilRow.id);
                if (parsedPerfilId == null) {
                    throw new Error('ID de perfil inválido retornado do banco de dados.');
                }
                perfilId = parsedPerfilId;
                perfilNome =
                    typeof perfilRow.nome === 'string'
                        ? perfilRow.nome.trim() || DEFAULT_PROFILE_NAME
                        : DEFAULT_PROFILE_NAME;
                await client.query('DELETE FROM public.perfil_modulos WHERE perfil_id = $1', [perfilId]);
            }
            else {
                const perfilInsert = await client.query(`INSERT INTO public.perfis (nome, ativo, datacriacao, idempresa)
           VALUES ($1, $2, NOW(), $3)
        RETURNING id, nome`, [DEFAULT_PROFILE_NAME, true, companyId]);
                const perfilRow = perfilInsert.rows[0];
                const parsedPerfilId = parseInteger(perfilRow.id);
                if (parsedPerfilId == null) {
                    throw new Error('Falha ao criar o perfil administrador.');
                }
                perfilId = parsedPerfilId;
                perfilNome =
                    typeof perfilRow.nome === 'string'
                        ? perfilRow.nome.trim() || DEFAULT_PROFILE_NAME
                        : DEFAULT_PROFILE_NAME;
            }
            if (modules.length > 0) {
                await client.query('INSERT INTO public.perfil_modulos (perfil_id, modulo) SELECT $1, unnest($2::text[])', [perfilId, modules]);
            }
            const hashedPassword = (0, passwordUtils_1.hashPassword)(passwordValue);
            const userInsert = await client.query(`INSERT INTO public.usuarios (nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING id, nome_completo, email, perfil, empresa, status, telefone, datacriacao`, [
                nameValue,
                null,
                normalizedEmail,
                perfilId,
                companyId,
                null,
                null,
                true,
                hashedPassword,
                phoneValue,
                null,
                null,
            ]);
            const createdUser = userInsert.rows[0];
            const createdUserId = parseInteger(createdUser.id);
            if (createdCompany && createdUserId != null) {
                await client.query('UPDATE public.empresas SET responsavel = $1 WHERE id = $2', [
                    createdUserId,
                    companyId,
                ]);
            }
            await client.query('COMMIT');
            transactionActive = false;
            res.status(201).json({
                user: {
                    id: createdUser?.id,
                    nome_completo: createdUser?.nome_completo,
                    email: createdUser?.email,
                    perfil: createdUser?.perfil,
                    empresa: createdUser?.empresa,
                    status: createdUser?.status,
                    telefone: createdUser?.telefone,
                    datacriacao: createdUser?.datacriacao,
                },
                empresa: {
                    id: companyId,
                    nome: companyName,
                    plano: companyPlanId,
                },
                perfil: {
                    id: perfilId,
                    nome: perfilNome,
                    modulos: modules,
                },
            });
        }
        catch (error) {
            if (transactionActive) {
                try {
                    await client.query('ROLLBACK');
                }
                catch (rollbackError) {
                    console.error('Falha ao reverter transação de cadastro', rollbackError);
                }
            }
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Erro ao registrar usuário', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Não foi possível concluir o cadastro.' });
        }
    }
};
exports.register = register;
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
              esc.nome AS setor_nome,
              emp.plano AS empresa_plano,
              emp.ativo AS empresa_ativo,
              emp.trial_started_at AS empresa_trial_started_at,
              COALESCE(emp.trial_ends_at, emp.subscription_trial_ends_at) AS empresa_trial_ends_at,
              emp.current_period_start AS empresa_current_period_start,
              COALESCE(emp.current_period_end, emp.subscription_current_period_ends_at) AS empresa_current_period_end,
              COALESCE(emp.grace_expires_at, emp.subscription_grace_period_ends_at) AS empresa_grace_expires_at,
              emp.subscription_cadence AS empresa_subscription_cadence,
              emp.datacadastro AS empresa_datacadastro,
              COALESCE(emp.subscription_current_period_ends_at, emp.current_period_end) AS empresa_current_period_ends_at,
              COALESCE(emp.subscription_grace_period_ends_at, emp.grace_expires_at) AS empresa_grace_period_ends_at
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
        const subscriptionResolution = user.empresa_id != null
            ? resolveSubscriptionPayload(user)
            : null;
        const subscriptionAccess = evaluateSubscriptionAccess(subscriptionResolution);
        if (!subscriptionAccess.isAllowed) {
            res
                .status(subscriptionAccess.statusCode ?? 403)
                .json({ error: subscriptionAccess.message ?? 'Assinatura inativa.' });
            return;
        }
        const token = (0, tokenUtils_1.signToken)({
            sub: user.id,
            email: user.email,
            name: user.nome_completo,
        }, auth_1.authConfig.secret, auth_1.authConfig.expirationSeconds);
        const modulos = await (0, moduleService_1.fetchPerfilModules)(user.perfil);
        const subscriptionDetails = user.empresa_id != null
            ? (0, subscriptionService_1.resolveSubscriptionPayloadFromRow)({
                empresa_plano: user.empresa_plano,
                empresa_ativo: user.empresa_ativo,
                trial_started_at: user.empresa_trial_started_at ?? user.empresa_datacadastro,
                trial_ends_at: user.empresa_trial_ends_at,
                current_period_start: user.empresa_current_period_start ?? user.empresa_datacadastro,
                current_period_end: user.empresa_current_period_end ?? user.empresa_current_period_ends_at,
                grace_expires_at: user.empresa_grace_expires_at ?? user.empresa_grace_period_ends_at,
                subscription_cadence: user.empresa_subscription_cadence,
            })
            : null;
        const subscription = subscriptionDetails && subscriptionResolution
            ? {
                planId: subscriptionResolution.planId ?? subscriptionDetails.planId,
                status: subscriptionResolution.status,
                cadence: subscriptionDetails.cadence,
                startedAt: subscriptionResolution.startedAt ?? subscriptionDetails.startedAt,
                trialEndsAt: subscriptionResolution.trialEndsAt ?? subscriptionDetails.trialEndsAt,
                currentPeriodStart: subscriptionDetails.currentPeriodStart,
                currentPeriodEndsAt: subscriptionResolution.currentPeriodEndsAt ??
                    subscriptionDetails.currentPeriodEnd,
                currentPeriodEnd: subscriptionDetails.currentPeriodEnd,
                gracePeriodEndsAt: subscriptionResolution.gracePeriodEndsAt ??
                    subscriptionDetails.graceExpiresAt,
                graceExpiresAt: subscriptionDetails.graceExpiresAt,
                isInGoodStanding: subscriptionResolution.isInGoodStanding,
                blockingReason: subscriptionResolution.blockingReason,
            }
            : null;
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
                subscription,
            },
        });
    }
    catch (error) {
        console.error('Erro ao realizar login', error);
        res.status(500).json({ error: 'Não foi possível concluir a autenticação.' });
    }
};
exports.login = login;
const refreshToken = (req, res) => {
    if (!req.auth) {
        res.status(401).json({ error: 'Token inválido.' });
        return;
    }
    try {
        const payload = (req.auth.payload ?? {});
        const refreshedToken = (0, tokenUtils_1.signToken)({
            sub: req.auth.userId,
            email: typeof payload.email === 'string' ? payload.email : undefined,
            name: typeof payload.name === 'string' ? payload.name : undefined,
        }, auth_1.authConfig.secret, auth_1.authConfig.expirationSeconds);
        res.json({
            token: refreshedToken,
            expiresIn: auth_1.authConfig.expirationSeconds,
        });
    }
    catch (error) {
        console.error('Erro ao renovar token de autenticação', error);
        res.status(500).json({ error: 'Não foi possível renovar o token de acesso.' });
    }
};
exports.refreshToken = refreshToken;
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
              esc.nome AS setor_nome,
              emp.plano AS empresa_plano,
              emp.ativo AS empresa_ativo,
              emp.trial_started_at AS empresa_trial_started_at,
              COALESCE(emp.trial_ends_at, emp.subscription_trial_ends_at) AS empresa_trial_ends_at,
              emp.current_period_start AS empresa_current_period_start,
              COALESCE(emp.current_period_end, emp.subscription_current_period_ends_at) AS empresa_current_period_end,
              COALESCE(emp.grace_expires_at, emp.subscription_grace_period_ends_at) AS empresa_grace_expires_at,
              emp.subscription_cadence AS empresa_subscription_cadence,
              emp.datacadastro AS empresa_datacadastro,
              COALESCE(emp.subscription_current_period_ends_at, emp.current_period_end) AS empresa_current_period_ends_at,
              COALESCE(emp.subscription_grace_period_ends_at, emp.grace_expires_at) AS empresa_grace_period_ends_at
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
        const subscriptionResolution = user.empresa_id != null ? resolveSubscriptionPayload(user) : null;
        const subscriptionAccess = evaluateSubscriptionAccess(subscriptionResolution);
        if (!subscriptionAccess.isAllowed) {
            res
                .status(subscriptionAccess.statusCode ?? 403)
                .json({ error: subscriptionAccess.message ?? 'Assinatura inativa.' });
            return;
        }
        const modulos = await (0, moduleService_1.fetchPerfilModules)(user.perfil);
        const subscription = user.empresa_id != null
            ? (0, subscriptionService_1.resolveSubscriptionPayloadFromRow)({
                empresa_plano: user.empresa_plano,
                empresa_ativo: user.empresa_ativo,
                trial_started_at: user.empresa_trial_started_at ?? user.empresa_datacadastro,
                trial_ends_at: user.empresa_trial_ends_at,
                current_period_start: user.empresa_current_period_start ?? user.empresa_datacadastro,
                current_period_end: user.empresa_current_period_end ?? user.empresa_current_period_ends_at,
                grace_expires_at: user.empresa_grace_expires_at ?? user.empresa_grace_period_ends_at,
                subscription_cadence: user.empresa_subscription_cadence,
            })
            : null;
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
            subscription,
        });
    }
    catch (error) {
        console.error('Erro ao carregar usuário autenticado', error);
        res.status(500).json({ error: 'Não foi possível carregar os dados do usuário.' });
    }
};
exports.getCurrentUser = getCurrentUser;
