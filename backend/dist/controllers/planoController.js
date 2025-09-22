"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePlano = exports.updatePlano = exports.createPlano = exports.listPlanos = void 0;
const modules_1 = require("../constants/modules");
const db_1 = __importDefault(require("../services/db"));
const RECORRENCIAS_PERMITIDAS = ['mensal', 'anual', 'nenhuma'];
const isRecorrenciaValida = (value) => typeof value === 'string' && RECORRENCIAS_PERMITIDAS.includes(value);
const FEATURE_KEYS = [
    'features',
    'recursos',
    'items',
    'itens',
    'lista',
    'listaRecursos',
    'lista_recursos',
    'values',
    'value',
    'feature',
    'recurso',
];
const MAX_CASES_KEYS = [
    'maxCases',
    'max_casos',
    'maxProcessos',
    'max_processos',
    'limiteCasos',
    'limite_casos',
    'limiteProcessos',
    'limite_processos',
    'maximoCasos',
    'maximo_casos',
    'maximoProcessos',
    'maximo_processos',
];
const toInteger = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const normalized = Number(trimmed.replace(/[^\d-]/g, ''));
        if (Number.isFinite(normalized)) {
            return Math.trunc(normalized);
        }
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    return null;
};
const toBoolean = (value) => {
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
        return null;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return null;
        }
        if (['true', '1', 'sim', 'yes', 'on'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'nao', 'não', 'no', 'off'].includes(normalized)) {
            return false;
        }
    }
    return null;
};
const parseBooleanOrDefault = (value, fieldName, fallback) => {
    if (value === undefined) {
        return fallback;
    }
    if (value === null) {
        return false;
    }
    const parsed = toBoolean(value);
    if (parsed === null) {
        throw new Error(`${fieldName} deve ser um booleano válido`);
    }
    return parsed;
};
const parseOptionalIntegerOrDefault = (value, fieldName, fallback) => {
    if (value === undefined) {
        return fallback;
    }
    if (value === null) {
        return null;
    }
    if (typeof value === 'string' && !value.trim()) {
        return null;
    }
    const parsed = toInteger(value);
    if (parsed === null) {
        throw new Error(`${fieldName} deve ser um número inteiro válido`);
    }
    return parsed;
};
const parseModulesOrDefault = (value, fallback, fallbackWasNull) => {
    if (value === undefined) {
        return fallbackWasNull ? null : fallback;
    }
    if (value === null) {
        return null;
    }
    try {
        return (0, modules_1.sanitizeModuleIds)(value);
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error('modulos inválidos');
    }
};
const pushFeature = (features, entry) => {
    if (entry === null || entry === undefined) {
        return;
    }
    const text = typeof entry === 'string'
        ? entry.trim()
        : typeof entry === 'number' || typeof entry === 'boolean'
            ? String(entry)
            : '';
    if (text) {
        features.push(text);
    }
};
const parseRecursosDetails = (value) => {
    const features = [];
    let maxCasos = null;
    const visit = (input) => {
        if (input === null || input === undefined) {
            return;
        }
        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (!trimmed) {
                return;
            }
            try {
                const parsed = JSON.parse(trimmed);
                visit(parsed);
                return;
            }
            catch {
                // Ignored – fallback to splitting by common separators
            }
            trimmed
                .split(/[\n;,]+/)
                .map((item) => item.trim())
                .filter(Boolean)
                .forEach((item) => pushFeature(features, item));
            return;
        }
        if (typeof input === 'number' || typeof input === 'boolean') {
            pushFeature(features, input);
            return;
        }
        if (Array.isArray(input)) {
            input.forEach((item) => visit(item));
            return;
        }
        if (typeof input === 'object') {
            const obj = input;
            FEATURE_KEYS.forEach((key) => {
                if (key in obj) {
                    visit(obj[key]);
                }
            });
            for (const key of MAX_CASES_KEYS) {
                if (key in obj) {
                    const parsed = toInteger(obj[key]);
                    if (parsed !== null) {
                        maxCasos = parsed;
                        break;
                    }
                }
            }
            return;
        }
    };
    visit(value);
    const uniqueFeatures = Array.from(new Set(features));
    return {
        recursos: uniqueFeatures,
        maxCasos,
    };
};
const prepareRecursosForStorage = (recursosInput, maxCasosInput, fallback = null) => {
    const fallbackDetails = fallback !== null && fallback !== void 0 ? fallback : { recursos: [], maxCasos: null };
    const sourceFeatures = recursosInput === undefined ? fallbackDetails.recursos : recursosInput;
    const sourceMaxCasos = maxCasosInput === undefined ? fallbackDetails.maxCasos : maxCasosInput;
    const normalized = parseRecursosDetails({
        features: sourceFeatures,
        maxCases: sourceMaxCasos,
    });
    if (!normalized.recursos.length && normalized.maxCasos === null) {
        return null;
    }
    const payload = {};
    if (normalized.recursos.length) {
        payload.features = normalized.recursos;
    }
    if (normalized.maxCasos !== null) {
        payload.maxCases = normalized.maxCasos;
    }
    return JSON.stringify(payload);
};
const formatPlanoRow = (row) => {
    var _a, _b, _c, _d;
    const recursosDetalhes = parseRecursosDetails(row.recursos);
    const explicitMaxCasos = (_a = toInteger(row.max_casos)) !== null && _a !== void 0 ? _a : toInteger(row.maxCases);
    const maxCasos = (_b = explicitMaxCasos !== null && explicitMaxCasos !== void 0 ? explicitMaxCasos : recursosDetalhes.maxCasos) !== null && _b !== void 0 ? _b : null;
    const maxPropostas = toInteger(row.max_propostas);
    const sincronizacaoProcessosLimite = toInteger(row.sincronizacao_processos_limite);
    const sincronizacaoProcessosHabilitada = (_c = toBoolean(row.sincronizacao_processos_habilitada)) !== null && _c !== void 0 ? _c : false;
    let modulos = [];
    if (Array.isArray(row.modulos)) {
        try {
            modulos = (0, modules_1.sanitizeModuleIds)(row.modulos);
        }
        catch (error) {
            console.warn('Falha ao normalizar módulos do plano:', error);
            modulos = [];
        }
    }
    return {
        ...row,
        ativo: (_d = row.ativo) !== null && _d !== void 0 ? _d : true,
        recursos: recursosDetalhes.recursos,
        max_casos: maxCasos,
        maxCases: maxCasos,
        modulos,
        max_propostas: maxPropostas,
        maxPropostas,
        sincronizacao_processos_habilitada: sincronizacaoProcessosHabilitada,
        sincronizacaoProcessosHabilitada,
        sincronizacao_processos_limite: sincronizacaoProcessosLimite,
        sincronizacaoProcessosLimite,
    };
};
const listPlanos = async (_req, res) => {
    try {
        const result = await db_1.default.query(`SELECT
        id,
        nome,
        valor,
        ativo,
        datacadastro,
        descricao,
        recorrencia,
        qtde_usuarios,
        recursos,
        modulos,
        max_propostas,
        sincronizacao_processos_habilitada,
        sincronizacao_processos_limite
      FROM public.planos`);
        const formatted = result.rows.map((row) => formatPlanoRow(row));
        res.json(formatted);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listPlanos = listPlanos;
const createPlano = async (req, res) => {
    const { nome, valor, ativo = true, descricao, recorrencia = 'nenhuma', qtde_usuarios, recursos, max_casos, maxCases, modulos, max_propostas, sincronizacao_processos_habilitada, sincronizacao_processos_limite, } = req.body;
    const descricaoValue = descricao !== null && descricao !== void 0 ? descricao : '';
    const ativoValue = ativo !== null && ativo !== void 0 ? ativo : true;
    const qtdeUsuariosValue = qtde_usuarios !== null && qtde_usuarios !== void 0 ? qtde_usuarios : null;
    const recursosValue = prepareRecursosForStorage(recursos, max_casos !== null && max_casos !== void 0 ? max_casos : maxCases);
    let modulosValue;
    try {
        modulosValue = parseModulesOrDefault(modulos, [], false);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'modulos inválidos';
        return res.status(400).json({ error: message });
    }
    let maxPropostasValue;
    try {
        maxPropostasValue = parseOptionalIntegerOrDefault(max_propostas, 'max_propostas', null);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'max_propostas inválido';
        return res.status(400).json({ error: message });
    }
    let sincronizacaoProcessosHabilitadaValue;
    try {
        sincronizacaoProcessosHabilitadaValue = parseBooleanOrDefault(sincronizacao_processos_habilitada, 'sincronizacao_processos_habilitada', false);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'sincronizacao_processos_habilitada inválido';
        return res.status(400).json({ error: message });
    }
    let sincronizacaoProcessosLimiteValue;
    try {
        sincronizacaoProcessosLimiteValue = parseOptionalIntegerOrDefault(sincronizacao_processos_limite, 'sincronizacao_processos_limite', null);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'sincronizacao_processos_limite inválido';
        return res.status(400).json({ error: message });
    }
    if (recorrencia !== null && !isRecorrenciaValida(recorrencia)) {
        return res.status(400).json({ error: 'Recorrência inválida' });
    }
    try {
        const result = await db_1.default.query(`INSERT INTO public.planos (
        nome,
        valor,
        ativo,
        datacadastro,
        descricao,
        recorrencia,
        qtde_usuarios,
        recursos,
        modulos,
        max_propostas,
        sincronizacao_processos_habilitada,
        sincronizacao_processos_limite
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id,
        nome,
        valor,
        ativo,
        datacadastro,
        descricao,
        recorrencia,
        qtde_usuarios,
        recursos,
        modulos,
        max_propostas,
        sincronizacao_processos_habilitada,
        sincronizacao_processos_limite`, [
            nome,
            valor,
            ativoValue,
            descricaoValue,
            recorrencia,
            qtdeUsuariosValue,
            recursosValue,
            modulosValue,
            maxPropostasValue,
            sincronizacaoProcessosHabilitadaValue,
            sincronizacaoProcessosLimiteValue,
        ]);
        const payload = formatPlanoRow(result.rows[0]);
        res.status(201).json(payload);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createPlano = createPlano;
const updatePlano = async (req, res) => {
    var _a, _b;
    const { id } = req.params;
    const { nome, valor, ativo, descricao, recorrencia, qtde_usuarios, recursos, max_casos, maxCases, modulos, max_propostas, sincronizacao_processos_habilitada, sincronizacao_processos_limite, } = req.body;
    try {
        const existingResult = await db_1.default.query(`SELECT
        id,
        nome,
        valor,
        ativo,
        datacadastro,
        descricao,
        recorrencia,
        qtde_usuarios,
        recursos,
        modulos,
        max_propostas,
        sincronizacao_processos_habilitada,
        sincronizacao_processos_limite
      FROM public.planos
      WHERE id = $1`, [id]);
        if (existingResult.rowCount === 0) {
            return res.status(404).json({ error: 'Plano não encontrado' });
        }
        const currentPlanoRow = existingResult.rows[0];
        const currentPlano = formatPlanoRow(currentPlanoRow);
        const currentRecursos = parseRecursosDetails(currentPlanoRow.recursos);
        const hasQtdeUsuarios = Object.prototype.hasOwnProperty.call(req.body, 'qtde_usuarios');
        const hasRecursos = Object.prototype.hasOwnProperty.call(req.body, 'recursos');
        const hasMaxCasos = Object.prototype.hasOwnProperty.call(req.body, 'max_casos') ||
            Object.prototype.hasOwnProperty.call(req.body, 'maxCases');
        const hasRecorrencia = Object.prototype.hasOwnProperty.call(req.body, 'recorrencia');
        const hasModulos = Object.prototype.hasOwnProperty.call(req.body, 'modulos');
        const hasMaxPropostas = Object.prototype.hasOwnProperty.call(req.body, 'max_propostas');
        const hasSincronizacaoProcessosHabilitada = Object.prototype.hasOwnProperty.call(req.body, 'sincronizacao_processos_habilitada');
        const hasSincronizacaoProcessosLimite = Object.prototype.hasOwnProperty.call(req.body, 'sincronizacao_processos_limite');
        let updatedRecorrencia;
        if (hasRecorrencia) {
            if (recorrencia === null) {
                updatedRecorrencia = null;
            }
            else if (recorrencia === undefined) {
                updatedRecorrencia = currentPlano.recorrencia;
            }
            else {
                updatedRecorrencia = recorrencia;
            }
        }
        else {
            updatedRecorrencia = currentPlano.recorrencia;
        }
        if (updatedRecorrencia !== null && !isRecorrenciaValida(updatedRecorrencia)) {
            return res.status(400).json({ error: 'Recorrência inválida' });
        }
        const updatedQtdeUsuarios = hasQtdeUsuarios
            ? qtde_usuarios !== null && qtde_usuarios !== void 0 ? qtde_usuarios : null
            : currentPlano.qtde_usuarios;
        const recursosValue = hasRecursos || hasMaxCasos
            ? prepareRecursosForStorage(hasRecursos ? recursos : currentPlano.recursos, hasMaxCasos ? max_casos !== null && max_casos !== void 0 ? max_casos : maxCases : currentPlano.max_casos, currentRecursos)
            : ((_a = currentPlanoRow.recursos) !== null && _a !== void 0 ? _a : null);
        let modulosValue;
        try {
            modulosValue = parseModulesOrDefault(hasModulos ? modulos : undefined, currentPlano.modulos, currentPlanoRow.modulos === null);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'modulos inválidos';
            return res.status(400).json({ error: message });
        }
        let maxPropostasValue;
        try {
            maxPropostasValue = parseOptionalIntegerOrDefault(hasMaxPropostas ? max_propostas : undefined, 'max_propostas', toInteger(currentPlanoRow.max_propostas));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'max_propostas inválido';
            return res.status(400).json({ error: message });
        }
        let sincronizacaoProcessosHabilitadaValue;
        try {
            sincronizacaoProcessosHabilitadaValue = parseBooleanOrDefault(hasSincronizacaoProcessosHabilitada
                ? sincronizacao_processos_habilitada
                : undefined, 'sincronizacao_processos_habilitada', currentPlano.sincronizacao_processos_habilitada);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'sincronizacao_processos_habilitada inválido';
            return res.status(400).json({ error: message });
        }
        let sincronizacaoProcessosLimiteValue;
        try {
            sincronizacaoProcessosLimiteValue = parseOptionalIntegerOrDefault(hasSincronizacaoProcessosLimite ? sincronizacao_processos_limite : undefined, 'sincronizacao_processos_limite', toInteger(currentPlanoRow.sincronizacao_processos_limite));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'sincronizacao_processos_limite inválido';
            return res.status(400).json({ error: message });
        }
        const result = await db_1.default.query(`UPDATE public.planos SET
        nome = $1,
        valor = $2,
        ativo = $3,
        descricao = $4,
        recorrencia = $5,
        qtde_usuarios = $6,
        recursos = $7,
        modulos = $8,
        max_propostas = $9,
        sincronizacao_processos_habilitada = $10,
        sincronizacao_processos_limite = $11
      WHERE id = $12
      RETURNING
        id,
        nome,
        valor,
        ativo,
        datacadastro,
        descricao,
        recorrencia,
        qtde_usuarios,
        recursos,
        modulos,
        max_propostas,
        sincronizacao_processos_habilitada,
        sincronizacao_processos_limite`, [
            nome !== null && nome !== void 0 ? nome : currentPlano.nome,
            valor !== null && valor !== void 0 ? valor : currentPlano.valor,
            ativo !== null && ativo !== void 0 ? ativo : currentPlano.ativo,
            (_b = (descricao !== null && descricao !== void 0 ? descricao : currentPlano.descricao)) !== null && _b !== void 0 ? _b : '',
            updatedRecorrencia,
            updatedQtdeUsuarios,
            recursosValue,
            modulosValue,
            maxPropostasValue,
            sincronizacaoProcessosHabilitadaValue,
            sincronizacaoProcessosLimiteValue,
            id,
        ]);
        const payload = formatPlanoRow(result.rows[0]);
        res.json(payload);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updatePlano = updatePlano;
const deletePlano = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM public.planos WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Plano não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deletePlano = deletePlano;
