-- NEXVORO commerce schema: additive only. This migration does not alter or delete
-- any pre-existing customer, order, payment, review, or product tables.
create extension if not exists pgcrypto;

create table if not exists public.nexvoro_categories (
  slug text primary key,
  name text not null,
  eyebrow text not null default '',
  description text not null default '',
  image text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nexvoro_products (
  id text primary key,
  slug text not null unique,
  sku text not null unique,
  name text not null,
  brand text not null default 'NEXVORO',
  category_slug text not null,
  price numeric(12,2) not null check (price >= 0),
  compare_at numeric(12,2) not null default 0 check (compare_at >= 0),
  description text not null default '',
  specs jsonb not null default '{}'::jsonb,
  stock integer not null default 0 check (stock >= 0),
  variants text[] not null default '{}',
  images text[] not null default '{}',
  featured boolean not null default false,
  bestseller boolean not null default false,
  new_arrival boolean not null default false,
  rating numeric(3,2),
  review_count integer not null default 0 check (review_count >= 0),
  related_ids text[] not null default '{}',
  tags text[] not null default '{}',
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nexvoro_products_category_active_idx on public.nexvoro_products(category_slug, is_active);
create index if not exists nexvoro_products_featured_active_idx on public.nexvoro_products(featured, is_active);

create table if not exists public.nexvoro_customers (
  id text primary key,
  name text not null,
  email text not null unique,
  phone text not null default '',
  order_count integer not null default 0,
  total_spent numeric(12,2) not null default 0,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nexvoro_orders (
  id text primary key,
  order_no text not null unique,
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  email text not null,
  phone text not null default '',
  address jsonb not null default '{}'::jsonb,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping numeric(12,2) not null default 0 check (shipping >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending','processing','shipped','completed','cancelled','refunded')),
  payment_method text not null default 'cash_on_delivery',
  coupon text,
  tracking_number text,
  stock_returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nexvoro_orders_created_idx on public.nexvoro_orders(created_at desc);
create index if not exists nexvoro_orders_status_idx on public.nexvoro_orders(status);
create index if not exists nexvoro_orders_email_idx on public.nexvoro_orders(email);

create table if not exists public.nexvoro_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.nexvoro_orders(id) on delete cascade,
  product_id text references public.nexvoro_products(id) on delete set null,
  product_name text not null,
  sku text not null default '',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  variant text,
  created_at timestamptz not null default now()
);
create index if not exists nexvoro_order_items_order_idx on public.nexvoro_order_items(order_id);
create index if not exists nexvoro_order_items_product_idx on public.nexvoro_order_items(product_id);

create table if not exists public.nexvoro_customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nexvoro_reviews (
  id text primary key,
  product_id text references public.nexvoro_products(id) on delete set null,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  title text not null default '',
  body text not null,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists nexvoro_reviews_product_approved_idx on public.nexvoro_reviews(product_id, is_approved);

create table if not exists public.nexvoro_coupons (
  id text primary key,
  code text not null unique,
  kind text not null check (kind in ('percent','fixed')),
  value numeric(12,2) not null check (value >= 0),
  is_active boolean not null default true,
  expires_at timestamptz,
  usage_limit integer,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nexvoro_banners (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  image text not null default '',
  href text not null default '/shop',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nexvoro_store_settings (
  id text primary key default 'store',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.nexvoro_newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  consented_at timestamptz not null default now(),
  source text not null default 'storefront'
);

create table if not exists public.nexvoro_contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','in_progress','resolved')),
  created_at timestamptz not null default now()
);
create index if not exists nexvoro_contact_messages_created_idx on public.nexvoro_contact_messages(created_at desc);

-- Keep administration server-only. The browser uses the public read API; the
-- API's service-role key never leaves the server. No permissive public policies.
do $$
declare t text;
begin
  foreach t in array array[
    'nexvoro_categories','nexvoro_products','nexvoro_customers','nexvoro_orders',
    'nexvoro_order_items','nexvoro_customer_profiles','nexvoro_reviews','nexvoro_coupons','nexvoro_banners',
    'nexvoro_store_settings','nexvoro_newsletter_subscribers','nexvoro_contact_messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

grant select, insert, update on public.nexvoro_customer_profiles to authenticated;
drop policy if exists "Customers can read their own profile" on public.nexvoro_customer_profiles;
drop policy if exists "Customers can create their own profile" on public.nexvoro_customer_profiles;
drop policy if exists "Customers can update their own profile" on public.nexvoro_customer_profiles;
create policy "Customers can read their own profile" on public.nexvoro_customer_profiles
  for select to authenticated using (auth.uid() = id);
create policy "Customers can create their own profile" on public.nexvoro_customer_profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "Customers can update their own profile" on public.nexvoro_customer_profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.nexvoro_sync_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nexvoro_customer_profiles(id, email, full_name, phone)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.raw_user_meta_data->>'phone',''))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;
drop trigger if exists nexvoro_on_auth_user_created on auth.users;
create trigger nexvoro_on_auth_user_created after insert on auth.users
  for each row execute function public.nexvoro_sync_auth_profile();
revoke all on function public.nexvoro_sync_auth_profile() from public, anon, authenticated;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
      values ('nexvoro-product-images', 'nexvoro-product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
      on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
  end if;
  if to_regclass('storage.objects') is not null and not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'NEXVORO product images are public'
  ) then
    execute 'create policy "NEXVORO product images are public" on storage.objects for select using (bucket_id = ''nexvoro-product-images'')';
  end if;
end $$;

-- Atomic guest checkout: price and stock are read from the catalog on the server,
-- not trusted from the browser. Orders remain independent snapshots if a product is archived.
create or replace function public.nexvoro_place_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := coalesce(nullif(p_payload->>'id',''), gen_random_uuid()::text);
  v_order_no text := 'NX-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_customer jsonb := coalesce(p_payload->'customer','{}'::jsonb);
  v_address jsonb := coalesce(p_payload->'address','{}'::jsonb);
  v_items jsonb := p_payload->'items';
  v_email text := lower(trim(coalesce(v_customer->>'email','')));
  v_customer_id uuid := nullif(p_payload->>'customerId','')::uuid;
  v_name text := trim(coalesce(v_customer->>'name',''));
  v_phone text := trim(coalesce(v_customer->>'phone',''));
  v_item jsonb;
  v_product public.nexvoro_products%rowtype;
  v_quantity integer;
  v_variant text;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_shipping_fee numeric(12,2) := 1200;
  v_free_threshold numeric(12,2) := 25000;
  v_settings jsonb := '{}'::jsonb;
  v_coupon_code text := upper(trim(coalesce(p_payload->>'coupon','')));
  v_coupon public.nexvoro_coupons%rowtype;
  v_order_items jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Your bag is empty.' using errcode = '22023';
  end if;
  if length(v_name) < 2 or length(v_email) < 5 or position('@' in v_email) < 2 then
    raise exception 'Please provide a valid name and email address.' using errcode = '22023';
  end if;
  if length(coalesce(v_address->>'line1','')) < 4 or length(coalesce(v_address->>'city','')) < 2 then
    raise exception 'Please provide a complete delivery address.' using errcode = '22023';
  end if;

  select payload into v_settings from public.nexvoro_store_settings where id = 'store';
  if not found or
     jsonb_typeof(v_settings->'storeName') is distinct from 'string' or length(trim(coalesce(v_settings->>'storeName',''))) < 2 or
     jsonb_typeof(v_settings->'currency') is distinct from 'string' or coalesce(v_settings->>'currency','') !~ '^[A-Z]{3}$' or
     jsonb_typeof(v_settings->'shippingFee') is distinct from 'number' or jsonb_typeof(v_settings->'freeShippingThreshold') is distinct from 'number' then
    raise exception 'Store delivery terms are not configured.' using errcode = '55000';
  end if;
  v_shipping_fee := (v_settings->>'shippingFee')::numeric;
  v_free_threshold := (v_settings->>'freeShippingThreshold')::numeric;
  if v_shipping_fee < 0 or v_free_threshold < 0 then
    raise exception 'Store delivery terms cannot be negative.' using errcode = '55000';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_quantity := coalesce(nullif(v_item->>'quantity','')::integer, 0);
    if v_quantity < 1 or v_quantity > 20 then
      raise exception 'Invalid item quantity.' using errcode = '22023';
    end if;
    select * into v_product
      from public.nexvoro_products
      where id = v_item->>'productId' and is_active = true
      for update;
    if not found then
      raise exception 'A product in your bag is no longer available.' using errcode = 'P0001';
    end if;
    if v_product.stock < v_quantity then
      raise exception 'Not enough stock for %.', v_product.name using errcode = 'P0001';
    end if;
    v_variant := nullif(trim(coalesce(v_item->>'variant','')), '');
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
    update public.nexvoro_products set stock = stock - v_quantity, updated_at = now() where id = v_product.id;
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id, 'name', v_product.name, 'sku', v_product.sku,
      'price', v_product.price, 'quantity', v_quantity, 'variant', v_variant
    ));
  end loop;

  v_shipping := case when v_subtotal >= v_free_threshold then 0 else v_shipping_fee end;
  if v_coupon_code <> '' then
    select * into v_coupon from public.nexvoro_coupons where upper(code) = v_coupon_code and is_active = true for update;
    if not found or (v_coupon.expires_at is not null and v_coupon.expires_at <= now()) or
       (v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit) then
      raise exception 'This coupon is not available.' using errcode = '22023';
    end if;
    if v_coupon.kind = 'percent' then
      v_discount := round(v_subtotal * least(v_coupon.value, 100) / 100, 2);
    else
      v_discount := least(v_coupon.value, v_subtotal);
    end if;
  end if;
  v_total := greatest(0, v_subtotal + v_shipping - v_discount);

  insert into public.nexvoro_orders(
    id, order_no, customer_id, customer_name, email, phone, address, subtotal, shipping,
    discount, total, status, payment_method, coupon
  ) values (
    v_id, v_order_no, v_customer_id, v_name, v_email, v_phone, v_address, v_subtotal, v_shipping,
    v_discount, v_total, 'pending', 'cash_on_delivery', nullif(v_coupon_code,'')
  );

  for v_item in select value from jsonb_array_elements(v_order_items)
  loop
    insert into public.nexvoro_order_items(order_id, product_id, product_name, sku, unit_price, quantity, variant)
      values (
        v_id, nullif(v_item->>'productId',''), v_item->>'name', coalesce(v_item->>'sku',''),
        (v_item->>'price')::numeric, (v_item->>'quantity')::integer, nullif(v_item->>'variant','')
      );
  end loop;

  insert into public.nexvoro_customers(id, name, email, phone, order_count, total_spent, joined_at, updated_at)
  values (v_email, v_name, v_email, v_phone, 1, v_total, now(), now())
  on conflict (email) do update set
    name = excluded.name,
    phone = excluded.phone,
    order_count = public.nexvoro_customers.order_count + 1,
    total_spent = public.nexvoro_customers.total_spent + excluded.total_spent,
    updated_at = now();

  if v_coupon_code <> '' then
    update public.nexvoro_coupons set usage_count = usage_count + 1, updated_at = now() where id = v_coupon.id;
  end if;

  return jsonb_build_object(
    'id', v_id, 'orderNo', v_order_no, 'createdAt', now(), 'customer', jsonb_build_object('name',v_name,'email',v_email,'phone',v_phone),
    'address', v_address, 'items', v_order_items, 'subtotal', v_subtotal, 'shipping', v_shipping,
    'discount', v_discount, 'total', v_total, 'status', 'pending', 'paymentMethod', 'cash_on_delivery',
    'coupon', nullif(v_coupon_code,'')
  );
end;
$$;
revoke all on function public.nexvoro_place_order(jsonb) from public, anon, authenticated;
grant execute on function public.nexvoro_place_order(jsonb) to service_role;

create or replace function public.nexvoro_update_order_status(p_order_id text, p_status text, p_tracking_number text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.nexvoro_orders%rowtype;
  v_line record;
begin
  if p_status not in ('pending','processing','shipped','completed','cancelled','refunded') then
    raise exception 'Invalid order status.' using errcode = '22023';
  end if;
  select * into v_order from public.nexvoro_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  if v_order.status in ('cancelled','refunded') and p_status <> v_order.status then
    raise exception 'Cancelled or refunded orders cannot be reopened from this dashboard.' using errcode = '22023';
  end if;
  if p_status = 'cancelled' and v_order.status <> 'cancelled' and v_order.stock_returned_at is null then
    for v_line in select product_id, quantity from public.nexvoro_order_items where order_id = p_order_id and product_id is not null for update
    loop
      update public.nexvoro_products set stock = stock + v_line.quantity, updated_at = now() where id = v_line.product_id;
    end loop;
    update public.nexvoro_orders set stock_returned_at = now() where id = p_order_id;
  end if;
  update public.nexvoro_orders
    set status = p_status, tracking_number = nullif(trim(coalesce(p_tracking_number,'')), ''), updated_at = now()
    where id = p_order_id;
end;
$$;
revoke all on function public.nexvoro_update_order_status(text, text, text) from public, anon, authenticated;
grant execute on function public.nexvoro_update_order_status(text, text, text) to service_role;

-- Health probe confirms the complete NEXVORO schema and checkout/admin procedures
-- are present without exposing table data or changing any record.
create or replace function public.nexvoro_store_health()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    to_regclass('public.nexvoro_products') is not null and
    to_regclass('public.nexvoro_categories') is not null and
    to_regclass('public.nexvoro_orders') is not null and
    to_regclass('public.nexvoro_order_items') is not null and
    to_regclass('public.nexvoro_customers') is not null and
    to_regclass('public.nexvoro_customer_profiles') is not null and
    to_regclass('public.nexvoro_store_settings') is not null and
    to_regclass('public.nexvoro_coupons') is not null and
    to_regclass('public.nexvoro_banners') is not null and
    to_regclass('public.nexvoro_reviews') is not null and
    to_regclass('public.nexvoro_newsletter_subscribers') is not null and
    to_regclass('public.nexvoro_contact_messages') is not null and
    to_regprocedure('public.nexvoro_place_order(jsonb)') is not null and
    to_regprocedure('public.nexvoro_update_order_status(text,text,text)') is not null;
$$;
revoke all on function public.nexvoro_store_health() from public, anon, authenticated;
grant execute on function public.nexvoro_store_health() to service_role;
