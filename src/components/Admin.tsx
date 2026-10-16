// Panel de la administradora (SPEC.md §4.2): familias y niños, personas e
// invitaciones, asignaciones niñera ↔ niño, y consulta de cualquier bitácora.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/cliente';
import { mensajeError } from '../lib/errores';
import { NOMBRE_ROL, type Asignacion, type Familia, type MiembroFamilia, type Nino, type Perfil, type Rol } from '../lib/tipos';
import { Bitacora } from './Bitacora';
import { Aviso, BotonConfirmar, Campo, Cargando } from './comunes';

type Pestana = 'bitacora' | 'familias' | 'personas' | 'asignaciones';

interface Datos {
  familias: Familia[];
  ninos: Nino[];
  usuarios: Perfil[];
  asignaciones: Asignacion[];
  miembros: MiembroFamilia[];
}

export function Admin({ perfil }: { perfil: Perfil }) {
  const [pestana, setPestana] = useState<Pestana>('bitacora');
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [familias, ninos, usuarios, asignaciones, miembros] = await Promise.all([
        api.familias(),
        api.ninos(),
        api.usuarios(),
        api.asignaciones(),
        api.miembros(),
      ]);
      setDatos({ familias, ninos, usuarios, asignaciones, miembros });
    } catch (err) {
      setError(mensajeError(err, 'cargar los datos'));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Ejecuta una acción, muestra el error si falla y recarga los datos. */
  const hacer = useCallback(
    async (accion: () => Promise<unknown>, que: string) => {
      setError(null);
      try {
        await accion();
        await cargar();
        return true;
      } catch (err) {
        setError(mensajeError(err, que));
        return false;
      }
    },
    [cargar],
  );

  const pestanas: [Pestana, string][] = [
    ['bitacora', 'Bitácora'],
    ['familias', 'Familias'],
    ['personas', 'Personas'],
    ['asignaciones', 'Asignaciones'],
  ];

  return (
    <>
      <nav className="pestanas-admin" aria-label="Secciones">
        {pestanas.map(([id, texto]) => (
          <button key={id} type="button" className="pestana" aria-pressed={pestana === id} onClick={() => setPestana(id)}>
            {texto}
          </button>
        ))}
      </nav>
      <Aviso texto={error} onCerrar={() => setError(null)} />
      {pestana === 'bitacora' ? (
        <Bitacora perfil={perfil} />
      ) : !datos ? (
        <Cargando />
      ) : pestana === 'familias' ? (
        <Familias datos={datos} hacer={hacer} />
      ) : pestana === 'personas' ? (
        <Personas datos={datos} hacer={hacer} yo={perfil.id} />
      ) : (
        <Asignaciones datos={datos} hacer={hacer} />
      )}
    </>
  );
}

type Hacer = (accion: () => Promise<unknown>, que: string) => Promise<boolean>;

function Familias({ datos, hacer }: { datos: Datos; hacer: Hacer }) {
  const [nueva, setNueva] = useState('');

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (!nueva.trim()) return;
    if (await hacer(() => api.crearFamilia(nueva.trim()), 'crear la familia')) setNueva('');
  }

  return (
    <section className="panel">
      <h1>Familias y niños</h1>
      <form className="fila-formulario" onSubmit={crear}>
        <Campo etiqueta="Nueva familia">
          <input type="text" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Familia García" />
        </Campo>
        <button type="submit" className="boton-principal" disabled={!nueva.trim()}>
          Agregar
        </button>
      </form>

      {datos.familias.length === 0 && <p className="vacio">Todavía no hay familias. Agrega la primera arriba.</p>}

      {datos.familias.map((f) => (
        <TarjetaFamilia key={f.id} familia={f} datos={datos} hacer={hacer} />
      ))}
    </section>
  );
}

