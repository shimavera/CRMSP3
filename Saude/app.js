const fs = require('fs');
console.log(fs.readFileSync('supabase/migrations/0023_flow_execution_engine.sql', 'utf8').substring(0, 100));
