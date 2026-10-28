import { randomInt } from 'node:crypto';
import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import {
  formatCedula,
  formatPhone,
  formatTicket,
  maskCedula,
  maskName,
  normalizeLaboratorioKey,
  type AdminEstadoResponse,
  type EventoPublico,
  type GanadorAdmin,
  type ParticipanteAdmin,
  type RegistroInput,
  type RegistroResponse,
  type SorteoResponse,
  type TotemEstado,
  type TotemEstadoResponse,
  type TotemGanadorPublico,
  type VerificarResponse,
} from '@maxitexs/shared';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import {
  jornadas,
  participantes,
  sorteos,
  totemEstado,
  type Participante,
} from '../../db/schema.js';
import { AppError, mapPgUnique } from '../../lib/errors.js';
import { publish } from '../../realtime/bus.js';

function formatHora(d: Date): string {
  return d.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: env.TZ,
  });
}

function toAdmin(p: Participante, elegible = true): ParticipanteAdmin {
  return {
    id: p.id,
    nombre: p.nombre,
    cedula: formatCedula(p.cedulaTipo, p.cedulaNumero),
    telefono: formatPhone(p.telefono),
    correo: p.correo,
    laboratorio: p.laboratorio,
    cargo: p.cargo,
    ticket: formatTicket(p.ticket),
    hora: formatHora(p.creadoAt),
    elegible,
  };
}

function toGanadorAdmin(
  s: { id: number; creadoAt: Date },
  p: Participante,
): GanadorAdmin {
  return {
    ...toAdmin(p),
    sorteo_id: s.id,
    registrado: formatHora(p.creadoAt),
    hora: formatHora(s.creadoAt),
  };
}

function toTotemGanador(p: Participante): TotemGanadorPublico {
  return {
    nombre_mask: maskName(p.nombre),
    laboratorio: p.laboratorio,
    cedula_mask: maskCedula(p.cedulaNumero),
    ticket: formatTicket(p.ticket),
  };
}

async function activeJornadaId(): Promise<number> {
  const j = await db.query.jornadas.findFirst({
    where: isNull(jornadas.cerradaAt),
    orderBy: [desc(jornadas.id)],
  });
  if (!j) throw new AppError('INVALID_STATE', 'No hay jornada activa', 500);
  return j.id;
}

/** Effective totem state — auto-reveals when revelarAt passed. */
async function resolveTotemEstado(): Promise<{
  estado: TotemEstado;
  sorteoId: number | null;
  revelarAt: Date | null;
}> {
  const row = await db.query.totemEstado.findFirst({ where: eq(totemEstado.id, 1) });
  if (!row) {
    await db.insert(totemEstado).values({ id: 1, estado: 'captacion' });
    return { estado: 'captacion', sorteoId: null, revelarAt: null };
  }

  let estado = row.estado as TotemEstado;
  if (estado === 'sorteo' && row.revelarAt && row.revelarAt.getTime() <= Date.now()) {
    estado = 'ganador';
    await db
      .update(totemEstado)
      .set({ estado: 'ganador', updatedAt: new Date() })
      .where(eq(totemEstado.id, 1));
    if (row.sorteoId) {
      const s = await db.query.sorteos.findFirst({ where: eq(sorteos.id, row.sorteoId) });
      const p = s
        ? await db.query.participantes.findFirst({ where: eq(participantes.id, s.participanteId) })
        : null;
      if (p) {
        await publish({
          type: 'sorteo.revelado',
          sorteo_id: row.sorteoId,
          ganador: toTotemGanador(p),
        });
        await publish({
          type: 'totem.estado',
          estado: 'ganador',
          sorteo_id: row.sorteoId,
          total: (
            await db
              .select({ n: sql<number>`count(*)::int` })
              .from(participantes)
              .where(eq(participantes.jornadaId, p.jornadaId))
          )[0]?.n ?? 0,
        });
      }
    }
  }

  return { estado, sorteoId: row.sorteoId ?? null, revelarAt: row.revelarAt };
}

