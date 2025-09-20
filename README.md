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

## Frontend

```bash
cd frontend
npm install
# opcional: export VITE_API_URL=http://localhost:3001/api
npm run dev
```

Após iniciar, acesse o frontend em `http://localhost:5173` e utilize o menu **Documentos** para gerenciar templates.

## Integração com cobranças Asaas

### Variáveis de ambiente

Configure as seguintes variáveis antes de iniciar o backend. Utilize o arquivo [`.env.example`](./.env.example) como referência:

| Variável               | Descrição                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `ASAAS_API_URL`        | URL base da API. Utilize `https://sandbox.asaas.com/api/v3` no ambiente de testes.            |
| `ASAAS_ACCESS_TOKEN`   | Token pessoal ou de aplicação gerado no painel do Asaas (`Configurações > Integrações > API`). |
| `ASAAS_WEBHOOK_SECRET` | Segredo configurado no webhook para validar a assinatura `x-asaas-signature`.                 |

> 💡 Defina as mesmas chaves no ambiente de build do frontend caso ele consuma endpoints intermediários (`VITE_API_URL`).

### Como obter o token de acesso
1. Acesse o painel do Asaas com um usuário administrador.
2. Navegue até **Configurações > Integrações > API**.
3. Gere um token para o ambiente desejado (produção ou sandbox) e copie-o imediatamente.
4. Armazene o valor no cofre corporativo e preencha `ASAAS_ACCESS_TOKEN` no arquivo `.env` do backend.

### Configuração de webhooks
1. Em **Configurações > Integrações > Webhooks**, crie uma nova assinatura apontando para `https://<sua-api>/api/asaas/webhooks`.
2. Ative ao menos os eventos `CUSTOMER_CREATED`, `CUSTOMER_UPDATED`, `PAYMENT_CREATED`, `PAYMENT_CONFIRMED` e `PAYMENT_FAILED`.
3. Informe um segredo forte (32+ caracteres) e replique o valor em `ASAAS_WEBHOOK_SECRET`.
4. Utilize o botão **Enviar teste** do Asaas para confirmar que o endpoint retorna `200 OK`.

### Fluxo recomendado de cobrança
1. **Sincronize o cliente**: o CRM envia `externalId`, `name`, `email` e `cpfCnpj` para `/api/asaas/customers`. O cadastro só é criado caso o cliente esteja previamente sincronizado localmente.
2. **Gere a cobrança**: a API chama `/api/asaas/payments` informando `customerExternalId`, tipo (`PIX`, `BOLETO`, `CREDIT_CARD`) e valores.
3. **Acompanhe o status**: o webhook do Asaas atualiza as tabelas internas com o novo estado do pagamento (recebido, vencido ou cancelado).
4. **Notifique o cliente**: ao confirmar o pagamento via webhook, envie recibo ou libere o serviço contratado.

### Limitações conhecidas
- É obrigatório que o cliente exista e esteja sincronizado no Asaas antes de gerar cobranças; caso contrário, a API responde `404 customer not found`.
- As cobranças PIX expiram após 24 horas no ambiente padrão; use o campo `dueDate` para aumentar o prazo quando aplicável.
- O webhook precisa estar acessível publicamente; em ambientes locais utilize um túnel (ngrok, Cloudflare) ou o endpoint `/api/asaas/webhooks/mock` para simular eventos.

### Ferramentas de teste
- Utilize a coleção [docs/asaas.postman_collection.json](./docs/asaas.postman_collection.json) no Postman ou Bruno para executar o fluxo fim a fim (cliente → cobrança PIX → webhook simulado).
- Para rodar scripts customizados, adicione testes end-to-end no diretório `backend/tests` consumindo os mesmos endpoints descritos acima.

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

