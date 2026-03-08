-- Migration 0017: Adicionar instance_name ao sp3chat
-- Para rastrear de qual instância WhatsApp o lead veio
-- O follow-up usa esta info para enviar pela mesma instância

-- Adicionar coluna
ALTER TABLE sp3chat ADD COLUMN IF NOT EXISTS instance_name TEXT;

-- Índice para consultas de follow-up
CREATE INDEX IF NOT EXISTS idx_sp3chat_instance_name ON sp3chat(company_id, instance_name);

-- Preencher leads existentes com a instância ativa da empresa
UPDATE sp3chat s
SET instance_name = i.instance_name
FROM sp3_instances i
WHERE s.company_id = i.company_id
  AND i.is_active = true
  AND s.instance_name IS NULL;
