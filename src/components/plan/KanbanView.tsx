import { useState, useEffect } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, useDroppable, type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, GripVertical, Calendar, User, Users } from "lucide-react";
import type { Tarefa, Funcionario, StatusTarefa, Equipe } from "@/types";
import ProgressoBar from "./ProgressoBar";

const COLunas: { id: StatusTarefa; titulo: string; cor: string; bola: string }[] = [
  { id: "a_fazer",  titulo: "A Fazer",   cor: "border-slate-200 bg-slate-50/50",  bola: "bg-slate-400" },
  { id: "fazendo",  titulo: "Fazendo",    cor: "border-blue-200 bg-blue-50/50",    bola: "bg-blue-500" },
  { id: "concluida", titulo: "Concluída", cor: "border-emerald-200 bg-emerald-50/50", bola: "bg-emerald-500" },
];

const PRIO_DOT: Record<string, string> = {
  baixa: "bg-slate-300", media: "bg-amber-400", alta: "bg-orange-500", critica: "bg-red-500",
};

function CardTarefa({
  t, funcMap, equipeMap, onEdit, onDelete, onAddSub, isOverlay,
}: {
  t: Tarefa; funcMap: Map<string, string>; equipeMap: Map<string, string>;
  onEdit: (t: Tarefa) => void; onDelete: (t: Tarefa) => void; onAddSub: (t: Tarefa) => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: t.id, data: { status: t.status, ordem: t.ordem },
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
const isFilha = !!t.parent_id;
  const resp = t.responsavel?.nome || t.responsavelNome || (t.responsavel_id ? funcMap.get(t.responsavel_id) : null);
  const eqNome = t.equipe_id ? equipeMap.get(t.equipe_id) : null;
  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2/M", month: "2-digit" }) : "-";
  const finalDone = t.status === "concluida";
  const dataFim = finalDone ? t.data_fim_real : t.data_fim;
  const atrasada = !finalDone && t.data_fim && new Date(t.data_fim) < new Date(new Date().toDateString());

  return (
    <div ref={isOverlay ? undefined : setNodeRef} style={isOverlay ? undefined : style}
      className={`group relative ${isOverlay ? "rotate-3 shadow-xl" : ""}`}>
      <Card className={`border ${isFilha ? "ml-5 border-l-2 border-l-primary/40 bg-slate-50/80" : "bg-white"} hover:shadow-md transition-shadow`}>
        <CardContent className="p-3">
          <div className="flex items-start gap-1.5">
            <button {...attributes} {...listeners}
              className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none mt-0.5"
              aria-label="Arrastar">
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 min-w-0">
              {isFilha && <span className="text-[10px] text-muted-foreground">↳</span>}
              <p className={`font-medium text-sm leading-tight ${finalDone ? "line-through text-slate-400" : ""}`}>
                {t.titulo}
              </p>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                <span className={`w-1.5 h-1.5 rounded-full ${PRIO_DOT[t.prioridade] || "bg-slate-300"}`} title={`Prioridade ${t.prioridade}`} />
{resp && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 gap-0.5 truncate max-w-[120px]">
                    <User className="w-2.5 h-2.5" />{resp}
                  </Badge>
                )}
                {eqNome && !resp && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 gap-0.5 truncate max-w-[120px] border-green-200 bg-green-50 text-green-700">
                    <Users className="w-2.5 h-2.5" />{eqNome}
                  </Badge>
                )}
                <Badge variant="outline" className={`text-[10px] py-0 px-1 ${atrasada ? "text-red-600 border-red-200 bg-red-50" : ""}`} title="Data fim">
                  <Calendar className="w-2.5 h-2.5" />{fmt(dataFim)}
                </Badge>
              </div>
              {(t.progresso > 0 || finalDone) && (
                <div className="mt-1.5"><ProgressoBar valor={finalDone ? 100 : (t.progresso_manual ? t.progresso : t.progresso)} atrasada={!!atrasada} /></div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onAddSub(t)} title="Subtarefa"><Plus className="w-3 h-3" /></Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(t)} title="Editar"><Pencil className="w-3 h-3" /></Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => onDelete(t)} title="Excluir"><Trash2 className="w-3 h-3" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export interface KanbanViewProps {
  tarefas: Tarefa[];
  funcs: Funcionario[];
  equipes: Equipe[];
  planofechado: boolean;
  onStatus: (t: Tarefa, novoStatus: string) => void;
  onReorder: (tarefaId: string, novoStatus: string, novaOrdem: number) => void;
  onEdit: (t: Tarefa) => void;
  onDelete: (t: Tarefa) => void;
  onAddSub: (t: Tarefa) => void;
}

