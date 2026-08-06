-- ============================================================
-- BPO DiGest <-> PlanSeven: RPCs de leitura de custo planejado/real
-- (Mesmo projeto p7store; le tabelas compartilhadas)
-- Aplicada em pnijzmqygibhwbcnkklm em 2026-08-06
-- ============================================================

-- 1) Custo Projetado total + lista de tarefas-mae da obra (plano fechado mais recente, fallback rascunho)
CREATE OR REPLACE FUNCTION public.calc_custo_projetado_obra(p_obra_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_plano record;
  v_tarefas JSONB;
  v_total numeric;
BEGIN
  -- seleciona plano fechado mais recente; fallback rascunho mais recente
  SELECT * INTO v_plano
  FROM public.planos p
  WHERE p.obra_id = p_obra_id AND p.status = 'fechado'
  ORDER BY p.created_at DESC LIMIT 1;

  IF v_plano.id IS NULL THEN
    SELECT * INTO v_plano
    FROM public.planos p
    WHERE p.obra_id = p_obra_id AND p.status = 'rascunho'
    ORDER BY p.created_at DESC LIMIT 1;
  END IF;

  IF v_plano.id IS NULL THEN
    RETURN jsonb_build_object('custo_projetado_total', 0, 'plano_id', null, 'plano_status', null, 'tarefas', '[]'::jsonb);
  END IF;

  -- monta array de tarefas-mae com custo calculado (mesma logica do TS calcularCustoTarefa)
  WITH tarefas AS (
    SELECT
      t.id,
      t.titulo,
      t.data_inicio,
      t.data_fim,
      t.data_fim_real,
      t.status,
      t.equipe_id,
      t.responsavel_id,
      t.horas_estimadas,
      t.peso_tarefa,
      -- custo_diario: equipe prevalece via pivô N:N, senao responsavel
      CASE
        WHEN t.equipe_id IS NOT NULL THEN COALESCE((
          SELECT SUM(COALESCE(f.custo_diario, 0))
          FROM public.funcionarios f
          JOIN public.funcionario_equipes fe ON fe.funcionario_id = f.id
          WHERE fe.equipe_id = t.equipe_id AND f.ativo = true
        ), 0)
        WHEN t.responsavel_id IS NOT NULL THEN COALESCE((
          SELECT f.custo_diario FROM public.funcionarios f WHERE f.id = t.responsavel_id
        ), 0)
        ELSE 0
      END AS custo_diario,
      (t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL AND t.data_inicio = t.data_fim) AS mesmo_dia
    FROM public.plano_tarefas t
    WHERE t.plano_id = v_plano.id AND t.parent_id IS NULL
  ),
  custos AS (
    SELECT
      id, titulo, data_inicio, data_fim, data_fim_real, status,
      CASE
        WHEN mesmo_dia AND COALESCE(horas_estimadas, 0) > 0 THEN custo_diario * (horas_estimadas / 8.0)
        ELSE custo_diario * GREATEST(1, COALESCE(peso_tarefa, 1))
      END AS custo,
      (data_fim_real IS NOT NULL) AS concluida
    FROM tarefas
  )
  SELECT
    jsonb_agg(jsonb_build_object(
      'titulo', titulo,
      'data_inicio', data_inicio,
      'data_fim', data_fim,
      'data_fim_real', data_fim_real,
      'status', status,
      'custo', custo,
      'concluida', concluida
    ) ORDER BY data_inicio NULLS LAST, titulo),
    COALESCE(SUM(custo), 0)
  INTO v_tarefas, v_total
  FROM custos;

  RETURN jsonb_build_object(
    'custo_projetado_total', v_total,
    'plano_id', v_plano.id,
    'plano_status', v_plano.status,
    'tarefas', COALESCE(v_tarefas, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calc_custo_projetado_obra(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_custo_projetado_obra(uuid) TO anon, authenticated;

-- 2) Custo MO Real PlanSeven: soma do custo das tarefas-mae concluidas (data_fim_real IS NOT NULL)
CREATE OR REPLACE FUNCTION public.calc_custo_mo_real_obra(p_obra_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_plano_id uuid;
  v_total numeric;
BEGIN
  SELECT id INTO v_plano_id
  FROM public.planos p
  WHERE p.obra_id = p_obra_id AND p.status = 'fechado'
  ORDER BY p.created_at DESC LIMIT 1;

  IF v_plano_id IS NULL THEN
    SELECT id INTO v_plano_id
    FROM public.planos p
    WHERE p.obra_id = p_obra_id AND p.status = 'rascunho'
    ORDER BY p.created_at DESC LIMIT 1;
  END IF;

  IF v_plano_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH tarefas AS (
    SELECT
      t.equipe_id, t.responsavel_id, t.horas_estimadas, t.peso_tarefa,
      t.data_inicio, t.data_fim,
      CASE
        WHEN t.equipe_id IS NOT NULL THEN COALESCE((
          SELECT SUM(COALESCE(f.custo_diario, 0))
          FROM public.funcionarios f
          JOIN public.funcionario_equipes fe ON fe.funcionario_id = f.id
          WHERE fe.equipe_id = t.equipe_id AND f.ativo = true
        ), 0)
        WHEN t.responsavel_id IS NOT NULL THEN COALESCE((
          SELECT f.custo_diario FROM public.funcionarios f WHERE f.id = t.responsavel_id
        ), 0)
        ELSE 0
      END AS custo_diario,
      (t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL AND t.data_inicio = t.data_fim) AS mesmo_dia
    FROM public.plano_tarefas t
    WHERE t.plano_id = v_plano_id
      AND t.parent_id IS NULL
      AND t.data_fim_real IS NOT NULL
  )
  SELECT COALESCE(SUM(
    CASE
      WHEN mesmo_dia AND COALESCE(horas_estimadas, 0) > 0 THEN custo_diario * (horas_estimadas / 8.0)
      ELSE custo_diario * GREATEST(1, COALESCE(peso_tarefa, 1))
    END
  ), 0)
  INTO v_total
  FROM tarefas;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.calc_custo_mo_real_obra(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_custo_mo_real_obra(uuid) TO anon, authenticated;
