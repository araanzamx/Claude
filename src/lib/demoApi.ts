// Modo demostración: datos de ejemplo guardados en este navegador, sin servidor.
// Sirve para ver y probar la app antes de conectar Supabase. Imita las reglas de
// acceso para que cada rol vea lo mismo que vería en producción, pero la
// privacidad real solo la garantiza la base de datos.
//
// Abre dos pestañas (una como niñera y otra como familia) para ver la
// actualización en vivo.

import type { Api } from './api';
import { puedeEditar } from './bitacora';
import { hoyCDMX, sumarDias } from './fechas';
import type { Asignacion, Familia, MiembroFamilia, Nino, Perfil, Registro } from './tipos';

interface Estado {
  usuarios: Perfil[];
  familias: Familia[];
  ninos: Nino[];
  asignaciones: Asignacion[];
  miembros: MiembroFamilia[];
  registros: Registro[];
}

const CLAVE_DATOS = 'upper-nannies-demo-v1';
const CLAVE_SESION = 'upper-nannies-demo-sesion';

export const USUARIOS_DEMO = {
  admin: 'demo-admin',
  ninera: 'demo-ninera-lupita',
  familia: 'demo-familia-garcia',
} as const;

function id() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function estadoInicial(): Estado {
  const hoy = hoyCDMX();
  const ayer = sumarDias(hoy, -1);
  const sofia = 'demo-nino-sofia';
  const mateo = 'demo-nino-mateo';
  const emilia = 'demo-nino-emilia';
  const reg = (nino_id: string, fecha: string, tipo: Registro['tipo'], hora: string, datos: Record<string, unknown>): Registro => ({
    id: id(),
    nino_id,
    fecha,
    tipo,
    hora: `${hora}:00`,
    datos,
    creado_por: USUARIOS_DEMO.ninera,
  });

  return {
    usuarios: [
      { id: USUARIOS_DEMO.admin, nombre: 'Aranza', correo: 'aranza@uppernannies.mx', rol: 'admin', activo: true },
      { id: USUARIOS_DEMO.ninera, nombre: 'Lupita Hernández', correo: 'lupita@ejemplo.mx', rol: 'ninera', activo: true },
      { id: 'demo-ninera-carmen', nombre: 'Carmen Ruiz', correo: 'carmen@ejemplo.mx', rol: 'ninera', activo: true },
      { id: USUARIOS_DEMO.familia, nombre: 'Daniela García', correo: 'daniela@ejemplo.mx', rol: 'familia', activo: true },
      { id: 'demo-familia-torres', nombre: 'Jorge Torres', correo: 'jorge@ejemplo.mx', rol: 'familia', activo: true },
    ],
    familias: [
      { id: 'demo-fam-garcia', nombre: 'Familia García' },
      { id: 'demo-fam-torres', nombre: 'Familia Torres' },
    ],
    ninos: [
      { id: sofia, nombre: 'Sofía', familia_id: 'demo-fam-garcia', activo: true },
      { id: mateo, nombre: 'Mateo', familia_id: 'demo-fam-garcia', activo: true },
      { id: emilia, nombre: 'Emilia', familia_id: 'demo-fam-torres', activo: true },
    ],
    asignaciones: [
      { nino_id: sofia, ninera_id: USUARIOS_DEMO.ninera, activo: true },
      { nino_id: mateo, ninera_id: USUARIOS_DEMO.ninera, activo: true },
      { nino_id: emilia, ninera_id: 'demo-ninera-carmen', activo: true },
    ],
    miembros: [
      { usuario_id: USUARIOS_DEMO.familia, familia_id: 'demo-fam-garcia' },
      { usuario_id: 'demo-familia-torres', familia_id: 'demo-fam-torres' },
    ],
    registros: [
      reg(sofia, hoy, 'comida', '08:15', { momento: 'Desayuno', que_comio: 'Avena con plátano', cuanto: 'Todo' }),
      reg(sofia, hoy, 'bano', '09:00', { que_paso: 'Pipí' }),
      reg(sofia, hoy, 'animo', '09:30', { animo: 'Feliz', temperatura: 36.5 }),
      reg(sofia, hoy, 'actividad', '10:00', { que_hicieron: 'Pintura con acuarelas', como_le_fue: 'Muy concentrada, pintó un sol' }),
      reg(sofia, hoy, 'comida', '11:30', { momento: 'Colación', que_comio: 'Manzana picada', cuanto: 'Casi todo' }),
      reg(sofia, hoy, 'siesta', '13:10', {}),
      reg(sofia, ayer, 'siesta', '13:00', { desperto: '14:40', como: 'Tranquilo' }),
      reg(sofia, ayer, 'comida', '14:50', { momento: 'Comida', que_comio: 'Sopa de fideo y pollo', cuanto: 'Poco' }),
      reg(mateo, hoy, 'comida', '08:30', { momento: 'Leche o biberón', que_comio: '180 ml', cuanto: 'Todo' }),
      reg(emilia, hoy, 'animo', '10:00', { animo: 'Tranquilo' }),
    ],
  };
}

