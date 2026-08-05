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
  fetchTarefasByPlano, updateTarefa, deleteTarefa, createTarefa, reagruparFilhas,
  calcularCustoTarefa,
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
import { GamepadControle, type GamepadAcao } from "@/components/plan/GamepadControle";

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
  const [focoInlineId, setFocoInlineId] = useState<string | null>(null);
  const [tarefaSelecionadaId, setTarefaSelecionadaId] = useState<string | null>(null);

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

  async function handleDrop(
    tarefaId: string,
    novoParentId: string | null,
    novaOrdem: number,
    virarMaeDe: { overId: string; overParentId: string | null; overOrdem: number } | null
  ) {
    if (planofechado) return;
    const t = tarefas.find((x) => x.id === tarefaId);
    if (!t) return;
    try {
      const patch: Partial<Tarefa> = { parent_id: novoParentId, ordem: novaOrdem };
      if (t.parent_id !== novoParentId) {
        patch.status = t.status;
      }
      await updateTarefa(tarefaId, patch);
      if (virarMaeDe) {
        // arrastada vira mae: move filhas do parent antigo (>= ordem da over) para baixo da arrastada
        const afetadas = await reagruparFilhas(virarMaeDe.overParentId, virarMaeDe.overOrdem, tarefaId);
        if (afetadas > 0) toast.success(`Tarefa virou mãe de ${afetadas} tarefa(s)`);
        else toast.success("Tarefa reposicionada");
      } else {
        toast.success(novoParentId ? "Tarefa movida" : "Tarefa movida para a raiz");
      }
      await recarregarTarefas();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleMudarNivel(tarefaId: string, direcao: "promover" | "rebaixar") {
    if (planofechado) return;
    const t = tarefas.find((x) => x.id === tarefaId);
    if (!t) return;
    if (direcao === "promover" && !t.parent_id) { toast.error("Já está na raiz"); return; }
    try {
      if (direcao === "promover") {
        // subir 1 nivel: vira irma da mae (logo apos ela)
        const mae = tarefas.find((x) => x.id === t.parent_id);
        if (!mae) return;
        const irmaosDaMae = tarefas.filter((x) => x.parent_id === mae.parent_id).sort((a, b) => a.ordem - b.ordem);
        const idxMae = irmaosDaMae.findIndex((x) => x.id === mae.id);
        const novaOrdem = idxMae + 1;
        await updateTarefa(tarefaId, { parent_id: mae.parent_id, ordem: novaOrdem });
      } else {
        // rebaixar: vira filha da irma anterior (imediato acima no mesmo nivel)
        const irmaos = tarefas
          .filter((x) => x.parent_id === t.parent_id && x.id !== t.id)
          .sort((a, b) => a.ordem - b.ordem);
        const idxT = [...irmaos, t].sort((a, b) => a.ordem - b.ordem).findIndex((x) => x.id === t.id);
        const irmaAnterior = irmaos[idxT - 1];
        if (!irmaAnterior) { toast.error("Sem irmã anterior para rebaixar"); return; }
        const filhosIrma = tarefas.filter((x) => x.parent_id === irmaAnterior.id);
        await updateTarefa(tarefaId, { parent_id: irmaAnterior.id, ordem: filhosIrma.length });
      }
      await recarregarTarefas();
      toast.success(direcao === "promover" ? "Promovida (subiu 1 nível)" : "Rebaixada (virou sub-tarefa)");
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleMoverVertical(tarefaId: string, direcao: "cima" | "baixo") {
    if (planofechado) return;
    const t = tarefas.find((x) => x.id === tarefaId);
    if (!t) return;
    const irmaos = tarefas
      .filter((x) => x.parent_id === t.parent_id)
      .sort((a, b) => a.ordem - b.ordem);
    const idx = irmaos.findIndex((x) => x.id === tarefaId);
    if (idx === -1) return;
    try {
      if (direcao === "cima") {
        if (idx === 0) { toast.error("Já é a primeira"); return; }
        const alvo = irmaos[idx - 1];
        // trocar posicoes: t vira ordem do alvo, alvo vira ordem do t
        const ordemT = t.ordem;
        await updateTarefa(alvo.id, { ordem: ordemT });
        await updateTarefa(tarefaId, { ordem: alvo.ordem });
      } else {
        if (idx === irmaos.length - 1) { toast.error("Já é a última"); return; }
        const alvo = irmaos[idx + 1];
        const ordemT = t.ordem;
        await updateTarefa(alvo.id, { ordem: ordemT });
        await updateTarefa(tarefaId, { ordem: alvo.ordem });
      }
      await recarregarTarefas();
    } catch (e) { toast.error((e as Error).message); }
  }

  function podeMover(tarefaId: string): { cima: boolean; baixo: boolean; esquerda: boolean; direita: boolean } {
    const t = tarefas.find((x) => x.id === tarefaId);
    if (!t) return { cima: false, baixo: false, esquerda: false, direita: false };
    const irmaos = tarefas.filter((x) => x.parent_id === t.parent_id).sort((a, b) => a.ordem - b.ordem);
    const idx = irmaos.findIndex((x) => x.id === tarefaId);
    return {
      cima: idx > 0,
      baixo: idx < irmaos.length - 1,
      esquerda: !!t.parent_id,
      direita: idx > 0,
    };
  }

  async function handleGamepadAction(acao: GamepadAcao) {
    if (planofechado) return;
    switch (acao) {
      case "toggle_selecionar": {
        if (tarefaSelecionadaId) setTarefaSelecionadaId(null);
        else {
          const visiveis = ordernar(tarefas);
          if (visiveis.length > 0) setTarefaSelecionadaId(visiveis[0].id);
          else toast.info("Nenhuma tarefa para selecionar");
        }
        break;
      }
      case "cima":
      case "baixo":
        if (tarefaSelecionadaId) await handleMoverVertical(tarefaSelecionadaId, acao);
        break;
      case "esquerda":
        if (tarefaSelecionadaId) await handleMudarNivel(tarefaSelecionadaId, "promover");
        break;
      case "direita":
        if (tarefaSelecionadaId) await handleMudarNivel(tarefaSelecionadaId, "rebaixar");
        break;
      case "adicionar":
        setTarefaSelecionadaId(null);
        await abrirNova(null);
        break;
      case "editar":
        if (tarefaSelecionadaId) {
          setFocoInlineId(tarefaSelecionadaId);
          setTimeout(() => setFocoInlineId(null), 3000);
        }
        break;
      case "excluir":
        if (tarefaSelecionadaId) {
          const t = tarefas.find((x) => x.id === tarefaSelecionadaId);
          if (t) await handleDelete(t);
          setTarefaSelecionadaId(null);
        }
        break;
    }
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

  async function abrirNova(parentId: string | null = null) {
    if (planofechado) { toast.error("Plano fechado - criar bloqueado"); return; }
    if (!planoAtivoId) { toast.error("Selecione/crie um plano primeiro"); return; }
    if (!empresaId || !obraId) { toast.error("Contexto de empresa/obra ausente"); return; }
    try {
      const irmaos = tarefas.filter((t) => t.parent_id === parentId).sort((a, b) => a.ordem - b.ordem);
      const novaOrdem = irmaos.length;
      const nova = await createTarefa({
        empresa_id: empresaId,
        obra_id: obraId,
        plano_id: planoAtivoId,
        titulo: "Sem título",
        status: "a_fazer",
        prioridade: "media",
        responsavel_id: null,
        parent_id: parentId,
        ordem: novaOrdem,
        progresso: 0,
        progresso_manual: false,
      });
      await recarregarTarefas();
      setFocoInlineId(nova.id);
      setTimeout(() => setFocoInlineId(null), 3000);
    } catch (e) { toast.error((e as Error).message); }
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
          <p>Projeto não encontrado.</p>
          <Button variant="link" onClick={() => { window.location.href = "https://p7store.vercel.app"; }}>Voltar</Button>
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
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}
              title="Voltar para projetos no PlanSeven">
              <ArrowLeft className="w-4 h-4" /> Projetos
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

      <main className="max-w-7xl mx-auto p-4 space-y-4 pb-32 md:pb-4">
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
          <PlanoProgressBar tarefas={tarefas} funcs={funcionarios} />
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
            onDrop={handleDrop} onUpdate={handleUpdateTarefa}
            onMudarNivel={handleMudarNivel} onMoverVertical={handleMoverVertical} podeMover={podeMover}
            focoInlineId={focoInlineId} selecionadaId={tarefaSelecionadaId} onSelecionar={(id) => setTarefaSelecionadaId(id)} />
        ) : (
          <KanbanView tarefas={tarefas} funcs={funcionarios} planofechado={planofechado || false}
            onStatus={handleStatusInline} onReorder={handleReorderKanban}
            onEdit={abrirEditar} onDelete={handleDelete} onAddSub={(t) => abrirNova(t.id)} />
        )}
      </main>

      {view === "tabela" && !planofechado && planoAtivoId && (
        <GamepadControle
          onAcao={handleGamepadAction}
          tarefaSelecionada={!!tarefaSelecionadaId}
          podeMover={tarefaSelecionadaId ? podeMover(tarefaSelecionadaId) : { cima: false, baixo: false, esquerda: false, direita: false }}
        />
      )}

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

// ---------- ProgressBar do plano (média ponderada nas raízes) + Custo MO total ----------
function PlanoProgressBar({ tarefas, funcs }: { tarefas: Tarefa[]; funcs: Funcionario[] }) {
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
  const custoTotal = tarefas.reduce((acc, t) => acc + calcularCustoTarefa(t, funcs), 0);
  return (
    <Card className="border-slate-200">
      <CardContent className="p-3 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Progresso do plano ({pls.length} tarefas raiz)</p>
          <ProgressoBar progresso={pct} size="md" className="mt-1.5" />
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Custo MO total</p>
          <p className={`text-base font-bold tabular-nums ${custoTotal > 0 ? "text-emerald-600" : "text-slate-300"}`}>
            {custoTotal > 0
              ? `R$ ${custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "-"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Tabela (Zenkit-style: arvore + drag-to-indent + inline-edit + joystick) ----------
function TabelaView({
  tarefas, funcs, planofechado, onStatus, onEdit, onDelete, onAddSub, onDrop, onUpdate, onMudarNivel, onMoverVertical, podeMover, focoInlineId, selecionadaId, onSelecionar,
}: {
  tarefas: Tarefa[]; funcs: Funcionario[]; planofechado: boolean;
  onStatus: (t: Tarefa, s: string) => void; onEdit: (t: Tarefa) => void;
  onDelete: (t: Tarefa) => void; onAddSub: (t: Tarefa) => void;
  onDrop: (
    tarefaId: string,
    novoParentId: string | null,
    novaOrdem: number,
    virarMaeDe: { overId: string; overParentId: string | null; overOrdem: number } | null
  ) => Promise<void>;
  onUpdate: (t: Tarefa, patch: Partial<Tarefa>) => Promise<void>;
  onMudarNivel: (tarefaId: string, direcao: "promover" | "rebaixar") => Promise<void>;
  onMoverVertical: (tarefaId: string, direcao: "cima" | "baixo") => Promise<void>;
  podeMover: (tarefaId: string) => { cima: boolean; baixo: boolean; esquerda: boolean; direita: boolean };
  focoInlineId: string | null;
  selecionadaId: string | null;
  onSelecionar: (id: string | null) => void;
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
    const { active, over, delta } = e;
    if (!over) return;
    if (active.id === over.id) return;

    const activeTarefa = visiveis.find((t) => t.id === active.id);
    const overTarefa = visiveis.find((t) => t.id === over.id);
    if (!activeTarefa || !overTarefa) return;

    const INDENT = 28;
    const activeMeta = metadata.get(active.id);
    const overMeta = metadata.get(over.id);
    if (!activeMeta || !overMeta) return;
    const nivelActive = activeMeta.nivel;
    const nivelOver = overMeta.nivel;

    // nivel alvo = nivel original + deslocamento horizontal arredondado (clamped 0..nivelMaxVisivel)
    const nivelMax = visiveis.reduce((m, t) => Math.max(m, metadata.get(t.id)?.nivel ?? 0), 0);
    const nivelAlvo = Math.max(0, Math.min(nivelMax, nivelActive + Math.round(delta.x / INDENT)));

    // detecta "acima do over" = soltou na metade superior da linha over (~ delta.y < 0 forte)
    const alturaLinha = over.rect.final.height || 36;
    const acimaDoOver = delta.y < 0 && Math.abs(delta.y) > alturaLinha * 0.4;

    // protecao ciclo: novoParentId nao pode ser active nem descendente
    function ehDescendente(id: string, ancestralId: string): boolean {
      let cur: string | null = ancestralId;
      while (cur) {
        if (cur === id) return true;
        const anc = tarefas.find((t) => t.id === cur);
        cur = anc?.parent_id ?? null;
      }
      return false;
    }
    function irmaosDe(parentId: string | null): Tarefa[] {
      return (filhasMap.get(parentId) || []).filter((t) => t.id !== active.id);
    }
    function ultimoNivelVisivelAte(idLimite: string, nivel: number): Tarefa | null {
      // ultima tarefa no nivel `nivel` que aparece antes de idLimite na lista visiveis
      const idx = visiveis.findIndex((t) => t.id === idLimite);
      for (let i = idx - 1; i >= 0; i--) {
        const t = visiveis[i];
        if ((metadata.get(t.id)?.nivel ?? 0) === nivel) return t;
      }
      return null;
    }

    const overParentId = overTarefa.parent_id;
    let novoParentId: string | null;
    let novaOrdem: number;
    let virarMaeDe: { overId: string; overParentId: string | null; overOrdem: number } | null = null;

    // CASO A: vira MAE da over (soltar acima e nivelAlvo = nivelOver - 1 OU nivelAlvo < nivelOver)
    // = re-agrupar: arrastada vira pai de over e suas irmas subsequentes (mesmo parent antigo, ordem >= over.ordem)
    if (acimaDoOver && nivelAlvo < nivelOver) {
      const novoPai = (nivelAlvo === 0) ? null
        : (ultimoNivelVisivelAte(over.id, nivelAlvo - 1)?.id ?? null);
      if (ehDescendente(active.id, novoPai ?? "")) return;
      novoParentId = novoPai;
      // ordem dentro do novo pai: posicao onde a arrastada deve ficar (no nivelAlvo, antes de over)
      const irmaosNivelAlvo = irmaosDe(novoPai);
      const idxInserir = irmaosNivelAlvo.findIndex((t) => t.id === overTarefa.parent_id);
      novaOrdem = idxInserir === -1 ? irmaosNivelAlvo.length : idxInserir;
      virarMaeDe = {
        overId: over.id,
        overParentId: overParentId,
        overOrdem: overTarefa.ordem,
      };
    }
    // CASO B: rebaixar (nivelAlvo > nivelOver OU nivelAlvo = nivelOver + 1)
    else if (nivelAlvo > nivelOver) {
      // novo pai = tarefa no nivel `nivelAlvo - 1` imediatamente acima do over (ancestral visivel)
      const novaMae = ultimoNivelVisivelAte(over.id, nivelAlvo - 1);
      if (!novaMae) return;
      if (ehDescendente(active.id, novaMae.id)) return;
      novoParentId = novaMae.id;
      // ao rebaixar vira filha no fim da lista de filhos do novaMae
      const filhosNovoPai = irmaosDe(novaMae.id);
      // se novaMae = over, coloca no inicio (antes das filhas atuais); senao no fim
      novaOrdem = novaMae.id === over.id ? 0 : filhosNovoPai.length;
    }
    // CASO C: irma no mesmo nivel do over (nivelAlvo === nivelOver e mesmo parent)
    else if (nivelAlvo === nivelOver) {
      novoParentId = overParentId;
      if (ehDescendente(active.id, novoParentId ?? "")) return;
      const irmaos = irmaosDe(overParentId);
      const idxOver = irmaos.findIndex((t) => t.id === over.id);
      if (idxOver === -1) return;
      novaOrdem = acimaDoOver ? idxOver : idxOver + 1;
    }
    // CASO D: promover (nivelAlvo < nivelOver, mas nao virou mae: soltou abaixo)
    else {
      // subir: novo parent tem nivel = nivelAlvo - 1; buscar irma ancestral com parent_id do nivel.
      // Simpler: o novo parent_id eh o irmao no nivel `nivelAlvo` mais proximo a cima do over.
      const irmaNoNivel = ultimoNivelVisivelAte(over.id, nivelAlvo);
      novoParentId = irmaNoNivel ? (irmaNoNivel.parent_id) : null;
      if (ehDescendente(active.id, novoParentId ?? "")) return;
      const irmaos = irmaosDe(novoParentId);
      novaOrdem = irmaNoNivel ? irmaos.findIndex((t) => t.id === irmaNoNivel.id) + 1 : irmaos.length;
      if (novaOrdem < 0) novaOrdem = irmaos.length;
    }

    onDrop(String(active.id), novoParentId, novaOrdem, virarMaeDe);
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} onDragStart={() => {}}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="text-xs uppercase text-slate-500">Título <span className="normal-case text-slate-400 hidden md:inline">(arraste p/ definir filha/irmã)</span></TableHead>
                <TableHead className="text-xs uppercase text-slate-500 w-24">Ações</TableHead>
                <TableHead className="text-xs uppercase text-slate-500">Status</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 hidden md:table-cell">Resp.</TableHead>
                <TableHead className="text-right text-xs uppercase text-slate-500 hidden md:table-cell">Início esp.</TableHead>
                <TableHead className="text-right text-xs uppercase text-slate-500 hidden md:table-cell">Fim esp.</TableHead>
                <TableHead className="text-right text-xs uppercase text-slate-500 hidden lg:table-cell">Fim real</TableHead>
                <TableHead className="text-center text-xs uppercase text-slate-500 hidden lg:table-cell">Δ</TableHead>
                <TableHead className="text-right text-xs uppercase text-slate-500 hidden md:table-cell">Custo MO</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 hidden md:table-cell">Progresso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="h-32 text-center text-slate-400">
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
                        custoMO={calcularCustoTarefa(t, funcs)}
                        planofechado={planofechado}
                        expandido={expandidoSet.has(t.id)}
                        temFilhas={(filhasMap.get(t.id)?.length || 0)}
                        focoInlineTitulo={focoInlineId === t.id}
                        podeMover={podeMover(t.id)}
                        selecionada={selecionadaId === t.id}
                        onSelecionar={() => onSelecionar(selecionadaId === t.id ? null : t.id)}
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
                        onPromote={() => onMudarNivel(t.id, "promover")}
                        onDemote={() => onMudarNivel(t.id, "rebaixar")}
                        onMoverCima={() => onMoverVertical(t.id, "cima")}
                        onMoverBaixo={() => onMoverVertical(t.id, "baixo")}
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
