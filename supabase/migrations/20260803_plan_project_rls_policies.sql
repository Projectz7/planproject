-- ============================================================
-- PlanProject - RLS (reutiliza get_empresa_id_from_email())
-- ============================================================

ALTER TABLE public.planos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_tarefas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_obra    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp planos select own"   ON public.planos;
DROP POLICY IF EXISTS "pp planos insert own"  ON public.planos;
DROP POLICY IF EXISTS "pp planos update own"  ON public.planos;
DROP POLICY IF EXISTS "pp planos delete own"  ON public.planos;
DROP POLICY IF EXISTS "pp tarefas select own"  ON public.plano_tarefas;
DROP POLICY IF EXISTS "pp tarefas insert own"  ON public.plano_tarefas;
DROP POLICY IF EXISTS "pp tarefas update own"  ON public.plano_tarefas;
DROP POLICY IF EXISTS "pp tarefas delete own"  ON public.plano_tarefas;
DROP POLICY IF EXISTS "pp diario select own"   ON public.diario_obra;
DROP POLICY IF EXISTS "pp diario insert own"  ON public.diario_obra;
DROP POLICY IF EXISTS "pp diario update own"  ON public.diario_obra;
DROP POLICY IF EXISTS "pp diario delete own"  ON public.diario_obra;

CREATE POLICY "pp planos select own"  ON public.planos FOR SELECT USING (empresa_id = public.get_empresa_id_from_email());
CREATE POLICY "pp planos insert own"  ON public.planos FOR INSERT WITH CHECK (empresa_id = public.get_empresa_id_from_email());
CREATE POLICY "pp planos update own"  ON public.planos FOR UPDATE USING (empresa_id = public.get_empresa_id_from_email());
CREATE POLICY "pp planos delete own"  ON public.planos FOR DELETE USING (empresa_id = public.get_empresa_id_from_email());

CREATE POLICY "pp tarefas select own"  ON public.plano_tarefas FOR SELECT USING (empresa_id = public.get_empresa_id_from_email());
CREATE POLICY "pp tarefas insert own"  ON public.plano_tarefas FOR INSERT WITH CHECK (empresa_id = public.get_empresa_id_from_email());
CREATE POLICY "pp tarefas update own"  ON public.plano_tarefas FOR UPDATE USING (empresa_id = public.get_empresa_id_from_email());
CREATE POLICY "pp tarefas delete own"  ON public.plano_tarefas FOR DELETE USING (empresa_id = public.get_empresa_id_from_email());

CREATE POLICY "pp diario select own"  ON public.diario_obra FOR SELECT USING (empresa_id = public.get_empresa_id_from_email());
CREATE POLICY "pp diario insert own"  ON public.diario_obra FOR INSERT WITH CHECK (empresa_id = public.get_empresa_id_from_email());
CREATE POLICY "pp diario update own"  ON public.diario_obra FOR UPDATE USING (empresa_id = public.get_empresa_id_from_email());
CREATE POLICY "pp diario delete own"  ON public.diario_obra FOR DELETE USING (empresa_id = public.get_empresa_id_from_email());
