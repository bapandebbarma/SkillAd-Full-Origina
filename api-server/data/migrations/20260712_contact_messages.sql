-- Contact messages + audit for SkillAd landing Contact form.
-- Run this in Supabase SQL Editor (or via migration tooling) before deploying the API.

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text        NOT NULL,
  email        text        NOT NULL,
  phone        text        NOT NULL DEFAULT '',
  subject      text        NOT NULL DEFAULT '',
  message      text        NOT NULL,
  status       text        NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'read', 'replied', 'closed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz,
  replied_at   timestamptz,
  ip_address   text,
  user_agent   text,
  source       text        NOT NULL DEFAULT 'Landing Page'
);

CREATE INDEX IF NOT EXISTS contact_messages_status_idx
  ON public.contact_messages (status);

CREATE INDEX IF NOT EXISTS contact_messages_created_idx
  ON public.contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_email_idx
  ON public.contact_messages (email);

CREATE TABLE IF NOT EXISTS public.contact_audit (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id   uuid        REFERENCES public.contact_messages(id) ON DELETE SET NULL,
  action       text        NOT NULL,
  admin        text        NOT NULL DEFAULT 'admin',
  created_at   timestamptz NOT NULL DEFAULT now(),
  meta         jsonb
);

CREATE INDEX IF NOT EXISTS contact_audit_message_idx
  ON public.contact_audit (message_id);

CREATE INDEX IF NOT EXISTS contact_audit_created_idx
  ON public.contact_audit (created_at DESC);
