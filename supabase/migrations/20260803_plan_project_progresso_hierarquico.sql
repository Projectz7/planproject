-- ============================================================
-- PlanProject - progresso hierárquico (no banco)
-- Peso por duração esperada (dias); sem datas => peso 1
-- ============================================================

-- 1. Função de peso (dias esperados)
CREATE OR REPLACE FUNCTION public.peso_tarefa(t public.plano_tarefas)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT GREATEST(
    CASE WHEN t.data_fim IS NOT NULL AND t.data_inicio IS NOT NULL
         THEN (t.data_fim - t.data_inicio)
         ELSE NULL END,
    1
  );
$$;

-- 2. Recalcula progresso da tarefa (e de cada ancestral até a raiz)
CREATE OR REPLACE FUNCTION public.recalc_progresso(p_tarefa_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  t_rec RECORD;
  soma_peso numeric;
  soma_pond numeric;
  novo integer;
BEGIN
  <<proximo_nivel>>
  LOOP
    SELECT * INTO t_rec FROM public.plano_tarefas WHERE id = p_tarefa_id;
    IF NOT FOUND THEN EXIT proximo_nivel; END IF;

    IF t_rec.progresso_manual THEN
      EXIT proximo_nivel;
    END IF;

    SELECT COALESCE(SUM(public.peso_tarefa(f)),  0),
           COALESCE(SUM(public.peso_tarefa(f) * f.progresso), 0)
      INTO soma_peso, soma_pond
      FROM public.plano_tarefas f
     WHERE f.parent_id = p_tarefa_id;

    IF soma_peso = 0 THEN
      novo := t_rec.progresso;  -- folha: mantém digitado
    ELSE
      novo := round(soma_pond / soma_peso)::integer;
    END IF;

    IF novo <> t_rec.progresso THEN
      UPDATE public.plano_tarefas
         SET progresso = novo, updated_at = now()
       WHERE id = p_tarefa_id;
    END IF;

    EXIT proximo_nivel WHEN t_rec.parent_id IS NULL;
    p_tarefa_id := t_rec.parent_id;
  END LOOP;
END $$;

-- 3. Trigger AFTER INSERT/UPDATE/DELETE: recalc progresso da mãe
CREATE OR REPLACE FUNCTION public.tarefa_progresso_handler()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  alvo uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    alvo := OLD.parent_id;
  ELSE
    alvo := NEW.parent_id;
    IF TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id AND OLD.parent_id IS NOT NULL AND NEW.parent_id IS NOT NULL THEN
      PERFORM public.recalc_progresso(OLD.parent_id);
    END IF;
  END IF;

  IF alvo IS NOT NULL THEN
    PERFORM public.recalc_progresso(alvo);
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_tarefa_progresso ON public.plano_tarefas;
CREATE TRIGGER trg_tarefa_progresso
AFTER INSERT OR UPDATE OR DELETE ON public.plano_tarefas
FOR EACH ROW EXECUTE FUNCTION public.tarefa_progresso_handler();

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_planos_updated_at ON public.planos;
CREATE TRIGGER trg_planos_updated_at
BEFORE UPDATE ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tarefas_updated_at ON public.plano_tarefas;
CREATE TRIGGER trg_tarefas_updated_at
BEFORE UPDATE ON public.plano_tarefas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
