CREATE OR REPLACE FUNCTION create_new_tenant(
  p_company_name TEXT,
  p_evo_instance TEXT,
  p_admin_id UUID,
  p_admin_email TEXT
) RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_is_master TEXT;
BEGIN
  -- Verifica se o caller pertence a SP3 Company - Master
  SELECT c.name INTO v_is_master 
  FROM sp3_users u
  JOIN sp3_companies c ON u.company_id = c.id
  WHERE u.id = auth.uid();

  IF v_is_master IS NULL OR v_is_master != 'SP3 Company - Master' THEN
    RAISE EXCEPTION 'Apenas o Super Admin (SP3) pode criar novos clientes.';
  END IF;

  INSERT INTO sp3_companies (name, evo_instance_name)
  VALUES (p_company_name, p_evo_instance)
  RETURNING id INTO v_company_id;

  INSERT INTO sp3_users (id, company_id, email, nome, role, permissions)
  VALUES (
    p_admin_id,
    v_company_id,
    p_admin_email,
    'Admin ' || p_company_name,
    'master',
    '{"dashboard":true, "chats":true, "kanban":true, "leads":true, "settings":true}'::jsonb
  );

  RETURN jsonb_build_object('success', true, 'company_id', v_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
