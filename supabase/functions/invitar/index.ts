// Invita a una persona a la plataforma. Solo la administradora puede llamarla.
//
// Recibe: { nombre, correo, rol: 'admin' | 'ninera' | 'familia', familia_id?, entrega: 'correo' | 'enlace' }
// - entrega 'correo': Supabase manda el correo de invitación.
// - entrega 'enlace': regresa un enlace para mandarlo por WhatsApp u otro medio.
//
// Crea también el renglón en public.usuarios (y en miembros_familia si es familia).
// Sin ese renglón, una cuenta no ve nada: así nadie se da de alta por su cuenta.

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(estado: number, cuerpo: Record<string, unknown>) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

const ROLES = ['admin', 'ninera', 'familia'] as const;
type Rol = (typeof ROLES)[number];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder(405, { error: 'Usa POST.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const servicio = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // ¿Quién llama? Debe ser una administradora activa.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: quien, error: errorQuien } = await servicio.auth.getUser(token);
  if (errorQuien || !quien.user) return responder(401, { error: 'Tu sesión expiró. Vuelve a entrar.' });

  const { data: perfil } = await servicio
    .from('usuarios')
    .select('rol, activo')
    .eq('id', quien.user.id)
    .maybeSingle();
  if (!perfil || perfil.rol !== 'admin' || !perfil.activo) {
    return responder(403, { error: 'Solo la administradora puede invitar personas.' });
  }

  let cuerpo: {
    nombre?: string;
    correo?: string;
    rol?: Rol;
    familia_id?: string | null;
    entrega?: 'correo' | 'enlace';
  };
  try {
    cuerpo = await req.json();
  } catch {
    return responder(400, { error: 'La solicitud no trae datos válidos.' });
  }

  const nombre = cuerpo.nombre?.trim();
  const correo = cuerpo.correo?.trim().toLowerCase();
  const rol = cuerpo.rol;
  const entrega = cuerpo.entrega ?? 'correo';

  if (!nombre) return responder(400, { error: 'Escribe el nombre de la persona.' });
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return responder(400, { error: 'Escribe un correo válido.' });
  }
  if (!rol || !ROLES.includes(rol)) return responder(400, { error: 'Elige un rol.' });
  if (rol === 'familia' && !cuerpo.familia_id) {
    return responder(400, { error: 'Elige a qué familia pertenece.' });
  }

  const redirectTo = Deno.env.get('SITE_URL') ?? req.headers.get('origin') ?? undefined;

  let usuarioId: string;
  let enlace: string | null = null;

  if (entrega === 'enlace') {
    const { data, error } = await servicio.auth.admin.generateLink({
      type: 'invite',
      email: correo,
      options: { redirectTo },
    });
    if (error || !data.user) return responder(409, { error: mensajeInvitacion(error?.message) });
    usuarioId = data.user.id;
    enlace = data.properties.action_link;
  } else {
    const { data, error } = await servicio.auth.admin.inviteUserByEmail(correo, { redirectTo });
    if (error || !data.user) return responder(409, { error: mensajeInvitacion(error?.message) });
    usuarioId = data.user.id;
  }

  const { error: errorPerfil } = await servicio
    .from('usuarios')
    .upsert({ id: usuarioId, nombre, correo, rol, activo: true });
  if (errorPerfil) {
    return responder(500, { error: `La invitación salió, pero no se guardó el perfil: ${errorPerfil.message}` });
  }

  if (rol === 'familia') {
    const { error: errorMiembro } = await servicio
      .from('miembros_familia')
      .upsert({ usuario_id: usuarioId, familia_id: cuerpo.familia_id });
    if (errorMiembro) {
      return responder(500, {
        error: `La invitación salió, pero no se pudo unir a la familia: ${errorMiembro.message}`,
      });
    }
  }

  return responder(200, { usuario_id: usuarioId, enlace });
});

function mensajeInvitacion(detalle?: string) {
  if (detalle && /already|registered|exists/i.test(detalle)) {
    return 'Ese correo ya tiene cuenta. Búscalo en la lista de personas.';
  }
  return `No se pudo enviar la invitación${detalle ? `: ${detalle}` : '.'}`;
}
