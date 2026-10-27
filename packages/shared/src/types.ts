export type TotemEstado = 'captacion' | 'sorteo' | 'ganador';
export type SorteoEstado = 'sorteado' | 'entregado' | 'ausente';
export type CedulaTipo = 'V' | 'E';

export interface EventoPublico {
  nombre: string;
  premio: string;
}

export interface RegistroResponse {
  ticket: string;
  nombre: string;
  laboratorio: string;
}

export interface VerificarResponse {
  cedula: boolean;
  telefono: boolean;
}

export interface TotemGanadorPublico {
  nombre_mask: string;
  laboratorio: string;
  cedula_mask: string;
  ticket: string;
}

export interface TotemEstadoResponse {
  estado: TotemEstado;
  total: number;
  premio: string;
  url_registro: string;
  sorteo_id: number | null;
  nombres: string[];
  ganador: TotemGanadorPublico | null;
}

export interface ParticipanteAdmin {
  id: number;
  nombre: string;
  cedula: string;
  telefono: string;
  correo: string;
  laboratorio: string;
  cargo: string;
  ticket: string;
  hora: string;
}

export interface GanadorAdmin extends ParticipanteAdmin {
  sorteo_id: number;
  registrado: string;
}

export interface AdminEstadoResponse {
  evento: { nombre: string; fecha: string };
  total: number;
  laboratorios: number;
  totem_en_linea: boolean;
  participantes: ParticipanteAdmin[];
  ganador: GanadorAdmin | null;
  sorteo_numero: number | null;
  entregado: boolean;
  totem_estado: TotemEstado;
}

export interface SorteoResponse {
  sorteo_numero: number;
  ganador: GanadorAdmin;
}

export interface ValidationErrorBody {
  campos: Record<string, string>;
}

export interface DuplicateErrorBody {
  campo: 'cedula' | 'telefono';
  mensaje: string;
}

export interface MessageBody {
  mensaje: string;
}
