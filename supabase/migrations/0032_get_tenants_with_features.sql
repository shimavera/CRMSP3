-- =============================================================================
-- Migration 0032: Atualizar get_all_tenants para retornar features
--
-- A coluna features JSONB já existe em sp3_companies (migration 0004).
-- Essa atualização permite que o painel SuperAdmin controle feature flags
-- por empresa (ex: ia_audio_enabled).
-- =============================================================================

DROP FUNCTION IF EXISTS get_all_tenants();

CREATE OR REPLACE FUNCTION get_all_tenants()
RETURNS TABLE (
  id UUID,
  name TEXT,
  evo_instance_name TEXT,
  active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  features JSONB
) AS $$
DECLARE
  v_is_master TEXT;
BEGIN
  SELECT c.name INTO v_is_master
  FROM sp3_users u
  JOIN sp3_companies c ON u.company_id = c.id
  WHERE u.id = auth.uid();

  IF v_is_master IS NULL OR v_is_master != 'SP3 Company - Master' THEN
    RAISE EXCEPTION 'Apenas o Super Admin (SP3) pode listar clientes.';
  END IF;

  RETURN QUERY SELECT c.id, c.name, c.evo_instance_name, c.active, c.created_at, c.features
  FROM sp3_companies c ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
