// Convierte errores técnicos en mensajes claros: qué pasó y qué hacer.
// Sin disculpas ni frases vagas (SPEC.md §4.3).

interface ErrorConCodigo {
  code?: string;
  message?: string;
  status?: number;
}

export function mensajeError(error: unknown, accion = 'guardar'): string {
  const e = (error ?? {}) as ErrorConCodigo;
  const msg = e.message ?? String(error ?? '');

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return `No hay conexión a internet. Revisa tu señal y vuelve a ${accion}.`;
  }
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return `No se pudo conectar con el servidor. Revisa tu conexión y vuelve a ${accion}.`;
  }
  if (e.code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'No tienes permiso para cambiar este día. La niñera puede editar hoy y ayer; para días anteriores pídeselo a la administradora.';
  }
  if (e.code === '23514') {
    return 'Faltan datos obligatorios o hay un valor fuera de rango. Revisa el formulario.';
  }
  if (e.code === 'PGRST301' || /JWT|expired/i.test(msg) || e.status === 401) {
    return 'Tu sesión expiró. Vuelve a entrar.';
  }
  return msg ? `No se pudo ${accion}: ${msg}` : `No se pudo ${accion}. Intenta de nuevo.`;
}
