-- DEMO ONLY: three fictional, AI-illustrated catalog entries for storefront testing.
-- Prices and stock are synthetic. These products are not available for sale or fulfillment.
-- Deliberately does not create store settings or enable checkout.

insert into public.nexvoro_categories (
  slug, name, eyebrow, description, is_active, updated_at
) values (
  'test-products',
  'TEST PRODUCTS · DEMO ONLY',
  'STOREFRONT TEST CATALOG',
  'Fictional demo listings with AI-generated images. Synthetic prices and stock; not real products and not available for sale or delivery.',
  true,
  now()
)
on conflict (slug) do update set
  name = excluded.name,
  eyebrow = excluded.eyebrow,
  description = excluded.description,
  is_active = true,
  updated_at = now();

insert into public.nexvoro_products (
  id, slug, sku, name, brand, category_slug, price, compare_at, description,
  specs, stock, variants, images, featured, bestseller, new_arrival, rating,
  review_count, related_ids, tags, is_active, archived_at, updated_at
) values
  (
    'demo-test-phone',
    'demo-test-phone',
    'NV-DEMO-001',
    '[TEST] Demo Smartphone',
    'NEXVORO DEMO',
    'test-products',
    100,
    100,
    'DEMO ONLY. Fictional test listing with an AI-generated image and synthetic PKR price and stock. This is not a real product and is not available for sale, shipment, or fulfillment.',
    jsonb_build_object(
      'Listing', 'Fictional demo item only',
      'Price', 'Synthetic test price in PKR',
      'Image', 'AI-generated demo illustration',
      'Availability', 'Not for sale or fulfillment'
    ),
    10,
    array['Demo unit'],
    array['/images/test-products/nexvoro-test-phone.jpg'],
    true,
    false,
    false,
    null,
    0,
    array['demo-test-earbuds', 'demo-test-lamp'],
    array['demo-only', 'test-catalog'],
    true,
    null,
    now()
  ),
  (
    'demo-test-earbuds',
    'demo-test-earbuds',
    'NV-DEMO-002',
    '[TEST] Demo Wireless Earbuds',
    'NEXVORO DEMO',
    'test-products',
    250,
    250,
    'DEMO ONLY. Fictional test listing with an AI-generated image and synthetic PKR price and stock. This is not a real product and is not available for sale, shipment, or fulfillment.',
    jsonb_build_object(
      'Listing', 'Fictional demo item only',
      'Price', 'Synthetic test price in PKR',
      'Image', 'AI-generated demo illustration',
      'Availability', 'Not for sale or fulfillment'
    ),
    10,
    array['Demo unit'],
    array['/images/test-products/nexvoro-test-earbuds.jpg'],
    false,
    false,
    false,
    null,
    0,
    array['demo-test-phone', 'demo-test-lamp'],
    array['demo-only', 'test-catalog'],
    true,
    null,
    now()
  ),
  (
    'demo-test-lamp',
    'demo-test-lamp',
    'NV-DEMO-003',
    '[TEST] Demo Desk Lamp',
    'NEXVORO DEMO',
    'test-products',
    400,
    400,
    'DEMO ONLY. Fictional test listing with an AI-generated image and synthetic PKR price and stock. This is not a real product and is not available for sale, shipment, or fulfillment.',
    jsonb_build_object(
      'Listing', 'Fictional demo item only',
      'Price', 'Synthetic test price in PKR',
      'Image', 'AI-generated demo illustration',
      'Availability', 'Not for sale or fulfillment'
    ),
    10,
    array['Demo unit'],
    array['/images/test-products/nexvoro-test-lamp.jpg'],
    false,
    false,
    false,
    null,
    0,
    array['demo-test-phone', 'demo-test-earbuds'],
    array['demo-only', 'test-catalog'],
    true,
    null,
    now()
  )
on conflict (id) do update set
  slug = excluded.slug,
  sku = excluded.sku,
  name = excluded.name,
  brand = excluded.brand,
  category_slug = excluded.category_slug,
  price = excluded.price,
  compare_at = excluded.compare_at,
  description = excluded.description,
  specs = excluded.specs,
  stock = excluded.stock,
  variants = excluded.variants,
  images = excluded.images,
  featured = excluded.featured,
  bestseller = excluded.bestseller,
  new_arrival = excluded.new_arrival,
  rating = null,
  review_count = 0,
  related_ids = excluded.related_ids,
  tags = excluded.tags,
  is_active = true,
  archived_at = null,
  updated_at = now();
