# Planner v3.0 — Changelog de Melhorias

## 1. SmartInput — Reengenharia Completa

### Preview ao Vivo
Enquanto digita, um card de preview aparece mostrando exatamente como a tarefa será renderizada — antes de pressionar Enter.

### Sintaxes Suportadas
| Sintaxe | Resultado |
|---------|-----------|
| `[] Tarefa` | Checklist simples |
| `[] Tarefa - nota aqui` | Nota em itálico 50% opaca abaixo |
| `[x] Tarefa` | Tarefa já marcada como concluída |
| `[] Tarefa @14:30` | Alerta visual 5 minutos antes |
| `[] Tarefa @60m` ou `@2h30m` | Timer regressivo clicável |
| `[] Tarefa #work #urgent` | Tags coloridas |
| `[] Tarefa !!high` / `!!medium` / `!!low` | Nível de energia |
| `/boom` | Fade-out + partículas em todas as concluídas |
| `/focus` | Ativa modo Deep Work |
| `/matrix` | Abre matriz completa em modal |
| `/pin nome` | Fixa/desafixa tarefa no topo |
| `Tab` (input vazio) | Autocompleta `[] ` |

---

## 2. TopBar — Nova Barra Superior

- **🔥 Streak counter**: dias consecutivos com ≥3 tarefas do dia concluídas. Acima de 7 dias fica laranja com glow pulsante.
- **🍅 Pomodoro nativo**: timer 25min integrado. Click para iniciar/pausar. Reseta com ↺.
- **⚡ Alerta -5min**: banner animado quando uma tarefa `@HH:MM` está a 5 minutos de vencer.
- **Relógio ao vivo**: HH:MM discreto.
- **Dicas de sintaxe** condensadas no centro.

---

## 3. CompactMatrix — Matriz Radicalmente Compacta

### Modo Padrão (sempre visível)
Exibe apenas as **Top 3 tarefas críticas (Q1)** numeradas 1. 2. 3. com checkbox direto.

### Modo Full (`/matrix` ou botão)
Modal flutuante 70vw com todos os 4 quadrantes:
- Drag-and-drop entre quadrantes
- SmartInput por quadrante
- Fecha com ESC ou clique fora

---

## 4. DeepFocus — Modo Deep Work (`/focus`)

- Overlay full-screen com fundo preto + textura de ruído
- Tarefa atual centralizada em tipografia serif leve (Crimson Pro)
- **Exercício de respiração guiada** (botão `○ respirar`):
  - Inspire 4s → Segure 4s → Expire 6s
  - Círculo que expande/contrai suavemente
- Cronômetro de foco ativo
- ESC para sair

---

## 5. TaskItem — Melhorias Visuais

- **📌 Pin**: botão de fixar (fica visível no hover). Tarefa fixada sobe ao topo com borda azul esquerda.
- **Notas inline**: cor 50% mais opaca em itálico (rgba(155,154,151,0.5))
- **Energy badges**: `⚡ alta` / `◎ média` / `○ baixa` com cores distintas
- **Flash de conclusão**: micro-animação azul quando checkbox é marcado
- **Alerta @HH:MM**: 5 minutos antes (não mais no exato momento)

---

## 6. StatsBar v3

Adicionados:
- Contador de tarefas fixadas (📌)
- Contador de tarefas `!!high` energia (⚡⚡)
- Barra de progresso muda de cor: cinza → azul → verde (100%)

---

## 7. Funcionalidades Criativas Extras

| Feature | Detalhe |
|---------|---------|
| **Heat aging** | Tarefas com 2-5+ dias ficam gradualmente mais alaranjadas/vermelhas |
| **Long-press** | Segurar 600ms em qualquer tarefa abre o Modo Foco nela |
| **Drag-and-drop** | Reordenação dentro de seções e entre quadrantes da matriz |
| **Auto-arquivo** | Tarefas concluídas há mais de 24h vão para o Histórico automaticamente |
| **Streak persistido** | Guardado em localStorage/arquivo junto com os dados |
| **Responsive opacity** | Tarefas concluídas ficam 25% de opacidade (não desaparecem) |

