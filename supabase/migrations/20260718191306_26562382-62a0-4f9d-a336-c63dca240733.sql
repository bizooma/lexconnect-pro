
-- 1. Store QA digest cron secret in Vault (idempotent).
DO $$
DECLARE
  v_secret text := '4a5b478ab813d0988bb45a55020c087653d2f1596e24f90489d3384b16d64384';
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'qa_digest_cron_secret') THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'qa_digest_cron_secret'),
      v_secret,
      'qa_digest_cron_secret'
    );
  ELSE
    PERFORM vault.create_secret(v_secret, 'qa_digest_cron_secret');
  END IF;
END $$;

-- 2. Reschedule the Q&A daily digest cron to use x-cron-secret header from Vault.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'qa-daily-digest') THEN
    PERFORM cron.unschedule('qa-daily-digest');
  END IF;
END $$;

SELECT cron.schedule(
  'qa-daily-digest',
  '0 9 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--da8d11c5-efc5-4d07-91af-03b25eda27bb.lovable.app/api/public/hooks/qa-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'qa_digest_cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- 3. Website auto-publish cron (re-declared here so the schedule lives in git).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'website-auto-publish-scheduled') THEN
    PERFORM cron.unschedule('website-auto-publish-scheduled');
  END IF;
END $$;

SELECT cron.schedule(
  'website-auto-publish-scheduled',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--da8d11c5-efc5-4d07-91af-03b25eda27bb.lovable.app/api/public/hooks/auto-publish',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- 4. Email queue drain is scheduled on-demand by public.email_queue_wake()
--    (fires from AFTER INSERT triggers on the pgmq queue tables) and unscheduled
--    by public.email_queue_dispatch() once both queues are empty. Do NOT create
--    a permanent 'process-email-queue' cron entry here — it would fight the
--    on-demand disarm logic. Verify wiring with:
--      SELECT jobname FROM cron.job WHERE jobname = 'process-email-queue';
--    (present only while emails are queued; absent when both queues are empty).
COMMENT ON FUNCTION public.email_queue_wake() IS
  'Arms the process-email-queue cron on enqueue. Companion to email_queue_dispatch(), which unschedules it when both pgmq queues drain. Do not schedule process-email-queue manually.';