function TarjetaFamilia({ familia, datos, hacer }: { familia: Familia; datos: Datos; hacer: Hacer }) {
  const [nino, setNino] = useState('');
  const [miembro, setMiembro] = useState('');
  const ninos = datos.ninos.filter((n) => n.familia_id === familia.id);
  const miembros = datos.miembros
    .filter((m) => m.familia_id === familia.id)
    .map((m) => datos.usuarios.find((u) => u.id === m.usuario_id))
    .filter((u): u is Perfil => !!u);
  const candidatos = datos.usuarios.filter((u) => u.rol === 'familia' && !miembros.some((m) => m.id === u.id));

  async function agregarNino(e: FormEvent) {
    e.preventDefault();
    if (!nino.trim()) return;
    if (await hacer(() => api.crearNino(nino.trim(), familia.id), 'agregar al niño')) setNino('');
  }

  return (
    <article className="tarjeta">
      <header className="tarjeta-encabezado">
        <h2>{familia.nombre}</h2>
        <BotonConfirmar
          texto="Borrar familia"
          confirmar="Se borra todo su historial. ¿Seguro? Toca otra vez"
          etiqueta={`Borrar ${familia.nombre}`}
          onConfirmar={() => hacer(() => api.quitarFamilia(familia.id), 'borrar la familia')}
        />
      </header>

      <h3>Niños</h3>
      {ninos.length === 0 && <p className="nota">Sin niños todavía.</p>}
      <ul className="lista">
        {ninos.map((n) => (
          <li key={n.id}>
            <span>
              {n.nombre}
              {!n.activo && <span className="etiqueta-estado">De baja</span>}
            </span>
            <button
              type="button"
              className="boton-chico"
              onClick={() => hacer(() => api.cambiarNino(n.id, { activo: !n.activo }), 'cambiar al niño')}
            >
              {n.activo ? 'Dar de baja' : 'Reactivar'}
            </button>
          </li>
        ))}
      </ul>
      <form className="fila-formulario" onSubmit={agregarNino}>
        <Campo etiqueta="Agregar niño o niña">
          <input type="text" value={nino} onChange={(e) => setNino(e.target.value)} placeholder="Nombre" />
        </Campo>
        <button type="submit" className="boton-secundario" disabled={!nino.trim()}>
          Agregar
        </button>
      </form>

      <h3>Quiénes ven la bitácora</h3>
      {miembros.length === 0 && <p className="nota">Nadie todavía. Invita a mamá, papá o tutores en Personas.</p>}
      <ul className="lista">
        {miembros.map((u) => (
          <li key={u.id}>
            <span>
              {u.nombre} <span className="nota">{u.correo}</span>
            </span>
            <BotonConfirmar
              texto="Quitar"
              confirmar="¿Quitar acceso? Toca otra vez"
              etiqueta={`Quitar a ${u.nombre} de ${familia.nombre}`}
              onConfirmar={() => hacer(() => api.quitarMiembro(u.id, familia.id), 'quitar el acceso')}
            />
          </li>
        ))}
      </ul>
      {candidatos.length > 0 && (
        <div className="fila-formulario">
          <Campo etiqueta="Agregar persona ya invitada">
            <select value={miembro} onChange={(e) => setMiembro(e.target.value)}>
              <option value="">Elige…</option>
              {candidatos.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.correo})
                </option>
              ))}
            </select>
          </Campo>
          <button
            type="button"
            className="boton-secundario"
            disabled={!miembro}
            onClick={async () => {
              if (await hacer(() => api.agregarMiembro(miembro, familia.id), 'agregar a la familia')) setMiembro('');
            }}
          >
            Agregar
          </button>
        </div>
      )}
    </article>
  );
}

