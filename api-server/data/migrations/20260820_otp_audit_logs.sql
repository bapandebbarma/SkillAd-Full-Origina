-- Persistent OTP audit log (no plaintext OTP codes).
-- Safe fields only: masked phone, event type, channel, success, optional safe detail.

CREATE TABLE IF NOT EXISTS public.otp_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_masked text NOT NULL,
  event_type  text NOT NULL
    CHECK (event_type IN (
      'send', 'resend', 'verify_ok', 'verify_fail', 'expired', 'blocked'
    )),
  channel     text,
  success     boolean NOT NULL DEFAULT false,
  detail      text,
  provider    text NOT NULL DEFAULT 'MSG91',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_audit_logs_created_idx
  ON public.otp_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS otp_audit_logs_event_idx
  ON public.otp_audit_logs (event_type, created_at DESC);

COMMENT ON TABLE public.otp_audit_logs IS
  'OTP delivery/verify audit. Never store plaintext OTP codes.';
