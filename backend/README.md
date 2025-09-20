# Backend

Estrutura inicial do backend usando Express e TypeScript.

## Pastas
- `src/`
  - `controllers/`
  - `routes/`
  - `models/`
  - `services/`
  - `index.ts`

## Como iniciar

### Ambiente de desenvolvimento local

1. Certifique-se de ter o **Node.js 20** (ou superior) e um banco de dados
   **PostgreSQL** acessível. O projeto já inclui um `appsettings.json`
   configurado para a stack de desenvolvimento utilizada no Docker Compose da
   Quantum, mas você pode sobrescrever a conexão usando a variável
   `DATABASE_URL`. Para o ambiente de testes/homologação padrão utilize:

   ```bash
   export DATABASE_URL="postgres://postgres:C@104rm0nd1994@easypanel02.quantumtecnologia.com.br:5438/quantumtecnologia?sslmode=disable"
   ```

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
API hospedada pela Quantum em `https://jusconnec.quantumtecnologia.com.br`.

- Quando o backend é inicializado sem sobrescrever `FRONTEND_BASE_URL`, ele já
  utiliza essa URL como padrão em fluxos que enviam links por e-mail, como o
  reset de senha.
- Ao rodar o frontend localmente, defina `VITE_API_URL` (ou utilize o arquivo
  `.env.development` fornecido no projeto do frontend) para apontar os
  requests para `https://jusconnec.quantumtecnologia.com.br/api`.
- Caso precise habilitar novos domínios para consumir a API pública, defina a
  variável `CORS_ALLOWED_ORIGINS` antes de subir o backend.

Em produção recomenda-se executar `npm run build` seguido de `npm start`, ou
utilizar a imagem Docker disponibilizada na raiz do monorepo.

# Rodando testes

```bash
npm test
```

## Banco de dados

O arquivo `sql/templates.sql` contém a estrutura mínima para as tabelas `templates` e `tags` utilizadas pelos novos endpoints de documentos. Execute esse script em um banco PostgreSQL antes de iniciar o servidor.

O script `sql/support.sql` cria a tabela `support_requests` utilizada pelo módulo de suporte.

O script `sql/situacoes.sql` cria as tabelas `situacao_cliente`, `situacao_proposta` e `situacao_processo`, além de inserir alguns valores iniciais necessários para os cadastros de situações utilizados nas oportunidades.

O script `sql/integration_api_keys.sql` define a tabela `integration_api_keys`, responsável por armazenar as chaves de API configuradas na tela de Integrações.

O script `sql/intimacoes.sql` cria a tabela `intimacoes`, utilizada para
persistir os dados normalizados durante a sincronização das intimações do
Projudi.

O script `sql/user_profile.sql` define as tabelas utilizadas pela tela "Meu
Perfil", responsáveis por armazenar os dados personalizados do usuário,
histórico de auditoria e sessões ativas.

## CORS

Por padrão o backend libera requisições vindas de `localhost` e do domínio `https://jusconnec.quantumtecnologia.com.br`. Caso precise habilitar outros hosts, defina a variável de ambiente `CORS_ALLOWED_ORIGINS` com uma lista de URLs separadas por vírgula:

```bash
CORS_ALLOWED_ORIGINS="https://meusite.com,https://app.meusite.com" npm start
```

Para cenários específicos é possível liberar todas as origens definindo `CORS_ALLOW_ALL=true`, embora isso não seja recomendado em produção.

## Documentação
Após iniciar o servidor, acesse [http://localhost:3001/api-docs](http://localhost:3001/api-docs) para visualizar a documentação Swagger.

## Autenticação

Os endpoints `POST /api/auth/login` e `GET /api/auth/me` permitem autenticar usuários e recuperar os dados do usuário logado.
Defina a variável `AUTH_TOKEN_SECRET` com um valor seguro em produção. Opcionalmente, utilize `AUTH_TOKEN_EXPIRATION` para
customizar o tempo de expiração (em segundos ou usando sufixos como `15m`, `2h` ou `7d`).

## Produção

Para gerar o build e executar o servidor em produção:

```bash
npm run build
DATABASE_URL="postgres://postgres:C@104rm0nd1994@base-de-dados_postgres:5432/quantumtecnologia?sslmode=disable" npm start
```

Se `DATABASE_URL` não estiver definida, o servidor tentará utilizar a conexão
descrita em `appsettings.json`. Esse arquivo é opcional; caso ambos estejam
ausentes, a inicialização falhará com um erro descritivo.

Caso a pasta `../frontend/dist` esteja presente (por exemplo, após executar
`npm run build` no frontend), o servidor também publicará automaticamente os
arquivos estáticos do aplicativo React na rota raiz.
