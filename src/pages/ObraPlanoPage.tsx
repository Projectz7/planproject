import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowLeft, Plus, Flag, CheckCircle2, Lock, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Obra, Funcionario, Plano, Tarefa, StatusPlano } from "@/types";
import {
  fetchObra, fetchFuncionarios, fetchPlanosByObra, createPlano, updatePlanoStatus,
  fetchTarefasByPlano, updateTarefa, deleteTarefa,
} from "@/lib/supabaseService";
import ProgressoBar from "@/components/plan/ProgressoBar";
import TarefaFormDialog from "@/components/plan/TarefaFormDialog";
import KanbanView from "@/components/plan/KanbanView";
import { TarefaRow } from "@/components/plan/TarefaRow";
import {
  DndContext, useSensor, useSensors, PointerSensor, closestCenter,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
} from "@dnd-kit/sortable";

const STATUS_LABEL: Record<string, string> = {
  a_fazer: "A fazer", fazendo: "Fazendo", concluida: "Concluída", bloqueada: "Bloqueada", cancelada: "Cancelada",
};
const STATUS_COLOR: Record<string, string> = {
  a_fazer: "bg-slate-100 text-slate-600", fazendo: "bg-blue-100 text-blue-700",
  concluida: "bg-emerald-100 text-emerald-700", bloqueada: "bg-amber-100 text-amber-700",
  cancelada: "bg-rose-100 text-rose-700",
};
const PRIO_COLOR: Record<string, string> = {
  baixa: "text-slate-400", media: "text-slate-500", alta: "text-amber-500", critica: "text-rose-500",
};

function deltaDias(t: Tarefa): { dias: number; atrasada: boolean } {
  if (!t.data_fim || !t.data_fim_real) return { dias: 0, atrasada: false };
  const d1 = new Date(t.data_fim); const d2 = new Date(t.data_fim_real);
  const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  return { dias: diff, atrasada: diff > 0 };
}

