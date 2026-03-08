const fs = require('fs');
const { Client } = require('pg');

async function deploy() {
  const client = new Client({
      connectionString: 'postgres://postgres.vptedwczcypmqsijszys:sp3company1234@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require',
      ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const sql = fs.readFileSync('../supabase/migrations/0023_flow_execution_engine.sql', 'utf8');
  await client.query(sql);
  console.log('0023 applied!');
  await client.end();
}
deploy().catch(console.error);
