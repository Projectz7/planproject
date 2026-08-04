import { MousePointerClick, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { AnalogicoPS, type Direcao } from "./AnalogicoPS";
import { cn } from "@/lib/utils";

export type GamepadAcao =
  | Direcao
  | "toggle_selecionar"
  | "adicionar"
  | "editar"
  | "excluir";

export interface GamepadControleProps {
  onAcao: (a: GamepadAcao) => void;
  tarefaSelecionada: boolean;
  podeMover: { cima: boolean; baixo: boolean; esquerda: boolean; direita: boolean };
  className?: string;
}

const PS_BTN = {
  selecionar: { cor: "bg-blue-500 hover:bg-blue-600 text-white", corActive: "bg-blue-600 ring-2 ring-blue-300" },
  adicionar:  { cor: "bg-emerald-500 hover:bg-emerald-600 text-white" },
  editar:     { cor: "bg-amber-400 hover:bg-amber-500 text-white" },
  excluir:    { cor: "bg-rose-500 hover:bg-rose-600 text-white" },
};

function BotaoPS({
  onClick, disabled, corAtiva, corNormal, icon, label, subLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  corAtiva?: string;
  corNormal: string;
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 w-16 h-16 rounded-full transition-all shadow-md",
        "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none",
        corAtiva || corNormal,
      )}
      title={label}
      aria-label={label}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      <span className="text-[9px] font-semibold uppercase leading-none">{subLabel ?? label}</span>
    </button>
  );
}

export function GamepadControle({
  onAcao, tarefaSelecionada, podeMover, className,
}: GamepadControleProps) {
  const analogicoDisabled = !tarefaSelecionada;

  return (
    <div className={cn(
      "flex items-end gap-4 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md shadow-2xl border border-slate-700",
      "md:fixed md:bottom-4 md:right-4 md:z-50",
      className,
    )}>
      <AnalogicoPS
        onDirecao={(d) => onAcao(d)}
        disabled={analogicoDisabled}
        podeCima={podeMover.cima}
        podeBaixo={podeMover.baixo}
        podeEsquerda={podeMover.esquerda}
        podeDireita={podeMover.direita}
      />

      <div className="grid grid-cols-2 gap-2">
        <BotaoPS
          onClick={() => onAcao("toggle_selecionar")}
          icon={tarefaSelecionada ? <CheckCircle2 className="w-5 h-5" /> : <MousePointerClick className="w-5 h-5" />}
          label={tarefaSelecionada ? "Soltar" : "Selecionar"}
          subLabel={tarefaSelecionada ? "Soltar" : "Selecionar"}
          corNormal={PS_BTN.selecionar.cor}
          corAtiva={tarefaSelecionada ? PS_BTN.selecionar.corActive : undefined}
        />
        <BotaoPS
          onClick={() => onAcao("adicionar")}
          icon={<Plus className="w-5 h-5" />}
          label="Adicionar tarefa"
          subLabel="Add"
          corNormal={PS_BTN.adicionar.cor}
        />
        <BotaoPS
          onClick={() => onAcao("editar")}
          disabled={!tarefaSelecionada}
          icon={<Pencil className="w-4 h-4" />}
          label="Editar nome da tarefa"
          subLabel="Editar"
          corNormal={PS_BTN.editar.cor}
        />
        <BotaoPS
          onClick={() => onAcao("excluir")}
          disabled={!tarefaSelecionada}
          icon={<Trash2 className="w-4 h-4" />}
          label="Excluir tarefa"
          subLabel="Excluir"
          corNormal={PS_BTN.excluir.cor}
        />
      </div>
    </div>
  );
}
