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

## CORS

Por padrão o backend libera requisições vindas de `localhost` e do domínio `https://jusconnec.quantumtecnologia.com.br`. Caso precise habilitar outros hosts, defina a variável de ambiente `CORS_ALLOWED_ORIGINS` com uma lista de URLs separadas por vírgula:

```bash
CORS_ALLOWED_ORIGINS="https://meusite.com,https://app.meusite.com" npm start
```

Para cenários específicos é possível liberar todas as origens definindo `CORS_ALLOW_ALL=true`, embora isso não seja recomendado em produção.

## Documentação
Após iniciar o servidor, acesse [http://localhost:3001/api-docs](http://localhost:3001/api-docs) para visualizar a documentação Swagger.

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