export default function ObraPlanoPage() {
  const { obraId = "" } = useParams();
  const navigate = useNavigate();
  const { empresaId, funcionario } = useAuth();
  const [obra, setObra] = useState<Obra | null>(null);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoAtivoId, setPlanoAtivoId] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTarefas, setLoadingTarefas] = useState(false);
  const [view, setView] = useState<"tabela" | "kanban">("tabela");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Tarefa | null>(null);
  const [parentIdDialog, setParentIdDialog] = useState<string | null>(null);

  const planoAtivo = useMemo(() => planos.find((p) => p.id === planoAtivoId) || null, [planos, planoAtivoId]);
  const planofechado = planoAtivo?.status === "fechado";

  // Carga inicial
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ob, funcs, plans] = await Promise.all([
          fetchObra(obraId), fetchFuncionarios(), fetchPlanosByObra(obraId),
        ]);
        setObra(ob);
        setFuncionarios(funcs);
        setPlanos(plans);
        // seleciona plano: último fechado senão último rascunho senão null
        const fechado = [...plans].reverse().find((p) => p.status === "fechado");
        const rascunho = [...plans].reverse().find((p) => p.status === "rascunho");
        setPlanoAtivoId(fechado?.id || rascunho?.id || plans[plans.length - 1]?.id || null);
      } catch (e) {
        toast.error("Erro ao carregar obra: " + (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [obraId]);

  // Carga de tarefas quando muda plano ativo
  useEffect(() => {
    if (!planoAtivoId) { setTarefas([]); return; }
    (async () => {
      setLoadingTarefas(true);
      try {
        setTarefas(await fetchTarefasByPlano(planoAtivoId));
      } catch (e) {
        toast.error("Erro ao carregar tarefas: " + (e as Error).message);
      } finally {
        setLoadingTarefas(false);
      }
    })();
  }, [planoAtivoId]);

  async function recarregarTarefas() {
    if (!planoAtivoId) return;
    try { setTarefas(await fetchTarefasByPlano(planoAtivoId)); } catch (e) { toast.error((e as Error).message); }
  }

  async function handleNovoPlano() {
    if (!empresaId) return;
    try {
      const p = await createPlano(obraId, empresaId, `Plano ${planos.length + 1}`);
      setPlanos([...planos, p]);
      setPlanoAtivoId(p.id);
      toast.success("Plano criado");
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleFecharPlano() {
    if (!planoAtivo) return;
    if (!confirm("Fechar plano congela o esperado. Continuar?")) return;
    try {
      await updatePlanoStatus(planoAtivo.id, "fechado");
      setPlanos(planos.map((p) => p.id === planoAtivo.id ? { ...p, status: "fechado" } : p));
      toast.success("Plano fechado");
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleStatusInline(t: Tarefa, novoStatus: string) {
    if (planofechado) return;
    try {
      const patch: Partial<Tarefa> = { status: novoStatus as Tarefa["status"] };
      if (novoStatus === "concluida") {
        patch.progresso = 100;
        if (!t.data_fim_real) patch.data_fim_real = new Date().toISOString().split("T")[0];
      } else if (novoStatus === "fazendo" && !t.data_inicio_real) {
        patch.data_inicio_real = new Date().toISOString().split("T")[0];
      }
      await updateTarefa(t.id, patch);
      await recarregarTarefas();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleReorderKanban(tarefaId: string, novoStatus: string, novaOrdem: number) {
    if (planofechado) return;
    const t = tarefas.find((x) => x.id === tarefaId);
    const patch: Partial<Tarefa> = { status: novoStatus as Tarefa["status"], ordem: novaOrdem };
    if (t && novoStatus === "concluida" && t.status !== "concluida") {
      patch.progresso = 100;
      if (!t.data_fim_real) patch.data_fim_real = new Date().toISOString().split("T")[0];
    } else if (t && novoStatus === "fazendo" && t.status !== "fazendo" && !t.data_inicio_real) {
      patch.data_inicio_real = new Date().toISOString().split("T")[0];
    }
    try { await updateTarefa(tarefaId, patch); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function handleReparent(tarefaId: string, novoParentId: string | null, novaOrdem: number) {
    if (planofechado) return;
    try {
      await updateTarefa(tarefaId, { parent_id: novoParentId, ordem: novaOrdem });
      await recarregarTarefas();
      toast.success(novoParentId ? "Tarefa movida como sub-tarefa" : "Tarefa movida para a raiz");
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleUpdateTarefa(t: Tarefa, patch: Partial<Tarefa>) {
    if (planofechado) return;
    try {
      await updateTarefa(t.id, patch);
      await recarregarTarefas();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleDelete(t: Tarefa) {
    if (planofechado) return;
    if (!confirm(`Excluir tarefa "${t.titulo}"?`)) return;
    try { await deleteTarefa(t.id); await recarregarTarefas(); toast.success("Excluída"); }
    catch (e) { toast.error((e as Error).message); }
  }

  function abrirNova(parentId: string | null = null) {
    if (planofechado) { toast.error("Plano fechado - criar bloqueado"); return; }
    if (!planoAtivoId) { toast.error("Selecione/crie um plano primeiro"); return; }
    setEditando(null); setParentIdDialog(parentId); setDialogOpen(true);
  }
  function abrirEditar(t: Tarefa) {
    setEditando(t); setParentIdDialog(null); setDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!obra) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Flag className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Obra não encontrada.</p>
          <Button variant="link" onClick={() => navigate("/")}>Voltar</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" /> Obras
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold leading-none">{obra.titulo || "(sem título)"}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {obra.cliente || "-"} {obra.endereco ? `· ${obra.endereco}` : ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Seletor de plano + ações */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={planoAtivoId || ""} onValueChange={setPlanoAtivoId} disabled={planos.length === 0}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
            <SelectContent>
              {planos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} · <span className="text-xs text-muted-foreground">{p.status}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={handleNovoPlano}>
            <Plus className="w-4 h-4" /> Novo plano
          </Button>

          {planoAtivo && planoAtivo.status === "rascunho" && (
            <Button variant="outline" size="sm" onClick={handleFecharPlano}>
              <Lock className="w-4 h-4" /> Fechar plano
            </Button>
          )}
          {planoAtivo?.status === "fechado" && (
            <Badge variant="secondary" className="gap-1"><Lock className="w-3 h-3" /> Plano fechado (somente leitura no esperado)</Badge>
          )}

          <div className="flex-1" />

          {/* Toggle Tabela/Kanban */}
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setView("tabela")}
              className={`px-3 py-1.5 text-xs rounded-md transition ${view === "tabela" ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-50"}`}>
              Tabela
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 text-xs rounded-md transition ${view === "kanban" ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-50"}`}>
              Kanban
            </button>
          </div>

          {!planofechado ? (
            <Button size="sm" onClick={() => abrirNova(null)} disabled={!planoAtivoId}>
              <Plus className="w-4 h-4" /> Nova tarefa
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={recarregarTarefas}>
              <RefreshCw className="w-4 h-4" /> refresh
            </Button>
          )}
        </div>

        {/* ProgressBar do plano */}
        {planoAtivo && tarefas.length > 0 && (
          <PlanoProgressBar tarefas={tarefas} />
        )}

        {/* View */}
        {!planoAtivo ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Flag className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nenhum plano ainda.</p>
            <Button className="mt-3" onClick={handleNovoPlano}><Plus className="w-4 h-4" /> Criar primeiro plano</Button>
          </CardContent></Card>
        ) : loadingTarefas ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : view === "tabela" ? (
          <TabelaView tarefas={tarefas} funcs={funcionarios} planofechado={planofechado || false}
            onStatus={handleStatusInline} onEdit={abrirEditar} onDelete={handleDelete} onAddSub={(t) => abrirNova(t.id)}
            onReparent={handleReparent} onUpdate={handleUpdateTarefa} />
        ) : (
          <KanbanView tarefas={tarefas} funcs={funcionarios} planofechado={planofechado || false}
            onStatus={handleStatusInline} onReorder={handleReorderKanban}
            onEdit={abrirEditar} onDelete={handleDelete} onAddSub={(t) => abrirNova(t.id)} />
        )}
      </main>

      <TarefaFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        empresaId={empresaId || ""}
        obraId={obraId}
        planoId={planoAtivoId || ""}
        parentId={parentIdDialog}
        funcionarios={funcionarios}
        editando={editando}
        planofechado={planofechado}
        onSalvou={recarregarTarefas}
      />
    </div>
  );
}

// ---------- ProgressBar do plano (média ponderada nas raízes) ----------
function PlanoProgressBar({ tarefas }: { tarefas: Tarefa[] }) {
  const pls = tarefas.filter((t) => !t.parent_id);
  let somaP = 0, somaW = 0;
  for (const t of pls) {
    let w = 1;
    if (t.data_fim && t.data_inicio) {
      const d1 = new Date(t.data_inicio); const d2 = new Date(t.data_fim);
      w = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    }
    somaP += t.progresso * w;
    somaW += w;
  }
  const pct = somaW > 0 ? Math.round(somaP / somaW) : 0;
  return (
    <Card className="border-slate-200">
      <CardContent className="p-3 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Progresso do plano ({pls.length} tarefas raiz)</p>
          <ProgressoBar progresso={pct} size="md" className="mt-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Tabela (Zenkit-style: arvore + drag-to-indent + inline-edit) ----------
function TabelaView({
  tarefas, funcs, planofechado, onStatus, onEdit, onDelete, onAddSub, onReparent, onUpdate,
}: {
  tarefas: Tarefa[]; funcs: Funcionario[]; planofechado: boolean;
  onStatus: (t: Tarefa, s: string) => void; onEdit: (t: Tarefa) => void;
  onDelete: (t: Tarefa) => void; onAddSub: (t: Tarefa) => void;
  onReparent: (tarefaId: string, novoParentId: string | null, novaOrdem: number) => Promise<void>;
  onUpdate: (t: Tarefa, patch: Partial<Tarefa>) => Promise<void>;
}) {
  const funcMap = new Map(funcs.map((f) => [f.id, f.nome]));
  const sorted = useMemo(() => ordernar(tarefas), [tarefas]);

  // mapeia tarefa -> filhas (para saber quais expandir e contar)
  const filhasMap = useMemo(() => {
    const m = new Map<string | null, Tarefa[]>();
    for (const t of sorted) {
      const k = t.parent_id || null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [sorted]);

  // expandir por default (qualquer tarefa com filhas = true)
  const [expandidoSet, setExpandidoSet] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const t of sorted) if (filhasMap.has(t.id)) s.add(t.id);
    return s;
  });
  useEffect(() => {
    // adiciona automaticamente novas maes
    setExpandidoSet((prev) => {
      const novo = new Set(prev);
      for (const t of sorted) if ((filhasMap.get(t.id)?.length || 0) > 0 && !novo.has(t.id)) novo.add(t.id);
      return novo;
    });
  }, [sorted.length, filhasMap.size]);

  // lista visivel = todas as tarefas, MAS filhos de nodes colapsados sao pulados
  const visiveis = useMemo(() => {
    const out: Tarefa[] = [];
    const walk = (parentId: string | null) => {
      const filhos = filhasMap.get(parentId) || [];
      filhos.sort((a, b) => (a.ordem - b.ordem) || (a.created_at!.localeCompare(b.created_at!)));
      for (const f of filhos) {
        out.push(f);
        if (expandidoSet.has(f.id)) walk(f.id);
      }
    };
    walk(null);
    return out;
  }, [sorted, filhasMap, expandidoSet]);

  // calcula nivel, ultimoFilho (└ vs ├) e trilha de conectores por tarefa visivel
  const metadata = useMemo(() => {
    // primeiro: ancestral comum + nivel
    const mapa = new Map<string, { nivel: number; trilha: boolean[]; ehUltimaFilha: boolean }>();
    const fill = (parentId: string | null, nivelAtual: number, trilhaAtual: boolean[]) => {
      const filhos = (filhasMap.get(parentId) || []).slice();
      filhos.sort((a, b) => (a.ordem - b.ordem) || (a.created_at!.localeCompare(b.created_at!)));
      filhos.forEach((f, idx) => {
        const ehUltima = idx === filhos.length - 1;
        mapa.set(f.id, {
          nivel: nivelAtual,
          trilha: trilhaAtual,
          ehUltimaFilha: ehUltima,
        });
        // para filhos: trilha ganha "true se ancestral ainda tem irmaos abaixo, false caso contrario"
        const novaTrilha = [...trilhaAtual, !ehUltima];
        fill(f.id, nivelAtual + 1, novaTrilha);
      });
    };
    fill(null, 0, []);
    return mapa;
  }, [filhasMap]);

  const sensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const sensors = useSensors(sensor);

  // estado local p/ reordenar/reparentar instantaneo (sincroniza c/ props onReparent)
  const [localItems, setLocalItems] = useState<string[]>(visiveis.map((t) => t.id));
  useEffect(() => { setLocalItems(visiveis.map((t) => t.id)); }, [visiveis.map((t) => t.id).join(",")]);

  // contador colapsados pra mensagens
  const totalTarefas = sorted.length;
  const totalVisiveis = visiveis.length;
  const colapsadas = totalTarefas - totalVisiveis;

  function onDragEnd(e: DragEndEvent) {
    if (planofechado) return;
    const { active, over } = e;
    if (!over) return;
    if (active.id === over.id) return;

    const activeTarefa = visiveis.find((t) => t.id === active.id);
    const overTarefa = visiveis.find((t) => t.id === over.id);
    if (!activeTarefa || !overTarefa) return;

    // Distancia em X (horizontal) do centro do over p/ direita = mais indentacao (filha)
    // delta.x positivo = arrastou p/ direita
    const delta = (over.rect.final.left + (over.rect.final.width / 2)) - (active.rect.final.left + (active.rect.final.width / 2));
    const INDENT = 28; // px equivalente a 1 nivel
    const offsetX = delta; // simplificado: compara offset
    // nivel alvo: nivel do over + (offsetX > INDENT/2 ? 1 : 0)
    // se offsetX > indentMetade => vira filha do over; senao irma (mesmo parent do over)
    const overNivel = metadata.get(over.id)?.nivel ?? 0;
    const overParentId = overTarefa.parent_id;
    const ehFilha = offsetX > (INDENT / 2);

    let novoParentId: string | null;
    let novaOrdem: number;
    if (ehFilha) {
      // vira filho do over
      novoParentId = over.id;
      const filhosOver = (filhasMap.get(over.id) || []).filter((t) => t.id !== active.id);
      novaOrdem = filhosOver.length; // no fim
    } else {
      // vira irma do over (mesmo parent)
      novoParentId = overParentId;
      const irmaos = (filhasMap.get(overParentId) || []).filter((t) => t.id !== active.id);
      const idxOver = irmaos.findIndex((t) => t.id === over.id);
      novaOrdem = idxOver + 1; // coloca logo apos o over
    }

    // protecao: nao deixa criar ciclo (mover uma mae p/ dentro de sua propria filha)
    if (novoParentId === active.id) return;
    let ancestor: string | null = novoParentId;
    while (ancestor) {
      if (ancestor === active.id) return; // ciclo detectado
      const anc = tarefas.find((t) => t.id === ancestor);
      ancestor = anc?.parent_id ?? null;
    }

    onReparent(String(active.id), novoParentId, novaOrdem);
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <DndContext sensores={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} onDragStart={() => {}}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="text-xs uppercase text-slate-500">Título <span className="normal-case text-slate-400">(arraste p/ definir filha/irmã)</span></TableHead>
                <TableHead className="text-xs uppercase text-slate-500">Resp.</TableHead>
                <TableHead className="text-xs uppercase text-slate-500">Status</TableHead>
                <TableHead className="text-right text-xs uppercase text-slate-500">Início esp.</TableHead>
                <TableHead className="text-right text-xs uppercase text-slate-500">Fim esp.</TableHead>
                <TableHead className="text-right text-xs uppercase text-slate-500">Fim real</TableHead>
                <TableHead className="text-center text-xs uppercase text-slate-500">Δ</TableHead>
                <TableHead className="text-xs uppercase text-slate-500">Progresso (auto/manual)</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-32 text-center text-slate-400">
                  Nenhuma tarefa. Clique em "Nova tarefa".
                </TableCell></TableRow>
              ) : (
                <SortableContext items={visiveis.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {visiveis.map((t) => {
                    const meta = metadata.get(t.id);
                    if (!meta) return null;
                    return (
                      <TarefaRow
                        key={t.id}
                        tarefa={t}
                        nivel={meta.nivel}
                        ehUltimaFilha={meta.ehUltimaFilha}
                        trilhaConectores={meta.trilha}
                        funcMap={funcMap}
                        planofechado={planofechado}
                        expandido={expandidoSet.has(t.id)}
                        temFilhas={(filhasMap.get(t.id)?.length || 0)}
                        onToggleExpand={() => setExpandidoSet((prev) => {
                          const novo = new Set(prev);
                          if (novo.has(t.id)) novo.delete(t.id); else novo.add(t.id);
                          return novo;
                        })}
                        onChange={async (patch) => {
                          const p: Partial<Tarefa> = { ...patch };
                          if (p.status === "concluida") { p.progresso = 100; if (!t.data_fim_real) p.data_fim_real = new Date().toISOString().split("T")[0]; }
                          else if (p.status === "fazendo" && !t.data_inicio_real) p.data_inicio_real = new Date().toISOString().split("T")[0];
                          await onUpdate(t, p);
                        }}
                        onAddSub={() => onAddSub(t)}
                        onEdit={() => onEdit(t)}
                        onDelete={() => onDelete(t)}
                      />
                    );
                  })}
                </SortableContext>
              )}
            </TableBody>
          </Table>
        </DndContext>
        {colapsadas > 0 && (
          <div className="px-4 py-1.5 text-[11px] text-slate-400 border-t">
            {colapsadas} tarefa(s) oculta(s) em nós colapsados · {totalVisiveis} visível(is) de {totalTarefas}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function fmtData(s: string | null | undefined): string {
  if (!s) return "-";
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y.slice(2)}`;
  } catch { return s; }
}

function prioridadeDot(p: string): React.ReactNode {
  return <span className={`inline-block w-2 h-2 rounded-full ${PRIO_COLOR[p]}`} />;
}

// Ordenar: raízes primeiro; filhas dentro, logo em seguida de sua mãe (mantém criar-order)
function ordernar(tarefas: Tarefa[]): Tarefa[] {
  const byParent = new Map<string | null, Tarefa[]>();
  for (const t of tarefas) {
    const k = t.parent_id || null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(t);
  }
  const out: Tarefa[] = [];
  const walk = (parentId: string | null) => {
    const filhos = byParent.get(parentId) || [];
    filhos.sort((a, b) => (a.ordem - b.ordem) || (a.created_at!.localeCompare(b.created_at!)));
    for (const f of filhos) {
      out.push(f);
      walk(f.id);
    }
  };
  walk(null);
  return out;
}
