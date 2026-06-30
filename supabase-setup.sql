create table if not exists app_storage (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_storage enable row level security;

create policy "Allow anon read" on app_storage
  for select
  to anon
  using (true);

create policy "Allow anon insert" on app_storage
  for insert
  to anon
  with check (true);

create policy "Allow anon update" on app_storage
  for update
  to anon
  using (true)
  with check (true);
