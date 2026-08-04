import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JoystickMoverProps {
  onCima: () => void;
  onBaixo: () => void;
  onEsquerda: () => void;
  onDireita: () => void;
  podeCima: boolean;
  podeBaixo: boolean;
  podeEsquerda: boolean;
  podeDireita: boolean;
  className?: string;
}

export function JoystickMover({
  onCima, onBaixo, onEsquerda, onDireita,
  podeCima, podeBaixo, podeEsquerda, podeDireita,
  className,
}: JoystickMoverProps) {
  const btn = "p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors";

  return (
    <div className={cn("inline-flex flex-col items-center gap-0.5 select-none", className)}>
      <button type="button" onClick={onCima} disabled={!podeCima} className={btn} title="Mover acima (irmã anterior)">
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center gap-0.5">
        <button type="button" onClick={onEsquerda} disabled={!podeEsquerda} className={btn} title="Promover (subir 1 nível)">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="w-3 h-3 rounded-full bg-slate-200 flex items-center justify-center" title="Controle de navegação">
          <span className="w-1 h-1 rounded-full bg-slate-400" />
        </span>
        <button type="button" onClick={onDireita} disabled={!podeDireita} className={btn} title="Rebaixar (virar sub-tarefa)">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <button type="button" onClick={onBaixo} disabled={!podeBaixo} className={btn} title="Mover abaixo (irmã posterior)">
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
