const { Client } = require('pg');

async function fix() {
    const client = new Client({
        connectionString: 'postgres://postgres.vptedwczcypmqsijszys:sp3company1234@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require',
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    const res = await client.query(`SELECT id, flow_data FROM sp3_flows WHERE name = 'Lembrete de Reunião'`);
    if (res.rows.length === 0) return console.log('not found');

    const flow = res.rows[0];
    const oldData = flow.flow_data;

    const newData = {
        nodes: oldData.nodes,
        edges: oldData.edges.map(e => {
            delete e.sourceHandle;
            return e;
        })
    };

    await client.query(`UPDATE sp3_flows SET flow_data = $1 WHERE id = $2`, [newData, flow.id]);
    console.log('Fixed edges!');
    await client.end();
}
fix().catch(console.error);
