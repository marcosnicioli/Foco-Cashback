# Roadmap — os 13 módulos

Do escopo do MVP (FAST Command Center). Os módulos estão na navegação como
"Em breve"; implemente **um de cada vez** com a skill `/new-module`.

A ordem importa: os módulos analíticos (Health Score, Rentabilidade, Forecast,
Cockpit, IA) **dependem dos dados** dos módulos de base. Não dá para calcular
rentabilidade sem ter projetos, recursos e custos cadastrados.

## Fase 1 — Fundação (CRUD que gera os dados)

| #   | Módulo         | Rota              | Essência                                                |
| --- | -------------- | ----------------- | ------------------------------------------------------- |
| 1   | Clientes       | `/clients`        | Cadastro, stakeholders, contratos, receita              |
| 2   | Projetos       | `/projects`       | Cadastro, PM, Tech Lead, squad, status, saúde           |
| 3   | Recursos       | `/resources`      | Colaboradores, skills, senioridade, custo/hora          |
| 4   | Alocação       | `/allocation`     | Alocação por projeto, calendário, overbooking           |
| 5   | Financeiro     | `/finance`        | Receitas, custos de equipe, custos operacionais, margem |
| 6   | Infraestrutura | `/infrastructure` | Cloud (AWS/Azure/GCP/VPS), domínios, custos             |

> Comece por **Clientes** e **Projetos** — são a espinha dorsal. Depois Recursos
> e Alocação (dependem de projetos). Financeiro e Infra fecham a base de dados.

## Fase 2 — Inteligência (lê e cruza os dados da Fase 1)

| #   | Módulo              | Rota             | Depende de                     |
| --- | ------------------- | ---------------- | ------------------------------ |
| 7   | Health Score        | `/health-score`  | Projetos, Financeiro, Recursos |
| 8   | Rentabilidade       | `/profitability` | Clientes, Projetos, Financeiro |
| 9   | Capacity Planning   | `/capacity`      | Recursos, Alocação             |
| 10  | Simulador Comercial | `/simulator`     | Capacidade, Financeiro         |
| 11  | Forecast Financeiro | `/forecast`      | Financeiro, Projetos           |

## Fase 3 — Camada executiva

| #   | Módulo            | Rota            | Essência                                          |
| --- | ----------------- | --------------- | ------------------------------------------------- |
| 12  | IA Consultiva     | `/ai-assistant` | Consultas em linguagem natural sobre os dados     |
| 13  | Cockpit Executivo | `/dashboard`\*  | Visão consolidada (projetos, pessoas, financeiro) |

\* O Cockpit Executivo é a evolução do `/dashboard` atual — começa como o painel
de boas-vindas e vai ganhando os indicadores conforme as fases anteriores
existirem.

## Princípios para não se perder

1. **Um módulo por PR.** Não tente fazer três ao mesmo tempo.
2. **Fundação antes de análise.** Sem dados, os módulos analíticos não têm o que mostrar.
3. **Sempre o mesmo padrão** (migration+RLS → service → action → tela). A skill
   `/new-module` garante isso.
4. **Permissão coerente** entre `rbac.config.ts` e as policies RLS.
