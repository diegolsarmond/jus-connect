import pool from '../src/services/db';
import { executeProjudiSync } from '../src/services/projudiSyncRunner';
import { SyncJobDisabledError } from '../src/services/syncJobStatusRepository';

async function main(): Promise<void> {
  await executeProjudiSync();
}

main()
  .then(() => {
    console.log('Sincronização do Projudi executada com sucesso.');
  })
  .catch((error) => {
    if (error instanceof SyncJobDisabledError) {
      console.log('Sincronização do Projudi desativada. Execução agendada ignorada.');
      return;
    }

    console.error('Falha ao executar sincronização do Projudi.', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end().catch(() => undefined);
  });
