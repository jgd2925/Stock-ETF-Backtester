-- Supabase SQL 에디터에서 실행하세요 (supabase.com → 프로젝트 → SQL Editor)

create table if not exists paper_trades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  symbol text not null,
  name text not null,
  type text not null check (type in ('buy', 'sell')),
  quantity numeric not null check (quantity > 0),
  price numeric not null check (price > 0),
  currency text not null default 'USD',
  created_at timestamptz default now() not null
);

alter table paper_trades enable row level security;

create policy "Users can view own trades"
  on paper_trades for select
  using (auth.uid() = user_id);

create policy "Users can insert own trades"
  on paper_trades for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own trades"
  on paper_trades for delete
  using (auth.uid() = user_id);

create index if not exists paper_trades_user_id_idx on paper_trades(user_id);
create index if not exists paper_trades_created_at_idx on paper_trades(created_at desc);
