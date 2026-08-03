import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, HardHat, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Obra } from "@/types";

type ObraComPlano = Obra & { planoStatus?: string | null; planoNome?: string | null };

export default function HomePage() {
  const navigate = useNavigate();
  const { user, funcionario, empresaId, signOut } = useAuth();
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);
  const [obras, setObras] = useState<ObraComPlano[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data: emp } = await supabase.from("empresa").select("nome").eq("id", empresaId).maybeSingle();
      if (emp) setEmpresaNome(emp.nome as string);

      const { data: obrasData, error: eOb } = await supabase
        .from("obras")
        .select("id, titulo, cliente, status, endereco, created_at")
        .order("created_at", { ascending: true });
      if (eOb) throw eOb;

      // busca último plano por obra (1 query)
      const { data: planosData } = await supabase
        .from("planos")
        .select("id, obra_id, nome, status")
        .order("created_at", { ascending: false });

      const ultimoPlanoPorObra = new Map<string, { nome: string; status: string }>();
      for (const p of planosData || []) {
        if (!ultimoPlanoPorObra.has(p.obra_id as string)) {
          ultimoPlanoPorObra.set(p.obra_id as string, { nome: p.nome, status: p.status });
        }
      }
      const inj = (obrasData || []).map((o: any) => {
        const pl = ultimoPlanoPorObra.get(o.id);
        return { ...o, planoNome: pl?.nome || null, planoStatus: pl?.status || null };
      });
      setObras(inj as ObraComPlano[]);
    } catch (e) {
      toast.error("Erro ao carregar: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [empresaId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <HardHat className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">PlanSeven</h1>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                {empresaNome || "-"} · {funcionario ? `Func: ${funcionario.nome}` : (user?.email || "Dono")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={carregar} title="Recarregar">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} title="Sair">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Obras <span className="text-xs text-muted-foreground font-normal">(lidas do schema do di-gest)</span></h2>
          <Badge variant="secondary">{obras.length}</Badge>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : obras.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <HardHat className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nenhuma obra nesta empresa.</p>
            <p className="text-xs mt-1">Cadastre obras no di-gest/P7Store para começar a planejar.</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {obras.map((o) => (
              <button key={o.id} onClick={() => navigate(`/obra/${o.id}`)}
                className="text-left">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm leading-tight">{o.titulo || "(sem título)"}</p>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{o.cliente || "-"}</p>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {o.status && <Badge variant="outline" className="text-[10px]">{o.status}</Badge>}
                      {o.planoNome ? (
                        <Badge className="text-[10px] bg-blue-50 text-blue-700 border-blue-200" variant="outline">
                          {o.planoStatus === "fechado" ? "🔒 " : ""}{o.planoNome}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-slate-400 border-dashed">sem plano</Badge>
                      )}
                    </div>
                    {o.endereco && <p className="text-[11px] text-muted-foreground mt-2 truncate">{o.endereco}</p>}
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
