import { useRef, useState, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Direcao = "cima" | "baixo" | "esquerda" | "direita";

export interface AnalogicoPSProps {
  onDirecao: (d: Direcao) => void;
  disabled?: boolean;
  podeCima?: boolean;
  podeBaixo?: boolean;
  podeEsquerda?: boolean;
  podeDireita?: boolean;
}

export function AnalogicoPS({
  onDirecao, disabled,
  podeCima = true, podeBaixo = true, podeEsquerda = true, podeDireita = true,
}: AnalogicoPSProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbOffset, setThumbOffset] = useState({ x: 0, y: 0 });
  const [arrastrando, setArrastrando] = useState(false);
  const MAX_OFFSET = 14;

  const reset = useCallback(() => {
    setThumbOffset({ x: 0, y: 0 });
    setArrastrando(false);
  }, []);

  const handlePointer = useCallback((e: React.PointerEvent) => {
    if (disabled || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MAX_OFFSET) {
      dx = (dx / dist) * MAX_OFFSET;
      dy = (dy / dist) * MAX_OFFSET;
    }
    setThumbOffset({ x: dx, y: dy });
  }, [disabled]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setArrastrando(true);
    handlePointer(e);
  }, [disabled, handlePointer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!arrastrando || disabled) return;
    handlePointer(e);
  }, [arrastrando, disabled, handlePointer]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!arrastrando) return;
    const off = thumbOffset;
    reset();
    const absX = Math.abs(off.x);
    const absY = Math.abs(off.y);
    if (absX < 4 && absY < 4) return;
    if (absX > absY) {
      if (off.x > 0 && podeDireita) onDirecao("direita");
      else if (off.x < 0 && podeEsquerda) onDirecao("esquerda");
    } else {
      if (off.y > 0 && podeBaixo) onDirecao("baixo");
      else if (off.y < 0 && podeCima) onDirecao("cima");
    }
  }, [arrastrando, disabled, thumbOffset, podeCima, podeBaixo, podeEsquerda, podeDireita, onDirecao, reset]);

  const setbackBtn = "absolute p-0.5 rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="relative w-20 h-20 select-none" ref={containerRef}>
      <div
        className={cn(
          "absolute inset-0 rounded-full bg-slate-800 border-2 border-slate-700 shadow-inner",
          !disabled && "touch-none cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={reset}
      >
        <div
          className={cn(
            "absolute top-1/2 left-1/2 w-8 h-8 -ml-4 -mt-4 rounded-full bg-gradient-to-b from-slate-600 to-slate-900 border border-slate-500 shadow-lg",
            "transition-transform duration-75",
            arrastrando && "transition-none",
          )}
          style={{ transform: `translate(${thumbOffset.x}px, ${thumbOffset.y}px)` }}
        />
      </div>

      <button type="button" disabled={disabled || !podeCima}
        onClick={() => onDirecao("cima")} className={cn(setbackBtn, "top-0 left-1/2 -translate-x-1/2")} title="Mover acima">
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button type="button" disabled={disabled || !podeBaixo}
        onClick={() => onDirecao("baixo")} className={cn(setbackBtn, "bottom-0 left-1/2 -translate-x-1/2")} title="Mover abaixo">
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <button type="button" disabled={disabled || !podeEsquerda}
        onClick={() => onDirecao("esquerda")} className={cn(setbackBtn, "left-0 top-1/2 -translate-y-1/2")} title="Promover">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <button type="button" disabled={disabled || !podeDireita}
        onClick={() => onDirecao("direita")} className={cn(setbackBtn, "right-0 top-1/2 -translate-y-1/2")} title="Rebaixar">
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
