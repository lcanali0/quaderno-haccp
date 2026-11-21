-- Protezione extra per le due app (ordini e HACCP).
-- Da incollare in Supabase > SQL Editor > Run. Si può rilanciare quando vuoi:
-- non cancella e non cambia nessun ordine, ricetta, lotto o registro.

-- 1) Solo le email già nell'elenco possono creare un account.
--    Prima: chiunque poteva crearsi un account (senza vedere niente, ma entrava nell'elenco utenti).
--    Ora: il database rifiuta l'iscrizione se l'email non è in "ammessi" (ordini)
--    o in "haccp_ammessi" (HACCP). Per far entrare una persona nuova basta,
--    come prima, aggiungerla dall'app e poi lei tocca "Crea la password".
create or replace function public.solo_email_ammesse() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ammessi where email = lower(coalesce(new.email, '')))
     and not exists (select 1 from public.haccp_ammessi where email = lower(coalesce(new.email, ''))) then
    raise exception 'EMAIL_NON_AMMESSA';
  end if;
  return new;
end $$;
revoke all on function public.solo_email_ammesse() from public, anon, authenticated;
drop trigger if exists solo_email_ammesse on auth.users;
create trigger solo_email_ammesse before insert on auth.users
  for each row execute function public.solo_email_ammesse();

-- 2) Le cartelle delle foto restano private (anche se per sbaglio sono state rese pubbliche).
update storage.buckets set public = false where id in ('foto', 'haccp') and public;

-- 3) Le funzioni interne non servono a chi non ha fatto l'accesso.
revoke execute on function public.sono_ammesso(), public.sono_admin(),
  public.haccp_ammesso(), public.haccp_admin() from public, anon;
grant execute on function public.sono_ammesso(), public.sono_admin(),
  public.haccp_ammesso(), public.haccp_admin() to authenticated;

-- 4) Controllo finale: deve uscire una sola riga con scritto "TUTTO A POSTO".
--    Se esce altro, fai una foto del risultato e mandala.
select coalesce(string_agg(problema, ' | '), 'TUTTO A POSTO') as risultato from (
  select 'Tabella senza protezione: ' || tablename as problema
    from pg_tables where schemaname = 'public' and not rowsecurity
  union all
  select 'Cartella foto pubblica: ' || id from storage.buckets where public
  union all
  select 'Persone con account ma fuori dagli elenchi: ' || count(*)
    from auth.users u
    where not exists (select 1 from public.ammessi a where a.email = lower(u.email))
      and not exists (select 1 from public.haccp_ammessi h where h.email = lower(u.email))
    having count(*) > 0
) x;

-- Per vedere chi sono le persone "fuori dagli elenchi" (se il controllo ne trova):
-- select email, created_at, last_sign_in_at from auth.users u
--   where not exists (select 1 from public.ammessi a where a.email = lower(u.email))
--     and not exists (select 1 from public.haccp_ammessi h where h.email = lower(u.email));
