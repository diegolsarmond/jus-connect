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
## Documentação
Após iniciar o servidor, acesse [http://localhost:3000/api-docs](http://localhost:3000/api-docs) para visualizar a documentação Swagger.

## Produção

Para gerar o build e executar o servidor em produção:

```bash
npm run build
DATABASE_URL="postgres://user:pass@host:port/db" npm start
```

Se a variável de ambiente `DATABASE_URL` não estiver definida, o valor de `appsettings.json` será utilizado como conexão padrão.
