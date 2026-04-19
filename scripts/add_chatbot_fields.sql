-- ============================================================
-- Migración: añadir campos chatbot a branches
-- Ejecutar en Supabase SQL Editor si no existen aún
-- ============================================================

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS chatbot_authorized    BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chatbot_authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chatbot_last_seen     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chatbot_wa_secret     TEXT,
  ADD COLUMN IF NOT EXISTS chatbot_version       TEXT;

-- Índice para la vista del super admin
CREATE INDEX IF NOT EXISTS branches_chatbot_authorized_idx
  ON public.branches(chatbot_authorized)
  WHERE chatbot_authorized = true;

-- Verificar
SELECT id, name, chatbot_authorized
FROM public.branches
LIMIT 5;
