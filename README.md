# Jus Connect Document Templates

Este repositório contém um módulo simples de CRUD de Templates de Documentos com editor rich text, painel de tags e geração de documentos via API.

## Backend

```bash
cd backend
npm install
# configure PostgreSQL e execute o script de tabelas
psql -f sql/templates.sql
npm run dev
```

## Frontend

```bash
cd frontend
npm install
# opcional: export VITE_API_URL=http://localhost:3000/api
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
# sirva os arquivos da pasta dist com seu servidor HTTP preferido
```

Ao configurar o servidor HTTP (Caddy, Nginx, etc.), aponte o `root` para
`./frontend/dist` em vez da raiz do repositório. O arquivo `index.html` na
raiz do projeto foi removido para evitar que seja servido por engano.