export default function KanbanView({
tarefas, funcs, equipes, planofechado, onStatus, onReorder, onEdit, onDelete, onAddSub,
}: KanbanViewProps) {
  const funcMap = new Map(funcs.map((f) => [f.id, f.nome]));
  const equipeMap = new Map(equipes.map((e) => [e.id, e.nome]));
  const [activeId, setActiveId] = useState<string | null>(null);

  // só raiz (sem parent) vão para o Kanban; filhas aparecem dentro do diálogo
  const raizes = tarefas.filter((t) => !t.parent_id);
  const porStatus = (s: StatusTarefa) =>
    raizes.filter((t) => t.status === s).sort((a, b) => a.ordem - b.ordem);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const colSets: Record<StatusTarefa, Tarefa[]> = {
    a_fazer: porStatus("a_fazer"), fazendo: porStatus("fazendo"),
    concluida: porStatus("concluida"),
    bloqueada: [], cancelada: [],
  };
  const [localCols, setLocalCols] = useState<Record<StatusTarefa, Tarefa[]>>(colSets);

  // re-sincroniza quando tarefas mudam externamente
  const [tick, setTick] = useState(0);
  useEffect(() => { if (!activeId) setLocalCols(colSets); }, [tarefas.length, tick, activeId]);

  function findTarefa(id: string): Tarefa | undefined {
    for (const k of Object.keys(localCols) as StatusTarefa[]) {
      const f = localCols[k].find((t) => t.id === id);
      if (f) return f;
    }
    return undefined;
  }

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  function onDragOver(e: DragOverEvent) {
    if (planofechado) return;
    const { active, over } = e;
    if (!over) return;
    const activeStatus = (active.data.current as any)?.status as StatusTarefa;
    // over.id pode ser "col-a_fazer" (droppable da coluna) ou id de card
    const overId = String(over.id);
    let targetStatus: StatusTarefa | null = null;
    if (overId.startsWith("col-")) targetStatus = overId.replace("col-", "") as StatusTarefa;
    else targetStatus = (over.data.current as any)?.status as StatusTarefa;
    if (!targetStatus || targetStatus === activeStatus) return;

    setLocalCols((prev) => {
      const fromList = (prev[activeStatus] || []).filter((t) => t.id !== active.id);
      const moved = findTarefa(String(active.id));
      if (!moved) return prev;
      const toList = [...(prev[targetStatus!] || [])];
      const overIdx = overId.startsWith("col-") ? toList.length : toList.findIndex((t) => t.id === overId);
      const insertAt = overIdx < 0 ? toList.length : overIdx;
      toList.splice(insertAt, 0, { ...moved, status: targetStatus! });
      return { ...prev, [activeStatus]: fromList, [targetStatus!]: toList };
    });
  }
  function onDragEnd(e: DragEndEvent) {
    if (planofechado) { setActiveId(null); return; }
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const overId = String(over.id);
    let targetStatus: StatusTarefa;
    if (overId.startsWith("col-")) targetStatus = overId.replace("col-", "") as StatusTarefa;
    else targetStatus = (over.data.current as any)?.status as StatusTarefa;
    if (!targetStatus) return;

    const newList = localCols[targetStatus] || [];
    newList.forEach((t, i) => {
      onReorder(t.id, targetStatus as string, i);
    });
    // sinal para re-sync externo
    setTimeout(() => setTick((n) => n + 1), 50);
  }

  const active = activeId ? findTarefa(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {COLunas.map((c) => {
          const set = localCols[c.id] || [];
          return <ColunaKanban key={c.id} col={c} set={set} funcMap={funcMap} equipeMap={equipeMap}
            onEdit={onEdit} onDelete={onDelete} onAddSub={onAddSub} />;
        })}
      </div>
      <DragOverlay>
        {active ? (
          <CardTarefa t={active} funcMap={funcMap} equipeMap={equipeMap}
            onEdit={() => {}} onDelete={() => {}} onAddSub={() => {}} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ColunaKanban({
  col, set, funcMap, equipeMap, onEdit, onDelete, onAddSub,
}: {
  col: { id: StatusTarefa; titulo: string; cor: string; bola: string };
  set: Tarefa[]; funcMap: Map<string, string>; equipeMap: Map<string, string>;
  onEdit: (t: Tarefa) => void; onDelete: (t: Tarefa) => void; onAddSub: (t: Tarefa) => void;
}) {
  const droppableId = `col-${col.id}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, data: { status: col.id, isColuna: true } });
  return (
    <div ref={setNodeRef} className={`rounded-xl border ${col.cor} min-h-[200px] transition-colors ${isOver ? "ring-2 ring-primary/30" : ""}`}>
      <div className="flex items-center justify-between px-3 py-2.5 sticky top-0 backdrop-blur-sm bg-white/70 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.bola}`} />
          <h3 className="text-sm font-semibold">{col.titulo}</h3>
        </div>
        <Badge variant="secondary" className="text-[10px]">{set.length}</Badge>
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">
        <SortableContext id={droppableId} items={set.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {set.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-6 border-2 border-dashed rounded-lg border-slate-200/60">
                      Arraste aqui
                    </div>
                  ) : (
                    set.map((t) => (
                      <CardTarefa key={t.id} t={t} funcMap={funcMap} equipeMap={equipeMap}
                        onEdit={onEdit} onDelete={onDelete} onAddSub={onAddSub} />
                    ))
                  )}
                </SortableContext>
              </div>
            </div>
  );
}
