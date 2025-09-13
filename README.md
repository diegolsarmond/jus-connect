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
