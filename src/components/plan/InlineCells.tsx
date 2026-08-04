import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

type SalvarFn<T> = (valor: T) => Promise<void> | void;
type NextFn = () => void;

interface BaseProps {
  valor: any;
  onSalvar: SalvarFn<any>;
  onNext?: NextFn;
  disabled?: boolean;
  className?: string;
}

function useEditState(inicial: any) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(inicial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editando) setDraft(inicial); }, [editando, inicial]);
  useEffect(() => { if (editando) inputRef.current?.focus(); }, [editando]);

  return { editando, setEditando, draft, setDraft, inputRef };
}

// ----- InlineText -----
export function InlineText({
  valor, onSalvar, onNext, disabled, className, placeholder = "vazio", autoFocus,
}: BaseProps & { placeholder?: string; autoFocus?: boolean }) {
  const { editando, setEditando, draft, setDraft, inputRef } = useEditState(valor ?? "");
  const [salvando, setSalvando] = useState(false);

  // autoFocus: abre modo edição automaticamente ao montar
  useEffect(() => {
    if (autoFocus) setEditando(true);
  }, [autoFocus]);

  async function commit() {
    if (draft === valor) { setEditando(false); return; }
    setSalvando(true);
    try { await onSalvar(draft); setEditando(false); onNext?.(); }
    catch (e) { console.error(e); setEditando(false); }
    finally { setSalvando(false); }
  }

  if (disabled || !editando) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setEditando(true)}
        className={cn(
          "text-left text-sm px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors min-w-[40px] text-slate-700",
          disabled && "cursor-default hover:bg-transparent",
          !valor && "text-slate-300",
          className
        )}
        title={disabled ? String(valor ?? "") : "Clique para editar"}
      >
        {valor || <span className="italic text-xs">{placeholder}</span>}
      </button>
    );
  }

  return (
    <Input
      ref={inputRef}
      value={draft}
      disabled={salvando}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { setEditando(false); }
        else if (e.key === "Tab") { e.preventDefault(); commit(); }
      }}
      className="h-7 text-sm px-1.5"
    />
  );
}

// ----- InlineDate -----
export function InlineDate({
  valor, onSalvar, onNext, disabled, className,
}: BaseProps) {
  const { editando, setEditando, draft, setDraft, inputRef } = useEditState(valor ?? "");
  const [salvando, setSalvando] = useState(false);

  function fmtBR(s: string | null | undefined): string {
    if (!s) return "-";
    try { const [y, m, d] = s.split("-"); return `${d}/${m}/${y.slice(2)}`; }
    catch { return s; }
  }

  async function commit() {
    const novo = draft || null;
    if (novo === valor) { setEditando(false); return; }
    setSalvando(true);
    try { await onSalvar(novo); setEditando(false); onNext?.(); }
    catch (e) { console.error(e); setEditando(false); }
    finally { setSalvando(false); }
  }

  if (disabled || !editando) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setEditando(true)}
        className={cn(
          "text-right text-sm px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors min-w-[64px]",
          disabled && "cursor-default hover:bg-transparent",
          !valor && "text-slate-300",
          valor && "text-slate-700",
          className
        )}
        title={disabled ? fmtBR(valor) : "Clique p/ editar data"}
      >
        {fmtBR(valor)}
      </button>
    );
  }

  return (
    <Input
      ref={inputRef}
      type="date"
      value={draft}
      disabled={salvando}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { setEditando(false); }
      }}
      className="h-7 text-sm px-1 w-[124px]"
    />
  );
}

// ----- InlineSelect -----
export function InlineSelect({
  valor, opcoes, onSalvar, onNext, disabled, className, renderTrigger,
}: BaseProps & {
  opcoes: { value: string; label: string; color?: string }[];
  renderTrigger?: (label: string, color?: string) => React.ReactNode;
}) {
  const [salvando, setSalvando] = useState(false);
  const op = opcoes.find((o) => o.value === valor);
  const label = op?.label ?? valor;
  const color = op?.color ?? "";

  async function commit(novo: string) {
    if (novo === valor) return;
    setSalvando(true);
    try { await onSalvar(novo); onNext?.(); }
    catch (e) { console.error(e); }
    finally { setSalvando(false); }
  }

  if (disabled) {
    return renderTrigger ? <span className={className}>{renderTrigger(label, color)}</span>
      : <span className={cn("text-sm px-1.5", className)}>{label}</span>;
  }

  return (
    <Select value={valor} onValueChange={commit} disabled={salvando}>
      <SelectTrigger className={cn("h-7 text-xs border-0 hover:bg-slate-100 px-1.5", className)}>
        {renderTrigger ? <span className="truncate">{renderTrigger(label, color)}</span>
          : <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ----- InlineProgress (manual: slider; automatico: read-only) -----
export function InlineProgress({
  valor, manual, atrasada, onSalvar, disabled,
}: { valor: number; manual: boolean; atrasada?: boolean; onSalvar?: SalvarFn<number>; disabled?: boolean }) {
  const cor = valor >= 100 ? "bg-emerald-500" : (atrasada ? "bg-rose-500" : "bg-blue-500");
  if (manual && onSalvar && !disabled) {
    return (
      <InlineText
        valor={String(valor)}
        onSalvar={async (v) => {
          const n = Math.max(0, Math.min(100, parseInt(String(v), 10) || 0));
          if (n !== valor) await onSalvar(n);
        }}
        disabled={disabled}
        className="w-12 text-center"
        placeholder=""
      />
    );
  }
  return (
    <div className="flex items-center gap-1.5 min-w-[100px]" title={`${valor}% ${manual ? "(manual)" : "(auto: filhas)"}`}>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all", cor)} style={{ width: `${valor}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 w-7 text-right tabular-nums">{valor}%</span>
      {manual && <span className="text-[9px] text-slate-400" title="Progresso manual">M</span>}
    </div>
  );
}