let lastTotemPollAt = 0;

export function touchTotem(): void {
  lastTotemPollAt = Date.now();
}

export function totemEnLinea(): boolean {
  return lastTotemPollAt > 0 && Date.now() - lastTotemPollAt < env.TOTEM_ONLINE_MS;
}

export function getEvento(): EventoPublico {
  return { nombre: env.EVENT_NAME, premio: env.PREMIO };
}

export async function verificar(
  numero: string,
  telefono?: string,
): Promise<VerificarResponse> {
  const jornadaId = await activeJornadaId();
  const byCedula = await db.query.participantes.findFirst({
    where: and(eq(participantes.jornadaId, jornadaId), eq(participantes.cedulaNumero, numero)),
  });
  let telDup = false;
  if (telefono) {
    const byTel = await db.query.participantes.findFirst({
      where: and(eq(participantes.jornadaId, jornadaId), eq(participantes.telefono, telefono)),
    });
    telDup = Boolean(byTel);
  }
  return { cedula: Boolean(byCedula), telefono: telDup };
}

export async function registrar(data: RegistroInput): Promise<RegistroResponse> {
  const jornadaId = await activeJornadaId();

  try {
    const result = await db.transaction(async (tx) => {
      // Lock jornada row so ticket numbers stay contiguous under concurrency
      await tx.execute(sql`SELECT id FROM jornadas WHERE id = ${jornadaId} FOR UPDATE`);

      const maxTicketRows = await tx
        .select({ max: sql<number>`coalesce(max(${participantes.ticket}), 0)` })
        .from(participantes)
        .where(eq(participantes.jornadaId, jornadaId));

      const ticket = Number(maxTicketRows[0]?.max ?? 0) + 1;
      const now = new Date();

      const [row] = await tx
        .insert(participantes)
        .values({
          jornadaId,
          ticket,
          nombre: data.nombre,
          cedulaTipo: data.tipo,
          cedulaNumero: data.numero,
          telefono: data.telefono,
          correo: data.correo,
          laboratorio: data.laboratorio,
          laboratorioKey: normalizeLaboratorioKey(data.laboratorio),
          cargo: data.cargo,
          consentimientoAt: now,
          creadoAt: now,
        })
        .returning();

      return row!;
    });

    const admin = toAdmin(result);
    const totalRows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(participantes)
      .where(eq(participantes.jornadaId, jornadaId));
    const total = totalRows[0]?.n ?? 0;

    await publish({ type: 'participante.creado', participante: admin, total });
    await publish({ type: 'totem.contador', total });

    return {
      ticket: formatTicket(result.ticket),
      nombre: result.nombre,
      laboratorio: result.laboratorio,
    };
  } catch (e) {
    const mapped = mapPgUnique(e);
    if (mapped) throw mapped;
    throw e;
  }
}

export async function getTotemEstado(requestBaseUrl?: string): Promise<TotemEstadoResponse> {
  touchTotem();
  const jornadaId = await activeJornadaId();
  const resolved = await resolveTotemEstado();

  const totalRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(participantes)
    .where(eq(participantes.jornadaId, jornadaId));
  const total = totalRows[0]?.n ?? 0;

  const names = await db
    .select({ nombre: participantes.nombre })
    .from(participantes)
    .where(eq(participantes.jornadaId, jornadaId))
    .orderBy(desc(participantes.id))
    .limit(40);

  let ganador: TotemGanadorPublico | null = null;
  if ((resolved.estado === 'sorteo' || resolved.estado === 'ganador') && resolved.sorteoId) {
    const s = await db.query.sorteos.findFirst({ where: eq(sorteos.id, resolved.sorteoId) });
    if (s) {
      const p = await db.query.participantes.findFirst({
        where: eq(participantes.id, s.participanteId),
      });
      if (p) ganador = toTotemGanador(p);
    }
  }

  const base =
    requestBaseUrl && !/localhost|127\.0\.0\.1/.test(requestBaseUrl)
      ? requestBaseUrl.replace(/\/$/, '')
      : env.publicUrl;

  return {
    estado: resolved.estado,
    total,
    premio: env.PREMIO,
    url_registro: `${base}/registro`,
    sorteo_id: resolved.sorteoId,
    nombres: names.map((r) => maskName(r.nombre)),
    ganador,
  };
}

