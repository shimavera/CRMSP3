import { createClient } from '@supabase/supabase-js';

const url = 'https://ioqjhbhjzuukmssxhvma.supabase.co';
const key = 'sb_publishable_BXmr9LLM_NDS94Y05ic8og_kFYcRsVU'; 
const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.from('sp3_users').select('email, nome, permissions');
    if (error) {
        console.error("Error fetching users:", error.message);
        return;
    }
    console.log(`Fetched ${data.length} users:`);
    for (const u of data) {
        console.log(`- ${u.email} (${u.nome}): calendar=${u.permissions?.calendar}`);
    }
}

run();
