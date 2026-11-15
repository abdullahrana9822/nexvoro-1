-- Database-backed Super Admin accounts for the NEXVORO-1 workspace.
-- Apply only to the Supabase project explicitly approved for NEXVORO-1, after migrations 001 and 002.
create table if not exists public.nexvoro_admin_users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 2 and 100),
  username text not null check (length(btrim(username)) between 3 and 64),
  username_key text generated always as (lower(btrim(username))) stored,
  password_hash text not null check (password_hash ~ '^\$2[aby]\$[0-9]{2}\$'),
  role text not null default 'SUPER_ADMIN' check (role = 'SUPER_ADMIN'),
  must_change_password boolean not null default true,
  session_version integer not null default 1 check (session_version > 0),
  failed_login_count integer not null default 0 check (failed_login_count between 0 and 5),
  locked_until timestamptz,
  disabled_at timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nexvoro_admin_users_username_key_unique unique (username_key)
);

comment on table public.nexvoro_admin_users is
  'NEXVORO-1 admin credentials. Passwords are bcrypt hashes; access is server-only.';
comment on column public.nexvoro_admin_users.password_hash is
  'bcrypt hash generated with bcryptjs; never expose this column to clients.';

alter table public.nexvoro_admin_users enable row level security;
revoke all on table public.nexvoro_admin_users from anon, authenticated;
grant select, insert, update, delete on table public.nexvoro_admin_users to service_role;

-- Persist account lockouts across serverless instances while keeping the counter
-- writable only through this service-role-only atomic function.
create or replace function public.nexvoro_admin_record_failed_login(p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_admin_id is null then
    return;
  end if;

  update public.nexvoro_admin_users as admin
  set failed_login_count = case
        when admin.locked_until is not null and admin.locked_until <= v_now then 1
        else least(admin.failed_login_count + 1, 5)
      end,
      locked_until = case
        when admin.locked_until > v_now then admin.locked_until
        when (case
          when admin.locked_until is not null and admin.locked_until <= v_now then 1
          else admin.failed_login_count + 1
        end) >= 5 then v_now + interval '15 minutes'
        else null
      end,
      updated_at = v_now
  where admin.id = p_admin_id and admin.disabled_at is null;
end;
$$;
revoke all on function public.nexvoro_admin_record_failed_login(uuid) from public, anon, authenticated;
grant execute on function public.nexvoro_admin_record_failed_login(uuid) to service_role;
