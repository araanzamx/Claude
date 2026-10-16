import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Api, Invitacion } from './api';
import type { Asignacion, Familia, MiembroFamilia, Nino, Perfil, Registro } from './tipos';

function revisar<T>(resultado: { data: T | null; error: unknown }): T {
  if (resultado.error) throw resultado.error;
  return resultado.data as T;
}

export function crearSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey);

  return {
    modoDemo: false,

    async sesionActual() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.id ?? null;
    },

    alCambiarSesion(cb) {
      const { data } = sb.auth.onAuthStateChange((_evento, sesion) => cb(sesion?.user.id ?? null));
      return () => data.subscription.unsubscribe();
    },

    async enviarEnlaceAcceso(correo) {
      const { error } = await sb.auth.signInWithOtp({
        email: correo,
        // Solo entran personas invitadas por la administradora.
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
    },

    async salir() {
      await sb.auth.signOut();
    },

    async perfil(usuarioId) {
      return revisar(
        await sb.from('usuarios').select('id, nombre, correo, rol, activo').eq('id', usuarioId).maybeSingle(),
      ) as Perfil | null;
    },

    async ninos() {
      return revisar(await sb.from('ninos').select('id, nombre, familia_id, activo').order('nombre')) as Nino[];
    },

    async familias() {
      return revisar(await sb.from('familias').select('id, nombre').order('nombre')) as Familia[];
    },

    async registros(ninoId, fecha) {
      return revisar(
        await sb
          .from('registros')
          .select('id, nino_id, fecha, tipo, hora, datos, creado_por')
          .eq('nino_id', ninoId)
          .eq('fecha', fecha)
          .order('hora'),
      ) as Registro[];
    },

    async fechasConRegistros(ninoId, desde, hasta) {
      const filas = revisar(
        await sb.from('registros').select('fecha').eq('nino_id', ninoId).gte('fecha', desde).lte('fecha', hasta),
      ) as { fecha: string }[];
      return [...new Set(filas.map((f) => f.fecha))];
    },

    async crearRegistro(r) {
      revisar(await sb.from('registros').insert(r));
    },

    async actualizarRegistro(id, cambios) {
      // .select() hace que una edición rechazada por las reglas no pase en silencio.
      const filas = revisar(await sb.from('registros').update(cambios).eq('id', id).select('id'));
      if (!filas || (filas as unknown[]).length === 0) throw { code: '42501' };
    },

    async quitarRegistro(id) {
      const filas = revisar(await sb.from('registros').delete().eq('id', id).select('id'));
      if (!filas || (filas as unknown[]).length === 0) throw { code: '42501' };
    },

    escucharBitacora(ninoId, cb) {
      const canal = sb
        .channel(`bitacora-${ninoId}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registros', filter: `nino_id=eq.${ninoId}` }, cb)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registros', filter: `nino_id=eq.${ninoId}` }, cb)
        // Supabase no filtra los borrados; volver a leer es barato y las reglas siguen aplicando.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'registros' }, cb)
        .subscribe();
      return () => {
        sb.removeChannel(canal);
      };
    },

    async usuarios() {
      return revisar(await sb.from('usuarios').select('id, nombre, correo, rol, activo').order('nombre')) as Perfil[];
    },

    async asignaciones() {
      return revisar(await sb.from('asignaciones').select('nino_id, ninera_id, activo')) as Asignacion[];
    },

    async miembros() {
      return revisar(await sb.from('miembros_familia').select('usuario_id, familia_id')) as MiembroFamilia[];
    },

    async crearFamilia(nombre) {
      revisar(await sb.from('familias').insert({ nombre }));
    },

    async quitarFamilia(id) {
      revisar(await sb.from('familias').delete().eq('id', id));
    },

    async crearNino(nombre, familiaId) {
      revisar(await sb.from('ninos').insert({ nombre, familia_id: familiaId }));
    },

    async cambiarNino(id, cambios) {
      revisar(await sb.from('ninos').update(cambios).eq('id', id));
    },

    async cambiarUsuario(id, cambios) {
      revisar(await sb.from('usuarios').update(cambios).eq('id', id));
    },

    async asignar(ninoId, nineraId) {
      revisar(await sb.from('asignaciones').upsert({ nino_id: ninoId, ninera_id: nineraId, activo: true }));
    },

    async cambiarAsignacion(ninoId, nineraId, activo) {
      revisar(await sb.from('asignaciones').update({ activo }).eq('nino_id', ninoId).eq('ninera_id', nineraId));
    },

    async quitarAsignacion(ninoId, nineraId) {
      revisar(await sb.from('asignaciones').delete().eq('nino_id', ninoId).eq('ninera_id', nineraId));
    },

    async agregarMiembro(usuarioId, familiaId) {
      revisar(await sb.from('miembros_familia').upsert({ usuario_id: usuarioId, familia_id: familiaId }));
    },

    async quitarMiembro(usuarioId, familiaId) {
      revisar(await sb.from('miembros_familia').delete().eq('usuario_id', usuarioId).eq('familia_id', familiaId));
    },

    async invitar(inv: Invitacion) {
      const { data, error } = await sb.functions.invoke('invitar', { body: inv });
      if (error) {
        // La función regresa { error } con un mensaje claro; úsalo si viene.
        let detalle: string | undefined;
        try {
          detalle = (await (error as { context?: Response }).context?.json())?.error;
        } catch {
          // sin cuerpo legible
        }
        throw new Error(detalle ?? error.message);
      }
      return (data as { enlace: string | null }).enlace;
    },
  };
}
