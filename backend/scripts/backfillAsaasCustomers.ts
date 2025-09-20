import AsaasCustomerService, { ClienteLocalData } from '../src/services/asaasCustomerService';
import pool from '../src/services/db';

async function main() {
  const service = new AsaasCustomerService();

  const result = await pool.query(
    `SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf
       FROM public.clientes
      ORDER BY id`
  );

  if (result.rowCount === 0) {
    console.log('Nenhum cliente encontrado para sincronização.');
    return;
  }

  for (const row of result.rows as Array<ClienteLocalData & { id: number }>) {
    const payload: ClienteLocalData = {
      nome: row.nome,
      tipo: row.tipo,
      documento: row.documento,
      email: row.email,
      telefone: row.telefone,
      cep: row.cep,
      rua: row.rua,
      numero: row.numero,
      complemento: row.complemento,
      bairro: row.bairro,
      cidade: row.cidade,
      uf: row.uf,
    };

    try {
      const status = await service.updateFromLocal(row.id, payload);
      const errorSuffix = status.errorMessage ? ` - erro: ${status.errorMessage}` : '';
      console.log(`Cliente ${row.id} (${row.nome}): ${status.status}${errorSuffix}`);
    } catch (error) {
      console.error(`Falha ao sincronizar cliente ${row.id} (${row.nome}):`, error);
    }
  }
}

main()
  .catch((error) => {
    console.error('Falha no backfill de clientes Asaas:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (error) {
      console.error('Falha ao encerrar conexão com o banco de dados:', error);
    }
  });
