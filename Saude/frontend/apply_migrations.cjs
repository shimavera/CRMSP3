const fs = require('fs');
const { Client } = require('pg');

const run = async () => {
    const client = new Client({
        connectionString: "postgres://postgres.vptedwczcypmqsijszys:sp3company1234@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    console.log('Connected');

    // Applying Migration 0022 again
    const sql22 = fs.readFileSync('../supabase/migrations/0022_auto_trigger_external_leads.sql', 'utf8');
    await client.query(sql22);
    console.log('Executed 0022');

    // Applying Migration 0023 again
    const sql23 = fs.readFileSync('../supabase/migrations/0023_flow_execution_engine.sql', 'utf8');
    await client.query(sql23);
    console.log('Executed 0023');

    await client.end();
};
run().catch(console.error);
