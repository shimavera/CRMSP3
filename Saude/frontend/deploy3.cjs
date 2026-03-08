const fs = require('fs');
const { Client } = require('pg');

async function deploy() {
  const client = new Client({
      connectionString: 'postgres://postgres:sp3company1234@db.vptedwczcypmqsijszys.supabase.co:5432/postgres',
      ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const sql = fs.readFileSync('../supabase/migrations/0023_flow_execution_engine.sql', 'utf8');
  await client.query(sql);
  console.log('0023 applied!');
  await client.end();
}
deploy().catch(console.error);
