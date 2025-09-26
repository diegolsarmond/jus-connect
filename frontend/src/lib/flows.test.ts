import { afterEach, describe, expect, test, vi } from 'vitest';

import { createAsaasCharge, type AsaasPaymentMethod } from './flows';

const originalFetch = global.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalFetch) {
    global.fetch = originalFetch;
  }
});

describe('createAsaasCharge', () => {
  test('sends debit card payment method to API and normalizes response', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const bodyText = init?.body ? String(init.body) : '';
      const parsedBody = bodyText ? JSON.parse(bodyText) : {};

      expect(parsedBody.paymentMethod).toBe<'DEBIT_CARD'>('DEBIT_CARD');

      const responsePayload = {
        charge: {
          id: 'ch_debit_front',
          paymentMethod: 'DEBIT_CARD' satisfies AsaasPaymentMethod,
          billingType: 'DEBIT_CARD',
          status: 'PENDING',
        },
      };

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const charge = await createAsaasCharge(123, {
      customerId: 'cus_123',
      paymentMethod: 'DEBIT_CARD',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(charge.paymentMethod).toBe('DEBIT_CARD');
    expect(charge.id).toBe('ch_debit_front');
  });
});
