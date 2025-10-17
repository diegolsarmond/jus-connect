import pool from '../src/services/db';
import { executeAsaasSync } from '../src/services/asaasSyncRunner';
import { SyncJobDisabledError } from '../src/services/syncJobStatusRepository';

async function main(): Promise<void> {
  await executeAsaasSync();
}

main()
  .then(() => {
    console.log('Sincronização do Asaas executada com sucesso.');
  })
  .catch((error) => {
    if (error instanceof SyncJobDisabledError) {
      console.log('Sincronização do Asaas desativada. Execução agendada ignorada.');
      return;
    }

    console.error('Falha ao executar sincronização do Asaas.', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end().catch(() => undefined);
  });
