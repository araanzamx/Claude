// Selector de niño + vista del día. La lista de niños ya viene filtrada por las
// reglas de la base: cada rol solo recibe a los niños que le corresponden.

import { useEffect, useState } from 'react';
import { api } from '../lib/cliente';
import { mensajeError } from '../lib/errores';
import type { Familia, Nino, Perfil } from '../lib/tipos';
import { Aviso, Cargando } from './comunes';
import { DiaVista } from './DiaVista';

const CLAVE_NINO = 'upper-nannies-nino';

function ninoRecordado(): string | null {
  try {
    return localStorage.getItem(CLAVE_NINO);
  } catch {
    return null;
  }
}

export function Bitacora({ perfil }: { perfil: Perfil }) {
  const [ninos, setNinos] = useState<Nino[] | null>(null);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [elegido, setElegido] = useState<string | null>(ninoRecordado);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.ninos(), api.familias()])
      .then(([n, f]) => {
        // La niñera solo trabaja con niños activos; familia y admin ven también el historial.
        setNinos(perfil.rol === 'ninera' ? n.filter((x) => x.activo) : n);
        setFamilias(f);
      })
      .catch((err) => setError(mensajeError(err, 'cargar la lista de niños')));
  }, [perfil.rol]);

  if (error) return <Aviso texto={error} />;
  if (!ninos) return <Cargando />;

  if (ninos.length === 0) {
    return (
      <div className="vacio grande">
        {perfil.rol === 'ninera' ? (
          <>
            <h1>Todavía no tienes niños asignados</h1>
            <p>Cuando la administradora te asigne a un niño o niña, aparecerá aquí para que registres su día.</p>
          </>
        ) : perfil.rol === 'familia' ? (
          <>
            <h1>Todavía no hay niños en tu cuenta</h1>
            <p>Pide a la administradora de Upper Nannies que agregue a tu hijo o hija a tu familia.</p>
          </>
        ) : (
          <>
            <h1>Todavía no hay niños</h1>
            <p>Agrega una familia y sus niños en la pestaña Familias.</p>
          </>
        )}
      </div>
    );
  }

  const actual = ninos.find((n) => n.id === elegido) ?? ninos[0];
  const nombreFamilia = (id: string) => familias.find((f) => f.id === id)?.nombre;

  function elegir(id: string) {
    setElegido(id);
    try {
      localStorage.setItem(CLAVE_NINO, id);
    } catch {
      // recordar el niño es solo una comodidad
    }
  }

  return (
    <>
      {ninos.length > 1 && (
        <div className="selector-ninos" role="group" aria-label="Elegir niño">
          {ninos.map((n) => (
            <button
              key={n.id}
              type="button"
              className="pestana"
              aria-pressed={n.id === actual.id}
              onClick={() => elegir(n.id)}
              title={perfil.rol !== 'familia' ? nombreFamilia(n.familia_id) : undefined}
            >
              {n.nombre}
              {perfil.rol === 'admin' && <span className="pestana-sub">{nombreFamilia(n.familia_id)}</span>}
              {!n.activo && <span className="pestana-sub">de baja</span>}
            </button>
          ))}
        </div>
      )}
      <DiaVista key={actual.id} nino={actual} rol={perfil.rol} />
    </>
  );
}
