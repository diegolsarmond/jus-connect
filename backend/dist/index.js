"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const areaAtuacaoRoutes_1 = __importDefault(require("./routes/areaAtuacaoRoutes"));
const tipoEventoRoutes_1 = __importDefault(require("./routes/tipoEventoRoutes"));
const tipoProcessoRoutes_1 = __importDefault(require("./routes/tipoProcessoRoutes"));
const escritorioRoutes_1 = __importDefault(require("./routes/escritorioRoutes"));
const perfilRoutes_1 = __importDefault(require("./routes/perfilRoutes"));
const planoRoutes_1 = __importDefault(require("./routes/planoRoutes"));
const situacaoClienteRoutes_1 = __importDefault(require("./routes/situacaoClienteRoutes"));
const situacaoProcessoRoutes_1 = __importDefault(require("./routes/situacaoProcessoRoutes"));
const etiquetaRoutes_1 = __importDefault(require("./routes/etiquetaRoutes"));
const usuarioRoutes_1 = __importDefault(require("./routes/usuarioRoutes"));
const empresaRoutes_1 = __importDefault(require("./routes/empresaRoutes"));
const clienteRoutes_1 = __importDefault(require("./routes/clienteRoutes"));
const agendaRoutes_1 = __importDefault(require("./routes/agendaRoutes"));
const templateRoutes_1 = __importDefault(require("./routes/templateRoutes"));
const tagRoutes_1 = __importDefault(require("./routes/tagRoutes"));
const documentRoutes_1 = __importDefault(require("./routes/documentRoutes"));
const financialRoutes_1 = __importDefault(require("./routes/financialRoutes"));
const fluxoTrabalhoRoutes_1 = __importDefault(require("./routes/fluxoTrabalhoRoutes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const oportunidadeRoutes_1 = __importDefault(require("./routes/oportunidadeRoutes"));
const tarefaRoutes_1 = __importDefault(require("./routes/tarefaRoutes"));
const tarefaResponsavelRoutes_1 = __importDefault(require("./routes/tarefaResponsavelRoutes"));
const tipoDocumentoRoutes_1 = __importDefault(require("./routes/tipoDocumentoRoutes"));
const clienteDocumentoRoutes_1 = __importDefault(require("./routes/clienteDocumentoRoutes"));
const supportRoutes_1 = __importDefault(require("./routes/supportRoutes"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_1 = __importDefault(require("./swagger"));
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
/**
 * Middleware de CORS
 */
app.use((req, res, next) => {
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:4200',
    ];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
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
app.use('/api', areaAtuacaoRoutes_1.default);
app.use('/api', tipoEventoRoutes_1.default);
app.use('/api', tipoProcessoRoutes_1.default);
app.use('/api', tipoDocumentoRoutes_1.default);
app.use('/api', escritorioRoutes_1.default);
app.use('/api', perfilRoutes_1.default);
app.use('/api', planoRoutes_1.default);
app.use('/api', situacaoProcessoRoutes_1.default);
app.use('/api', situacaoClienteRoutes_1.default);
app.use('/api', etiquetaRoutes_1.default);
app.use('/api', empresaRoutes_1.default);
app.use('/api', usuarioRoutes_1.default);
app.use('/api/v1', usuarioRoutes_1.default);
app.use('/api', clienteRoutes_1.default);
app.use('/api', agendaRoutes_1.default);
app.use('/api', templateRoutes_1.default);
app.use('/api', tagRoutes_1.default);
app.use('/api', documentRoutes_1.default);
app.use('/api', financialRoutes_1.default);
app.use('/api', fluxoTrabalhoRoutes_1.default);
app.use('/api', uploadRoutes_1.default);
app.use('/api', oportunidadeRoutes_1.default);
app.use('/api', tarefaRoutes_1.default);
app.use('/api', tarefaResponsavelRoutes_1.default);
app.use('/api', clienteDocumentoRoutes_1.default);
app.use('/api', supportRoutes_1.default);
// Swagger
const specs = (0, swagger_jsdoc_1.default)(swagger_1.default);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(specs));
/**
 * @swagger
 * /:
 *   get:
 *     summary: Verifica o status do backend
 *     responses:
 *       200:
 *         description: Backend up and running
 */
app.get('/', (_req, res) => {
    res.send('Backend up and running');
});
// Start
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
