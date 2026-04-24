-- ============================================================
-- 0015_orders_tracking_columns.sql
-- Columnas de tracking de estado en orders
-- Necesarias para buildOrderStatusUpdate del frontend
-- ============================================================

begin;

-- Columnas de timestamp por cada transición de estado
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ready_at             timestamptz,
  ADD COLUMN IF NOT EXISTS picked_at            timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at           timestamptz,
  ADD COLUMN IF NOT EXISTS review_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_code        text,
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz NOT NULL DEFAULT now();

-- Columnas adicionales que el frontend puede usar
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_rider_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_cook_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status       text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','refunded')),
  ADD COLUMN IF NOT EXISTS source               text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web','whatsapp','pos','qr','phone'));

-- Índice para realtime (status + branch)
CREATE INDEX IF NOT EXISTS orders_realtime_idx
  ON public.orders(store_id, branch_id, status, created_at DESC);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger en orders
DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
  AND column_name IN ('ready_at','picked_at','arrived_at','review_requested_at','delivery_code','updated_at','status')
ORDER BY column_name;

commit;
