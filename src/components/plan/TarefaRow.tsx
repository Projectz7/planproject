import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, ChevronDown, ChevronRight, ChevronLeft, Pencil, Trash2 } from "lucide-react";
import type { Tarefa, Funcionario, StatusTarefa, Prioridade } from "@/types";
import { InlineText, InlineDate, InlineSelect, InlineProgress } from "./InlineCells";
import { JoystickMover } from "./JoystickMover";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<StatusTarefa, string> = {
  a_fazer: "A fazer", fazendo: "Fazendo", concluida: "Concluída",
  bloqueada: "Bloqueada", cancelada: "Cancelada",
};
const STATUS_COLOR: Record<StatusTarefa, string> = {
  a_fazer: "bg-slate-100 text-slate-600", fazendo: "bg-blue-100 text-blue-700",
  concluida: "bg-emerald-100 text-emerald-700", bloqueada: "bg-amber-100 text-amber-700",
  cancelada: "bg-rose-100 text-rose-700",
};
const PRIO_COLOR: Record<Prioridade, string> = {
  baixa: "bg-slate-300", media: "bg-amber-400", alta: "bg-orange-500", critica: "bg-rose-500",
};
const PRIO_LABEL: Record<Prioridade, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica",
};

const STATUS_OPTS = (Object.keys(STATUS_LABEL) as StatusTarefa[]).map((k) => ({
  value: k, label: STATUS_LABEL[k], color: STATUS_COLOR[k],
}));
const PRIO_OPTS = (Object.keys(PRIO_LABEL) as Prioridade[]).map((k) => ({
  value: k, label: PRIO_LABEL[k],
}));

function deltaDias(t: Tarefa): { dias: number; atrasada: boolean } {
  if (!t.data_fim || !t.data_fim_real) return { dias: 0, atrasada: false };
  const d1 = new Date(t.data_fim); const d2 = new Date(t.data_fim_real);
  const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  return { dias: diff, atrasada: diff > 0 };
}

export interface TarefaRowProps {
  tarefa: Tarefa;
  nivel: number;
  ehUltimaFilha: boolean;
  trilhaConectores: boolean[];
  funcMap: Map<string, string>;
  planofechado: boolean;
  expandido: boolean;
  onToggleExpand: () => void;
  temFilhas: number;
  focoInlineTitulo?: boolean;
  podeMover: { cima: boolean; baixo: boolean; esquerda: boolean; direita: boolean };
  onChange: (patch: Partial<Tarefa>) => Promise<void>;
  onPromote?: () => void;
  onDemote?: () => void;
  onMoverCima?: () => void;
  onMoverBaixo?: () => void;
  onAddSub: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isOverlay?: boolean;
}

