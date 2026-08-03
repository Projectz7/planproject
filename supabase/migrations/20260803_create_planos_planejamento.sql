-- ============================================================
-- PlanProject - tabelas de planos, tarefas e diário de obra
-- (mesmo projeto p7store; lê obras/funcionarios do di-gest)
-- Migration aplicada via Supabase studio/MCP em 2026-08-03
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Planos: snapshot fechado de planejamento de uma obra
CREATE TABLE IF NOT EXISTS public.planos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  obra_id     uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome        text NOT NULL DEFAULT 'Plano principal',
  status      text NOT NULL DEFAULT 'rascunho'
              CHECK (status IN ('rascunho','fechado','arquivado')),
  criado_por  uuid,                       -- funcionario.id ou NULL (dono)
  criado_em   timestamptz NOT NULL DEFAULT now(),
  fechado_em  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_planos_empresa_obra ON public.planos (empresa_id, obra_id);

-- 2. Tarefas: esperado x realizado + progresso hierárquico (subtarefas via parent_id)
CREATE TABLE IF NOT EXISTS public.plano_tarefas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  plano_id          uuid NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  obra_id           uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  parent_id         uuid REFERENCES public.plano_tarefas(id) ON DELETE CASCADE,
  titulo            text NOT NULL,
  descricao         text,
  responsavel_id    uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  equipe_id         uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'a_fazer'
                    CHECK (status IN ('a_fazer','fazendo','concluida','bloqueada','cancelada')),
  prioridade        text NOT NULL DEFAULT 'media'
                    CHECK (prioridade IN ('baixa','media','alta','critica')),
  ordem             integer NOT NULL DEFAULT 0,
  -- ESPERADO
  data_inicio       date,
  data_fim          date,
  -- REALIZADO
  data_inicio_real  date,
  data_fim_real     date,
  -- PROGRESSO
  progresso_manual  boolean NOT NULL DEFAULT false,   -- false => agregado das filhas
  progresso         integer NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  observacao        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tarefas_empresa_plano ON public.plano_tarefas (empresa_id, plano_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_obra ON public.plano_tarefas (obra_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_parent ON public.plano_tarefas (parent_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.plano_tarefas (plano_id, status);

-- 3. Diário de obra (pós-MVP; já no schema p/ não migrar depois)
CREATE TABLE IF NOT EXISTS public.diario_obra (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  obra_id         uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  plano_id        uuid REFERENCES public.planos(id) ON DELETE SET NULL,
  tarefa_id       uuid REFERENCES public.plano_tarefas(id) ON DELETE SET NULL,
  funcionario_id  uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  data            date NOT NULL,
  descricao       text NOT NULL,
  progresso_pct    integer CHECK (progresso_pct BETWEEN 0 AND 100),
  foto_urls       text[],
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diario_empresa_obra_data ON public.diario_obra (empresa_id, obra_id, data DESC);
