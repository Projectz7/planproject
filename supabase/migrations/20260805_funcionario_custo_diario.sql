-- ============================================================
-- Custo diário de mão de obra: coluna em funcionarios
-- + atualiza RPCs criar_funcionario e editar_funcionario
-- ============================================================

-- 1. Nova coluna custo_diario (nullable; default 0 p/ nao quebrar inserts existentes)
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS custo_diario numeric(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.funcionarios.custo_diario IS
  'Custo de mão de obra diário (R$). Usado pelo PlanSeven p/ calcular custo de tarefas. 0 = não definido.';

-- 2. Recria criar_funcionario com novo param p_custo_diario DEFAULT 0
CREATE OR REPLACE FUNCTION public.criar_funcionario(
  p_nome TEXT, p_cpf TEXT, p_senha TEXT, p_empresa_id UUID,
  p_is_gerente BOOLEAN DEFAULT false, p_equipe_id UUID DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL, p_perfil_id UUID DEFAULT NULL,
  p_custo_diario NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid; v_cpf text; v_empresa_exists boolean; v_token text;
BEGIN
  v_cpf := regexp_replace(p_cpf, '\D', '', 'g');
  IF p_empresa_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Empresa não identificada. Recarregue a página.');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.empresa WHERE id = p_empresa_id) INTO v_empresa_exists;
  IF NOT v_empresa_exists THEN
    RETURN jsonb_build_object('error', 'Empresa não encontrada. Recarregue a página.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.funcionarios WHERE empresa_id = p_empresa_id AND cpf = v_cpf) THEN
    RETURN jsonb_build_object('error', 'CPF já cadastrado nesta empresa');
  END IF;
  INSERT INTO public.funcionarios
    (nome, cpf, senha, is_gerente, equipe_id, telefone, empresa_id, perfil_id, custo_diario)
  VALUES
    (p_nome, v_cpf, p_senha, p_is_gerente, p_equipe_id, p_telefone, p_empresa_id, p_perfil_id, p_custo_diario)
  RETURNING id INTO v_id;
  v_token := encode(gen_random_bytes(32), 'hex');
  UPDATE public.funcionarios
     SET token_acesso = v_token,
         token_expiracao = '2100-01-01 00:00:00+00'::TIMESTAMPTZ,
         token_acesso_hash = NULL
   WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'token_acesso', v_token);
END;
$$;

-- 3. Recria editar_funcionario com novo param p_custo_diario DEFAULT NULL (nao sobrescreve se null)
CREATE OR REPLACE FUNCTION public.editar_funcionario(
  p_id UUID, p_nome TEXT DEFAULT NULL, p_cpf TEXT DEFAULT NULL,
  p_senha TEXT DEFAULT NULL, p_is_gerente BOOLEAN DEFAULT NULL,
  p_equipe_id UUID DEFAULT NULL, p_telefone TEXT DEFAULT NULL,
  p_perfil_id UUID DEFAULT NULL,
  p_custo_diario NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf text;
BEGIN
  v_cpf := CASE WHEN p_cpf IS NOT NULL THEN regexp_replace(p_cpf, '\D', '', 'g') ELSE NULL END;
  UPDATE public.funcionarios SET
    nome = COALESCE(p_nome, nome),
    cpf = COALESCE(v_cpf, cpf),
    senha = COALESCE(p_senha, senha),
    is_gerente = COALESCE(p_is_gerente, is_gerente),
    equipe_id = COALESCE(p_equipe_id, equipe_id),
    telefone = COALESCE(p_telefone, telefone),
    perfil_id = COALESCE(p_perfil_id, perfil_id),
    custo_diario = COALESCE(p_custo_diario, custo_diario)
  WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Atualiza GRANTs (signatures mudaram)
REVOKE ALL ON FUNCTION public.criar_funcionario(TEXT, TEXT, TEXT, UUID, BOOLEAN, UUID, TEXT, UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_funcionario(TEXT, TEXT, TEXT, UUID, BOOLEAN, UUID, TEXT, UUID, NUMERIC) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.editar_funcionario(UUID, TEXT, TEXT, TEXT, BOOLEAN, UUID, TEXT, UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_funcionario(UUID, TEXT, TEXT, TEXT, BOOLEAN, UUID, TEXT, UUID, NUMERIC) TO anon, authenticated;
