import { env } from '../config/env.js';
import { db, pool } from './client.js';
import { jornadas, participantes } from './schema.js';
import { normalizeLaboratorioKey } from '@maxitexs/shared';
import { isNull } from 'drizzle-orm';

async function main() {
  let jornada = await db.query.jornadas.findFirst({ where: isNull(jornadas.cerradaAt) });
  if (!jornada) {
    const [j] = await db.insert(jornadas).values({ nombre: env.EVENT_NAME }).returning();
    jornada = j!;
  }

  const samples = [
    ['Valentina Castro Ruiz', 'V', '20118305', '04145551290', 'vcastro@farmandina.com', 'Farma Andina', 'Gerente de Compras'],
    ['Mateo Díaz Herrera', 'V', '17442019', '04245557712', 'mdiaz@biocaribe.com', 'BioCaribe', 'Analista de Laboratorio'],
    ['Camila Hernández Soto', 'V', '22903774', '04125553305', 'chernandez@quimifar.com', 'Quimifar', 'Regente Farmacéutico'],
  ] as const;

  let ticket = 1;
  for (const [nombre, tipo, numero, tel, correo, lab, cargo] of samples) {
    await db
      .insert(participantes)
      .values({
        jornadaId: jornada.id,
        ticket: ticket++,
        nombre,
        cedulaTipo: tipo,
        cedulaNumero: numero,
        telefono: tel,
        correo,
        laboratorio: lab,
        laboratorioKey: normalizeLaboratorioKey(lab),
        cargo,
        consentimientoAt: new Date(),
      })
      .onConflictDoNothing();
  }

  console.log(`[seed] jornada ${jornada.id} ready`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
