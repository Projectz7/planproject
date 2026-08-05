-- ============================================================
-- peso_tarefa (duração em dias) para calcular custo MO
-- + trigger que sincroniza peso com data_inicio/data_fim
-- ============================================================

ALTER TABLE public.plano_tarefas
  ADD COLUMN IF NOT EXISTS peso_tarefa integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.plano_tarefas.peso_tarefa IS
  'Duração estimada da tarefa em dias (mão de obra). Default 1. Usado p/ custo MO = peso_tarefa * custo_diario.';

CREATE OR REPLACE FUNCTION public.sync_peso_tarefa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data_inicio IS NOT NULL AND NEW.data_fim IS NOT NULL THEN
    NEW.peso_tarefa := GREATEST(1, (NEW.data_fim::date - NEW.data_inicio::date) + 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_peso_tarefa ON public.plano_tarefas;
CREATE TRIGGER trg_sync_peso_tarefa
  BEFORE INSERT OR UPDATE OF data_inicio, data_fim ON public.plano_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.sync_peso_tarefa();

GRANT EXECUTE ON FUNCTION public.sync_peso_tarefa() TO anon, authenticated;
