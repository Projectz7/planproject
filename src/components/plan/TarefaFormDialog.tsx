import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tarefa, Prioridade, Funcionario } from "@/types";
import { createTarefa, updateTarefa } from "@/lib/supabaseService";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string;
  obraId: string;
  planoId: string;
  parentId?: string | null;
  funcionarios: Funcionario[];
  editando?: Tarefa | null;
  onSalvou: () => void;
  planofechado?: boolean;
}

const PRIORIDADES: Prioridade[] = ["baixa", "media", "alta", "critica"];

export default function TarefaFormDialog({
  open, onOpenChange, empresaId, obraId, planoId, parentId, funcionarios, editando, onSalvou, planofechado,
}: Props) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [dataInicioReal, setDataInicioReal] = useState<string>("");
  const [dataFimReal, setDataFimReal] = useState<string>("");
  const [progresso, setProgresso] = useState<number>(0);
  const [progressoManual, setProgressoManual] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("a_fazer");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (editando) {
      setTitulo(editando.titulo);
      setDescricao(editando.descricao || "");
      setResponsavelId(editando.responsavel_id || "");
      setPrioridade(editando.prioridade);
      setDataInicio(editando.data_inicio || "");
      setDataFim(editando.data_fim || "");
      setDataInicioReal(editando.data_inicio_real || "");
      setDataFimReal(editando.data_fim_real || "");
      setProgresso(editando.progresso);
      setProgressoManual(editando.progresso_manual);
      setStatus(editando.status);
    } else {
      setTitulo(""); setDescricao(""); setResponsavelId(""); setPrioridade("media");
      setDataInicio(""); setDataFim(""); setDataInicioReal(""); setDataFimReal("");
      setProgresso(0); setProgressoManual(false); setStatus("a_fazer");
    }
  }, [editando, open]);

  const readonly = planofechado && !editando; // em plano fechado, só criar bloqueado
  const blocked = !!planofechado;

  const handleSave = async () => {
    if (!titulo.trim()) { toast.error("Título é obrigatório"); return; }
    setSalvando(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        responsavel_id: responsavelId || null,
        prioridade,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        data_inicio_real: dataInicioReal || null,
        data_fim_real: dataFimReal || null,
        progresso,
        progresso_manual: progressoManual,
        status: status as Tarefa["status"],
      };
      if (editando) {
        await updateTarefa(editando.id, payload);
        toast.success("Tarefa atualizada");
      } else {
        await createTarefa({
          empresa_id: empresaId,
          plano_id: planoId,
          obra_id: obraId,
          parent_id: parentId || null,
          ordem: 0,
          ...payload,
        } as any);
        toast.success(parentId ? "Subtarefa criada" : "Tarefa criada");
      }
      onSalvou();
      onOpenChange(false);
    } catch (e) {
      toast.error("Erro ao salvar tarefa: " + (e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar tarefa" : parentId ? "Nova subtarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Responsável</Label>
              <Select value={responsavelId || "none"} onValueChange={(v) => setResponsavelId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ESPERADO */}
          <div className="rounded-lg border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Esperado</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Início previsto</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Vencimento previsto</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
          </div>

          {/* REALIZADO */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Realizado</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Início real</Label>
                <Input type="date" value={dataInicioReal} onChange={(e) => setDataInicioReal(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Conclusão real</Label>
                <Input type="date" value={dataFimReal} onChange={(e) => setDataFimReal(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_fazer">A fazer</SelectItem>
                    <SelectItem value="fazendo">Fazendo</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="bloqueada">Bloqueada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Progresso {progressoManual ? "(manual)" : "(auto pelas filhas)"}</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={100} value={progresso} disabled={!progressoManual}
                    onChange={(e) => setProgresso(Math.max(0, Math.min(100, Number(e.target.value))))} />
                  <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                    <Switch checked={progressoManual} onCheckedChange={setProgressoManual} /> manual
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={salvando || blocked}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : editando ? "Salvar" : "Criar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
