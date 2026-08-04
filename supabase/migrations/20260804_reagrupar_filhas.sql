-- ============================================================
-- PlanSeven - reagrupar_filhas: move filhas de um parent (com ordem >= limite)
--   para um novo parent em 1 query. Usada quando arrastada vira MAE
--   (a over e suas irmas subsequentes passam a ser filhas da arrastada).
-- ============================================================

CREATE OR REPLACE FUNCTION public.reagrupar_filhas(
  p_parent_antigo uuid,
  p_ordem_limite  integer,
  p_novo_parent   uuid
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  afetadas integer := 0;
BEGIN
  -- Pega o irmao anterior (imediato antes do limite, no mesmo parent)
  -- para calcular ordem inicial dentro do novo parent
  UPDATE public.plano_tarefas
     SET parent_id = p_novo_parent,
         updated_at = now()
   WHERE parent_id = p_parent_antigo
     AND ordem >= p_ordem_limite;

  GET DIAGNOSTICS afetadas = ROW_COUNT;

  -- Recalcula progresso dos 2 envolvidos (antigo e novo parent)
  IF p_parent_antigo IS NOT NULL THEN
    PERFORM public.recalc_progresso(p_parent_antigo);
  END IF;
  IF p_novo_parent IS NOT NULL THEN
    PERFORM public.recalc_progresso(p_novo_parent);
  END IF;

  RETURN afetadas;
END $$;

-- Permite chamada via Supabase RPC (auth.def = true)
REVOKE ALL ON FUNCTION public.reagrupar_filhas(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reagrupar_filhas(uuid, integer, uuid) TO authenticated;
