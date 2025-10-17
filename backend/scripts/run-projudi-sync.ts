import pool from '../src/services/db';
import { executeProjudiSync } from '../src/services/projudiSyncRunner';

async function main(): Promise<void> {
  await executeProjudiSync();
}

main()
  .then(() => {
    console.log('Sincronização do Projudi executada com sucesso.');
  })
  .catch((error) => {
    console.error('Falha ao executar sincronização do Projudi.', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end().catch(() => undefined);
  });
