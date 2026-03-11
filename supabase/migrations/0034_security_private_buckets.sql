-- =============================================================================
-- Migration 0034: Tornar buckets de storage privados + RLS por company_id
-- =============================================================================

-- 1. Tornar buckets followup-media e instagram-media PRIVADOS
UPDATE storage.buckets SET public = false WHERE id IN ('followup-media', 'instagram-media');

-- 2. Remover política de leitura pública dos buckets (se existir)
DROP POLICY IF EXISTS "followup_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "instagram_media_public_read" ON storage.objects;

-- 3. Políticas RLS para followup-media (somente usuários autenticados da mesma empresa)
DO $$ BEGIN
  CREATE POLICY "followup_media_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'followup-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "followup_media_auth_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'followup-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Políticas RLS para instagram-media
DO $$ BEGIN
  CREATE POLICY "instagram_media_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'instagram-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "instagram_media_auth_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'instagram-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
