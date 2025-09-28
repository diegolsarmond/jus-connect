# Manual interno - Cobranças Asaas

## Erros comuns e correções

### Cartão recusado
- **Sintoma**: o webhook `PAYMENT_FAILED` retorna `creditCard.chargeback` ou `creditCard.declined`.
- **Causa provável**: o banco emissor rejeitou a transação por falta de saldo, suspeita de fraude ou dados incorretos.
- **Como agir**:
  1. Confirme com o cliente se os dados do cartão (número, validade, CVV e CPF do titular) estão corretos.
  2. Solicite ao cliente o contato com o banco para liberar a transação.
  3. Reprocesse a cobrança pelo painel Asaas ou crie uma nova cobrança no CRM após ajustar os dados.
  4. Registre o atendimento no CRM usando a nota "Cartão recusado" para manter o histórico acessível ao financeiro.

### Cliente sem CPF/CNPJ válido
- **Sintoma**: ao sincronizar cliente com o Asaas, a API responde `422 Unprocessable Entity` com mensagem `cpfCnpj` obrigatório ou inválido.
- **Causa provável**: cadastro incompleto ou documento com pontuação incorreta.
- **Como agir**:
  1. Peça ao escritório responsável que atualize o cadastro com CPF ou CNPJ válidos (somente números).
  2. Utilize a ação "Sincronizar com Asaas" novamente após a correção; o webhook de atualização confirmará o sucesso.
  3. Caso o cliente não possua CPF/CNPJ (ex.: estrangeiros), abra chamado para o time financeiro definir fluxo manual.

## Reconciliação manual
1. Acesse o dashboard do Asaas e exporte o extrato de recebimentos do período desejado (menu **Financeiro > Cobranças recebidas**).
2. No CRM, abra o relatório "Cobranças pendentes" filtrando pelo mesmo intervalo.
3. Compare cada pagamento pelo `externalReference` (ID interno) e valor:
   - Se constar no Asaas, mas não no CRM, acione o endpoint `/api/asaas/webhooks/mock` com o payload do pagamento para reprocessar.
   - Se constar no CRM, mas não no Asaas, investigue o status da cobrança. Ajuste a data de vencimento ou reenvie o boleto/PIX ao cliente.
4. Documente divergências no quadro "Reconciliação" do Notion e atribua responsáveis com prazo de correção.
5. Após os ajustes, gere um novo relatório consolidado e anexe ao fechamento contábil do mês.

## Estorno de cobranças
- **Fluxo padrão**:
  1. Na tela **Financeiro > Lançamentos**, abra o lançamento com cobrança paga e clique em **Gerenciar cobrança**.
  2. O painel mostra a seção *Solicitar estorno no Asaas* quando o status retornado pela API for `RECEIVED`, `CONFIRMED`, `RECEIVED_IN_CASH` ou `RECEIVED_PARTIALLY`.
  3. Ao acionar o botão **Solicitar estorno**, o frontend chama `POST /financial/flows/{id}/asaas/charges/refund` e aguarda a confirmação do Asaas. O backend atualiza `asaas_charges.status` para `REFUNDED` e marca o `financial_flows.status` como `estornado`, limpando a data de pagamento. 【F:backend/src/controllers/financialController.ts†L1507-L1608】【F:frontend/src/components/financial/AsaasChargeDialog.tsx†L806-L861】
  4. Assim que o estorno é concluído, o lançamento deixa de aparecer como pago e o filtro "Situação" passa a oferecer a opção **Estornados**. Os totais e badges consideram o novo status automaticamente. 【F:frontend/src/pages/operator/FinancialFlows.tsx†L326-L561】
- **API direta**: o endpoint pode ser invocado manualmente em integrações (`POST /api/financial/flows/:id/asaas/charges/refund`). É necessário autenticar o usuário e garantir que o lançamento pertence à mesma empresa. O corpo aceita parâmetros opcionais (`value`, `description`, `keepCustomerFee`) repassados para o Asaas. 【F:backend/src/routes/financialRoutes.ts†L19-L22】【F:backend/src/services/asaas/asaasClient.ts†L280-L311】
- **Sincronização**: o sincronizador periódico (`AsaasChargeSyncService`) agora acompanha também os status `REFUNDED` e derivados, mantendo `financial_flows` em `estornado` caso o estorno seja acionado diretamente no Asaas. 【F:backend/src/services/asaasChargeSync.ts†L12-L144】

## Boas práticas operacionais
- Mantenha o `ASAAS_WEBHOOK_SECRET` atualizado sempre que gerar uma nova assinatura no portal Asaas.
- Nunca compartilhe tokens em canais públicos; utilize o cofre de senhas da empresa.
- Agende revisão trimestral dos planos e taxas no Asaas para garantir que o CRM reflita as condições atuais.

## Integração Judit

