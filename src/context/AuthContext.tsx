import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, setEmpresaToken } from '@/integrations/supabase/client';
import { storage } from '@/lib/storageService';

export interface FuncionarioSession {
  id: string;
  nome: string;
  cpf: string;
  isGerente: boolean;
  ativo: boolean;
  equipeId?: string;
  empresaId: string;
  perfilId?: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  funcionario: FuncionarioSession | null;
  session: Session | null;
  loading: boolean;
  empresaId: string | null;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  devLogin: () => void;
  signInAsGuest: () => void;
}

const GUEST_KEY = "pc_guest";
const DEV_KEY = "pc_dev";
const EMP_KEY = "pc_emp_session";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function createGuestUser(): User {
  return {
    id: "guest-user-id", app_metadata: {},
    user_metadata: { full_name: "Convidado", email: "guest@precicalc.app" },
    aud: "authenticated", created_at: new Date().toISOString(),
    email: "guest@precicalc.app", role: "authenticated",
  } as User;
}

function createDevUser(): User {
  return {
    id: "dev-user", app_metadata: { provider: "dev" },
    user_metadata: { full_name: "Desenvolvimento", email: "dev@localhost" },
    aud: "authenticated", created_at: new Date().toISOString(),
    email: "dev@localhost", role: "authenticated",
  } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [funcionario, setFuncionario] = useState<FuncionarioSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const resolveEmpresaId = async (email?: string): Promise<string | null> => {
    if (!email) return null;
    const { data } = await supabase.from("empresa").select("id").eq("dono_email", email).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (data) return data.id;
    const { data: nova } = await supabase.rpc("criar_empresa_com_trial", { p_dono_email: email });
    if (nova) return nova as string;
    return null;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const hash = window.location.hash;

        if (hash && hash.includes('access_token=')) {
          const params = new URLSearchParams(hash.replace('#', ''));
          const at = params.get('access_token');
          const rt = params.get('refresh_token');
          if (at && rt) {
            const { data } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
              resolveEmpresaId(data.session.user.email).then((eid) => {
                if (eid) setEmpresaId(eid);
              });
            }
            window.history.replaceState(null, '', window.location.pathname);
            setLoading(false);
            return;
          }
        }

        const { data: { session: sess } } = await supabase.auth.getSession();
        if (sess?.user) {
          setSession(sess);
          setUser(sess.user);
          // Dono autenticado - limpa header do token de funcionário (RLS resolve por auth.email())
          setEmpresaToken(null);
          const eid = await resolveEmpresaId(sess.user.email);
          if (eid) setEmpresaId(eid);
          } else {
          const cachedEmp = await storage.get<string>(EMP_KEY);
          if (cachedEmp) {
            try {
              const parsed = typeof cachedEmp === 'string' ? JSON.parse(cachedEmp) : cachedEmp;
              if (parsed?.empresaId) {
                // Seta contexto de empresa ANTES de consultar para RLS funcionar
                if (parsed.token) {
                  setEmpresaToken(parsed.token);
                  try {
                    await supabase.rpc('set_empresa_context' as any, { p_token: parsed.token });
                  } catch (e) {
                    console.error('set_empresa_context falhou:', e);
                  }
                }
                const { data: empresa } = await supabase.from('empresa').select('id').eq('id', parsed.empresaId).maybeSingle();
                if (empresa) {
                  setFuncionario(parsed);
                  setEmpresaId(parsed.empresaId);
                } else {
                  await storage.remove(EMP_KEY);
                }
              }
            } catch { await storage.remove(EMP_KEY); }
          } else {
            const guest = await storage.get<string>(GUEST_KEY);
            if (guest === "true") {
              setUser(createGuestUser());
            } else {
              const dev = await storage.get<string>(DEV_KEY);
              if (dev === "true") {
                setUser(createDevUser());
              }
            }
          }
        }

        if (!cancelled) setLoading(false);
      } catch (e) {
        console.error('[AuthInit] Erro na inicialização:', e);
        if (!cancelled) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setEmpresaToken(null);
        resolveEmpresaId(sess.user.email).then(setEmpresaId);
      }
    });

    const timer = setTimeout(() => { if (!cancelled) setLoading(false); }, 5000);
    return () => { cancelled = true; subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  const signInWithGoogle = async () => {
    await storage.remove(GUEST_KEY); await storage.remove(EMP_KEY); await storage.remove(DEV_KEY);
    const currentParams = window.location.search;
    const redirectTo = `${window.location.origin}/auth${currentParams}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    await storage.remove(GUEST_KEY); await storage.remove(EMP_KEY); await storage.remove(DEV_KEY);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await storage.remove(GUEST_KEY); await storage.remove(EMP_KEY); await storage.remove(DEV_KEY);
    const currentParams = window.location.search;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth${currentParams}` },
    });
    if (error) return { error: error.message };
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) return { error: signInError.message };
    }
    return {};
  };

  const signOut = async () => {
    await storage.remove(GUEST_KEY); await storage.remove(EMP_KEY); await storage.remove(DEV_KEY);
    setEmpresaToken(null);
    await supabase.auth.signOut();
    setUser(null); setSession(null); setFuncionario(null); setEmpresaId(null);
  };

  const devLogin = () => {
    storage.remove(GUEST_KEY); storage.remove(EMP_KEY);
    storage.set(DEV_KEY, "true");
    setUser(createDevUser());
    supabase.from("empresa").select("id").limit(1).then(({ data }) => {
      if (data?.[0]) setEmpresaId(data[0].id);
    });
  };

  const signInAsGuest = () => {
    storage.set(GUEST_KEY, "true");
    setUser(createGuestUser());
  };

  return (
    <AuthContext.Provider value={{ user, funcionario, session, loading, empresaId, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, devLogin, signInAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
