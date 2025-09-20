import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createAsaasChargeMock = vi.fn();
const fetchChargeDetailsMock = vi.fn().mockResolvedValue(null);
const listChargeStatusMock = vi.fn().mockResolvedValue([]);
const tokenizeCardMock = vi.fn();
const fetchCustomerSyncStatusMock = vi.fn().mockResolvedValue(null);
const syncCustomerNowMock = vi.fn().mockResolvedValue(null);

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/flows', () => ({
  createAsaasCharge: (...args: unknown[]) => createAsaasChargeMock(...args),
  fetchChargeDetails: (...args: unknown[]) => fetchChargeDetailsMock(...args),
  listChargeStatus: (...args: unknown[]) => listChargeStatusMock(...args),
  tokenizeCard: (...args: unknown[]) => tokenizeCardMock(...args),
  fetchCustomerSyncStatus: (...args: unknown[]) => fetchCustomerSyncStatusMock(...args),
  syncCustomerNow: (...args: unknown[]) => syncCustomerNowMock(...args),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AsaasCharge, Flow } from '@/lib/flows';
import { AsaasChargeDialog } from '../AsaasChargeDialog';

describe('AsaasChargeDialog', () => {
  beforeEach(() => {
    createAsaasChargeMock.mockReset();
    fetchChargeDetailsMock.mockReset().mockResolvedValue(null);
    listChargeStatusMock.mockReset().mockResolvedValue([]);
    tokenizeCardMock.mockReset();
    fetchCustomerSyncStatusMock.mockReset().mockResolvedValue(null);
    syncCustomerNowMock.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const flow: Flow = {
    id: 42,
    tipo: 'receita',
    descricao: 'Mensalidade de assessoria',
    vencimento: '2024-06-15',
    pagamento: null,
    valor: 1234.56,
    status: 'pendente',
  };

  const customers = [
    {
      id: 'customer-1',
      label: 'Empresa Exemplo',
      email: 'contato@exemplo.com',
      document: '12345678901',
      raw: {},
    },
  ];

  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });

  it('envia a criação de cobrança PIX quando o cliente é selecionado', async () => {
    const onChargeCreated = vi.fn();
    const sampleCharge: AsaasCharge = {
      id: 'charge_pix',
      paymentMethod: 'PIX',
      status: 'PENDING',
      pixPayload: '00020126580014BR.GOV.BCB.PIX0123abc123',
    };

    createAsaasChargeMock.mockResolvedValueOnce(sampleCharge);

    render(
      <QueryClientProvider client={createQueryClient()}>
        <AsaasChargeDialog
          flow={flow}
          open
          onOpenChange={() => {}}
          customers={customers}
          customersLoading={false}
          onChargeCreated={onChargeCreated}
          onStatusUpdated={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Cliente'), ['customer-1']);

    await user.click(screen.getByRole('button', { name: 'Gerar cobrança' }));

    await waitFor(() => expect(createAsaasChargeMock).toHaveBeenCalledTimes(1));
    expect(createAsaasChargeMock).toHaveBeenCalledWith(flow.id, {
      customerId: 'customer-1',
      paymentMethod: 'PIX',
      installmentCount: undefined,
      dueDate: undefined,
    });

    await waitFor(() => expect(onChargeCreated).toHaveBeenCalledWith(flow.id, sampleCharge));
  });

  it('tokeniza o cartão antes de criar a cobrança de cartão', async () => {
    const onChargeCreated = vi.fn();

    const cardCharge: AsaasCharge = {
      id: 'charge_card',
      paymentMethod: 'CREDIT_CARD',
      status: 'AUTHORIZED',
      cardAuthorizationCode: 'ABC123',
    };

    tokenizeCardMock.mockResolvedValueOnce({ token: 'tok_123', brand: 'VISA', last4Digits: '4242' });
    createAsaasChargeMock.mockResolvedValueOnce(cardCharge);

    render(
      <QueryClientProvider client={createQueryClient()}>
        <AsaasChargeDialog
          flow={flow}
          open
          onOpenChange={() => {}}
          customers={customers}
          customersLoading={false}
          onChargeCreated={onChargeCreated}
          onStatusUpdated={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Cliente'), ['customer-1']);
    await user.selectOptions(screen.getByLabelText('Método de pagamento'), ['CREDIT_CARD']);

    await user.click(screen.getByRole('button', { name: /prosseguir para cartão/i }));

    const modal = await screen.findByRole('dialog', { name: 'Dados do cartão' });

    await user.type(screen.getByPlaceholderText('Nome impresso no cartão'), 'Fulano de Tal');
    await user.type(screen.getByPlaceholderText('E-mail do titular'), 'fulano@example.com');
    await user.type(screen.getByPlaceholderText('CPF/CNPJ'), '123.456.789-01');
    await user.type(screen.getByPlaceholderText('Número do cartão'), '4242 4242 4242 4242');
    await user.type(screen.getByPlaceholderText('Mês'), '12');
    await user.type(screen.getByPlaceholderText('Ano'), '34');
    await user.type(screen.getByPlaceholderText('CVV'), '123');
    await user.type(screen.getByPlaceholderText('Telefone'), '(11) 90000-0000');
    await user.type(screen.getByPlaceholderText('CEP'), '01001-000');
    await user.type(screen.getByPlaceholderText('Número do endereço'), '123');
    await user.type(screen.getByPlaceholderText('Complemento'), 'Sala 5');

    await user.click(within(modal).getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => expect(tokenizeCardMock).toHaveBeenCalledTimes(1));
    expect(tokenizeCardMock).toHaveBeenCalledWith({
      holderName: 'Fulano de Tal',
      number: '4242424242424242',
      expiryMonth: '12',
      expiryYear: '34',
      cvv: '123',
      document: '12345678901',
      email: 'fulano@example.com',
      phone: '11900000000',
      postalCode: '01001000',
      addressNumber: '123',
      addressComplement: 'Sala 5',
    });

    await waitFor(() => expect(createAsaasChargeMock).toHaveBeenCalledTimes(1));
    expect(createAsaasChargeMock).toHaveBeenCalledWith(
      flow.id,
      expect.objectContaining({
        customerId: 'customer-1',
        paymentMethod: 'CREDIT_CARD',
        cardToken: 'tok_123',
        installmentCount: 1,
      }),
    );

    await waitFor(() => expect(onChargeCreated).toHaveBeenCalledWith(flow.id, cardCharge));
  });
});