function leer(): Estado {
  try {
    const crudo = localStorage.getItem(CLAVE_DATOS);
    if (crudo) return JSON.parse(crudo) as Estado;
  } catch {
    // sin almacenamiento: se usa el estado inicial
  }
  return estadoInicial();
}

export function crearDemoApi(): Api {
  let estado = leer();
  const oyentes = new Set<() => void>();
  const oyentesSesion = new Set<(u: string | null) => void>();

  function guardar() {
    try {
      localStorage.setItem(CLAVE_DATOS, JSON.stringify(estado));
    } catch {
      // sin almacenamiento: los cambios viven solo en esta pestaña
    }
    oyentes.forEach((cb) => cb());
  }

  // Cambios hechos en otra pestaña.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === CLAVE_DATOS) {
        estado = leer();
        oyentes.forEach((cb) => cb());
      }
    });
  }

  function sesion(): string | null {
    try {
      return sessionStorage.getItem(CLAVE_SESION);
    } catch {
      return memoriaSesion;
    }
  }
  let memoriaSesion: string | null = null;

  function yo(): Perfil {
    const p = estado.usuarios.find((u) => u.id === sesion() && u.activo);
    if (!p) throw new Error('Tu sesión expiró. Vuelve a entrar.');
    return p;
  }

  function puedeVer(ninoId: string): boolean {
    const p = yo();
    const nino = estado.ninos.find((n) => n.id === ninoId);
    if (!nino) return false;
    if (p.rol === 'admin') return true;
    if (p.rol === 'ninera') {
      return nino.activo && estado.asignaciones.some((a) => a.nino_id === ninoId && a.ninera_id === p.id && a.activo);
    }
    return estado.miembros.some((m) => m.usuario_id === p.id && m.familia_id === nino.familia_id);
  }

  function exigirEscritura(ninoId: string, fecha: string) {
    if (!puedeVer(ninoId) || !puedeEditar(yo().rol, fecha)) throw { code: '42501' };
  }

  function exigirAdmin() {
    if (yo().rol !== 'admin') throw { code: '42501' };
  }

  function cambiarSesion(u: string | null) {
    try {
      if (u) sessionStorage.setItem(CLAVE_SESION, u);
      else sessionStorage.removeItem(CLAVE_SESION);
    } catch {
      memoriaSesion = u;
    }
    oyentesSesion.forEach((cb) => cb(u));
  }

  const espera = () => new Promise((r) => setTimeout(r, 120));

  return {
    modoDemo: true,

    async sesionActual() {
      return sesion();
    },
    alCambiarSesion(cb) {
      oyentesSesion.add(cb);
      return () => oyentesSesion.delete(cb);
    },
    async enviarEnlaceAcceso(usuarioId) {
      // En demo, el "correo" es el id del usuario de ejemplo elegido.
      cambiarSesion(usuarioId);
    },
    async salir() {
      cambiarSesion(null);
    },
    async perfil(usuarioId) {
      return estado.usuarios.find((u) => u.id === usuarioId) ?? null;
    },

    async ninos() {
      await espera();
      return estado.ninos.filter((n) => puedeVer(n.id)).sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
    async familias() {
      const visibles = new Set(estado.ninos.filter((n) => puedeVer(n.id)).map((n) => n.familia_id));
      return estado.familias.filter((f) => yo().rol === 'admin' || visibles.has(f.id));
    },
    async registros(ninoId, fecha) {
      await espera();
      if (!puedeVer(ninoId)) return [];
      return estado.registros.filter((r) => r.nino_id === ninoId && r.fecha === fecha);
    },
    async crearRegistro(r) {
      exigirEscritura(r.nino_id, r.fecha);
      estado = { ...estado, registros: [...estado.registros, { ...r, id: id(), creado_por: yo().id }] };
      guardar();
    },
    async actualizarRegistro(rid, cambios) {
      const actual = estado.registros.find((r) => r.id === rid);
      if (!actual) throw { code: '42501' };
      exigirEscritura(actual.nino_id, actual.fecha);
      estado = { ...estado, registros: estado.registros.map((r) => (r.id === rid ? { ...r, ...cambios } : r)) };
      guardar();
    },
    async quitarRegistro(rid) {
      const actual = estado.registros.find((r) => r.id === rid);
      if (!actual) throw { code: '42501' };
      exigirEscritura(actual.nino_id, actual.fecha);
      estado = { ...estado, registros: estado.registros.filter((r) => r.id !== rid) };
      guardar();
    },
    escucharBitacora(_ninoId, cb) {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },

    async usuarios() {
      exigirAdmin();
      return [...estado.usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
    async asignaciones() {
      exigirAdmin();
      return estado.asignaciones;
    },
    async miembros() {
      exigirAdmin();
      return estado.miembros;
    },
    async crearFamilia(nombre) {
      exigirAdmin();
      estado = { ...estado, familias: [...estado.familias, { id: id(), nombre }] };
      guardar();
    },
    async quitarFamilia(fid) {
      exigirAdmin();
      const ninos = new Set(estado.ninos.filter((n) => n.familia_id === fid).map((n) => n.id));
      estado = {
        ...estado,
        familias: estado.familias.filter((f) => f.id !== fid),
        ninos: estado.ninos.filter((n) => !ninos.has(n.id)),
        asignaciones: estado.asignaciones.filter((a) => !ninos.has(a.nino_id)),
        miembros: estado.miembros.filter((m) => m.familia_id !== fid),
        registros: estado.registros.filter((r) => !ninos.has(r.nino_id)),
      };
      guardar();
    },
    async crearNino(nombre, familiaId) {
      exigirAdmin();
      estado = { ...estado, ninos: [...estado.ninos, { id: id(), nombre, familia_id: familiaId, activo: true }] };
      guardar();
    },
    async cambiarNino(nid, cambios) {
      exigirAdmin();
      estado = { ...estado, ninos: estado.ninos.map((n) => (n.id === nid ? { ...n, ...cambios } : n)) };
      guardar();
    },
    async cambiarUsuario(uid, cambios) {
      exigirAdmin();
      estado = { ...estado, usuarios: estado.usuarios.map((u) => (u.id === uid ? { ...u, ...cambios } : u)) };
      guardar();
    },
    async asignar(ninoId, nineraId) {
      exigirAdmin();
      const resto = estado.asignaciones.filter((a) => !(a.nino_id === ninoId && a.ninera_id === nineraId));
      estado = { ...estado, asignaciones: [...resto, { nino_id: ninoId, ninera_id: nineraId, activo: true }] };
      guardar();
    },
    async cambiarAsignacion(ninoId, nineraId, activo) {
      exigirAdmin();
      estado = {
        ...estado,
        asignaciones: estado.asignaciones.map((a) =>
          a.nino_id === ninoId && a.ninera_id === nineraId ? { ...a, activo } : a,
        ),
      };
      guardar();
    },
    async quitarAsignacion(ninoId, nineraId) {
      exigirAdmin();
      estado = {
        ...estado,
        asignaciones: estado.asignaciones.filter((a) => !(a.nino_id === ninoId && a.ninera_id === nineraId)),
      };
      guardar();
    },
    async agregarMiembro(usuarioId, familiaId) {
      exigirAdmin();
      const resto = estado.miembros.filter((m) => !(m.usuario_id === usuarioId && m.familia_id === familiaId));
      estado = { ...estado, miembros: [...resto, { usuario_id: usuarioId, familia_id: familiaId }] };
      guardar();
    },
    async quitarMiembro(usuarioId, familiaId) {
      exigirAdmin();
      estado = {
        ...estado,
        miembros: estado.miembros.filter((m) => !(m.usuario_id === usuarioId && m.familia_id === familiaId)),
      };
      guardar();
    },
    async invitar(inv) {
      exigirAdmin();
      if (estado.usuarios.some((u) => u.correo === inv.correo.toLowerCase())) {
        throw new Error('Ese correo ya tiene cuenta. Búscalo en la lista de personas.');
      }
      const nuevo: Perfil = { id: id(), nombre: inv.nombre, correo: inv.correo.toLowerCase(), rol: inv.rol, activo: true };
      estado = { ...estado, usuarios: [...estado.usuarios, nuevo] };
      if (inv.rol === 'familia' && inv.familia_id) {
        estado = { ...estado, miembros: [...estado.miembros, { usuario_id: nuevo.id, familia_id: inv.familia_id }] };
      }
      guardar();
      return inv.entrega === 'enlace' ? `${window.location.origin}/#invitacion-demo` : null;
    },
  };
}

export function reiniciarDemo() {
  try {
    localStorage.removeItem(CLAVE_DATOS);
  } catch {
    // nada que borrar
  }
}
