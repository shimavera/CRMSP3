-- =============================================================================
-- Migration 0035: Deduplicação de Lacunas da IA
--
-- Evita que o mesmo gap seja inserido múltiplas vezes quando o webhook do
-- WhatsApp dispara duplicado (comportamento normal da Meta API).
-- =============================================================================

-- 1. Remover duplicatas existentes (manter apenas o menor ID de cada grupo)
DELETE FROM sp3_ia_gaps a
USING sp3_ia_gaps b
WHERE a.id > b.id
  AND a.company_id = b.company_id
  AND a.pergunta = b.pergunta
  AND a.telefone_lead IS NOT DISTINCT FROM b.telefone_lead;

-- 2. Adicionar unique constraint para prevenir futuras duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_ia_gaps_dedup
  ON sp3_ia_gaps (company_id, pergunta, telefone_lead)
  WHERE status = 'pending';
