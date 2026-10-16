// Tipos de datos y catálogo de registros de la bitácora (SPEC.md §4.1).
// Los valores de las opciones deben coincidir con registro_datos_validos() en la base.

export type Rol = 'admin' | 'ninera' | 'familia';
export type TipoRegistro = 'comida' | 'siesta' | 'bano' | 'animo' | 'actividad';

export interface Perfil {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
}

export interface Familia {
  id: string;
  nombre: string;
}

export interface Nino {
  id: string;
  nombre: string;
  familia_id: string;
  activo: boolean;
}

export interface Asignacion {
  nino_id: string;
  ninera_id: string;
  activo: boolean;
}

export interface MiembroFamilia {
  usuario_id: string;
  familia_id: string;
}

export interface DatosComida {
  momento: string;
  que_comio?: string | null;
  cuanto?: string | null;
}
export interface DatosSiesta {
  desperto?: string | null; // "HH:MM"
  como?: string | null;
}
export interface DatosBano {
  que_paso: string;
  notas?: string | null;
}
export interface DatosAnimo {
  animo: string;
  temperatura?: number | null;
  salud?: string | null;
}
export interface DatosActividad {
  que_hicieron: string;
  como_le_fue?: string | null;
}

export type DatosRegistro = DatosComida | DatosSiesta | DatosBano | DatosAnimo | DatosActividad;

export interface Registro {
  id: string;
  nino_id: string;
  fecha: string; // "AAAA-MM-DD"
  tipo: TipoRegistro;
  hora: string; // "HH:MM" o "HH:MM:SS"
  datos: Record<string, unknown>;
  creado_por: string | null;
}

export type NuevoRegistro = Pick<Registro, 'nino_id' | 'fecha' | 'tipo' | 'hora' | 'datos'>;

export const MOMENTOS_COMIDA = ['Desayuno', 'Colación', 'Comida', 'Merienda', 'Cena', 'Leche o biberón'];
export const CUANTO_COMIO = ['Todo', 'Casi todo', 'Poco', 'Nada'];
export const COMO_DURMIO = ['Tranquilo', 'Inquieto'];
export const QUE_PASO_BANO = ['Pipí', 'Popó', 'Pipí y popó', 'Seco', 'Fue al baño'];
export const ANIMOS = ['Feliz', 'Tranquilo', 'Inquieto', 'Triste o llorón', 'Cansado'];

export interface InfoTipo {
  tipo: TipoRegistro;
  nombre: string; // título en la línea de tiempo y en la hoja
  boton: string; // texto corto en la barra de captura
  icono: string;
}

export const TIPOS: InfoTipo[] = [
  { tipo: 'comida', nombre: 'Comida', boton: 'Comida', icono: '🍎' },
  { tipo: 'siesta', nombre: 'Siesta', boton: 'Siesta', icono: '🌙' },
  { tipo: 'bano', nombre: 'Pañal o baño', boton: 'Baño', icono: '💧' },
  { tipo: 'animo', nombre: 'Ánimo y salud', boton: 'Ánimo', icono: '😊' },
  { tipo: 'actividad', nombre: 'Actividad', boton: 'Actividad', icono: '🎨' },
];

export function infoTipo(tipo: TipoRegistro): InfoTipo {
  return TIPOS.find((t) => t.tipo === tipo)!;
}

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administradora',
  ninera: 'Niñera',
  familia: 'Familia',
};
