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
Instale as dependências e rode o servidor em modo desenvolvimento:

```bash
npm install
npm run dev

```

# Rodando testes

```bash
npm test
```

## Banco de dados

O arquivo `sql/templates.sql` contém a estrutura mínima para as tabelas `templates` e `tags` utilizadas pelos novos endpoints de documentos. Execute esse script em um banco PostgreSQL antes de iniciar o servidor.

O script `sql/support.sql` cria a tabela `support_requests` utilizada pelo módulo de suporte.

O script `sql/integration_api_keys.sql` define a tabela `integration_api_keys`, responsável por armazenar as chaves de API configuradas na tela de Integrações.

O script `sql/intimacoes.sql` cria a tabela `intimacoes`, utilizada para
persistir os dados normalizados durante a sincronização das intimações do
Projudi.

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
DATABASE_URL="postgres://user:pass@host:port/db" npm start
```

Se `DATABASE_URL` não estiver definida, o servidor tentará utilizar a conexão
descrita em `appsettings.json`. Esse arquivo é opcional; caso ambos estejam
ausentes, a inicialização falhará com um erro descritivo.

Caso a pasta `../frontend/dist` esteja presente (por exemplo, após executar
`npm run build` no frontend), o servidor também publicará automaticamente os
arquivos estáticos do aplicativo React na rota raiz.
