-- Quaderno HACCP: da incollare una volta sola in Supabase > SQL Editor > Run
-- (lo stesso progetto Supabase dell'app degli ordini). Si può rilanciare senza perdere dati.
-- Usa lo stesso elenco di chi può entrare (tabella "ammessi") dell'app degli ordini.

create table if not exists public.haccp (
  coll text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  creato timestamptz not null default now(),
  aggiornato timestamptz not null default now(),
  primary key (coll, id)
);

-- Ogni modifica resta nello storico (utile per i controlli ASL).
drop trigger if exists haccp_storia on public.haccp;
create trigger haccp_storia after insert or update or delete on public.haccp
  for each row execute function public.registra_storia();

alter table public.haccp enable row level security;
drop policy if exists haccp_leggi on public.haccp;
drop policy if exists haccp_scrivi on public.haccp;
create policy haccp_leggi on public.haccp for select to authenticated using (sono_ammesso());
create policy haccp_scrivi on public.haccp for all to authenticated using (sono_ammesso()) with check (sono_ammesso());

do $$ begin
  alter publication supabase_realtime add table public.haccp;
exception when duplicate_object then null; end $$;

-- Foto di etichette, fatture e prodotti
insert into storage.buckets (id, name, public) values ('haccp', 'haccp', false) on conflict (id) do nothing;
drop policy if exists haccp_foto_leggi on storage.objects;
drop policy if exists haccp_foto_carica on storage.objects;
create policy haccp_foto_leggi on storage.objects for select to authenticated using (bucket_id = 'haccp' and public.sono_ammesso());
create policy haccp_foto_carica on storage.objects for insert to authenticated with check (bucket_id = 'haccp' and public.sono_ammesso());
