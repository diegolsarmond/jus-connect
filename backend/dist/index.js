"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const areaAtuacaoRoutes_1 = __importDefault(require("./routes/areaAtuacaoRoutes"));
const tipoEventoRoutes_1 = __importDefault(require("./routes/tipoEventoRoutes"));
const tipoProcessoRoutes_1 = __importDefault(require("./routes/tipoProcessoRoutes"));
const escritorioRoutes_1 = __importDefault(require("./routes/escritorioRoutes"));
const perfilRoutes_1 = __importDefault(require("./routes/perfilRoutes"));
const planoRoutes_1 = __importDefault(require("./routes/planoRoutes"));
const situacaoClienteRoutes_1 = __importDefault(require("./routes/situacaoClienteRoutes"));
const situacaoProcessoRoutes_1 = __importDefault(require("./routes/situacaoProcessoRoutes"));
const situacaoPropostaRoutes_1 = __importDefault(require("./routes/situacaoPropostaRoutes"));
const etiquetaRoutes_1 = __importDefault(require("./routes/etiquetaRoutes"));
const usuarioRoutes_1 = __importDefault(require("./routes/usuarioRoutes"));
const empresaRoutes_1 = __importDefault(require("./routes/empresaRoutes"));
const clienteRoutes_1 = __importDefault(require("./routes/clienteRoutes"));
const agendaRoutes_1 = __importDefault(require("./routes/agendaRoutes"));
const templateRoutes_1 = __importDefault(require("./routes/templateRoutes"));
const tagRoutes_1 = __importDefault(require("./routes/tagRoutes"));
const documentRoutes_1 = __importDefault(require("./routes/documentRoutes"));
const financialRoutes_1 = __importDefault(require("./routes/financialRoutes"));
const processoRoutes_1 = __importDefault(require("./routes/processoRoutes"));
const fluxoTrabalhoRoutes_1 = __importDefault(require("./routes/fluxoTrabalhoRoutes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const oportunidadeRoutes_1 = __importDefault(require("./routes/oportunidadeRoutes"));
const oportunidadeDocumentoRoutes_1 = __importDefault(require("./routes/oportunidadeDocumentoRoutes"));
const tarefaRoutes_1 = __importDefault(require("./routes/tarefaRoutes"));
const tarefaResponsavelRoutes_1 = __importDefault(require("./routes/tarefaResponsavelRoutes"));
const tipoDocumentoRoutes_1 = __importDefault(require("./routes/tipoDocumentoRoutes"));
const clienteDocumentoRoutes_1 = __importDefault(require("./routes/clienteDocumentoRoutes"));
const supportRoutes_1 = __importDefault(require("./routes/supportRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const integrationApiKeyRoutes_1 = __importDefault(require("./routes/integrationApiKeyRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const userProfileRoutes_1 = __importDefault(require("./routes/userProfileRoutes"));
const wahaWebhookRoutes_1 = __importDefault(require("./routes/wahaWebhookRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_1 = __importDefault(require("./swagger"));
const cronJobs_1 = __importDefault(require("./services/cronJobs"));
const chatSchema_1 = require("./services/chatSchema");
const authMiddleware_1 = require("./middlewares/authMiddleware");
const moduleAuthorization_1 = require("./middlewares/moduleAuthorization");
const app = (0, express_1.default)();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 0;
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:4200',
    'https://jusconnec.quantumtecnologia.com.br',
];
const additionalAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = new Set([
    ...defaultAllowedOrigins,
    ...additionalAllowedOrigins,
]);
const allowAllOrigins = process.env.CORS_ALLOW_ALL === 'true';
/**
 * Middleware de CORS
 */
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowAllOrigins || allowedOrigins.has(origin))) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin'); // boa prática p/ caches
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, access-token, x-authorization-id, x-client-id, id-account');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});
// Rotas
const protectedApiRouter = express_1.default.Router();
protectedApiRouter.use(authMiddleware_1.authenticateRequest);
const registerModuleRoutes = (modules, router) => {
    protectedApiRouter.use((0, moduleAuthorization_1.authorizeModules)(modules), router);
};
registerModuleRoutes(['configuracoes-parametros', 'configuracoes-parametros-area-atuacao'], areaAtuacaoRoutes_1.default);
registerModuleRoutes(['configuracoes-parametros', 'configuracoes-parametros-tipo-evento'], tipoEventoRoutes_1.default);
registerModuleRoutes(['configuracoes-parametros', 'configuracoes-parametros-tipo-processo'], tipoProcessoRoutes_1.default);
registerModuleRoutes(['configuracoes-parametros', 'configuracoes-parametros-tipos-documento'], tipoDocumentoRoutes_1.default);
registerModuleRoutes(['configuracoes-parametros', 'configuracoes-parametros-escritorios'], escritorioRoutes_1.default);
registerModuleRoutes(['configuracoes-parametros', 'configuracoes-parametros-perfis'], perfilRoutes_1.default);
registerModuleRoutes('configuracoes', planoRoutes_1.default);
registerModuleRoutes(['configuracoes-parametros', 'configuracoes-parametros-situacao-processo'], situacaoProcessoRoutes_1.default);
registerModuleRoutes(['configuracoes-parametros', 'configuracoes-parametros-situacao-cliente'], situacaoClienteRoutes_1.default);
registerModuleRoutes(['configuracoes-parametros', 'configuracoes-parametros-situacao-proposta'], situacaoPropostaRoutes_1.default);
registerModuleRoutes(['configuracoes-parametros', 'configuracoes-parametros-etiquetas'], etiquetaRoutes_1.default);
registerModuleRoutes('configuracoes', empresaRoutes_1.default);
registerModuleRoutes('configuracoes-usuarios', usuarioRoutes_1.default);
registerModuleRoutes('clientes', clienteRoutes_1.default);
registerModuleRoutes('agenda', agendaRoutes_1.default);
registerModuleRoutes('documentos', templateRoutes_1.default);
registerModuleRoutes('documentos', tagRoutes_1.default);
registerModuleRoutes('documentos', documentRoutes_1.default);
registerModuleRoutes('financeiro', financialRoutes_1.default);
registerModuleRoutes('processos', processoRoutes_1.default);
registerModuleRoutes('pipeline', fluxoTrabalhoRoutes_1.default);
registerModuleRoutes('documentos', uploadRoutes_1.default);
registerModuleRoutes('pipeline', oportunidadeRoutes_1.default);
registerModuleRoutes('pipeline', oportunidadeDocumentoRoutes_1.default);
registerModuleRoutes('tarefas', tarefaRoutes_1.default);
registerModuleRoutes('tarefas', tarefaResponsavelRoutes_1.default);
registerModuleRoutes(['clientes', 'documentos'], clienteDocumentoRoutes_1.default);
registerModuleRoutes('suporte', supportRoutes_1.default);
registerModuleRoutes('intimacoes', notificationRoutes_1.default);
registerModuleRoutes('configuracoes-integracoes', integrationApiKeyRoutes_1.default);
registerModuleRoutes('conversas', chatRoutes_1.default);
protectedApiRouter.use(userProfileRoutes_1.default);
app.use('/api', wahaWebhookRoutes_1.default);
app.use('/api', authRoutes_1.default);
app.use('/api', protectedApiRouter);
app.use('/api/v1', authMiddleware_1.authenticateRequest, usuarioRoutes_1.default);
// Background jobs
cronJobs_1.default.startProjudiSyncJob();
// Swagger
const specs = (0, swagger_jsdoc_1.default)(swagger_1.default);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(specs));
// Static frontend (when available)
const frontendDistPath = path_1.default.resolve(__dirname, '../../frontend/dist');
const frontendIndexPath = path_1.default.join(frontendDistPath, 'index.html');
const hasFrontendBuild = (0, fs_1.existsSync)(frontendIndexPath);
if (hasFrontendBuild) {
    app.use(express_1.default.static(frontendDistPath));
}
/**
 * @swagger
 * /:
 *   get:
 *     summary: Verifica o status do backend
 *     responses:
 *       200:
 *         description: Backend up and running
 */
if (!hasFrontendBuild) {
    app.get('/', (_req, res) => {
        res.send('Backend up and running');
    });
}
else {
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/api-docs')) {
            return next();
        }
        res.sendFile(frontendIndexPath);
    });
}
async function startServer() {
    try {
        await (0, chatSchema_1.ensureChatSchema)();
    }
    catch (error) {
        console.error('Failed to initialize chat storage schema', error);
        process.exit(1);
    }
    const server = app.listen(port, () => {
        const actualPort = server.address().port;
        console.log(`Server listening on port ${actualPort}`);
    });
}
void startServer();
