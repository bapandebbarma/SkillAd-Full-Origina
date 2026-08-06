-- =============================================
-- SkillAd Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- =============================================
-- PROFILES (extends Supabase auth.users)
-- =============================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  phone text unique not null,
  is_provider boolean not null default false,
  avatar_color text not null default '#64748B',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- =============================================
-- PROVIDERS
-- =============================================
create table if not exists public.providers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  name text not null,
  category text not null,
  subcategory text,
  experience int not null default 0,
  description text not null default '',
  phone text not null,
  location text not null default '',
  service_radius int not null default 50,
  service_charge text,
  working_hours text not null default 'Mon–Sat, 9AM–6PM',
  latitude double precision not null default 12.9352,
  longitude double precision not null default 77.6245,
  verified boolean not null default false,
  available boolean not null default true,
  initials text not null default 'PR',
  avatar_color text not null default '#FF6B35',
  services text[] not null default '{}',
  rating double precision not null default 0,
  review_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.providers enable row level security;

create policy "Providers are viewable by everyone"
  on public.providers for select using (true);

create policy "Users can insert their own provider profile"
  on public.providers for insert with check (auth.uid() = user_id);

create policy "Users can update their own provider profile"
  on public.providers for update using (auth.uid() = user_id);

-- Full-text search index
create index if not exists providers_category_idx on public.providers(category);
create index if not exists providers_location_idx on public.providers(latitude, longitude);

-- =============================================
-- REVIEWS
-- =============================================
create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references public.providers(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  reviewer_name text not null,
  reviewer_initials text not null,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create policy "Reviews are viewable by everyone"
  on public.reviews for select using (true);

create policy "Authenticated users can insert reviews"
  on public.reviews for insert with check (auth.uid() = reviewer_id);

-- Trigger to update provider rating on review insert/delete
create or replace function update_provider_rating()
returns trigger language plpgsql as $$
begin
  update public.providers
  set
    rating = (select coalesce(avg(rating)::numeric(3,1), 0) from public.reviews where provider_id = coalesce(new.provider_id, old.provider_id)),
    review_count = (select count(*) from public.reviews where provider_id = coalesce(new.provider_id, old.provider_id)),
    updated_at = now()
  where id = coalesce(new.provider_id, old.provider_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_review_change on public.reviews;
create trigger on_review_change
  after insert or delete on public.reviews
  for each row execute procedure update_provider_rating();

-- =============================================
-- CONVERSATIONS
-- =============================================
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references public.profiles(id) on delete cascade not null,
  provider_id uuid references public.providers(id) on delete cascade not null,
  last_message text not null default '',
  last_message_time timestamptz not null default now(),
  customer_unread int not null default 0,
  provider_unread int not null default 0,
  created_at timestamptz not null default now(),
  unique(customer_id, provider_id)
);

alter table public.conversations enable row level security;

create policy "Participants can view their conversations"
  on public.conversations for select
  using (auth.uid() = customer_id or auth.uid() = (select user_id from public.providers where id = provider_id));

create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (auth.uid() = customer_id);

create policy "Participants can update conversations"
  on public.conversations for update
  using (auth.uid() = customer_id or auth.uid() = (select user_id from public.providers where id = provider_id));

-- =============================================
-- MESSAGES
-- =============================================
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  type text not null default 'text' check (type in ('text', 'booking')),
  booking_data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Conversation participants can view messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.customer_id = auth.uid() or c.provider_id in (
          select id from public.providers where user_id = auth.uid()
        ))
    )
  );

create policy "Authenticated users can insert messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Sender can mark messages read"
  on public.messages for update
  using (auth.uid() = sender_id);

-- Index for fast conversation message lookup
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at desc);

-- Trigger: update conversation last_message on new message
create or replace function update_conversation_on_message()
returns trigger language plpgsql as $$
declare
  conv record;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  update public.conversations
  set
    last_message = new.text,
    last_message_time = new.created_at,
    customer_unread = case
      when new.sender_id != conv.customer_id then conv.customer_unread + 1
      else 0
    end,
    provider_unread = case
      when new.sender_id = conv.customer_id then conv.provider_unread + 1
      else 0
    end
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_new_message on public.messages;
create trigger on_new_message
  after insert on public.messages
  for each row execute procedure update_conversation_on_message();

-- =============================================
-- SEED: Providers
-- =============================================
-- (seed data is handled by the app on first launch via the seeding utility)

-- =============================================
-- REALTIME
-- =============================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
