import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, HardHat, Flag } from "lucide-react";

type Obra = {
  id: string;
  titulo: string | null;
  cliente: string | null;
  status: string | null;
  endereco: string | null;
};

export default function HomePage() {
  const { user, funcionario, empresaId, signOut } = useAuth();
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!empresaId) return;
      setLoading(true);
      const { data: emp } = await supabase
        .from("empresa").select("nome").eq("id", empresaId).maybeSingle();
      if (emp) setEmpresaNome(emp.nome as string);

      const { data, error } = await supabase
        .from("obras")
        .select("id, titulo, cliente, status, endereco")
        .order("created_at", { ascending: true });
      if (error) setErro(error.message);
      else setObras((data || []) as Obra[]);
      setLoading(false);
    })();
  }, [empresaId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <HardHat className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">PlanProject</h1>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                {empresaNome || "-"} · {funcionario ? `Func: ${funcionario.nome}` : (user?.email || "Dono")}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scaffold F0 - valida\u00e7\u00e3o</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-muted-foreground">empresaId:</span> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{empresaId || "-"}</code></p>
            <p><span className="text-muted-foreground">Auth:</span> {funcionario ? "funcionário (token)" : "dono (supabase auth)"}</p>
            <p><span className="text-muted-foreground">Projeto Supabase:</span> p7store (pnijzmqygibhwbcnkklm)</p>
            {erro && <p className="text-destructive">Erro obras: {erro}</p>}
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Obras <span className="text-xs text-muted-foreground font-normal">(lidas do schema do di-gest)</span></h2>
            <Badge variant="secondary">{obras.length} obras</Badge>
          </div>
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : obras.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Flag className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Nenhuma obra encontrada.</p>
              <p className="text-xs mt-1">Verifique se a empresa tem obras cadastradas no di-gest.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {obras.map((o) => (
                <Card key={o.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm">{o.titulo || "(sem t\u00edtulo)"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.cliente || "-"}</p>
                    {o.status && <Badge variant="outline" className="mt-2 text-[10px]">{o.status}</Badge>}
                    {o.endereco && <p className="text-[11px] text-muted-foreground mt-2 truncate">{o.endereco}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
