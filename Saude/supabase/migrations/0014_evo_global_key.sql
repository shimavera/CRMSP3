-- Migration: Adicionar coluna evo_global_key na sp3_companies
-- Armazena a AUTHENTICATION_API_KEY do servidor Evolution (chave global)
-- para pré-preencher na criação de novos clientes.

ALTER TABLE sp3_companies ADD COLUMN IF NOT EXISTS evo_global_key TEXT;

-- RPC para o Super Admin salvar/ler a chave global sem expor via RLS
CREATE OR REPLACE FUNCTION save_evo_global_key(p_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Verificar se é o Super Admin da SP3
  IF NOT is_master_admin() THEN
    RAISE EXCEPTION 'Apenas o Super Admin pode salvar a chave global.';
  END IF;

  SELECT get_my_company_id() INTO v_company_id;

  UPDATE sp3_companies SET evo_global_key = p_key WHERE id = v_company_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_evo_global_key()
RETURNS TEXT AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF NOT is_master_admin() THEN
    RAISE EXCEPTION 'Apenas o Super Admin pode ler a chave global.';
  END IF;

  SELECT evo_global_key INTO v_key
  FROM sp3_companies
  WHERE id = get_my_company_id();

  RETURN v_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