export async function getAdminEstado(): Promise<AdminEstadoResponse> {
  const jornadaId = await activeJornadaId();
  const resolved = await resolveTotemEstado();

  const people = await db.query.participantes.findMany({
    where: eq(participantes.jornadaId, jornadaId),
    orderBy: [desc(participantes.creadoAt), desc(participantes.id)],
  });

  const wonRows = await db
    .select({ participanteId: sorteos.participanteId })
    .from(sorteos)
    .where(
      and(eq(sorteos.jornadaId, jornadaId), inArray(sorteos.estado, ['sorteado', 'entregado'])),
    );
  const wonIds = new Set(wonRows.map((w) => w.participanteId));

  const labRows = await db
    .select({ n: sql<number>`count(distinct ${participantes.laboratorioKey})::int` })
    .from(participantes)
    .where(eq(participantes.jornadaId, jornadaId));
  const labs = labRows[0]?.n ?? 0;

  let ganador: GanadorAdmin | null = null;
  let sorteoNumero: number | null = null;
  let entregado = false;

  const latest = await db.query.sorteos.findFirst({
    where: and(
      eq(sorteos.jornadaId, jornadaId),
      inArray(sorteos.estado, ['sorteado', 'entregado']),
    ),
    orderBy: [desc(sorteos.id)],
  });

  if (latest) {
    const p = await db.query.participantes.findFirst({
      where: eq(participantes.id, latest.participanteId),
    });
    if (p) {
      ganador = toGanadorAdmin(latest, p);
      sorteoNumero = latest.numero;
      entregado = latest.estado === 'entregado';
    }
  }

  return {
    evento: { nombre: env.EVENT_NAME, fecha: env.eventDate },
    total: people.length,
    laboratorios: labs,
    totem_en_linea: totemEnLinea(),
    participantes: people.map((p) => toAdmin(p, !wonIds.has(p.id))),
    ganador,
    sorteo_numero: sorteoNumero,
    entregado,
    totem_estado: resolved.estado,
  };
}

/** Step 1: move totem to preparation screen (no winner yet). */
export async function prepararSorteo(): Promise<{ ok: true; total: number }> {
  const jornadaId = await activeJornadaId();
  const resolved = await resolveTotemEstado();

  if (resolved.estado === 'sorteo') {
    throw new AppError(
      'INVALID_STATE',
      'Hay un sorteo en curso. Espera a que termine la animación.',
      409,
    );
  }

  const totalRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(participantes)
    .where(eq(participantes.jornadaId, jornadaId));
  const total = totalRows[0]?.n ?? 0;

  if (total < 1) {
    throw new AppError('NO_ELIGIBLE', 'No hay participantes registrados para el sorteo.', 422);
  }

  // Eligible pool (exclude already sorteado/entregado)
  const winners = await db
    .select({ participanteId: sorteos.participanteId })
    .from(sorteos)
    .where(
      and(eq(sorteos.jornadaId, jornadaId), inArray(sorteos.estado, ['sorteado', 'entregado'])),
    );
  const excludeIds = winners.map((w) => w.participanteId);
  const pool = await db
    .select({ id: participantes.id })
    .from(participantes)
    .where(
      excludeIds.length
        ? and(eq(participantes.jornadaId, jornadaId), notInArray(participantes.id, excludeIds))
        : eq(participantes.jornadaId, jornadaId),
    );
  if (pool.length === 0) {
    throw new AppError('NO_ELIGIBLE', 'No hay participantes elegibles para el sorteo.', 422);
  }

  if (resolved.estado === 'preparacion') {
    return { ok: true, total };
  }

  await db
    .update(totemEstado)
    .set({ estado: 'preparacion', sorteoId: null, revelarAt: null, updatedAt: new Date() })
    .where(eq(totemEstado.id, 1));

  await publish({ type: 'totem.estado', estado: 'preparacion', sorteo_id: null, total });
  return { ok: true, total };
}

