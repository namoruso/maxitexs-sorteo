import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminEstadoResponse, ParticipanteAdmin, RealtimeEvent } from '@maxitexs/shared';
import { api } from '../../api/client';
import { useEventStream } from '../../hooks/useEventStream';
import { Icon } from '../../lib/icons';

export default function AdminPage() {
  const nav = useNavigate();
  const [state, setState] = useState<AdminEstadoResponse | null>(null);
  const [q, setQ] = useState('');
  const [toast, setToast] = useState('');
  const [flashId, setFlashId] = useState<number | null>(null);
  const [modal, setModal] = useState<'preparar' | 'lanzar' | 'manual' | 'reiniciar' | null>(null);
  const [manualQ, setManualQ] = useState('');
  const [manualId, setManualId] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const load = useCallback(async () => {
    const r = await api<AdminEstadoResponse>('/api/admin/estado');
    if (r.status === 401) {
      nav(`/admin/login?next=${encodeURIComponent('/admin')}`, { replace: true });
      return;
    }
    if (r.ok) setState(r.data);
  }, [nav]);

  useEffect(() => {
    void load();
  }, [load]);

  useEventStream('/api/admin/stream', (ev: RealtimeEvent) => {
    if (ev.type === 'participante.creado') {
      setState((prev) => {
        if (!prev) return prev;
        const exists = prev.participantes.some((p) => p.id === ev.participante.id);
        const participantes = exists
          ? prev.participantes
          : [ev.participante, ...prev.participantes];
        return { ...prev, total: ev.total, participantes };
      });
      setFlashId(ev.participante.id);
      showToast(`Nuevo registro · Ticket #${ev.participante.ticket}`);
      setTimeout(() => setFlashId(null), 2500);
    } else if (
      ev.type === 'sorteo.lanzado' ||
      ev.type === 'sorteo.entregado' ||
      ev.type === 'sorteo.ausente' ||
      ev.type === 'sorteo.revelado' ||
      ev.type === 'totem.estado' ||
      ev.type === 'jornada.reiniciada'
    ) {
      void load();
    }
  });

  const rows = useMemo(() => {
    if (!state) return [];
    const qq = q.toLowerCase().trim();
    let list: ParticipanteAdmin[] = state.participantes;
    if (qq) {
      list = list.filter((p) =>
        [p.nombre, p.cedula, p.laboratorio, p.cargo, p.telefono, p.correo, p.ticket]
          .join(' ')
          .toLowerCase()
          .includes(qq),
      );
    }
    const g = state.ganador;
    if (g) list = [...list].sort((a, b) => Number(b.ticket === g.ticket) - Number(a.ticket === g.ticket));
    return list;
  }, [state, q]);

  async function preparar() {
    setModal(null);
    const r = await api<{ mensaje?: string }>('/api/admin/sorteo/preparar', { method: 'POST' });
    if (!r.ok) return showToast(r.data.mensaje || 'No se pudo preparar el sorteo.');
    showToast('Tótem en pantalla de sorteo');
    void load();
  }

  async function lanzar(participanteId?: number) {
    setModal(null);
    setManualId(null);
    setManualQ('');
    const r = await api<{ mensaje?: string }>('/api/admin/sorteo', {
      method: 'POST',
      body: participanteId != null ? { participante_id: participanteId } : {},
    });
    if (!r.ok) return showToast(r.data.mensaje || 'No se pudo lanzar el sorteo.');
    showToast(
      participanteId != null
        ? 'Ganador manual lanzado — el tótem está girando'
        : 'Sorteo lanzado — el tótem está girando',
    );
    void load();
  }

  const elegibles = useMemo(() => {
    if (!state) return [];
    const qq = manualQ.toLowerCase().trim();
    return state.participantes.filter((p) => {
      if (!p.elegible) return false;
      if (!qq) return true;
      return [p.nombre, p.cedula, p.laboratorio, p.ticket, p.telefono]
        .join(' ')
        .toLowerCase()
        .includes(qq);
    });
  }, [state, manualQ]);

  async function entrega() {
    if (!state?.ganador) return;
    const r = await api(`/api/admin/sorteo/${state.ganador.sorteo_id}/entrega`, { method: 'POST' });
    if (r.ok) {
      showToast('Entrega confirmada');
      void load();
    } else showToast('No se pudo confirmar la entrega.');
  }

  async function ausente() {
    if (!state?.ganador) return;
    const r = await api<{ mensaje?: string }>(`/api/admin/sorteo/${state.ganador.sorteo_id}/ausente`, {
      method: 'POST',
    });
    if (!r.ok) return showToast(r.data.mensaje || 'No se pudo preparar el nuevo sorteo.');
    showToast('Ausente marcado · tótem listo para lanzar de nuevo');
    void load();
  }

  async function captacion() {
    const r = await api('/api/admin/totem/captacion', { method: 'POST' });
    if (r.ok) {
      showToast('Tótem en captación (QR)');
      void load();
    }
  }

  async function reiniciar() {
    setModal(null);
    const r = await api('/api/admin/reiniciar', { method: 'POST' });
    if (r.ok) {
      showToast('Nueva jornada iniciada');
      void load();
    } else showToast('No se pudo reiniciar.');
  }

  if (!state) {
    return <div style={{ padding: 48, textAlign: 'center' }}>Cargando panel…</div>;
  }

  const g = state.ganador;
  const after = Boolean(g);
  const te = state.totem_estado;
  const spinning = te === 'sorteo';
  const ready = te === 'preparacion';

  return (
    <div className="ch ch-screen ch-admin">
      <header className="ch-admin-bar">
        <span className="ch-logo">
          <img src="/assets/isotipo.png" alt="Corporación Maxitex’s" style={{ height: 44, width: 'auto' }} />
        </span>
        <span className="sep" />
        <div className="ev">
          <b>{state.evento.nombre}</b>
          <span>Corporación Maxitex’s · {state.evento.fecha}</span>
        </div>
        <span className="sep" />
        <span className={`ch-status ${state.totem_en_linea ? 'ch-status--on' : 'ch-status--off'}`} role="status">
          <i aria-hidden="true" />
          <span>{state.totem_en_linea ? 'Tótem en línea' : 'Tótem sin conexión'}</span>
        </span>
        <div className="kpi">
          <b>{state.total}</b>
          <span>registrados</span>
        </div>
      </header>

      <main className="ch-admin-main">
        <section className="ch-card ch-card--secondary ch-admin-control">
          <header className="ch-card-head">
            <h3>Sorteo</h3>
            <div className="ch-card-action">
              {after && <span className="ch-badge">Sorteo #{state.sorteo_numero ?? 1} realizado</span>}
              <span className="ch-badge ch-badge--neutral">Tótem: {te}</span>
            </div>
          </header>
          <p>
            {spinning
              ? 'El tótem está girando. En unos segundos revelará al ganador.'
              : ready
                ? 'El tótem ya muestra la pantalla del sorteo (parece aleatorio). Desde aquí lanza al azar o elige el ganador; el público solo ve la animación.'
                : after
                  ? 'El tótem muestra al ganador. Confirma la entrega o marca ausente. Para otro sorteo, prepara de nuevo el tótem.'
                  : `Primero prepara el tótem (cambia a la pantalla de sorteo). Luego lanza al azar o elige un ganador entre los ${state.total} registrados.`}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {ready ? (
              <>
                <button type="button" className="ch-btn ch-btn--lg ch-btn--primary" onClick={() => setModal('lanzar')}>
                  <Icon name="play" size={22} />
                  <span>Lanzar al azar</span>
                </button>
                <button
                  type="button"
                  className="ch-btn ch-btn--lg ch-btn--outline"
                  onClick={() => {
                    setManualId(null);
                    setManualQ('');
                    setModal('manual');
                  }}
                >
                  <Icon name="search" size={22} />
                  <span>Elegir ganador</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`ch-btn ch-btn--lg ${after || spinning ? 'ch-btn--outline' : 'ch-btn--primary'}`}
                disabled={spinning}
                onClick={() => setModal('preparar')}
              >
                <Icon name="play" size={22} />
                <span>{spinning ? 'Sorteo en curso…' : after ? 'Preparar otro sorteo' : 'Ir al sorteo'}</span>
              </button>
            )}
            {te !== 'captacion' && (
              <button type="button" className="ch-btn ch-btn--lg ch-btn--outline" onClick={() => void captacion()} disabled={spinning}>
                <Icon name="refresh" size={22} />
                <span>Volver al QR</span>
              </button>
            )}
          </div>
          <div className="meta">
            <span>Participantes: <b>{state.total}</b></span>
            <span>Laboratorios: <b>{state.laboratorios}</b></span>
            <span>Último sorteo: <b>{g?.hora ?? '—'}</b></span>
          </div>
        </section>

        <section className="ch-card ch-admin-win" aria-live="polite">
          <header className="ch-card-head">
            <h3>Ganador actual</h3>
            <div className="ch-card-action">
              {g &&
                (state.entregado ? (
                  <span className="ch-badge ch-badge--success">
                    <Icon name="check" size={16} stroke={3} />
                    Entregado
                  </span>
                ) : (
                  <span className="ch-badge ch-badge--neutral">Pendiente de entrega</span>
                ))}
            </div>
          </header>
          {!g ? (
            <div className="ch-admin-empty">
              <div>
                <b style={{ display: 'block', color: 'var(--ink)', fontSize: 18, marginBottom: 4 }}>
                  Aún no hay ganador
                </b>
                Lanza el sorteo para verlo aquí con sus datos completos.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p className="nm">{g.nombre}</p>
              <dl>
                <div><dt>Cédula</dt><dd>{g.cedula}</dd></div>
                <div><dt>Teléfono</dt><dd>{g.telefono}</dd></div>
                <div><dt>Laboratorio</dt><dd>{g.laboratorio}</dd></div>
                <div><dt>Cargo</dt><dd>{g.cargo}</dd></div>
                <div className="wide"><dt>Correo</dt><dd>{g.correo}</dd></div>
                <div><dt>Ticket · Registro</dt><dd>#{g.ticket} · {g.registrado}</dd></div>
              </dl>
              <div className="acts">
                <button type="button" className="ch-btn ch-btn--md ch-btn--primary" disabled={state.entregado} onClick={() => void entrega()}>
                  <Icon name="check" size={22} />
                  <span>{state.entregado ? 'Entregado' : 'Confirmar entrega'}</span>
                </button>
                <button type="button" className="ch-btn ch-btn--md ch-btn--warning" onClick={() => void ausente()} disabled={spinning}>
                  <Icon name="refresh" size={22} />
                  <span>Ausente / Preparar</span>
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="ch-card ch-admin-table">
          <header className="ch-card-head">
            <h3>Profesionales registrados</h3>
            <div className="ch-card-action">
              <label className="ch-field ch-field--sm">
                <div className="ch-input ch-input--icon">
                  <Icon name="search" size={22} />
                  <input
                    type="search"
                    placeholder="Buscar…"
                    aria-label="Buscar participantes"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </label>
            </div>
          </header>
          <div className="ch-table-wrap">
            <table className="ch-table ch-admin-people-table">
              <thead>
                <tr>
                  <th>Nombre y apellido</th>
                  <th>Cédula</th>
                  <th>Laboratorio · Cargo</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Ticket</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="ch-table-empty">
                      Ningún participante coincide con la búsqueda
                    </td>
                  </tr>
                ) : (
                  rows.map((p) => {
                    const win = Boolean(g && p.ticket === g.ticket);
                    return (
                      <tr key={p.id} className={`${win ? 'is-hl' : ''} ${flashId === p.id ? 'is-flash' : ''}`}>
                        <td className="ch-admin-col-name">
                          <span className="ch-admin-name-cell">
                            <span className="ch-admin-name-text">{p.nombre}</span>
                            {win && <span className="ch-badge">Ganador</span>}
                          </span>
                        </td>
                        <td className="ch-mono ch-admin-col-cedula">{p.cedula}</td>
                        <td>
                          <span className="ch-cell2">
                            <b>{p.laboratorio}</b>
                            <small>{p.cargo}</small>
                          </span>
                        </td>
                        <td className="ch-mono ch-admin-col-phone">{p.telefono}</td>
                        <td className="ch-admin-col-mail">{p.correo}</td>
                        <td className="ch-mono ch-admin-col-ticket">#{p.ticket}</td>
                        <td className="ch-mono ch-admin-col-hora">{p.hora}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="ch-admin-people-cards" aria-label="Lista de participantes">
            {rows.length === 0 ? (
              <div className="ch-admin-people-empty">Ningún participante coincide con la búsqueda</div>
            ) : (
              rows.map((p) => {
                const win = Boolean(g && p.ticket === g.ticket);
                return (
                  <article
                    key={p.id}
                    className={`ch-admin-person ${win ? 'is-hl' : ''} ${flashId === p.id ? 'is-flash' : ''}`}
                  >
                    <div className="name">
                      {p.nombre}
                      {win && <span className="ch-badge">Ganador</span>}
                      <span className="ticket">#{p.ticket}</span>
                    </div>
                    <div className="meta-row">
                      <span>
                        Cédula <b className="ch-mono">{p.cedula}</b>
                      </span>
                      <span>
                        Tel. <b className="ch-mono">{p.telefono}</b>
                      </span>
                      <span>{p.hora}</span>
                    </div>
                    <div className="meta-row">
                      <span>
                        <b>{p.laboratorio}</b> · {p.cargo}
                      </span>
                    </div>
                    <div className="meta-row">
                      <span>{p.correo}</span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>

      <footer className="ch-admin-foot">
        <span className="info">
          <Icon name="info" size={20} />
          <span>Un registro por cédula y teléfono · Reinicio abre una jornada nueva (00:00 Caracas)</span>
        </span>
        <div className="ch-admin-foot-actions">
          <a className="ch-btn ch-btn--md ch-btn--outline" href="/api/admin/exportar.csv">
            <Icon name="download" size={22} />
            <span>Exportar</span>
          </a>
          <button type="button" className="ch-btn ch-btn--md ch-btn--danger" onClick={() => setModal('reiniciar')}>
            <Icon name="trash" size={22} />
            <span>Nueva jornada</span>
          </button>
        </div>
      </footer>

      {modal === 'preparar' && (
        <Modal
          title="¿Ir a la pantalla de sorteo?"
          body="El tótem dejará el QR y mostrará la pantalla de sorteo (nombres girando). El ganador se elige después desde este panel."
          onClose={() => setModal(null)}
          okLabel="Sí, preparar tótem"
          onOk={() => void preparar()}
        />
      )}
      {modal === 'lanzar' && (
        <Modal
          title="¿Lanzar el sorteo al azar?"
          body={`Se elegirá 1 ganador al azar entre los elegibles. El tótem girará y lo revelará como si fuera totalmente aleatorio.`}
          onClose={() => setModal(null)}
          okLabel="Sí, lanzar al azar"
          onOk={() => void lanzar()}
        />
      )}
      {modal === 'manual' && (
        <div className="ch-modal-wrap" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="ch-modal ch-modal--manual" role="dialog" aria-modal="true" aria-labelledby="manual-title">
            <h2 id="manual-title">Elegir ganador manual</h2>
            <p>
              El tótem hará la misma animación de giro y revelará a esta persona. El público no ve que fue elección manual.
            </p>
            <label className="ch-field ch-field--sm" style={{ marginBottom: 12 }}>
              <div className="ch-input ch-input--icon">
                <Icon name="search" size={22} />
                <input
                  type="search"
                  placeholder="Buscar nombre, cédula, ticket…"
                  aria-label="Buscar elegible"
                  value={manualQ}
                  onChange={(e) => setManualQ(e.target.value)}
                  autoFocus
                />
              </div>
            </label>
            <div className="ch-admin-manual-list" role="listbox" aria-label="Participantes elegibles">
              {elegibles.length === 0 ? (
                <div className="ch-admin-people-empty">No hay elegibles que coincidan</div>
              ) : (
                elegibles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={manualId === p.id}
                    className={`ch-admin-manual-item ${manualId === p.id ? 'is-selected' : ''}`}
                    onClick={() => setManualId(p.id)}
                  >
                    <span className="nm">{p.nombre}</span>
                    <span className="meta">
                      #{p.ticket} · {p.cedula} · {p.laboratorio}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="ch-modal-actions">
              <button type="button" className="ch-btn ch-btn--md ch-btn--ghost" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="ch-btn ch-btn--md ch-btn--primary"
                disabled={manualId == null}
                onClick={() => manualId != null && void lanzar(manualId)}
              >
                Lanzar con animación
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'reiniciar' && (
        <Modal
          title="¿Iniciar una nueva jornada?"
          body="Se cierra la jornada actual (los datos quedan guardados) y se abre una nueva. El tótem vuelve al QR."
          onClose={() => setModal(null)}
          okLabel="Sí, nueva jornada"
          danger
          onOk={() => void reiniciar()}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <style>{`
        .ch-table tbody tr.is-flash td { animation: flashrow 2.4s ease; }
        @keyframes flashrow {
          0% { background: var(--primary-soft); }
          100% { background: transparent; }
        }
      `}</style>
    </div>
  );
}

function Modal({
  title,
  body,
  onClose,
  onOk,
  okLabel,
  danger,
}: {
  title: string;
  body: string;
  onClose: () => void;
  onOk: () => void;
  okLabel: string;
  danger?: boolean;
}) {
  return (
    <div className="ch-modal-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ch-modal" role="dialog" aria-modal="true">
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="ch-modal-actions">
          <button type="button" className="ch-btn ch-btn--md ch-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={`ch-btn ch-btn--md ${danger ? 'ch-btn--danger-solid' : 'ch-btn--primary'}`}
            onClick={onOk}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
