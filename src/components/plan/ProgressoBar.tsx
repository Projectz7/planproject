import { cn } from "@/lib/utils";

interface Props {
  progresso: number; // 0-100
  atrasada?: boolean; // se <100 e data_fim_real > data_fim
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export default function ProgressoBar({ progresso, atrasada, size = "sm", showLabel = true, className }: Props) {
  const p = Math.max(0, Math.min(100, progresso));
  const colorBg = p >= 100 ? "bg-emerald-500" : atrasada ? "bg-rose-500" : "bg-blue-500";
  const textColor = p >= 100 ? "text-emerald-600" : atrasada ? "text-rose-600" : "text-blue-600";
  const h = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className={cn("flex items-center gap-2 min-w-[80px]", className)}>
      <div className={cn("flex-1 rounded-full bg-slate-100 overflow-hidden", h)}>
        <div className={cn("h-full rounded-full transition-all", colorBg)} style={{ width: `${p}%` }} />
      </div>
      {showLabel && (
        <span className={cn("text-xs font-mono font-medium tabular-nums w-8 text-right", textColor)}>{p}%</span>
      )}
    </div>
  );
}
