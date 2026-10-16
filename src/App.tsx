import { useEffect, useState } from 'react';
import { api } from './lib/cliente';
import { mensajeError } from './lib/errores';
import { NOMBRE_ROL, type Perfil } from './lib/tipos';
import { Acceso } from './components/Acceso';
import { Admin } from './components/Admin';
import { Bitacora } from './components/Bitacora';
import { Aviso, Cargando } from './components/comunes';

export function App() {
  // undefined = todavía no sabemos; null = sin sesión / sin perfil.
  const [usuarioId, setUsuarioId] = useState<string | null | undefined>(undefined);
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.sesionActual().then(setUsuarioId);
    return api.alCambiarSesion(setUsuarioId);
  }, []);

  useEffect(() => {
    if (usuarioId === undefined) return;
    if (usuarioId === null) {
      setPerfil(null);
      return;
    }
    setPerfil(undefined);
    api
      .perfil(usuarioId)
      .then(setPerfil)
      .catch((err) => setError(mensajeError(err, 'cargar tu cuenta')));
  }, [usuarioId]);

  if (error) {
    return (
      <main className="contenido">
        <Aviso texto={error} />
      </main>
    );
  }
  if (usuarioId === undefined || (usuarioId && perfil === undefined)) {
    return (
      <main className="contenido">
        <Cargando />
      </main>
    );
  }
  if (!usuarioId) return <Acceso />;

  if (!perfil || !perfil.activo) {
    return (
      <main className="acceso">
        <div className="acceso-tarjeta">
          <h1>Tu cuenta no tiene acceso</h1>
          <p>Entraste con un correo que no está activo en Upper Nannies. Pide a la administradora que te invite o te devuelva el acceso.</p>
          <button type="button" className="boton-secundario ancho" onClick={() => api.salir()}>
            Salir
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className={`app rol-${perfil.rol}`}>
      <header className="barra-superior">
        <p className="marca">Upper Nannies</p>
        <div className="usuario">
          <span>
            {perfil.nombre}
            <span className="rol"> · {NOMBRE_ROL[perfil.rol]}</span>
          </span>
          <button type="button" className="boton-texto" onClick={() => api.salir()}>
            Salir
          </button>
        </div>
      </header>
      {api.modoDemo && <p className="banda-demo">Modo demostración: datos de ejemplo guardados solo en este navegador.</p>}
      <main className="contenido">{perfil.rol === 'admin' ? <Admin perfil={perfil} /> : <Bitacora perfil={perfil} />}</main>
    </div>
  );
}
