// Interfaz única de datos. La app usa Supabase si hay credenciales en .env.local;
// si no, abre en modo demostración con datos de ejemplo en memoria.

import type {
  Asignacion,
  Familia,
  MiembroFamilia,
  Nino,
  NuevoRegistro,
  Perfil,
  Registro,
  Rol,
} from './tipos';

export interface Invitacion {
  nombre: string;
  correo: string;
  rol: Rol;
  familia_id?: string | null;
  entrega: 'correo' | 'enlace';
}

export interface Api {
  modoDemo: boolean;

  // Sesión
  sesionActual(): Promise<string | null>; // id del usuario o null
  alCambiarSesion(cb: (usuarioId: string | null) => void): () => void;
  enviarEnlaceAcceso(correo: string): Promise<void>;
  salir(): Promise<void>;
  perfil(usuarioId: string): Promise<Perfil | null>;

  // Bitácora
  ninos(): Promise<Nino[]>;
  familias(): Promise<Familia[]>;
  registros(ninoId: string, fecha: string): Promise<Registro[]>;
  /** Fechas ("AAAA-MM-DD") entre `desde` y `hasta` que tienen al menos un registro. */
  fechasConRegistros(ninoId: string, desde: string, hasta: string): Promise<string[]>;
  crearRegistro(r: NuevoRegistro): Promise<void>;
  actualizarRegistro(id: string, cambios: Partial<NuevoRegistro>): Promise<void>;
  quitarRegistro(id: string): Promise<void>;
  /** Llama a `cb` cada vez que cambie la bitácora de ese niño. Regresa la función para dejar de escuchar. */
  escucharBitacora(ninoId: string, cb: () => void): () => void;

  // Administración
  usuarios(): Promise<Perfil[]>;
  asignaciones(): Promise<Asignacion[]>;
  miembros(): Promise<MiembroFamilia[]>;
  crearFamilia(nombre: string): Promise<void>;
  quitarFamilia(id: string): Promise<void>;
  crearNino(nombre: string, familiaId: string): Promise<void>;
  cambiarNino(id: string, cambios: Partial<Pick<Nino, 'nombre' | 'activo'>>): Promise<void>;
  cambiarUsuario(id: string, cambios: Partial<Pick<Perfil, 'nombre' | 'activo'>>): Promise<void>;
  asignar(ninoId: string, nineraId: string): Promise<void>;
  cambiarAsignacion(ninoId: string, nineraId: string, activo: boolean): Promise<void>;
  quitarAsignacion(ninoId: string, nineraId: string): Promise<void>;
  agregarMiembro(usuarioId: string, familiaId: string): Promise<void>;
  quitarMiembro(usuarioId: string, familiaId: string): Promise<void>;
  /** Regresa el enlace si la entrega es por enlace. */
  invitar(inv: Invitacion): Promise<string | null>;
}
