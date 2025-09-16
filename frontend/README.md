# JusConnect — Templates de Documentos

Interface web para gerenciar a biblioteca de templates de documentos jurídicos. O módulo permite listar, criar e editar modelos com placeholders dinâmicos, salvando o conteúdo tanto em HTML quanto em JSON compatível com o editor.

## Principais recursos

- Biblioteca de modelos em grade com busca, filtro por tipo e ações (abrir, renomear, exportar PDF e excluir).
- Editor WYSIWYG com aparência de página A4, toolbar completa (formatação, listas, alinhamento, undo/redo, imagem e tabela).
- Menu de inserção de variáveis hierárquicas (Cliente, Processo, Escritório, Usuário e Data atual) com tags visuais `{{namespace.campo}}`.
- Modal de metadados (título, tipo, área, complexidade, visibilidade e opções de cadastro automático).
- Botão flutuante "Salvar novo modelo" que envia `content_html` e `content_editor_json` ao backend.
- Autenticação mock com armazenamento do token JWT em `localStorage`.

## Tecnologias utilizadas

- **React + Vite + TypeScript** para a camada SPA.
- **Slate** como editor rich text. Escolhido pela flexibilidade para criar nodes customizados (ex.: placeholders `variable`) e controle completo de serialização.
- **Slate History** para desfazer/refazer, **React Router** para roteamento e **Testing Library + Vitest** para testes de unidade.

## Pré-requisitos

- Node.js 18+
- npm 9+

## Instalação e execução

```bash
cd frontend
npm install
npm run dev
```

A aplicação ficará disponível em `http://localhost:5173` (ou na porta definida em `VITE_PORT`).

### Variáveis de ambiente

Defina a URL base do backend (incluindo protocolo) antes de iniciar:

```bash
BACKEND_URL=http://localhost:3001 npm run dev
```

O arquivo `vite.config.ts` expõe automaticamente variáveis que começam com `BACKEND_` ou `VITE_`. Caso esteja em produção, utilize `BACKEND_URL` para apontar para o domínio correto.

### Testes automatizados

```bash
cd frontend
npm test
```

Os testes utilizam Vitest + jsdom e cobrem a serialização das variáveis para o formato `{{namespace.campo}}`.

## Como funciona a integração

- **Login**: formulário simples em `/login`. Envia credenciais para `/api/auth/login`. Caso o endpoint não exista, é gerado um token mock (`mock-token-<timestamp>`).
- **Templates**: `GET /api/templates`, `GET /api/templates/:id`, `POST /api/templates`, `PUT /api/templates/:id`, `PATCH /api/templates/:id/rename`, `DELETE /api/templates/:id`.
- **Variáveis**: `GET /api/variables` retorna a árvore de placeholders. Há um fallback local em `EditorPage.tsx` que garante os grupos obrigatórios (Cliente, Processo, Escritório, Usuário e Data atual).
- **Exportação**: `GET /api/templates/:id/export` gera download de PDF.

### Exemplo de requisições com `curl`

```bash
# Login
curl -X POST "$BACKEND_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"consultor@jus.com","password":"123456"}'

# Listar templates
curl "$BACKEND_URL/api/templates" -H "Authorization: Bearer <TOKEN>"

# Criar template
curl -X POST "$BACKEND_URL/api/templates" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name":"Contrato de Honorários",
    "type":"Contrato",
    "area":"Cível",
    "complexity":"media",
    "visibility":"PUBLIC",
    "autoCreateClient":false,
    "autoCreateProcess":false,
    "contentHtml":"<p>Olá {{cliente.primeiro_nome}}</p>",
    "contentEditorJson":"[]"
  }'
```

## Estrutura principal

```
frontend/
├── src/
│   ├── App.tsx                 # Rotas, provider de autenticação e layout com sidebar
│   ├── pages/
│   │   ├── LibraryPage.tsx     # Grade de templates
│   │   └── EditorPage.tsx      # Editor WYSIWYG + serialização HTML/JSON
│   ├── components/
│   │   ├── EditorToolbar.tsx
│   │   ├── InsertMenu.tsx
│   │   ├── MetadataModal.tsx
│   │   ├── SaveButton.tsx
│   │   ├── Sidebar.tsx
│   │   └── VariableTag.tsx
│   └── services/api.ts         # Fetch com autenticação
└── tests/
    └── Editor.test.tsx
```

### Comentários importantes no código

- `EditorPage.tsx`: há comentários explicitando onde estender a lista de variáveis (`fallbackVariables`) e como a função `serializeEditorValue` converte o conteúdo do Slate em HTML com placeholders `{{namespace.campo}}`.
- `api.ts`: comentários indicam onde incluir novos namespaces/variáveis retornados pelo backend.

## Scripts disponíveis

- `npm run dev` — inicia o Vite em modo desenvolvimento.
- `npm run build` — compila TypeScript e gera artefatos de produção.
- `npm run test` — executa os testes com Vitest.
- `npm run prisma:migrate` — placeholder para futuras migrações (backend).
- `npm run seed` — placeholder para seeds do backend.

## Acessibilidade e responsividade

- Sidebar colapsável com foco por teclado.
- Editor ocupa 100% da largura em telas menores.
- Atalhos básicos habilitados (`Ctrl+B`, `Ctrl+I`, `Ctrl+U`).
- Componentes possuem `aria-label` e modais utilizam `aria-modal`.

## Próximos passos sugeridos

- Conectar o botão "Salvar novo modelo" a endpoints reais de atualização/histórico.
- Implementar pré-visualização real de PDF na biblioteca (pré-download).
- Sincronizar variáveis disponíveis com o backend em tempo real (WebSocket) para evitar divergências.
