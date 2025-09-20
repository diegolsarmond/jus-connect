# Jus Connect Document Templates

Este repositório contém um módulo simples de CRUD de Templates de Documentos com editor rich text, painel de tags e geração de documentos via API.

## Backend

```bash
cd backend
npm install
# configure PostgreSQL e execute o script de tabelas
psql -f sql/templates.sql
psql -f sql/intimacoes.sql
npm run dev
```

### Integração com notificações do PJE

Para habilitar o agendamento automático de webhooks com o PJE, defina as
seguintes variáveis de ambiente antes de iniciar o backend:

| Variável              | Descrição                                                                 |
| --------------------- | ------------------------------------------------------------------------- |
| `PJE_CLIENT_ID`       | Identificador do cliente cadastrado no PJE para obter o token OAuth2.     |
| `PJE_CLIENT_SECRET`   | Segredo associado ao cliente, utilizado na geração do token de acesso.    |
| `PJE_WEBHOOK_URL`     | URL pública do seu backend que receberá as notificações enviadas pelo PJE. |

Com esses valores configurados, o serviço agenda rotinas para renovar tokens
expirados e revalidar a assinatura do webhook automaticamente.

### Integração com intimações do Projudi

Para habilitar a sincronização automática das intimações disponibilizadas pelo
Projudi, defina as seguintes variáveis de ambiente antes de iniciar o backend:

| Variável              | Descrição                                                                 |
| --------------------- | ------------------------------------------------------------------------- |
| `PROJUDI_BASE_URL`    | URL base do ambiente do Projudi que será consultado.                      |
| `PROJUDI_USER`        | Usuário habilitado no Projudi para acesso às intimações.                  |
| `PROJUDI_PASSWORD`    | Senha do usuário configurado na integração.                               |

O serviço executa uma rotina periódica para autenticar, consultar novas
intimações e gravá-las na tabela `intimacoes`. É possível monitorar ou
acionar a sincronização manualmente via `GET /api/notificacoes/projudi/sync`.

### Integração com Asaas

Para consumir a API de cobranças do Asaas por meio das credenciais gerenciadas
em `integration_api_keys`:

1. Execute novamente o script `psql -f sql/integration_api_keys.sql` para
   garantir a presença da coluna `url_api` e do provedor `asaas` no `CHECK`.
2. Cadastre uma chave com `provider` igual a `asaas` (via API ou tela de
   configurações) informando o token de acesso do Asaas.
3. Se o campo `url_api` não for preenchido, o backend assumirá automaticamente
   os endpoints padrão:
   - Produção: `https://api.asaas.com/api/v3`
   - Homologação: `https://sandbox.asaas.com/api/v3`
4. Utilize o endpoint `POST /api/integrations/providers/asaas/validate` para
   testar a conexão após o cadastro da chave.

Não são necessárias variáveis de ambiente adicionais além das credenciais
registradas na tabela.

## Frontend

```bash
cd frontend
npm install
# opcional: export VITE_API_URL=http://localhost:3001/api
npm run dev
```

Após iniciar, acesse o frontend em `http://localhost:5173` e utilize o menu **Documentos** para gerenciar templates.

## Produção

### Backend

```bash
cd backend
npm run build
# Defina DATABASE_URL ou certifique-se de que appsettings.json contenha a conexão
DATABASE_URL="postgres://user:pass@host:port/db" npm start
```

Se `DATABASE_URL` não estiver definido, o servidor buscará a cadeia de conexão em
`appsettings.json`. Esse arquivo é opcional, mas se ambos estiverem ausentes o
backend encerrará com um erro informativo.

### Frontend

```bash
cd frontend
npm run build
# os arquivos ficarão disponíveis em ./frontend/dist
```

Se a pasta `frontend/dist` estiver presente, o backend servirá automaticamente
o frontend estático, inclusive na imagem Docker fornecida. Caso prefira usar
um servidor HTTP dedicado (Caddy, Nginx, etc.), basta apontar o `root` para
`./frontend/dist`.

