CREATE OR REPLACE FUNCTION get_all_tenants()
RETURNS TABLE (
  id UUID,
  name TEXT,
  evo_instance_name TEXT,
  active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_is_master TEXT;
BEGIN
  -- Verifica se o caller pertence a SP3 Company - Master
  SELECT c.name INTO v_is_master 
  FROM sp3_users u
  JOIN sp3_companies c ON u.company_id = c.id
  WHERE u.id = auth.uid();

  IF v_is_master IS NULL OR v_is_master != 'SP3 Company - Master' THEN
    RAISE EXCEPTION 'Apenas o Super Admin (SP3) pode listar clientes.';
  END IF;

  RETURN QUERY SELECT c.id, c.name, c.evo_instance_name, c.active, c.created_at FROM sp3_companies c ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
