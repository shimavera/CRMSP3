-- =============================================
-- Migration: Adicionar permissão calendar
-- =============================================

UPDATE sp3_users 
SET permissions = permissions || '{"calendar": true}'::jsonb 
WHERE permissions->>'calendar' IS NULL;
