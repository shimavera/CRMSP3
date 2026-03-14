-- =============================================================================
-- Migration 0037: Corrigir RLS — adicionar is_master_admin() em tabelas faltantes
--
-- Tabelas criadas após migration 0011 não incluíam OR is_master_admin().
-- Isso impede o super admin de visualizar dados dessas tabelas ao impersonar
-- uma empresa cliente.
-- =============================================================================

-- sp3_flows
DROP POLICY IF EXISTS "Isolate sp3_flows" ON sp3_flows;
CREATE POLICY "Isolate sp3_flows" ON sp3_flows
  FOR ALL USING (company_id = get_my_company_id() OR is_master_admin());

-- sp3_flow_executions
DROP POLICY IF EXISTS "Isolate sp3_flow_executions" ON sp3_flow_executions;
CREATE POLICY "Isolate sp3_flow_executions" ON sp3_flow_executions
  FOR ALL USING (company_id = get_my_company_id() OR is_master_admin());

-- sp3_followup_steps
DROP POLICY IF EXISTS "Isolate sp3_followup_steps" ON sp3_followup_steps;
CREATE POLICY "Isolate sp3_followup_steps" ON sp3_followup_steps
  FOR ALL USING (company_id = get_my_company_id() OR is_master_admin());

-- sp3_followup_step_messages
DROP POLICY IF EXISTS "Isolate sp3_followup_step_messages" ON sp3_followup_step_messages;
CREATE POLICY "Isolate sp3_followup_step_messages" ON sp3_followup_step_messages
  FOR ALL USING (company_id = get_my_company_id() OR is_master_admin());

-- sp3_ia_gaps
DROP POLICY IF EXISTS "Isolate sp3_ia_gaps" ON sp3_ia_gaps;
CREATE POLICY "Isolate sp3_ia_gaps" ON sp3_ia_gaps
  FOR ALL USING (company_id = get_my_company_id() OR is_master_admin());
