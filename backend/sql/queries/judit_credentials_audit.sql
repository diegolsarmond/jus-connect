-- Consulta administrativa para listar credenciais JUDIT cadastradas
SELECT
  id,
  provider,
  environment,
  active,
  last_used,
  created_at,
  updated_at
FROM integration_api_keys
WHERE provider = 'judit'
ORDER BY created_at DESC;
