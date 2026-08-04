import { supabase } from "@/integrations/supabase/client";
import type { Obra, Funcionario, Plano, Tarefa, StatusPlano } from "@/types";

// ---------- Obras (do schema do di-gest) ----------
export async function fetchObras(): Promise<Obra[]> {
  const { data, error } = await supabase
    .from("obras")
    .select("id, titulo, cliente, status, endereco, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as Obra[];
}

export async function fetchObra(id: string): Promise<Obra | null> {
  const { data, error } = await supabase
    .from("obras")
    .select("id, titulo, cliente, status, endereco, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Obra;
}

// ---------- Funcionários ----------
export async function fetchFuncionarios(): Promise<Funcionario[]> {
  const { data, error } = await supabase
    .from("funcionarios")
    .select("id, nome, is_gerente, ativo, equipe_id, telefone")
    .eq("ativo", true)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as Funcionario[];
}

// ---------- Planos ----------
export async function fetchPlanosByObra(obraId: string): Promise<Plano[]> {
  const { data, error } = await supabase
    .from("planos")
    .select("*")
    .eq("obra_id", obraId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as Plano[];
}

export async function createPlano(obraId: string, empresaId: string, nome: string): Promise<Plano> {
  const { data, error } = await supabase
    .from("planos")
    .insert({ obra_id: obraId, empresa_id: empresaId, nome, status: "rascunho" })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Plano;
}

export async function updatePlanoStatus(planoId: string, status: StatusPlano): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "fechado") patch.fechado_em = new Date().toISOString();
  const { error } = await supabase.from("planos").update(patch).eq("id", planoId);
  if (error) throw error;
}

// ---------- Tarefas ----------
export async function fetchTarefasByPlano(planoId: string): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from("plano_tarefas")
    .select("*, responsavel:funcionarios(id, nome)")
    .eq("plano_id", planoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as Tarefa[];
}

type TarefaInsert = Omit<Tarefa, "id" | "created_at" | "updated_at" | "responsavel" | "responsavelNome" | "progresso"> & Partial<Pick<Tarefa, "progresso">>;

export async function createTarefa(t: TarefaInsert): Promise<Tarefa> {
  const { data, error } = await supabase
    .from("plano_tarefas")
    .insert({ ...t, progresso: t.progresso ?? 0 })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Tarefa;
}

export async function updateTarefa(id: string, patch: Partial<Tarefa>): Promise<void> {
  const { error } = await supabase.from("plano_tarefas").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteTarefa(id: string): Promise<void> {
  const { error } = await supabase.from("plano_tarefas").delete().eq("id", id);
  if (error) throw error;
}

export async function reagruparFilhas(parentAntigo: string | null, ordemLimite: number, novoParent: string): Promise<number> {
  const { data, error } = await supabase.rpc("reagrupar_filhas", {
    p_parent_antigo: parentAntigo,
    p_ordem_limite: ordemLimite,
    p_novo_parent: novoParent,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}
