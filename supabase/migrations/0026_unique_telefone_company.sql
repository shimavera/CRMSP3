-- =============================================================================
-- Migration 0026: UNIQUE constraint em (telefone, company_id) na sp3chat
-- Evita leads duplicados com mesmo telefone dentro da mesma empresa
-- =============================================================================

-- Primeiro, remover duplicatas existentes (mantém o mais antigo)
DELETE FROM sp3chat
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY telefone, company_id ORDER BY created_at ASC) AS rn
        FROM sp3chat
    ) sub
    WHERE rn > 1
);

-- Criar o constraint UNIQUE
ALTER TABLE sp3chat
ADD CONSTRAINT sp3chat_telefone_company_unique UNIQUE (telefone, company_id);
