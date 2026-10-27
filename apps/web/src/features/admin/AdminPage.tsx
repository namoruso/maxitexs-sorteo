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
  const [modal, setModal] = useState<'lanzar' | 'reiniciar' | null>(null);

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

  async function lanzar() {
    setModal(null);
    const r = await api<{ mensaje?: string }>('/api/admin/sorteo', { method: 'POST' });
    if (!r.ok) return showToast(r.data.mensaje || 'No se pudo lanzar el sorteo.');
    showToast('Sorteo lanzado');
    void load();
  }

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
    if (!r.ok) return showToast(r.data.mensaje || 'No se pudo relanzar.');
    showToast('Nuevo sorteo lanzado');
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
              <span className="ch-badge ch-badge--neutral">Tótem: {state.totem_estado}</span>
            </div>
          </header>
          <p>
            {after
              ? 'El tótem muestra al ganador. Confirma la entrega o relanza si no se presenta. También puedes volver al QR.'
              : `Elige un ganador al azar entre los ${state.total} profesionales registrados. El tótem mostrará la animación.`}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`ch-btn ch-btn--lg ${after ? 'ch-btn--outline' : 'ch-btn--primary'}`}
              onClick={() => setModal('lanzar')}
            >
              <Icon name="play" size={22} />
              <span>{after ? 'Lanzar otro sorteo' : 'Lanzar sorteo'}</span>
            </button>
            {state.totem_estado !== 'captacion' && (
              <button type="button" className="ch-btn ch-btn--lg ch-btn--outline" onClick={() => void captacion()}>
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
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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
                <button type="button" className="ch-btn ch-btn--md ch-btn--warning" onClick={() => void ausente()}>
                  <Icon name="refresh" size={22} />
                  <span>Ausente / Relanzar</span>
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
                    placeholder="Buscar nombre, cédula, laboratorio o ticket"
                    aria-label="Buscar participantes"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </label>
            </div>
          </header>
          <div className="ch-table-wrap">
            <table className="ch-table">
              <thead>
                <tr>
                  <th style={{ width: '19%' }}>Nombre y apellido</th>
                  <th style={{ width: '11%' }}>Cédula</th>
                  <th style={{ width: '23%' }}>Laboratorio · Cargo</th>
                  <th style={{ width: '12%' }}>Teléfono</th>
                  <th style={{ width: '22%' }}>Correo</th>
                  <th style={{ width: '7%' }}>Ticket</th>
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
                        <td>
                          <span className="ch-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                            {p.nombre}
                            {win && <span className="ch-badge">Ganador</span>}
                          </span>
                        </td>
                        <td className="ch-mono">{p.cedula}</td>
                        <td>
                          <span className="ch-cell2">
                            <b>{p.laboratorio}</b>
                            <small>{p.cargo}</small>
                          </span>
                        </td>
                        <td className="ch-mono">{p.telefono}</td>
                        <td>{p.correo}</td>
                        <td className="ch-mono">#{p.ticket}</td>
                        <td className="ch-mono">{p.hora}</td>
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
          Un registro por cédula y teléfono · Reinicio abre una jornada nueva (00:00 Caracas)
        </span>
        <a className="ch-btn ch-btn--md ch-btn--outline" href="/api/admin/exportar.csv">
          <Icon name="download" size={22} />
          <span>Exportar CSV/Excel</span>
        </a>
        <button type="button" className="ch-btn ch-btn--md ch-btn--danger" onClick={() => setModal('reiniciar')}>
          <Icon name="trash" size={22} />
          <span>Nueva jornada</span>
        </button>
      </footer>

      {modal === 'lanzar' && (
        <Modal
          title="¿Lanzar el sorteo ahora?"
          body={`Se elegirá 1 ganador al azar entre ${state.total} participantes y el tótem mostrará la animación.`}
          onClose={() => setModal(null)}
          okLabel="Sí, lanzar sorteo"
          onOk={() => void lanzar()}
        />
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
