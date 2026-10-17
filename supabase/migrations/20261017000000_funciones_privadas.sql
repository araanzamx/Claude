-- Las funciones que deciden quién ve qué pasan a un esquema que la API no expone,
-- para que nadie pueda llamarlas directo (/rest/v1/rpc/...). Las políticas de
-- acceso las siguen usando igual. Atiende el aviso 0029 del asesor de Supabase.

create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated, service_role;

alter function public.es_admin() set schema privado;
alter function public.cuida_a(uuid) set schema privado;
alter function public.es_familia_de(uuid) set schema privado;
alter function public.puede_ver_nino(uuid) set schema privado;
alter function public.puede_escribir_bitacora(uuid, date) set schema privado;

-- Estas dos llaman a las otras por nombre: se reescriben con el esquema nuevo.
create or replace function privado.puede_ver_nino(p_nino_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.es_admin() or privado.cuida_a(p_nino_id) or privado.es_familia_de(p_nino_id)
$$;

create or replace function privado.puede_escribir_bitacora(p_nino_id uuid, p_fecha date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_fecha <= public.hoy_cdmx()
    and (
      privado.es_admin()
      or (privado.cuida_a(p_nino_id) and p_fecha >= public.hoy_cdmx() - 1)
    )
$$;

revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated, service_role;

-- La migración anterior dio permiso sobre todas las funciones de public, incluidas
-- las que trae Supabase. Se deja solo lo que la app necesita.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from authenticated;
  end if;
end;
$$;
