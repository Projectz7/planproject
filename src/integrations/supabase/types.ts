// Tipos do banco - placeholder. Regenerar com: supabase gen-types typescript --project-id <id> > src/integrations/supabase/types.ts
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
