# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/cdd61cc2-8e74-4dda-ba23-09bb5b408f07

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/cdd61cc2-8e74-4dda-ba23-09bb5b408f07) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Documentos Padrão

O módulo de templates de documentos consome a API disponível em `http://localhost:3001/api`. Caso o backend esteja em outra URL, defina a variável de ambiente `VITE_API_URL` antes de iniciar o projeto. Caso contrário, o frontend utilizará automaticamente o mesmo domínio em que estiver publicado ou, se essa informação não estiver disponível (por exemplo, durante o build em ambientes de homologação/produção), recorrerá ao endpoint público `https://quantumtecnologia.com.br`.

Para facilitar o desenvolvimento utilizando a API de produção, o projeto inclui um arquivo `.env.development` com `VITE_API_URL=https://quantumtecnologia.com.br`. Assim, ao executar `npm run dev`, o frontend apontará automaticamente para os endpoints em produção.

## Integração com cobranças Asaas

- Garanta que as variáveis `ASAAS_API_URL`, `ASAAS_ACCESS_TOKEN` e `ASAAS_WEBHOOK_SECRET` estejam definidas no backend. Em ambientes locais você pode duplicar o arquivo [`../.env.example`](../.env.example).
- No frontend, use `VITE_API_URL` para apontar para a API que expõe os endpoints `/api/asaas/*`.
- Para validar o fluxo completo sem depender do Asaas, importe a coleção [`docs/asaas.postman_collection.json`](../docs/asaas.postman_collection.json) no Postman/Bruno e siga os passos sugeridos na documentação principal.
- Ao receber `PAYMENT_CONFIRMED` o frontend deve exibir a linha da cobrança como quitada; use o webhook simulado (`/api/asaas/webhooks/mock`) quando estiver desenvolvendo offline.

## Conversas (Chat Omnichannel)

Este projeto inclui uma área de conversas inspirada na experiência de mensageria profissional:

- **Atalhos de teclado**: `Ctrl + K` foca a busca de contatos, `Ctrl + N` abre a modal de nova conversa e `Esc` fecha modais em destaque.
- **Lista de conversas**: filtragem em tempo real, badges de não lidos, ordenação por atividade recente e navegação por teclado.
- **Janela de chat**: cabeçalho com ações rápidas, histórico virtualizado (renderiza apenas um bloco de mensagens para manter a performance) e carregamento incremental ao rolar para o topo.
- **Entrada de mensagem**: suporte a emoji, anexos simulados, colagem de imagens e envio com Enter (Shift+Enter cria nova linha).
- **Modal de dispositivos**: tela dedicada para pareamento por QR code, mantendo a interface acessível e responsiva.

### Como rodar

```sh
cd frontend
npm install
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`. O servidor mockado de conversas é inicializado automaticamente no carregamento do módulo.

### Ajustando os dados fictícios

- **Conversas e mensagens**: edite `src/features/chat/data/chatData.json` para alterar contatos, mensagens e status.
- **Comportamento da API**: endpoints simulados ficam em `src/features/chat/services/mockServer.ts`. Ali é possível ajustar paginação, ordenação e payloads retornados.
- **Estilos do chat**: cada componente usa CSS Modules (por exemplo, `ChatSidebar.module.css`, `ChatWindow.module.css`). As variáveis de cor aproveitam o tema existente do CRM.

Sempre que alterar os mocks, salve o arquivo e a aplicação será recarregada automaticamente pelo Vite.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/cdd61cc2-8e74-4dda-ba23-09bb5b408f07) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
