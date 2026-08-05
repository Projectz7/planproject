import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowLeft, FolderKanban, LogOut } from "lucide-react";
import { toast } from "sonner";
import type { Tarefa } from "@/types";
import { fetchTudo } from "@/lib/supabaseService";

const STATUS_LABEL: Record<string, string> = {
  a_fazer: "A fazer", fazendo: "Fazendo", concluida: "Concluída", bloqueada: "Bloqueada", cancelada: "Cancelada",
};
const STATUS_COLOR: Record<string, string> = {
  a_fazer: "bg-slate-100 text-slate-600", fazendo: "bg-blue-100 text-blue-700",
  concluida: "bg-emerald-100 text-emerald-700", bloqueada: "bg-amber-100 text-amber-700",
  cancelada: "bg-rose-100 text-rose-700",
};

type TarefaComProjeto = Tarefa & { obra_titulo: string };

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

export default function TudoPage() {
  const navigate = useNavigate();
  const { empresaId, funcionario, user, signOut } = useAuth();
  const [tarefas, setTarefas] = useState<TarefaComProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [colapsadosProjs, setColapsadosProjs] = useState<Set<string>>(new Set());

  async function carregar() {
    if (!empresaId) return;
    setLoading(true);
    try {
      const dados = await fetchTudo(empresaId);
      setTarefas(dados);
    } catch (e) {
      toast.error("Erro ao carregar: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [empresaId]);

  // agrupar por obra_titulo
  const grupos = useMemo(() => {
    const m = new Map<string, TarefaComProjeto[]>();
    for (const t of tarefas) {
      const k = t.obra_titulo;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [tarefas]);

  const total = tarefas.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" /> Projetos
            </Button>
            <div className="flex items-center gap-2 ml-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <FolderKanban className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-none">Visão unificada</h1>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                  {funcionario ? `Func: ${funcionario.nome}` : (user?.email || "Dono")} · {total} tarefas · {grupos.size} {grupos.size === 1 ? "projeto" : "projetos"}
                </p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={async () => {
            try { await signOut(); } catch {}
            window.location.href = "https://p7store.vercel.app";
          }} title="Sair">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-4 pb-32">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : total === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <FolderKanban className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nenhuma tarefa em nenhum projeto.</p>
          </CardContent></Card>
        ) : (
          Array.from(grupos.entries()).map(([projeto, tarefasProj]) => {
            const sorted = ordernar(tarefasProj);
            const colapsado = colapsadosProjs.has(projeto);
            return (
              <Card key={projeto}>
                <CardContent className="p-0">
                  <button
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50"
                    onClick={() => setColapsadosProjs((prev) => {
                      const n = new Set(prev);
                      if (n.has(projeto)) n.delete(projeto); else n.add(projeto);
                      return n;
                    })}
                  >
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">{projeto}</span>
                      <Badge variant="secondary" className="text-[10px]">{tarefasProj.length}</Badge>
                    </div>
                    <span className="text-xs text-slate-400">{colapsado ? "(colapsado)" : "(aberto)"}</span>
                  </button>
                  {!colapsado && (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead className="text-xs uppercase text-slate-500">Título</TableHead>
                          <TableHead className="text-xs uppercase text-slate-500">Status</TableHead>
                          <TableHead className="text-xs uppercase text-slate-500 hidden md:table-cell">Progresso</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.map((t) => {
                          const isSub = !!t.parent_id;
                          return (
                            <TableRow key={t.id} className={isSub ? "bg-slate-50/40" : ""}>
                              <TableCell className="font-medium py-1.5">
                                <div className="flex items-center gap-1" style={isSub ? { paddingLeft: 20 } : {}}>
                                  {isSub && <span className="text-slate-300">↳</span>}
                                  <span className="truncate">{t.titulo}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Badge variant="outline" className={STATUS_COLOR[t.status] + " text-[10px]"}>
                                  {STATUS_LABEL[t.status]}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-1.5 hidden md:table-cell">
                                <div className="flex items-center gap-1.5 min-w-[100px]">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={t.progresso >= 100 ? "bg-emerald-500 h-full" : "bg-blue-500 h-full"}
                                      style={{ width: `${t.progresso}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-500 w-7 text-right tabular-nums">{t.progresso}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
