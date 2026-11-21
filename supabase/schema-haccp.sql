-- Quaderno HACCP: da incollare in Supabase > SQL Editor > Run.
-- Si può rilanciare senza perdere dati.
-- L'app HACCP è separata dall'app degli ordini: ha i suoi dati, le sue foto,
-- il suo storico e il suo elenco di chi può entrare. Non legge né scrive niente degli ordini.

-- Chi può entrare nell'app HACCP (diverso dall'elenco degli ordini).
create table if not exists public.haccp_ammessi (
  email text primary key check (email = lower(email)),
  admin boolean not null default false,
  aggiunto timestamptz not null default now()
);
-- Prima volta: i titolari dell'app degli ordini diventano titolari anche qui.
-- Dopo, l'elenco si gestisce dall'app HACCP (pulsante "Accessi").
insert into public.haccp_ammessi (email, admin)
  select email, true from public.ammessi
  where admin and not exists (select 1 from public.haccp_ammessi)
on conflict do nothing;

create or replace function public.haccp_ammesso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from haccp_ammessi where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
create or replace function public.haccp_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from haccp_ammessi where email = lower(coalesce(auth.jwt() ->> 'email', '')) and admin);
$$;

alter table public.haccp_ammessi enable row level security;
drop policy if exists haccp_ammessi_leggi on public.haccp_ammessi;
drop policy if exists haccp_ammessi_gestisci on public.haccp_ammessi;
create policy haccp_ammessi_leggi on public.haccp_ammessi for select to authenticated using (haccp_ammesso());
create policy haccp_ammessi_gestisci on public.haccp_ammessi for all to authenticated using (haccp_admin()) with check (haccp_admin());

-- Tutti i dati HACCP: ricette, lotti, fatture, produzioni, registri, impostazioni.
create table if not exists public.haccp (
  coll text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  creato timestamptz not null default now(),
  aggiornato timestamptz not null default now(),
  primary key (coll, id)
);

-- Storico HACCP: ogni modifica resta qui per sempre (utile per i controlli ASL).
create table if not exists public.haccp_storia (
  n bigserial primary key,
  coll text not null,
  doc_id text not null,
  azione text not null,
  utente text,
  quando timestamptz not null default now(),
  prima jsonb,
  dopo jsonb
);
create index if not exists haccp_storia_doc on public.haccp_storia (coll, doc_id, n);

create or replace function public.haccp_registra_storia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.data = new.data then return new; end if;
  insert into haccp_storia (coll, doc_id, azione, utente, prima, dopo)
  values (
    coalesce(new.coll, old.coll), coalesce(new.id, old.id), lower(tg_op),
    coalesce(auth.jwt() ->> 'email', 'sistema'),
    case when tg_op <> 'INSERT' then old.data end,
    case when tg_op <> 'DELETE' then new.data end
  );
  return coalesce(new, old);
end $$;
drop trigger if exists haccp_storia on public.haccp;
create trigger haccp_storia after insert or update or delete on public.haccp
  for each row execute function public.haccp_registra_storia();

alter table public.haccp enable row level security;
alter table public.haccp_storia enable row level security;
drop policy if exists haccp_leggi on public.haccp;
drop policy if exists haccp_scrivi on public.haccp;
create policy haccp_leggi on public.haccp for select to authenticated using (haccp_ammesso());
create policy haccp_scrivi on public.haccp for all to authenticated using (haccp_ammesso()) with check (haccp_ammesso());
drop policy if exists haccp_storia_leggi on public.haccp_storia;
create policy haccp_storia_leggi on public.haccp_storia for select to authenticated using (haccp_ammesso());

do $$ begin
  alter publication supabase_realtime add table public.haccp;
exception when duplicate_object then null; end $$;

-- Foto di etichette, fatture e prodotti (cartella separata da quella degli ordini)
insert into storage.buckets (id, name, public) values ('haccp', 'haccp', false) on conflict (id) do nothing;
drop policy if exists haccp_foto_leggi on storage.objects;
drop policy if exists haccp_foto_carica on storage.objects;
create policy haccp_foto_leggi on storage.objects for select to authenticated using (bucket_id = 'haccp' and public.haccp_ammesso());
create policy haccp_foto_carica on storage.objects for insert to authenticated with check (bucket_id = 'haccp' and public.haccp_ammesso());

