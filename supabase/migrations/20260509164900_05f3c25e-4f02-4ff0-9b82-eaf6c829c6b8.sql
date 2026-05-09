
-- Required extensions
create extension if not exists pg_net with schema extensions;

-- 1. Subscriptions
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Per-user preferences
create table public.notification_preferences (
  user_id uuid primary key,
  push_messages boolean not null default true,
  push_mentorship boolean not null default true,
  push_meetings boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;

create policy "Users view their preferences"
  on public.notification_preferences for select
  to authenticated using (auth.uid() = user_id);
create policy "Users insert their preferences"
  on public.notification_preferences for insert
  to authenticated with check (auth.uid() = user_id);
create policy "Users update their preferences"
  on public.notification_preferences for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger update_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.update_updated_at_column();

-- Backfill default prefs for existing users
insert into public.notification_preferences (user_id)
select distinct user_id from public.profiles
on conflict (user_id) do nothing;

-- Auto-create prefs for new signups (extend the existing handler)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'full_name', NEW.email));

  insert into public.user_roles (user_id, role)
  values (NEW.id, 'member');

  insert into public.notification_preferences (user_id)
  values (NEW.id)
  on conflict (user_id) do nothing;

  return NEW;
end;
$$;

-- 3. Dispatcher: on any new notification row, call our public push endpoint
create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  endpoint_url text := 'https://project--da8d11c5-efc5-4d07-91af-03b25eda27bb.lovable.app/api/public/push/dispatch';
  shared_secret text := 'dc704da71d8e3e56fe0725cc7535bfb2ddb2b908bdb6f1ce4b0f109bacc829ef';
begin
  perform net.http_post(
    url := endpoint_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', shared_secret
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  return NEW;
exception when others then
  -- Never block notification insert if push fails
  return NEW;
end;
$$;

create trigger dispatch_push_after_notification_insert
  after insert on public.notifications
  for each row execute function public.dispatch_push_notification();
