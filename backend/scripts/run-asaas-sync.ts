import pool from '../src/services/db';
import { executeAsaasSync } from '../src/services/asaasSyncRunner';

async function main(): Promise<void> {
  await executeAsaasSync();
}

main()
  .then(() => {
    console.log('Sincronização do Asaas executada com sucesso.');
  })
  .catch((error) => {
    console.error('Falha ao executar sincronização do Asaas.', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end().catch(() => undefined);
  });