function Personas({ datos, hacer, yo }: { datos: Datos; hacer: Hacer; yo: string }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState<Rol>('familia');
  const [familiaId, setFamiliaId] = useState('');
  const [entrega, setEntrega] = useState<'correo' | 'enlace'>('correo');
  const [resultado, setResultado] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function invitar(e: FormEvent) {
    e.preventDefault();
    setResultado(null);
    if (!nombre.trim()) return setErrorForm('Escribe el nombre.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return setErrorForm('Escribe un correo válido.');
    if (rol === 'familia' && !familiaId) return setErrorForm('Elige a qué familia pertenece.');
    setErrorForm(null);
    setEnviando(true);
    let enlace: string | null = null;
    const ok = await hacer(async () => {
      enlace = await api.invitar({
        nombre: nombre.trim(),
        correo: correo.trim(),
        rol,
        familia_id: rol === 'familia' ? familiaId : null,
        entrega,
      });
    }, 'enviar la invitación');
    setEnviando(false);
    if (ok) {
      setResultado(
        enlace
          ? `Listo. Manda este enlace a ${nombre.trim()} por WhatsApp o mensaje: ${enlace}`
          : `Listo. Le llegará un correo a ${correo.trim()} para entrar.`,
      );
      setNombre('');
      setCorreo('');
    }
  }

  return (
    <section className="panel">
      <h1>Personas</h1>
      <article className="tarjeta">
        <h2>Invitar</h2>
        <form onSubmit={invitar} noValidate>
          <Campo etiqueta="Nombre">
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />
          </Campo>
          <Campo etiqueta="Correo">
            <input type="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="off" />
          </Campo>
          <Campo etiqueta="Rol">
            <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              <option value="familia">Familia (mamá, papá o tutor)</option>
              <option value="ninera">Niñera</option>
              <option value="admin">Administradora</option>
            </select>
          </Campo>
          {rol === 'familia' && (
            <Campo etiqueta="Familia">
              <select value={familiaId} onChange={(e) => setFamiliaId(e.target.value)}>
                <option value="">Elige…</option>
                {datos.familias.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo etiqueta="¿Cómo se la mandamos?">
            <select value={entrega} onChange={(e) => setEntrega(e.target.value as 'correo' | 'enlace')}>
              <option value="correo">Por correo</option>
              <option value="enlace">Copiar un enlace (para WhatsApp)</option>
            </select>
          </Campo>
          <Aviso texto={errorForm} />
          {resultado && (
            <p className="exito" role="status">
              {resultado}
            </p>
          )}
          <button type="submit" className="boton-principal ancho" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Invitar'}
          </button>
        </form>
      </article>

      <ul className="lista tarjeta">
        {datos.usuarios.map((u) => (
          <li key={u.id}>
            <span>
              <strong>{u.nombre}</strong> · {NOMBRE_ROL[u.rol]}
              <br />
              <span className="nota">{u.correo}</span>
              {!u.activo && <span className="etiqueta-estado">Sin acceso</span>}
            </span>
            {u.id !== yo && (
              <button
                type="button"
                className="boton-chico"
                onClick={() => hacer(() => api.cambiarUsuario(u.id, { activo: !u.activo }), 'cambiar el acceso')}
              >
                {u.activo ? 'Quitar acceso' : 'Devolver acceso'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Asignaciones({ datos, hacer }: { datos: Datos; hacer: Hacer }) {
  const [ninera, setNinera] = useState('');
  const [nino, setNino] = useState('');
  const nineras = datos.usuarios.filter((u) => u.rol === 'ninera');
  const nombreNino = (id: string) => datos.ninos.find((n) => n.id === id)?.nombre ?? 'Niño';
  const nombreFamilia = (ninoId: string) => {
    const n = datos.ninos.find((x) => x.id === ninoId);
    return datos.familias.find((f) => f.id === n?.familia_id)?.nombre ?? '';
  };

  async function asignar(e: FormEvent) {
    e.preventDefault();
    if (!ninera || !nino) return;
    if (await hacer(() => api.asignar(nino, ninera), 'asignar')) setNino('');
  }

  return (
    <section className="panel">
      <h1>Asignaciones</h1>
      <p className="nota">Una niñera solo ve y registra a los niños que tiene asignados.</p>
      <form className="tarjeta" onSubmit={asignar}>
        <Campo etiqueta="Niñera">
          <select value={ninera} onChange={(e) => setNinera(e.target.value)}>
            <option value="">Elige…</option>
            {nineras.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Niño o niña">
          <select value={nino} onChange={(e) => setNino(e.target.value)}>
            <option value="">Elige…</option>
            {datos.ninos
              .filter((n) => n.activo)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nombre} · {nombreFamilia(n.id)}
                </option>
              ))}
          </select>
        </Campo>
        <button type="submit" className="boton-principal ancho" disabled={!ninera || !nino}>
          Asignar
        </button>
      </form>

      {nineras.length === 0 && <p className="vacio">Todavía no hay niñeras. Invítalas en Personas.</p>}
      {nineras.map((u) => {
        const suyas = datos.asignaciones.filter((a) => a.ninera_id === u.id);
        return (
          <article key={u.id} className="tarjeta">
            <h2>{u.nombre}</h2>
            {suyas.length === 0 && <p className="nota">Sin niños asignados.</p>}
            <ul className="lista">
              {suyas.map((a) => (
                <li key={a.nino_id}>
                  <span>
                    {nombreNino(a.nino_id)} <span className="nota">{nombreFamilia(a.nino_id)}</span>
                    {!a.activo && <span className="etiqueta-estado">Pausada</span>}
                  </span>
                  <span className="acciones">
                    <button
                      type="button"
                      className="boton-chico"
                      onClick={() => hacer(() => api.cambiarAsignacion(a.nino_id, a.ninera_id, !a.activo), 'cambiar la asignación')}
                    >
                      {a.activo ? 'Pausar' : 'Reanudar'}
                    </button>
                    <BotonConfirmar
                      texto="Quitar"
                      confirmar="¿Quitar? Toca otra vez"
                      etiqueta={`Quitar a ${nombreNino(a.nino_id)} de ${u.nombre}`}
                      onConfirmar={() => hacer(() => api.quitarAsignacion(a.nino_id, a.ninera_id), 'quitar la asignación')}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
