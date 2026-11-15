-- NEXVORO currency support: additive only. Existing orders, profiles, and order items
-- remain untouched. Historical currency is intentionally left NULL where it was not recorded.
alter table public.nexvoro_customer_profiles
  add column if not exists preferred_currency text;

alter table public.nexvoro_customers
  add column if not exists spend_by_currency jsonb not null default '{}'::jsonb;

comment on column public.nexvoro_customers.total_spent is
  'Legacy aggregate with no reliable currency metadata. Do not use for currency-aware customer spend.';
comment on column public.nexvoro_customers.spend_by_currency is
  'Recorded payment totals grouped by saved payment currency; historical unrecorded totals are not backfilled.';

create or replace function public.nexvoro_sync_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nexvoro_customer_profiles(id, email, full_name, phone, preferred_currency)
  values (
    new.id,
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    case when new.raw_user_meta_data->>'preferred_currency' in (
      'USD','PKR','GBP','EUR','AED','SAR','CAD','AUD','INR','TRY','CNY','JPY','MYR','SGD','BDT'
    ) then new.raw_user_meta_data->>'preferred_currency' else null end
  )
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;
revoke all on function public.nexvoro_sync_auth_profile() from public, anon, authenticated;

alter table public.nexvoro_orders
  add column if not exists currency_code text,
  add column if not exists payment_currency text,
  add column if not exists fx_rate numeric(20,10),
  add column if not exists fx_rate_at timestamptz,
  add column if not exists fx_rate_source text,
  add column if not exists payment_subtotal numeric(12,2),
  add column if not exists payment_shipping numeric(12,2),
  add column if not exists payment_discount numeric(12,2),
  add column if not exists payment_total numeric(12,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.nexvoro_customer_profiles'::regclass and conname = 'nexvoro_customer_profiles_preferred_currency_check') then
    alter table public.nexvoro_customer_profiles add constraint nexvoro_customer_profiles_preferred_currency_check
      check (preferred_currency is null or preferred_currency in ('USD','PKR','GBP','EUR','AED','SAR','CAD','AUD','INR','TRY','CNY','JPY','MYR','SGD','BDT'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nexvoro_orders'::regclass and conname = 'nexvoro_orders_currency_code_check') then
    alter table public.nexvoro_orders add constraint nexvoro_orders_currency_code_check
      check (currency_code is null or currency_code in ('USD','PKR','GBP','EUR','AED','SAR','CAD','AUD','INR','TRY','CNY','JPY','MYR','SGD','BDT'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nexvoro_orders'::regclass and conname = 'nexvoro_orders_payment_currency_check') then
    alter table public.nexvoro_orders add constraint nexvoro_orders_payment_currency_check
      check (payment_currency is null or payment_currency in ('USD','PKR','GBP','EUR','AED','SAR','CAD','AUD','INR','TRY','CNY','JPY','MYR','SGD','BDT'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nexvoro_orders'::regclass and conname = 'nexvoro_orders_fx_rate_check') then
    alter table public.nexvoro_orders add constraint nexvoro_orders_fx_rate_check check (fx_rate is null or fx_rate > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nexvoro_orders'::regclass and conname = 'nexvoro_orders_fx_rate_source_check') then
    alter table public.nexvoro_orders add constraint nexvoro_orders_fx_rate_source_check
      check (fx_rate_source is null or fx_rate_source in ('identity','live','fallback','stale'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nexvoro_orders'::regclass and conname = 'nexvoro_orders_payment_total_check') then
    alter table public.nexvoro_orders add constraint nexvoro_orders_payment_total_check check (payment_total is null or payment_total >= 0);
  end if;
end;
$$;

create index if not exists nexvoro_orders_payment_currency_created_idx
  on public.nexvoro_orders(payment_currency, created_at desc)
  where payment_total is not null;

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
  v_currency text;
  v_payment_currency text;
  v_fx_rate numeric(20,10);
  v_fx_at timestamptz;
  v_fx_source text;
  v_payment_subtotal numeric(12,2) := 0;
  v_payment_shipping numeric(12,2) := 0;
  v_payment_discount numeric(12,2) := 0;
  v_payment_total numeric(12,2) := 0;
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
     jsonb_typeof(v_settings->'currency') is distinct from 'string' or coalesce(v_settings->>'currency','') not in (
       'USD','PKR','GBP','EUR','AED','SAR','CAD','AUD','INR','TRY','CNY','JPY','MYR','SGD','BDT'
     ) or
     jsonb_typeof(v_settings->'shippingFee') is distinct from 'number' or jsonb_typeof(v_settings->'freeShippingThreshold') is distinct from 'number' then
    raise exception 'Store delivery terms are not configured.' using errcode = '55000';
  end if;
  v_currency := v_settings->>'currency';
  v_payment_currency := coalesce(nullif(p_payload->>'paymentCurrency',''), '');
  v_fx_rate := nullif(p_payload->>'fxRate','')::numeric;
  v_fx_at := nullif(p_payload->>'fxRateAt','')::timestamptz;
  v_fx_source := coalesce(nullif(p_payload->>'fxRateSource',''), '');
  if v_payment_currency <> 'PKR' then
    raise exception 'Cash-on-delivery payment is collected in PKR.' using errcode = '22023';
  end if;
  if v_fx_rate is null or v_fx_rate <= 0 or v_fx_rate > 1000000000 then
    raise exception 'A valid checkout exchange rate is required.' using errcode = '22023';
  end if;
  if v_currency = 'PKR' then
    if abs(v_fx_rate - 1) > 0.00000001 or v_fx_source <> 'identity' then
      raise exception 'The PKR checkout rate is invalid.' using errcode = '22023';
    end if;
    v_fx_at := coalesce(v_fx_at, now());
  elsif v_fx_source not in ('live','fallback') or v_fx_at is null then
    raise exception 'A current live or configured fallback checkout rate is required.' using errcode = '22023';
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
  v_payment_subtotal := round(v_subtotal * v_fx_rate, 2);
  v_payment_shipping := round(v_shipping * v_fx_rate, 2);
  v_payment_discount := round(v_discount * v_fx_rate, 2);
  v_payment_total := round(v_total * v_fx_rate, 2);

  insert into public.nexvoro_orders(
    id, order_no, customer_id, customer_name, email, phone, address, subtotal, shipping,
    discount, total, status, payment_method, coupon,
    currency_code, payment_currency, fx_rate, fx_rate_at, fx_rate_source,
    payment_subtotal, payment_shipping, payment_discount, payment_total
  ) values (
    v_id, v_order_no, v_customer_id, v_name, v_email, v_phone, v_address, v_subtotal, v_shipping,
    v_discount, v_total, 'pending', 'cash_on_delivery', nullif(v_coupon_code,''),
    v_currency, v_payment_currency, v_fx_rate, v_fx_at, v_fx_source,
    v_payment_subtotal, v_payment_shipping, v_payment_discount, v_payment_total
  );

  for v_item in select value from jsonb_array_elements(v_order_items)
  loop
    insert into public.nexvoro_order_items(order_id, product_id, product_name, sku, unit_price, quantity, variant)
      values (
        v_id, nullif(v_item->>'productId',''), v_item->>'name', coalesce(v_item->>'sku',''),
        (v_item->>'price')::numeric, (v_item->>'quantity')::integer, nullif(v_item->>'variant','')
      );
  end loop;

  insert into public.nexvoro_customers(id, name, email, phone, order_count, total_spent, spend_by_currency, joined_at, updated_at)
  values (v_email, v_name, v_email, v_phone, 1, 0, jsonb_build_object(v_payment_currency, v_payment_total), now(), now())
  on conflict (email) do update set
    name = excluded.name,
    phone = excluded.phone,
    order_count = public.nexvoro_customers.order_count + 1,
    spend_by_currency = jsonb_set(
      coalesce(public.nexvoro_customers.spend_by_currency, '{}'::jsonb),
      array[v_payment_currency],
      to_jsonb(coalesce((public.nexvoro_customers.spend_by_currency->>v_payment_currency)::numeric, 0) + v_payment_total),
      true
    ),
    updated_at = now();

  if v_coupon_code <> '' then
    update public.nexvoro_coupons set usage_count = usage_count + 1, updated_at = now() where id = v_coupon.id;
  end if;

  return jsonb_build_object(
    'id', v_id, 'orderNo', v_order_no, 'createdAt', now(), 'customer', jsonb_build_object('name',v_name,'email',v_email,'phone',v_phone),
    'address', v_address, 'items', v_order_items, 'subtotal', v_subtotal, 'shipping', v_shipping,
    'discount', v_discount, 'total', v_total,
    'currency', v_currency, 'paymentCurrency', v_payment_currency, 'fxRate', v_fx_rate,
    'fxRateAt', v_fx_at, 'fxRateSource', v_fx_source,
    'paymentSubtotal', v_payment_subtotal, 'paymentShipping', v_payment_shipping,
    'paymentDiscount', v_payment_discount, 'paymentTotal', v_payment_total,
    'status', 'pending', 'paymentMethod', 'cash_on_delivery', 'coupon', nullif(v_coupon_code,'')
  );
end;
$$;
revoke all on function public.nexvoro_place_order(jsonb) from public, anon, authenticated;
grant execute on function public.nexvoro_place_order(jsonb) to service_role;
