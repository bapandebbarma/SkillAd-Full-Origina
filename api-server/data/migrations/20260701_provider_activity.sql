-- provider_activity table for tracking Call, WhatsApp, and View events per provider.
-- 30-minute view dedup is enforced in application code (POST /api/providers/:id/activity).

CREATE TABLE IF NOT EXISTS public.provider_activity (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id text        NOT NULL,
  customer_id uuid,                        -- NULL for unauthenticated viewers
  event_type  text        NOT NULL CHECK (event_type IN ('view', 'call', 'whatsapp')),
  platform    text,                        -- 'ios' | 'android' | 'web'
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS pa_provider_event_idx
  ON public.provider_activity (provider_id, event_type);

CREATE INDEX IF NOT EXISTS pa_created_idx
  ON public.provider_activity (created_at);

CREATE INDEX IF NOT EXISTS pa_dedup_idx
  ON public.provider_activity (provider_id, customer_id, event_type, created_at);
