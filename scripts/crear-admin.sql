-- Da de alta a la primera administradora. Se corre UNA vez en el SQL Editor de Supabase,
-- después de invitarte desde Authentication → Users → "Invite user" con tu correo.
-- Cambia el correo y el nombre antes de correrlo.

insert into public.usuarios (id, nombre, correo, rol)
select id, 'Aranza', email, 'admin'
from auth.users
where email = 'TU_CORREO@ejemplo.com'
on conflict (id) do update set rol = 'admin', activo = true;
