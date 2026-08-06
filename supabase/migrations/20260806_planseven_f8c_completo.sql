-- ============================================================
-- F8c: Limpeza de testes + tabela pivô N:N + horas_estimadas
-- ============================================================

-- 1. Remove funcionarios de teste (empresa Projectsevenz7, sem tarefas)
DELETE FROM public.funcionarios
WHERE id IN (
  'cf679345-443c-4836-bca1-183c2e40de70',  -- Amgelica
  'bd59aa5c-c9ca-4931-9743-a86785b6bfa2',  -- APITest
  '172d5025-5080-446f-8378-bfe93fba85bf',  -- jose vando
  '80e10a6c-4691-4dc8-9534-fbfba4d4a176'   -- Teste Func
);

-- 2. Tabela pivô N:N para funcionário em múltiplas equipes
CREATE TABLE IF NOT EXISTS public.funcionario_equipes (
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  equipe_id       UUID NOT NULL REFERENCES public.equipes(id)     ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (funcionario_id, equipe_id)
);

ALTER TABLE public.funcionario_equipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_funcionario_equipes ON public.funcionario_equipes
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.funcionario_equipes (funcionario_id, equipe_id)
SELECT f.id, f.equipe_id FROM public.funcionarios f
WHERE f.equipe_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Horas estimadas na tarefa (tarefas de 1 dia)
ALTER TABLE public.plano_tarefas
  ADD COLUMN IF NOT EXISTS horas_estimadas integer NULL DEFAULT NULL;
COMMENT ON COLUMN public.plano_tarefas.horas_estimadas IS
  'Horas estimadas (apenas p/ tarefas de 1 dia). Custo = (custo_diario/8) * horas. NULL = usa peso_tarefa.';

-- 4. RPC para vincular funcionarios a uma equipe (N:N)
CREATE OR REPLACE FUNCTION public.vincular_funcionarios_equipe(
  p_equipe_id UUID,
  p_funcionario_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  DELETE FROM public.funcionario_equipes
  WHERE equipe_id = p_equipe_id
    AND funcionario_id <> ALL(COALESCE(p_funcionario_ids, ARRAY[]::UUID[]));
  INSERT INTO public.funcionario_equipes (funcionario_id, equipe_id)
  SELECT unnest(COALESCE(p_funcionario_ids, ARRAY[]::UUID[])), p_equipe_id
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.vincular_funcionarios_equipe(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_funcionarios_equipe(UUID, UUID[]) TO anon, authenticated;

-- 5. RPC para listar membros de uma equipe (via pivô)
CREATE OR REPLACE FUNCTION public.listar_membros_equipe(p_equipe_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', f.id, 'nome', f.nome, 'custo_diario', f.custo_diario, 'ativo', f.ativo
  ) ORDER BY f.nome)
  INTO v_result
  FROM public.funcionarios f
  JOIN public.funcionario_equipes fe ON fe.funcionario_id = f.id
  WHERE fe.equipe_id = p_equipe_id AND f.ativo = true;
  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.listar_membros_equipe(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_membros_equipe(UUID) TO anon, authenticated;
