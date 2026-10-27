CREATE TABLE IF NOT EXISTS "jornadas" (
  "id" serial PRIMARY KEY NOT NULL,
  "nombre" text NOT NULL,
  "iniciada_at" timestamptz DEFAULT now() NOT NULL,
  "cerrada_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "participantes" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "jornada_id" integer NOT NULL REFERENCES "jornadas"("id"),
  "ticket" integer NOT NULL,
  "nombre" text NOT NULL,
  "cedula_tipo" char(1) NOT NULL,
  "cedula_numero" text NOT NULL,
  "telefono" text NOT NULL,
  "correo" text NOT NULL,
  "laboratorio" text NOT NULL,
  "laboratorio_key" text NOT NULL,
  "cargo" text NOT NULL,
  "consentimiento_at" timestamptz NOT NULL,
  "creado_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "uq_participante_cedula" UNIQUE("jornada_id","cedula_numero"),
  CONSTRAINT "uq_participante_telefono" UNIQUE("jornada_id","telefono"),
  CONSTRAINT "uq_participante_ticket" UNIQUE("jornada_id","ticket"),
  CONSTRAINT "chk_cedula_tipo" CHECK ("cedula_tipo" in ('V', 'E')),
  CONSTRAINT "chk_cedula_numero" CHECK ("cedula_numero" ~ '^[0-9]{6,9}$'),
  CONSTRAINT "chk_telefono" CHECK ("telefono" ~ '^0[0-9]{10}$')
);

CREATE TABLE IF NOT EXISTS "sorteos" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "jornada_id" integer NOT NULL REFERENCES "jornadas"("id"),
  "numero" integer NOT NULL,
  "participante_id" bigint NOT NULL REFERENCES "participantes"("id"),
  "estado" text DEFAULT 'sorteado' NOT NULL,
  "creado_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chk_sorteo_estado" CHECK ("estado" in ('sorteado', 'entregado', 'ausente'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_sorteo_pendiente"
  ON "sorteos" ("jornada_id") WHERE "estado" = 'sorteado';

CREATE TABLE IF NOT EXISTS "totem_estado" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "estado" text DEFAULT 'captacion' NOT NULL,
  "sorteo_id" bigint REFERENCES "sorteos"("id"),
  "revelar_at" timestamptz,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chk_totem_id" CHECK ("id" = 1),
  CONSTRAINT "chk_totem_estado" CHECK ("estado" in ('captacion', 'sorteo', 'ganador'))
);

CREATE TABLE IF NOT EXISTS "admin_sesiones" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "expira_at" timestamptz NOT NULL,
  "creado_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_participantes_jornada_creado"
  ON "participantes" ("jornada_id", "creado_at" DESC);

INSERT INTO "totem_estado" ("id", "estado")
VALUES (1, 'captacion')
ON CONFLICT ("id") DO NOTHING;
