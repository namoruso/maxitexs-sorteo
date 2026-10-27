-- Two-step raffle: captacion → preparacion → sorteo → ganador
ALTER TABLE "totem_estado" DROP CONSTRAINT IF EXISTS "chk_totem_estado";
ALTER TABLE "totem_estado"
  ADD CONSTRAINT "chk_totem_estado"
  CHECK ("estado" in ('captacion', 'preparacion', 'sorteo', 'ganador'));
