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

## Boas práticas operacionais
- Mantenha o `ASAAS_WEBHOOK_SECRET` atualizado sempre que gerar uma nova assinatura no portal Asaas.
- Nunca compartilhe tokens em canais públicos; utilize o cofre de senhas da empresa.
- Agende revisão trimestral dos planos e taxas no Asaas para garantir que o CRM reflita as condições atuais.
