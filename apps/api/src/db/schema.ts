import {
  bigint,
  bigserial,
  char,
  check,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const jornadas = pgTable('jornadas', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  iniciadaAt: timestamp('iniciada_at', { withTimezone: true }).notNull().defaultNow(),
  cerradaAt: timestamp('cerrada_at', { withTimezone: true }),
});

export const participantes = pgTable(
  'participantes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    jornadaId: integer('jornada_id')
      .notNull()
      .references(() => jornadas.id),
    ticket: integer('ticket').notNull(),
    nombre: text('nombre').notNull(),
    cedulaTipo: char('cedula_tipo', { length: 1 }).notNull(),
    cedulaNumero: text('cedula_numero').notNull(),
    telefono: text('telefono').notNull(),
    correo: text('correo').notNull(),
    laboratorio: text('laboratorio').notNull(),
    laboratorioKey: text('laboratorio_key').notNull(),
    cargo: text('cargo').notNull(),
    consentimientoAt: timestamp('consentimiento_at', { withTimezone: true }).notNull(),
    creadoAt: timestamp('creado_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_participante_cedula').on(t.jornadaId, t.cedulaNumero),
    unique('uq_participante_telefono').on(t.jornadaId, t.telefono),
    unique('uq_participante_ticket').on(t.jornadaId, t.ticket),
    check('chk_cedula_tipo', sql`${t.cedulaTipo} in ('V', 'E')`),
    check('chk_cedula_numero', sql`${t.cedulaNumero} ~ '^[0-9]{6,9}$'`),
    check('chk_telefono', sql`${t.telefono} ~ '^0[0-9]{10}$'`),
  ],
);

export const sorteos = pgTable(
  'sorteos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    jornadaId: integer('jornada_id')
      .notNull()
      .references(() => jornadas.id),
    numero: integer('numero').notNull(),
    participanteId: bigint('participante_id', { mode: 'number' })
      .notNull()
      .references(() => participantes.id),
    estado: text('estado').notNull().default('sorteado'),
    creadoAt: timestamp('creado_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_sorteo_estado', sql`${t.estado} in ('sorteado', 'entregado', 'ausente')`),
    uniqueIndex('uq_sorteo_pendiente')
      .on(t.jornadaId)
      .where(sql`${t.estado} = 'sorteado'`),
  ],
);

export const totemEstado = pgTable(
  'totem_estado',
  {
    id: integer('id').primaryKey().default(1),
    estado: text('estado').notNull().default('captacion'),
    sorteoId: bigint('sorteo_id', { mode: 'number' }).references(() => sorteos.id),
    revelarAt: timestamp('revelar_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_totem_id', sql`${t.id} = 1`),
    check('chk_totem_estado', sql`${t.estado} in ('captacion', 'sorteo', 'ganador')`),
  ],
);

export const adminSesiones = pgTable('admin_sesiones', {
  tokenHash: text('token_hash').primaryKey(),
  expiraAt: timestamp('expira_at', { withTimezone: true }).notNull(),
  creadoAt: timestamp('creado_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Jornada = typeof jornadas.$inferSelect;
export type Participante = typeof participantes.$inferSelect;
export type Sorteo = typeof sorteos.$inferSelect;
export type TotemEstadoRow = typeof totemEstado.$inferSelect;
