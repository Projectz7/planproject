import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, setEmpresaToken } from '@/integrations/supabase/client';
import { storage } from '@/lib/storageService';
import { Loader2, XCircle } from 'lucide-react';

const EMP_KEY = 'pc_emp_session';

export default function AccessPage() {
  const { token } = useParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('Link invÃ¡lido.'); return; }

    (async () => {
      const { data, error: rpcErr } = await supabase.rpc('validar_token_acesso' as any, {
        p_token: token,
      });
      if (rpcErr || !data) { setError('Erro ao validar acesso.'); return; }

      const row = typeof data === 'string' ? JSON.parse(data) : data;
      if (row.error) { setError(row.error); return; }

      const sess = {
        id: row.id, nome: row.nome, cpf: row.cpf,
        isGerente: !!row.is_gerente, ativo: !!row.ativo,
        equipeId: row.equipe_id || undefined,
        empresaId: row.empresa_id,
        perfilId: row.perfil_id || undefined,
        authMethod: 'token',
      };

      sess.token = token;
      await storage.set(EMP_KEY, sess);

      // Seta o contexto de empresa no Supabase para RLS funcionar imediatamente (dupla via: header + ctx)
      setEmpresaToken(token);
      await supabase.rpc('set_empresa_context' as any, { p_token: token });

      window.location.href = '/';
    })();
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Acesso InvÃ¡lido</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}