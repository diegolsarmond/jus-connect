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
- Caso um webhook seja configurado sem credencial associada no CRM, defina `ASAAS_WEBHOOK_SECRET` no ambiente: o backend usa o valor (após remover espaços extras) como fallback para validar as assinaturas recebidas.
- Nunca compartilhe tokens em canais públicos; utilize o cofre de senhas da empresa.
- Agende revisão trimestral dos planos e taxas no Asaas para garantir que o CRM reflita as condições atuais.

