import { useEffect, useState } from "react";
import {
  MousePointerClick, Plus, Pencil, Trash2, CheckCircle2,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Direcao = "cima" | "baixo" | "esquerda" | "direita";

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
  podeNavegar?: { cima: boolean; baixo: boolean };
  temTarefas: boolean;
  className?: string;
}

const PS_BTN = {
  selecionar: { cor: "bg-blue-500 hover:bg-blue-600 text-white", corActive: "bg-blue-600 ring-2 ring-blue-300" },
  adicionar:  { cor: "bg-emerald-500 hover:bg-emerald-600 text-white" },
  editar:     { cor: "bg-amber-400 hover:bg-amber-500 text-white" },
  excluir:    { cor: "bg-rose-500 hover:bg-rose-600 text-white" },
  // D-Pad: botões menores, estilo console
  dpad:       { cor: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600" },
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

// Botão direcional (D-Pad) — menor e quadrado
function BotaoDir({
  onClick, disabled, icon, label,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center w-11 h-11 rounded-lg transition-all shadow-sm",
        "disabled:opacity-25 disabled:cursor-not-allowed disabled:shadow-none",
        PS_BTN.dpad.cor,
      )}
      title={label}
      aria-label={label}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
    </button>
  );
}

export function GamepadControle({
  onAcao, tarefaSelecionada, podeMover, podeNavegar, temTarefas, className,
}: GamepadControleProps) {
  const [tecladoVisivel, setTecladoVisivel] = useState(false);

  // some ao digitar: detecta focus em input/textarea/select
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") {
        setTecladoVisivel(true);
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") {
        setTecladoVisivel(false);
      }
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  if (tecladoVisivel) return null;

  // Sem seleção → D-Pad navega (cima/baixo); esquerda/direita desabilitados.
  // Com seleção → D-Pad move a tarefa (ações confirmadas).
  const navCima    = tarefaSelecionada ? podeMover.cima    : (podeNavegar?.cima    ?? temTarefas);
  const navBaixo   = tarefaSelecionada ? podeMover.baixo   : (podeNavegar?.baixo   ?? temTarefas);
  const navEsquerda = tarefaSelecionada ? podeMover.esquerda : false;
  const navDireita  = tarefaSelecionada ? podeMover.direita  : false;

  return (
    <div className={cn(
      // Mobile: full-width fixo no rodapé
      "fixed bottom-0 inset-x-0 z-50",
      // Desktop: compacto no canto inferior direito
      "md:bottom-4 md:inset-x-auto md:right-4 md:left-auto md:w-auto",
      "flex items-end gap-4 px-3 py-3",
      "pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3",
      "bg-slate-900/95 backdrop-blur-md shadow-2xl border-t border-slate-700 md:border md:rounded-2xl md:border-slate-700",
      className,
    )}>
      {/* D-Pad (substitui a alavanca analógica) */}
      <div className="grid grid-cols-3 grid-rows-3 gap-0.5 shrink-0">
        <span />
        <BotaoDir onClick={() => onAcao("cima")}    disabled={!navCima}    icon={<ChevronUp className="w-5 h-5" />}    label={tarefaSelecionada ? "Mover acima" : "Tarefa acima"} />
        <span />
        <BotaoDir onClick={() => onAcao("esquerda")} disabled={!navEsquerda} icon={<ChevronLeft className="w-5 h-5" />}  label="Promover (menos indentação)" />
        <div className="w-11 h-11" />
        <BotaoDir onClick={() => onAcao("direita")}  disabled={!navDireita}  icon={<ChevronRight className="w-5 h-5" />} label="Rebaixar (mais indentação)" />
        <span />
        <BotaoDir onClick={() => onAcao("baixo")}   disabled={!navBaixo}   icon={<ChevronDown className="w-5 h-5" />}  label={tarefaSelecionada ? "Mover abaixo" : "Tarefa abaixo"} />
        <span />
      </div>

      {/* Botões de ação */}
      <div className="grid grid-cols-2 gap-2">
        <BotaoPS
          onClick={() => onAcao("toggle_selecionar")}
          disabled={!temTarefas}
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