### Endpoints internos expostos
- `POST /api/processos/{id}/judit/sync`: aciona manualmente a sincronização de um processo específico na Judit. Requer autenticação e valida o vínculo do usuário com a empresa do processo antes de criar/renovar o tracking e abrir uma nova request. O retorno inclui o `tracking_id` ativo e os metadados da request criada (status, origem e horário). 【F:backend/src/controllers/juditProcessController.ts†L15-L101】【F:backend/src/routes/processoRoutes.ts†L309-L336】
- `GET /api/processos/{id}/judit/requests/{requestId}`: consulta o status mais recente da request registrada. Se necessário, o backend faz polling na API da Judit e atualiza o registro local antes de responder. O payload expõe `status`, `result` e timestamps para auditoria. 【F:backend/src/controllers/juditProcessController.ts†L103-L190】【F:backend/src/routes/processoRoutes.ts†L338-L359】
- `POST /api/integrations/judit/webhook`: endpoint utilizado pela Judit para entregar atualizações. Ele identifica o processo pelo `process_number` ou `tracking_id`, atualiza campos internos, consolida o status da request e persiste cada incremento recebido como evento em `sync_audit`. Retorna `202` quando não encontra correspondência, e `200` com `{ status: 'ok' }` após processar com sucesso. 【F:backend/src/controllers/juditWebhookController.ts†L23-L151】【F:backend/src/routes/juditWebhookRoutes.ts†L1-L8】
- `GET /api/processos/{id}`: além dos dados principais, retorna `juditSyncs`, `juditResponses` e `juditAuditTrail`, permitindo acompanhar o histórico de requests, respostas e eventos auditáveis. A consulta também tenta renovar o tracking e dispara um pooling leve (skip se houver request pendente). 【F:backend/src/controllers/processoController.ts†L786-L918】

### Agendamentos automáticos e monitoramento
- O backend inicializa três execuções agendadas para a Judit, às 08h, 12h e 16h (horário do servidor), ignorando domingos. Cada execução garante o tracking, dispara requests somente quando não há outra pendente (`skipIfPending`) e registra erros no log com o prefixo `[CronJobs]`. 【F:backend/src/services/cronJobs.ts†L329-L507】
- Os próximos disparos calculados ficam armazenados em memória e expostos via `cronJobs.getJuditSyncStatus()`, utilizado internamente por telas e rotas protegidas. Caso a chave da Judit não esteja configurada, os timers são limpos e o status passa a indicar `enabled: false`. 【F:backend/src/services/cronJobs.ts†L352-L441】
- Para monitoramento operacional, recomenda-se:
  1. Acompanhar os logs da aplicação em busca de mensagens `[CronJobs]` para identificar processos com falha ou volume processado.
  2. Consultar o processo pelo endpoint `/api/processos/{id}` e revisar os arrays `juditSyncs`, `juditResponses` e `juditAuditTrail`, que trazem os dados persistidos em `process_sync`, `process_response` e `sync_audit` respectivamente. 【F:backend/src/controllers/processoController.ts†L786-L918】【F:backend/src/services/juditProcessService.ts†L420-L648】
  3. Quando necessário, inspecionar diretamente as tabelas `process_sync`, `process_response` e `sync_audit` para confirmar requests em aberto, payloads recebidos ou eventos de auditoria. 【F:backend/src/controllers/juditWebhookController.ts†L23-L151】【F:backend/src/services/juditProcessService.ts†L314-L648】

### Operações manuais: migrations, API key e sincronização
1. **Rodar migrations**: as estruturas utilizadas pela Judit (`process_sync`, `process_response` e `sync_audit`) estão em `backend/sql/`. Na primeira subida do servidor (`npm run dev` ou `npm start`), o backend executa automaticamente `ensureProcessSyncSchema()` que aplica esses scripts. Para executar manualmente em um ambiente novo, rode `psql -f backend/sql/process_sync.sql`, `psql -f backend/sql/process_response.sql` e `psql -f backend/sql/sync_audit.sql` apontando para o banco desejado. 【F:backend/src/services/processSyncSchema.ts†L1-L74】【F:backend/src/index.ts†L323-L343】【F:backend/sql/process_sync.sql†L1-L200】
2. **Configurar `JUDIT_API_KEY`**: defina a variável de ambiente antes de iniciar o backend. Sem a chave, o serviço permanece desabilitado (`isEnabled() === false`) e blocos como `ensureTrackingForProcess` e `updateRequestStatus` retornam `null`. Opcionalmente, ajuste `JUDIT_MAX_RETRIES` e `JUDIT_BACKOFF_MS` para calibrar as tentativas contra a API externa. Armazene a chave no gerenciador de segredos da Quantum e nunca em commits. 【F:backend/src/services/juditProcessService.ts†L788-L910】
3. **Reproduzir sincronização manual**:
   - Certifique-se de que o processo possui número válido e que o usuário autenticado pertence à mesma empresa.
   - Chame `POST /api/processos/{id}/judit/sync` para forçar a criação/renovação do tracking e abrir uma request (`request_id`). Guarde o identificador retornado. 【F:backend/src/controllers/juditProcessController.ts†L15-L101】
   - Utilize `GET /api/processos/{id}/judit/requests/{requestId}` para acompanhar o status. O backend fará polling na Judit quando necessário e persistirá o resultado em `process_sync`. 【F:backend/src/controllers/juditProcessController.ts†L103-L190】
   - Ao receber o webhook (ou para testes, enviando manualmente um POST para `/api/integrations/judit/webhook` com `tracking_id`, `request_id` e `increments`), verifique em `process_sync`, `process_response` e `sync_audit` se os dados foram gravados. O histórico também pode ser consultado na tela de detalhes do processo. 【F:backend/src/controllers/juditWebhookController.ts†L23-L151】【F:backend/src/services/juditProcessService.ts†L314-L648】
