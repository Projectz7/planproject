# PlanSeven — Plano F5: Drag versátil (Notion/Figma) + Nova linha inline

## Objetivo (2 linhas)
Tabela hierárquica com drag-to-reparent por distância X (promover/rebaixar/virar mãe), botões de nível ←/→ como complemento, e criação de tarefa como linha em branco editável inline (sem dialog).

## Etapas (priorizadas por dependência)

- [x] E0 — Criar RPC `reagrupar_filhas` + migration SQL (dependência do E1)
- [x] E1 — Reconstruir `onDragEnd` em ObraPlanoPage c/ lógica por nível alvo absoluto (promover/rebaixar/irma/mae)
- [x] E2 — Botões ←/→ no TarefaRow (onPromote/onDemote) + wire no ObraPlanoPage
- [x] E3 — Nova tarefa = linha em branco inline (abrirNova); estado `focoInlineId`; InlineText ganha `autoFocus`
- [x] E4 — Manter TarefaFormDialog só para edição completa (lapis); sem mudança
- [x] E5 — Build + commit + push (deploy auto Vercel)
