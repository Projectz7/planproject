# TODO F5 — Micro-tarefas

## E0 — RPC reagrupar_filhas
- [ ] E0.1 Criar migration `supabase/migrations/reagrupar_filhas.sql` com RPC que_move filhas de um parent (>= ordemLimite) para novo parent em 1 query
- [ ] E0.2 Aplicar migration no Supabase (project pnijzmqygibhwbcnkklm)
- [ ] E0.3 Adicionar wrapper `reagruparFilhas()` em supabaseService.ts

## E1 — onDragEnd versátil
- [ ] E1.1 Ler `e.delta.x` e `e.delta.y` (deslocamento do drag, nao delta de centros)
- [ ] E1.2 Computar `nivelAlvo = clamp(round(nivelActive + offsetX / INDENT), 0, maxNivel)`
- [ ] E1.3 Detectar `acimaDoOver` (delta.y negativo + |delta.y| > altura/2 da linha)
- [ ] E1.4 Decidir novoParentId por nivelAlvo vs nivelOver (promover/rebaixar/irma/mae)
- [ ] E1.5 Caso vire MAE: chamar `reagruparFilhas(over.parent_id, ordemOver, arrastada.id)` + `updateTarefa(arrastada, { parent_id: over.parent_id, ordem: ordemOver })`
- [ ] E1.6 Prevencao de ciclo (nao vira filha de si/descendente)
- [ ] E1.7 DragOverlay com indicador visual de nivel alvo + seta

## E2 — Botões de nível no TarefaRow
- [ ] E2.1 Adicionar props `onPromote` e `onDemote` ao TarefaRow
- [ ] E2.2 Renderizar 2 icones (← →) no hover entre drag handle e titulo
- [ ] E2.3 `onPromote` so habilitado se nivel > 0
- [ ] E2.4 `onDemote` so habilitado se ha irma anterior
- [ ] E2.5 Wire no ObraPlanoPage via `handleMudarNivel(id, direcao)`

## E3 — Nova tarefa inline
- [ ] E3.1 `abrirNova(parentId)` chama `createTarefa` c/ titulo "Sem título" no banco, depois recarrega
- [ ] E3.2 Estado `focoInlineId` no ObraPlanoPage; passa pra TabelaView -> TarefaRow
- [ ] E3.3 InlineText ganha prop `autoFocus` (abre edicao ao montar)
- [ ] E3.4 TarefaRow passa `autoFocus` pro InlineText do titulo quando id === focoInlineId
- [ ] E3.5 Esc mantém "Sem título" (sem rollback); lixeira já visível

## E5 — Finalização
- [ ] E5.1 npm run build (validar compilacao)
- [ ] E5.2 git commit + push origin main