export function TarefaRow({
  tarefa: t, nivel, ehUltimaFilha, trilhaConectores, funcMap,
  planofechado, expandido, onToggleExpand, temFilhas, focoInlineTitulo, podeMover,
  onChange, onPromote, onDemote, onMoverCima, onMoverBaixo, onAddSub, onEdit, onDelete, isOverlay,
}: TarefaRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: t.id,
    data: { tarefaId: t.id, parentId: t.parent_id, ordem: t.ordem, nivel },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const { dias, atrasada } = deltaDias(t);
  const resp = t.responsavel?.nome || (t.responsavel_id ? funcMap.get(t.responsavel_id) : null);

  // trilha de conectores ├ └ para cada nivel acima
  const conectores = trilhaConectores.map((c, i) => {
    const ehNivelAtual = i === nivel - 1;
    if (ehNivelAtual) {
      return ehUltimaFilha ? (
        <span key={i} className="text-slate-300 select-none">└─</span>
      ) : (
        <span key={i} className="text-slate-300 select-none">├─</span>
      );
    }
    // niveis superiores: linha vertical se ancestral tem mais irmaos abaixo
    return c ? (
      <span key={i} className="text-slate-200 select-none">&nbsp;&nbsp;│&nbsp;</span>
    ) : (
      <span key={i} className="text-slate-200 select-none">&nbsp;&nbsp;&nbsp;&nbsp;</span>
    );
  });

  // Outline drag handle na esquerda (sempre visivel, estilo Zenkit)
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none px-1"
      title="Arraste para reordenar/redefinir parentesco"
      aria-label="Arraste para reordenar"
    >
      <GripVertical className="w-3.5 h-3.5" />
    </button>
  );

  const expandIcon = temFilhas ? (
    <button onClick={onToggleExpand} className="p-0.5 rounded hover:bg-slate-100 text-slate-400">
      {expandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
    </button>
  ) : <span className="w-[18px]" />;

  const joystick = !planofechado && (onPromote || onDemote || onMoverCima || onMoverBaixo) ? (
    <JoystickMover
      onCima={() => onMoverCima?.()}
      onBaixo={() => onMoverBaixo?.()}
      onEsquerda={() => onPromote?.()}
      onDireita={() => onDemote?.()}
      podeCima={podeMover.cima}
      podeBaixo={podeMover.baixo}
      podeEsquerda={podeMover.esquerda}
      podeDireita={podeMover.direita}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    />
  ) : null;

  const saveField = (campo: keyof Tarefa) => async (v: any) => {
    await onChange({ [campo]: v } as Partial<Tarefa>);
  };

  return (
    <TableRow
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      className={cn(
        nivel > 0 && "bg-slate-50/40",
        t.status === "concluida" && "opacity-70",
        isOverlay && "shadow-2xl ring-2 ring-primary/40",
      )}
    >
      <TableCell className="font-medium py-1.5">
        <div className="flex items-center gap-1 group">
          {handle}
          {expandIcon}
          {joystick}
          {nivel > 0 && <span className="flex items-center text-xs mr-0.5">{conectores}</span>}
          <span className={cn("inline-block w-2 h-2 rounded-full", PRIO_COLOR[t.prioridade])}
            title={`Prioridade ${PRIO_LABEL[t.prioridade]}`} />
          <InlineGraph tipo="texto" className={cn("min-w-[200px]", focoInlineTitulo && "ring-2 ring-primary/50 rounded")}>
            <InlineText
              valor={t.titulo}
              onSalvar={saveField("titulo")}
              disabled={planofechado}
              className="font-medium"
              autoFocus={focoInlineTitulo}
            />
          </InlineGraph>
          {temFilhas ? (
            <Badge variant="outline" className="text-[9px] ml-1" title="Tem subtarefas">
              {temFilhas}
            </Badge>
          ) : null}
        </div>
      </TableCell>

      <TableCell className="py-1.5">
        <InlineGraph tipo="texto">
          <InlineText
            valor={resp ?? ""}
            placeholder="-"
            onSalvar={async (v) => {
              // Responsavel e FK; por simplicidade salva nome texto e marca responsavel_id=null
              // Para vincular a funcionario real, usa o dialog (lapis) — aqui so visual
              await onChange({ descricao: v } as any);
            }}
            disabled={planofechado}
            className="min-w-[80px]"
          />
        </InlineGraph>
      </TableCell>

      <TableCell className="py-1.5">
        <InlineSelect
          valor={t.status}
          opcoes={STATUS_OPTS}
          onSalvar={saveField("status")}
          disabled={planofechado}
          renderTrigger={(label, color) => (
            <Badge variant="outline" className={cn("text-[10px]", color)}>{label}</Badge>
          )}
        />
      </TableCell>

      <TableCell className="py-1.5 text-right">
        <InlineGraph tipo="date">
          <InlineDate valor={t.data_inicio} onSalvar={saveField("data_inicio")} disabled={planofechado} />
        </InlineGraph>
      </TableCell>

      <TableCell className="py-1.5 text-right">
        <InlineGraph tipo="date">
          <InlineDate valor={t.data_fim} onSalvar={saveField("data_fim")} disabled={planofechado} />
        </InlineGraph>
      </TableCell>

      <TableCell className="py-1.5 text-right">
        <InlineGraph tipo="date">
          <InlineDate valor={t.data_fim_real} onSalvar={saveField("data_fim_real")} disabled={planofechado} />
        </InlineGraph>
      </TableCell>

      <TableCell className="py-1.5 text-center">
        {t.data_fim && t.data_fim_real ? (
          <Badge variant="outline" className={cn(
            "text-[10px]",
            atrasada ? "border-rose-200 bg-rose-50 text-rose-600"
                     : "border-emerald-200 bg-emerald-50 text-emerald-600",
          )} title={`Fim esp: ${t.data_fim}\nFim real: ${t.data_fim_real}`}>
            {dias > 0 ? `+${dias}d` : dias === 0 ? "✓" : `${dias}d`}
          </Badge>
        ) : <span className="text-slate-300">-</span>}
      </TableCell>

      <TableCell className="py-1.5">
        <div className="flex items-center justify-between gap-1">
          <InlineProgress
            valor={t.progresso}
            manual={t.progresso_manual}
            atrasada={atrasada}
            onSalvar={saveField("progresso")}
            disabled={planofechado || !t.progresso_manual}
          />
          <InlineSelect
            valor={t.progresso_manual ? "manual" : "auto"}
            opcoes={[
              { value: "auto", label: "auto" },
              { value: "manual", label: "manual" },
            ]}
            onSalvar={async (v) => await onChange({ progresso_manual: v === "manual" } as Partial<Tarefa>)}
            disabled={planofechado || !temFilhas}
            className="w-[68px]"
          />
        </div>
      </TableCell>

      <TableCell className="py-1.5 w-24">
        <div className="flex items-center gap-0.5">
          {!planofechado && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onAddSub} title="Adicionar subtarefa">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit} title="Editar (dialog completo)">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          {!planofechado && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-500" onClick={onDelete} title="Excluir">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// Wrapper p/ dar feedback visual quando hover (sem mudar altura)
function InlineGraph({
  tipo, className, children,
}: {
  tipo: "texto" | "date" | "select"; className?: string; children: React.ReactNode;
}) {
  return <span className={cn("inline-flex", className)}>{children}</span>;
}
