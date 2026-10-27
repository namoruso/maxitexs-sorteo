import type { GanadorAdmin, ParticipanteAdmin, TotemEstado, TotemGanadorPublico } from './types.js';

export type RealtimeEvent =
  | { type: 'participante.creado'; participante: ParticipanteAdmin; total: number }
  | { type: 'sorteo.lanzado'; sorteo_id: number; sorteo_numero: number; ganador: GanadorAdmin; nombres: string[] }
  | { type: 'sorteo.revelado'; sorteo_id: number; ganador: TotemGanadorPublico }
  | { type: 'sorteo.entregado'; sorteo_id: number }
  | { type: 'sorteo.ausente'; sorteo_id: number }
  | { type: 'totem.estado'; estado: TotemEstado; sorteo_id: number | null; total: number }
  | { type: 'totem.contador'; total: number }
  | { type: 'jornada.reiniciada'; jornada_id: number };

export const SSE_CHANNEL = 'sorteo_eventos';
