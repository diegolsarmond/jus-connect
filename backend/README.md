# Backend

Estrutura inicial do backend usando Express e TypeScript.

## Pastas
- `src/`
  - `controllers/`
  - `routes/`
  - `models/`
- `services/`
  - `index.ts`

## Padrão para acesso a dados

- Centralize consultas SQL reutilizáveis em arquivos de repositório dentro de `src/services`, como `clienteRepository.ts` e `fornecedorRepository.ts`.
- Controllers devem importar essas funções em vez de executar `pool.query` diretamente, garantindo padronização de parâmetros e facilitando futuras otimizações ou trocas de banco.

## Regra para usuários sem empresa vinculada

- Endpoints multiempresa retornam `403` quando o usuário autenticado não possui empresa associada. Isso evita que perfis globais enxerguem dados sensíveis sem informar um escopo explícito.
- Usuários vinculados a uma empresa continuam acessando apenas os registros da própria organização. Ex.: `GET /usuarios`, `GET /usuarios/empresa` e `GET /templates` respeitam esse comportamento. 【F:backend/src/controllers/usuarioController.ts†L146-L205】【F:backend/src/controllers/templateController.ts†L6-L40】

## Como iniciar

### Ambiente de desenvolvimento local

1. Certifique-se de ter o **Node.js 20** (ou superior) e um banco de dados
   **PostgreSQL** acessível. O projeto já inclui um `appsettings.json`
   configurado para a stack de desenvolvimento utilizada no Docker Compose da
   Quantum. Ao executar o backend fora de containers, a aplicação substitui
   automaticamente o host `base-de-dados_postgres` por `localhost`.
   Caso precise utilizar outro hostname local, defina `LOCAL_DB_HOST` antes de
   iniciar o servidor. Você também pode sobrescrever toda a conexão usando a
   variável `DATABASE_URL`. Para o ambiente de testes/homologação padrão
   utilize:

   ```bash
   export DATABASE_URL="postgres://usuario:senha@host:porta/nomedb?sslmode=disable"
   ```

   Recomenda-se armazenar essas credenciais em um arquivo `.env` (não versionado)
   ou no gerenciador de segredos da sua infraestrutura, carregando-as antes de
   iniciar a aplicação.

   Caso prefira outra instância local, substitua a string acima pela conexão
   desejada.

2. Instale as dependências do backend:

   ```bash
   npm install
   ```

3. (Opcional) Execute os scripts SQL necessários para criar as tabelas usadas
   pelos módulos que deseja testar. Os arquivos estão em `sql/*.sql`. O
   projeto pode ser iniciado mesmo sem todas as tabelas, mas os endpoints que
   dependem delas retornarão erros específicos.
4. Inicie o servidor em modo desenvolvimento. A API ficará disponível em
   `http://localhost:3001` e a documentação Swagger em
   `http://localhost:3001/api-docs`:

   ```bash
   npm run dev
   ```

Por padrão o servidor escuta em todas as interfaces (`0.0.0.0`), o que facilita
o acesso a partir de outras máquinas da rede local, containers ou tunneling
de ferramentas como ngrok.

### Utilizando a API de produção

Para cenários de homologação rápida ou integração com o frontend publicado, a
mesma base de código também pode ser executada em modo produção consumindo a
API hospedada pela Quantum em `https://quantumtecnologia.com.br`.

- Quando o backend é inicializado sem sobrescrever `FRONTEND_BASE_URL`, ele já
  utiliza essa URL como padrão em fluxos que enviam links por e-mail, como o
  reset de senha.
- Ao rodar o frontend localmente, defina `VITE_API_URL` (ou utilize o arquivo
  `.env.development` fornecido no projeto do frontend) para apontar os
  requests para `https://quantumtecnologia.com.br/api`.
- Caso precise habilitar novos domínios para consumir a API pública, defina a
  variável `CORS_ALLOWED_ORIGINS` antes de subir o backend.

Em produção recomenda-se executar `npm run build` seguido de `npm start`, ou
utilizar a imagem Docker disponibilizada na raiz do monorepo.

# Prazos de avaliação e tolerância

- `SUBSCRIPTION_TRIAL_DAYS`: número de dias concedidos no período de teste
  inicial (padrão 14).
- `SUBSCRIPTION_GRACE_DAYS_MONTHLY`: quantidade de dias de tolerância aplicada
  a assinaturas mensais quando o pagamento não é identificado no período
  vigente (padrão 7).
- `SUBSCRIPTION_GRACE_DAYS_ANNUAL`: quantidade de dias de tolerância aplicada
  a assinaturas anuais (padrão 30).

Os mesmos valores podem ser expostos para o frontend via Vite utilizando as
variáveis `VITE_SUBSCRIPTION_TRIAL_DAYS`,
`VITE_SUBSCRIPTION_GRACE_DAYS_MONTHLY` e
`VITE_SUBSCRIPTION_GRACE_DAYS_FALLBACK`. Quando não forem definidos, o
frontend seguirá os padrões do backend para estimar datas locais de vencimento.

# Uploads de arquivos

O endpoint `POST /uploads` aceita um formulário `multipart/form-data` com o
campo `file` e persiste o conteúdo no filesystem local por padrão. Os arquivos
ficam disponíveis em `backend/uploads/` e também podem ser servidos
automaticamente pela API quando `FILE_STORAGE_PUBLIC_BASE_URL` aponta para um
path relativo (ex.: `/uploads/`).

Variáveis de ambiente relacionadas:

- `FILE_STORAGE_DRIVER`: driver utilizado para salvar arquivos. Atualmente há o
  driver `local` (padrão) e o modo `disabled`, que retorna HTTP 501
  imediatamente.
- `FILE_STORAGE_LOCAL_ROOT`: caminho onde os arquivos serão salvos quando o
  driver local estiver ativo. Por padrão utiliza `<repo>/backend/uploads`.
- `FILE_STORAGE_PUBLIC_BASE_URL`: base usada para montar a URL pública retornada
  após o upload. Aceita caminhos relativos (`/uploads/`) ou URLs completas
  (`https://cdn.example.com/uploads/`).
- `UPLOAD_MAX_SIZE_MB`: tamanho máximo de arquivo aceito pela API (padrão 10
  MB).
- `UPLOAD_ALLOWED_MIME_TYPES`: lista separada por vírgula com os tipos MIME
  permitidos. Quando não definida, a API aceita `image/jpeg`, `image/png`,
  `image/webp`, `application/pdf` e `text/plain`.

# Rodando testes

Os testes automatizados ficam em `backend/tests/` e utilizam o runner nativo do
Node (`node --test`) carregado via `tsx`. Para executá-los, basta instalar as
dependências e rodar:

```bash
npm install
npm test
```

O script `npm test` configura um `DATABASE_URL` fictício e todos os cenários
mockam dependências externas (Postgres etc.), portanto não é necessário
ter serviços auxiliares em execução. Caso queira filtrar algum teste específico,
use `npm test -- --test-name-pattern="<trecho-do-nome>"`.


arquivos estáticos do aplicativo React na rota raiz.
