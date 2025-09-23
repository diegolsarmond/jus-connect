-- Associação entre clientes locais e cadastros na API do Asaas
CREATE TABLE IF NOT EXISTS asaas_customers (
  cliente_id BIGINT NOT NULL,
  integration_api_key_id BIGINT NOT NULL,
  asaas_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  synced_at TIMESTAMPTZ,
  last_payload JSONB,
  PRIMARY KEY (cliente_id, integration_api_key_id),
  CONSTRAINT fk_asaas_customers_cliente
    FOREIGN KEY (cliente_id)
    REFERENCES public.clientes (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_asaas_customers_integration
    FOREIGN KEY (integration_api_key_id)
    REFERENCES public.integration_api_keys (id)
    ON DELETE CASCADE
);

-- Índice explícito para acelerar consultas por cliente e integração
CREATE UNIQUE INDEX IF NOT EXISTS uq_asaas_customers_cliente_integration
  ON asaas_customers (cliente_id, integration_api_key_id);
