-- DIAGNÓSTICO DO FLOW: rodar no SQL Editor do Supabase

-- 1. Quantos flows existem e quais são external_lead?
SELECT id, name, is_active, trigger_type, company_id
FROM sp3_flows
ORDER BY id;

-- 2. Execuções de flow (todas)
SELECT id, flow_id, lead_id, status, current_node_id,
       next_run_at, started_at, completed_at,
       execution_log
FROM sp3_flow_executions
ORDER BY id DESC
LIMIT 20;

-- 3. sp3chat — lead criado pelo trigger
SELECT id, nome, telefone, stage, ia_active, created_at, observacoes
FROM sp3chat
WHERE id = 33;

-- 4. Instância Evolution API ativa
SELECT id, company_id, instance_name, evo_api_url, is_active, connection_status
FROM sp3_instances
WHERE is_active = true;

-- 5. pg_cron está rodando?
SELECT jobid, schedule, command, active
FROM cron.job;

-- 6. Últimas execuções do pg_cron
SELECT jobid, runid, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
