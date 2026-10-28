import { z } from 'zod';
import { digits, normalizeCedulaNumero, normalizeTelefono } from './normalize.js';

export const registroSchema = z
  .object({
    nombre: z.string().trim(),
    cedula: z.object({
      tipo: z.enum(['V', 'E']),
      numero: z.union([z.string(), z.number()]),
    }),
    telefono: z.union([z.string(), z.number()]),
    laboratorio: z.string().trim(),
    cargo: z.string().trim(),
    correo: z.string().trim(),
    consentimiento: z.literal(true, {
      errorMap: () => ({ message: 'Debes aceptar los términos.' }),
    }),
  })
  .superRefine((data, ctx) => {
    if (!/^\S+\s+\S+/.test(data.nombre) || data.nombre.length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nombre'],
        message: 'Escribe tu nombre y apellido.',
      });
    }

    const numero = normalizeCedulaNumero(data.cedula.numero);
    if (numero.length < 6 || numero.length > 9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cedula'],
        message: 'Escribe entre 6 y 9 dígitos, sin puntos.',
      });
    }

    const telefono = normalizeTelefono(data.telefono);
    if (!/^0\d{10}$/.test(telefono)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['telefono'],
        message: 'Escribe los 11 dígitos, p. ej. 0412 555 4821.',
      });
    }

    if (data.laboratorio.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['laboratorio'],
        message: 'Escribe el nombre de tu laboratorio.',
      });
    }

    if (data.cargo.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cargo'],
        message: 'Escribe tu cargo.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.correo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correo'],
        message: 'Escribe un correo válido.',
      });
    }
  })
  .transform((data) => ({
    nombre: data.nombre,
    tipo: data.cedula.tipo as 'V' | 'E',
    numero: normalizeCedulaNumero(data.cedula.numero),
    telefono: normalizeTelefono(data.telefono),
    laboratorio: data.laboratorio,
    cargo: data.cargo,
    correo: data.correo.toLowerCase(),
    consentimiento: true as const,
  }));

export type RegistroInput = z.infer<typeof registroSchema>;

export const verificarSchema = z
  .object({
    cedula: z.object({
      tipo: z.enum(['V', 'E']).optional(),
      numero: z.union([z.string(), z.number()]),
    }),
    telefono: z.union([z.string(), z.number()]).optional(),
  })
  .transform((data) => ({
    numero: normalizeCedulaNumero(data.cedula.numero),
    telefono: data.telefono != null ? normalizeTelefono(data.telefono) : undefined,
  }));

export const loginSchema = z.object({
  usuario: z.string().min(1),
  password: z.string().min(1),
});

/** Admin launch: omit participante_id for random, or pass it for manual winner. */
export const lanzarSorteoSchema = z.object({
  participante_id: z.number().int().positive().optional(),
});

export function zodToCampos(error: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!campos[key]) campos[key] = issue.message;
  }
  return campos;
}

export { digits };