/**
 * Step 2: pick winner and start totem spin (only from preparacion).
 * Pass participanteId to force a manual winner; otherwise random.
 */
export async function lanzarSorteo(participanteId?: number): Promise<SorteoResponse> {
  const jornadaId = await activeJornadaId();
  const resolved = await resolveTotemEstado();

  if (resolved.estado !== 'preparacion') {
    throw new AppError(
      'INVALID_STATE',
      'Primero prepara el sorteo para pasar el tótem a la pantalla de lanzamiento.',
      409,
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM jornadas WHERE id = ${jornadaId} FOR UPDATE`);

      const winners = await tx
        .select({ participanteId: sorteos.participanteId })
        .from(sorteos)
        .where(
          and(
            eq(sorteos.jornadaId, jornadaId),
            inArray(sorteos.estado, ['sorteado', 'entregado']),
          ),
        );

      const excludeIds = winners.map((w) => w.participanteId);
      const pool = await tx
        .select()
        .from(participantes)
        .where(
          excludeIds.length
            ? and(
                eq(participantes.jornadaId, jornadaId),
                notInArray(participantes.id, excludeIds),
              )
            : eq(participantes.jornadaId, jornadaId),
        );

      if (pool.length === 0) {
        throw new AppError(
          'NO_ELIGIBLE',
          'No hay participantes elegibles para el sorteo.',
          422,
        );
      }

      let winner = pool[randomInt(0, pool.length)]!;
      if (participanteId != null) {
        const forced = pool.find((p) => p.id === participanteId);
        if (!forced) {
          throw new AppError(
            'NO_ELIGIBLE',
            'Ese participante no es elegible (no existe o ya ganó).',
            422,
          );
        }
        winner = forced;
      }

      const maxSorteoRows = await tx
        .select({ max: sql<number>`coalesce(max(${sorteos.numero}), 0)` })
        .from(sorteos)
        .where(eq(sorteos.jornadaId, jornadaId));
      const numero = Number(maxSorteoRows[0]?.max ?? 0) + 1;

      const [sorteo] = await tx
        .insert(sorteos)
        .values({
          jornadaId,
          numero,
          participanteId: winner.id,
          estado: 'sorteado',
        })
        .returning();

      const revelarAt = new Date(Date.now() + env.SORTEO_ANIM_MS);
      await tx
        .update(totemEstado)
        .set({
          estado: 'sorteo',
          sorteoId: sorteo!.id,
          revelarAt,
          updatedAt: new Date(),
        })
        .where(eq(totemEstado.id, 1));

      return { sorteo: sorteo!, winner, numero };
    });

    const ganador = toGanadorAdmin(result.sorteo, result.winner);
    const names = (
      await db
        .select({ nombre: participantes.nombre })
        .from(participantes)
        .where(eq(participantes.jornadaId, jornadaId))
        .orderBy(desc(participantes.id))
        .limit(40)
    ).map((r) => maskName(r.nombre));

    const totalAfter = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(participantes)
      .where(eq(participantes.jornadaId, jornadaId));
    const total = totalAfter[0]?.n ?? 0;

    await publish({
      type: 'sorteo.lanzado',
      sorteo_id: result.sorteo.id,
      sorteo_numero: result.numero,
      ganador,
      nombres: names,
    });
    await publish({
      type: 'totem.estado',
      estado: 'sorteo',
      sorteo_id: result.sorteo.id,
      total,
    });

    return { sorteo_numero: result.numero, ganador };
  } catch (e) {
    if (e instanceof AppError) throw e;
    const pg = e as { code?: string; constraint?: string };
    if (pg.code === '23505' && String(pg.constraint).includes('pendiente')) {
      throw new AppError(
        'INVALID_STATE',
        'Ya hay un sorteo en curso. Confirma entrega o marca ausente primero.',
        409,
      );
    }
    throw e;
  }
}

export async function confirmarEntrega(sorteoId: number): Promise<{ ok: true }> {
  const s = await db.query.sorteos.findFirst({ where: eq(sorteos.id, sorteoId) });
  if (!s) throw new AppError('NOT_FOUND', 'Sorteo no encontrado', 404);
  if (s.estado !== 'sorteado') {
    throw new AppError('INVALID_STATE', 'El sorteo no está pendiente de entrega', 409);
  }
  await db.update(sorteos).set({ estado: 'entregado' }).where(eq(sorteos.id, sorteoId));
  await publish({ type: 'sorteo.entregado', sorteo_id: sorteoId });
  return { ok: true };
}

/** Mark winner absent and return totem to preparation so staff can launch again. */
export async function marcarAusenteYRelanzar(
  sorteoId: number,
): Promise<{ ok: true; total: number }> {
  const s = await db.query.sorteos.findFirst({ where: eq(sorteos.id, sorteoId) });
  if (!s) throw new AppError('NOT_FOUND', 'Sorteo no encontrado', 404);
  await db.update(sorteos).set({ estado: 'ausente' }).where(eq(sorteos.id, sorteoId));
  await publish({ type: 'sorteo.ausente', sorteo_id: sorteoId });
  return prepararSorteo();
}

export async function volverACaptacion(): Promise<{ ok: true }> {
  const jornadaId = await activeJornadaId();
  await db
    .update(totemEstado)
    .set({ estado: 'captacion', sorteoId: null, revelarAt: null, updatedAt: new Date() })
    .where(eq(totemEstado.id, 1));

  // Mark pending draw as ausente so a new one can be launched
  await db
    .update(sorteos)
    .set({ estado: 'ausente' })
    .where(and(eq(sorteos.jornadaId, jornadaId), eq(sorteos.estado, 'sorteado')));

  const totalCap = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(participantes)
    .where(eq(participantes.jornadaId, jornadaId));
  const total = totalCap[0]?.n ?? 0;

  await publish({ type: 'totem.estado', estado: 'captacion', sorteo_id: null, total });
  return { ok: true };
}

export async function reiniciar(): Promise<{ ok: true; jornada_id: number }> {
  const current = await activeJornadaId();
  await db
    .update(jornadas)
    .set({ cerradaAt: new Date() })
    .where(eq(jornadas.id, current));

  const [nueva] = await db
    .insert(jornadas)
    .values({ nombre: env.EVENT_NAME })
    .returning();

  await db
    .update(totemEstado)
    .set({ estado: 'captacion', sorteoId: null, revelarAt: null, updatedAt: new Date() })
    .where(eq(totemEstado.id, 1));

  await publish({ type: 'jornada.reiniciada', jornada_id: nueva!.id });
  await publish({ type: 'totem.estado', estado: 'captacion', sorteo_id: null, total: 0 });
  await publish({ type: 'totem.contador', total: 0 });

  return { ok: true, jornada_id: nueva!.id };
}

export async function exportCsv(): Promise<string> {
  const jornadaId = await activeJornadaId();
  const rows = await db.query.participantes.findMany({
    where: eq(participantes.jornadaId, jornadaId),
    orderBy: [desc(participantes.creadoAt)],
  });

  const { csvEscape } = await import('@maxitexs/shared');
  const header = [
    'ticket',
    'nombre',
    'cedula',
    'telefono',
    'correo',
    'laboratorio',
    'cargo',
    'hora',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        formatTicket(r.ticket),
        r.nombre,
        formatCedula(r.cedulaTipo, r.cedulaNumero),
        formatPhone(r.telefono),
        r.correo,
        r.laboratorio,
        r.cargo,
        formatHora(r.creadoAt),
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
