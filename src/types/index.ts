export type StatusPlano = "rascunho" | "fechado" | "arquivado";
export type StatusTarefa = "a_fazer" | "fazendo" | "concluida" | "bloqueada" | "cancelada";
export type Prioridade = "baixa" | "media" | "alta" | "critica";

export interface Obra {
  id: string;
  titulo: string | null;
  cliente: string | null;
  status: string | null;
  endereco: string | null;
  data_inicio?: string | null;
  data_previsao_fim?: string | null;
  dias_previstos?: number | null;
  dias_reais?: number | null;
  valor_total_previsto?: number | null;
  modalidade?: string | null;
  created_at?: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  is_gerente: boolean;
  ativo: boolean;
  equipe_id?: string | null;
  telefone?: string | null;
}

export interface Plano {
  id: string;
  empresa_id: string;
  obra_id: string;
  nome: string;
  status: StatusPlano;
  criado_por?: string | null;
  criado_em?: string;
  fechado_em?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Tarefa {
  id: string;
  empresa_id: string;
  plano_id: string;
  obra_id: string;
  parent_id: string | null;
  titulo: string;
  descricao?: string | null;
  responsavel_id?: string | null;
  equipe_id?: string | null;
  status: StatusTarefa;
  prioridade: Prioridade;
  ordem: number;
  data_inicio: string | null;
  data_fim: string | null;
  data_inicio_real: string | null;
  data_fim_real: string | null;
  progresso_manual: boolean;
  progresso: number;
  observacao?: string | null;
  created_at?: string;
  updated_at?: string;
  // joins opcionais
  responsavel?: { id: string; nome: string } | null;
  responsavelNome?: string | null;
}
