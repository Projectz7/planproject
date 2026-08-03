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
            onStatus={handleStatusInline} onEdit={abrirEditar} onDelete={handleDelete} onAddSub={(t) => abrirNova(t.id)} />
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

// ---------- Tabela ----------
function TabelaView({
  tarefas, funcs, planofechado, onStatus, onEdit, onDelete, onAddSub,
}: {
  tarefas: Tarefa[]; funcs: Funcionario[]; planofechado: boolean;
  onStatus: (t: Tarefa, s: string) => void; onEdit: (t: Tarefa) => void;
  onDelete: (t: Tarefa) => void; onAddSub: (t: Tarefa) => void;
}) {
  const funcMap = new Map(funcs.map((f) => [f.id, f.nome]));
  // ordenar: raízes primeiro, filhas logo após a mãe
  const sorted = useMemo(() => ordernar(tarefas), [tarefas]);

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-xs uppercase text-slate-500">Título</TableHead>
              <TableHead className="text-xs uppercase text-slate-500">Resp.</TableHead>
              <TableHead className="text-xs uppercase text-slate-500">Status</TableHead>
              <TableHead className="text-right text-xs uppercase text-slate-500">Início esp.</TableHead>
              <TableHead className="text-right text-xs uppercase text-slate-500">Fim esp.</TableHead>
              <TableHead className="text-right text-xs uppercase text-slate-500">Fim real</TableHead>
              <TableHead className="text-center text-xs uppercase text-slate-500">Δ</TableHead>
              <TableHead className="text-xs uppercase text-slate-500">Progresso</TableHead>
              <TableHead className="text-xs uppercase text-slate-500 w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="h-32 text-center text-slate-400">
                Nenhuma tarefa. Clique em "Nova tarefa".
              </TableCell></TableRow>
            ) : sorted.map((t) => {
              const { dias, atrasada } = deltaDias(t);
              const isSub = !!t.parent_id;
              return (
                <TableRow key={t.id} className={isSub ? "bg-slate-50/40" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2" style={isSub ? { paddingLeft: 20 } : {}}>
                      {isSub && <span className="text-slate-300">↳</span>}
                      {prioridadeDot(t.prioridade)}
                      <span>{t.titulo}</span>
                      {isSub && <Badge variant="outline" className="text-[9px]">sub</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {t.responsavel?.nome || funcMap.get(t.responsavel_id || "") || "-"}
                  </TableCell>
                  <TableCell>
                    {planofechado ? (
                      <Badge variant="outline" className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                    ) : (
                      <Select value={t.status} onValueChange={(v) => onStatus(t, v)}>
                        <SelectTrigger className="h-7 text-xs w-32 border-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABEL).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-slate-500">{fmtData(t.data_inicio)}</TableCell>
                  <TableCell className="text-right text-sm text-slate-500">{fmtData(t.data_fim)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {t.data_fim_real ? (
                      <span className="text-slate-700">{fmtData(t.data_fim_real)}</span>
                    ) : <span className="text-slate-300">-</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {t.data_fim && t.data_fim_real ? (
                      <Badge variant="outline" className={atrasada ? "border-rose-200 bg-rose-50 text-rose-600"
                        : "border-emerald-200 bg-emerald-50 text-emerald-600"}>
                        {dias > 0 ? `+${dias}d` : dias === 0 ? "✓" : `${dias}d`}
                      </Badge>
                    ) : <span className="text-slate-300">-</span>}
                  </TableCell>
                  <TableCell>
                    <ProgressoBar progresso={t.progresso} atrasada={atrasada} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {!planofechado && !isSub && (
                        <button onClick={() => onAddSub(t)} title="Adicionar subtarefa"
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-primary">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => onEdit(t)} title="Editar"
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-primary">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!planofechado && (
                        <button onClick={() => onDelete(t)} title="Excluir"
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
