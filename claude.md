# CLAUDE.md — Projeto N8N: Atendimento WhatsApp e Automação de Follow-Up

## Visão Geral do Projeto

Este projeto usa **Claude Code com n8n-mcp (MCP Server) e n8n-skills** para criar, gerenciar
e depurar workflows n8n de forma autônoma, sem necessidade de acesso manual à interface do n8n.

Casos de uso principais:
1. **Agentes de IA para Atendimento via WhatsApp** — respostas automáticas, classificação de
   intenção, roteamento para humanos e integração com CRM.
2. **Automações de Follow-Up** — sequências de mensagens agendadas, lembretes, reengajamento
   de leads e acompanhamento pós-atendimento.

**Idioma de trabalho:** Português Brasileiro. Responder SEMPRE em PT-BR.

**Regra fundamental:** Claude DEVE usar as ferramentas MCP para interagir com o n8n. Nunca
instruir o usuário a fazer alterações manuais na UI quando uma ferramenta MCP puder executar a
tarefa.

---

## Ferramentas Disponíveis

### 1. n8n-MCP (`czlonkowski/n8n-mcp`)

Servidor MCP com acesso direto à instância n8n. Usar sempre que disponível.

#### Ferramentas de Descoberta de Nós

| Ferramenta | Uso Principal |
|---|---|
| `search_nodes` | Buscar nós por nome, funcionalidade ou tipo |
| `get_node` | Obter esquema completo e propriedades de um nó — usar `detail: 'full'` para configurações complexas |

#### Ferramentas de Validação

| Ferramenta | Uso Principal |
|---|---|
| `validate_node` | Validar configuração de um nó específico antes de aplicar |
| `validate_workflow` | Validar o workflow completo — OBRIGATÓRIO antes de finalizar qualquer criação |

#### Ferramentas de Gerenciamento de Workflows

| Ferramenta | Uso Principal |
|---|---|
| `n8n_create_workflow` | Criar workflow novo do zero |
| `n8n_get_workflow` | Obter o JSON completo de um workflow existente |
| `n8n_update_partial_workflow` | Atualizar partes específicas — **preferir sempre que possível** |
| `n8n_update_full_workflow` | Substituir completamente um workflow — usar só para reestruturações |
| `n8n_delete_workflow` | Excluir workflow — pedir confirmação do usuário antes |
| `n8n_list_workflows` | Listar todos os workflows da instância |

#### Ferramentas de Execução e Diagnóstico

| Ferramenta | Uso Principal |
|---|---|
| `list_executions` | Ver histórico de execuções (filtrar por `status: error` ou `success`) |
| `get_execution` | Detalhar uma execução específica para debug |
| `execute_workflow` | Disparar um workflow manualmente para teste |

#### Ferramentas de Templates

| Ferramenta | Uso Principal |
|---|---|
| `search_templates` | Buscar templates por palavra-chave ou nós utilizados |
| `get_template` | Obter o JSON completo de um template para usar como base |

---

### 2. n8n-Skills (`czlonkowski/n8n-skills`)

Sete skills especializadas que ativam automaticamente conforme o contexto:

| Skill | Ativa Quando |
|---|---|
| **n8n Expression Syntax** | Trabalhando com `{{ }}`, `$json`, `$node`, `$input`, dados de webhook |
| **n8n MCP Tools Expert** | Usando ferramentas MCP, criando ou atualizando workflows via API |
| **n8n Workflow Patterns** | Projetando arquitetura de workflows (webhook, HTTP, IA, agendado) |
| **n8n Validation Expert** | Interpretando erros de validação, corrigindo configurações inválidas |
| **n8n Node Configuration** | Configurando nós específicos, dependências de propriedades |
| **n8n Code JavaScript** | Escrevendo código em nós Code com JavaScript |
| **n8n Code Python** | Escrevendo código em nós Code com Python |

Não é necessário invocar manualmente — as skills ativam por contexto.

---

## Acesso à Instância n8n

### Configuração Obrigatória

As credenciais de acesso devem estar configuradas como variáveis de ambiente no MCP server:

```
N8N_API_URL=https://sua-instancia.n8n.cloud   # ou http://localhost:5678
N8N_API_KEY=sua_chave_api_aqui
```

Se o usuário não informou essas variáveis, **perguntar antes de prosseguir** com qualquer
operação que exija acesso à instância.

### Verificação de Conexão

Antes de iniciar qualquer tarefa de criação, executar `n8n_list_workflows` para confirmar
conectividade. Se houver erro de autenticação, solicitar que o usuário verifique `N8N_API_KEY`
e `N8N_API_URL`.

### Regra de Segurança — Produção

> **NUNCA editar diretamente workflows ativos em produção.**
> Sempre duplicar o workflow, trabalhar na cópia, validar e pedir confirmação do usuário
> antes de substituir o original.

---

## Processo Padrão de Criação de Workflow

Seguir este fluxo em toda criação ou modificação:

```
1. ENTENDER   → Confirmar objetivo, triggers, integrações e regras de negócio com o usuário
2. PESQUISAR  → search_nodes para encontrar os nós corretos
                search_templates para verificar se existe template como ponto de partida
3. CONFIGURAR → get_node (detail: 'full') para cada nó que será usado
4. CONSTRUIR  → n8n_create_workflow OU n8n_update_partial_workflow
5. VALIDAR    → validate_workflow OBRIGATORIAMENTE antes de finalizar
6. TESTAR     → execute_workflow para teste manual
7. CONFIRMAR  → Apresentar resumo do que foi criado ao usuário
```

### Ordem de Preferência para Atualizações

1. `n8n_update_partial_workflow` — para adicionar/remover nós ou corrigir parâmetros
2. `n8n_update_full_workflow` — somente para reestruturações completas
3. `n8n_create_workflow` — somente para workflows inteiramente novos

---

## Padrões para Atendimento WhatsApp

### Arquitetura Base do Agente WhatsApp

```
[WhatsApp Trigger]
        |
        v
[IF: É mensagem de texto?]
   Sim |             | Não (status update, delivery, etc.)
       v             v
[AI Agent]        [Respond 200 + Stop]
(LangChain)
       |
       v
[WhatsApp: Send Message]
```

### Nós Essenciais

| Nó | Função |
|---|---|
| `n8n-nodes-base.whatsappTrigger` | Escutar mensagens recebidas via Meta API |
| `n8n-nodes-base.whatsapp` (operação `message:send`) | Enviar resposta livre (dentro da janela 24h) |
| `n8n-nodes-base.whatsapp` (operação `message:sendTemplate`) | Enviar template aprovado (obrigatório fora da janela 24h) |
| `@n8n/n8n-nodes-langchain.agent` | Nó principal do agente (Tools Agent) |
| `@n8n/n8n-nodes-langchain.lmChatOpenAi` | Modelo de linguagem (OpenAI, Anthropic, etc.) |
| `@n8n/n8n-nodes-langchain.memoryBufferWindow` | Memória de janela para contexto da conversa |
| `@n8n/n8n-nodes-langchain.toolWorkflow` | Chamar sub-workflows como ferramentas do agente |
| `n8n-nodes-base.switch` | Rotear por intenção, tipo de mensagem ou status |
| `n8n-nodes-base.if` | Validações binárias |

### Dados do WhatsApp Trigger (Estrutura Meta API)

```javascript
// Texto da mensagem recebida:
{{ $json.body.entry[0].changes[0].value.messages[0].text.body }}

// ID do remetente (número de telefone):
{{ $json.body.entry[0].changes[0].value.messages[0].from }}

// ID da mensagem (para marcar como lida):
{{ $json.body.entry[0].changes[0].value.messages[0].id }}

// Tipo da mensagem (text, audio, image, document):
{{ $json.body.entry[0].changes[0].value.messages[0].type }}

// Nome do contato:
{{ $json.body.entry[0].changes[0].value.contacts[0].profile.name }}
```

**Atenção:** Sempre verificar se `messages` existe antes de acessar. Notificações de delivery
e leitura NÃO contêm o campo `messages` — filtrar com IF no início do workflow.

### Filtro Obrigatório de Mensagens de Status

Inserir este IF logo após o WhatsApp Trigger:

```
Condição:
  $json.body.entry[0].changes[0].value.messages EXISTS
  E
  $json.body.entry[0].changes[0].value.messages[0].type == "text"
```

- Branch **TRUE** → processar como mensagem do cliente
- Branch **FALSE** → responder HTTP 200 e encerrar (evitar timeout da Meta API)

### Regras WhatsApp Business

1. **Janela de 24 horas:** Após receber mensagem do cliente, há 24h para responder livremente.
   Após esse período, apenas templates aprovados pela Meta.
2. **Um webhook por App:** Apenas um WhatsApp Trigger ativo por App Meta. Usar Switch para
   dividir eventos no mesmo trigger.
3. **Mensagens proativas (follow-up):** EXIGEM templates aprovados. Usar operação
   `message:sendTemplate` com os parâmetros exatamente como aprovados na Meta.
4. **Credenciais separadas:** O Trigger usa OAuth (App ID + App Secret). O nó de envio usa
   Access Token + Phone Number ID + Business Account ID.

### System Prompt Base para Agente de Atendimento

```
Você é um assistente virtual de atendimento ao cliente para [Nome da Empresa].

Responda SEMPRE em português brasileiro de forma educada, clara e objetiva.
Mantenha respostas curtas (máximo 3 parágrafos). Não use markdown — apenas texto simples.

Você pode ajudar com:
- Informações sobre produtos e serviços
- Status de pedidos (use a ferramenta consultar_pedido)
- Agendamentos (use a ferramenta verificar_agenda)
- Dúvidas frequentes

Se o cliente pedir para falar com humano, responda:
"Entendido! Vou te transferir para nossa equipe agora. Um momento, por favor."
E chame a ferramenta escalar_atendimento.

Nunca invente informações. Se não souber, diga que vai verificar e retornar em breve.
```

---

## Padrões para Follow-Up Automation

### Arquitetura: Sequência com Wait Node (Preferida)

```
[Webhook: novo lead/evento]
        |
        v
[Set: capturar dados do contato]
        |
        v
[Enviar Mensagem Dia 0]
        |
        v
[Wait: 24 horas]
        |
        v
[IF: respondeu ou converteu?]
    Sim |             | Não
        v             v
    [Encerrar]   [Enviar Follow-Up 1]
                      |
                      v
                 [Wait: 48 horas]
                      |
                      v
                 [IF: respondeu?]
                  Sim |    | Não
                      v    v
                  [Encerrar] [Enviar Follow-Up 2]
                              |
                              v
                         [Wait: 96 horas]
                              |
                              v
                         [IF: respondeu?]
                          Sim |    | Não
                              v    v
                          [Encerrar] [Marcar como "frio" no CRM]
```

### Arquitetura: Schedule Trigger (Para Lotes)

```
[Schedule Trigger — diário]
        |
        v
[HTTP Request: buscar leads sem follow-up no CRM]
        |
        v
[Split In Batches: lotes de 10]
        |
        v
[IF: canal preferido do contato]
  WhatsApp |   Email   |   SMS
     |          |           |
     v          v           v
[WhatsApp]  [Email]   [SMS/Twilio]
     |          |           |
     +----------+-----------+
                |
                v
[HTTP Request: atualizar data_followup no CRM]
```

### Nós Essenciais para Follow-Up

| Nó | Função |
|---|---|
| `n8n-nodes-base.scheduleTrigger` | Disparar em horários fixos |
| `n8n-nodes-base.wait` | Pausar execução por tempo determinado |
| `n8n-nodes-base.splitInBatches` | Processar listas em lotes (evitar rate limits) |
| `n8n-nodes-base.httpRequest` | Consultar e atualizar CRM via API REST |
| `n8n-nodes-base.emailSend` | Enviar e-mails de follow-up |
| `n8n-nodes-base.if` | Verificar condições (respondeu? converteu?) |
| `n8n-nodes-base.set` | Preparar/transformar dados |
| `n8n-nodes-base.code` | Filtragem, cálculo de datas, personalização de mensagens |

### Expressões de Data para Follow-Up

```javascript
// Data de follow-up (3 dias a partir de agora):
{{ $now.plus({ days: 3 }).toISO() }}

// Verificar se a data de follow-up já passou:
{{ DateTime.fromISO($json.followup_date) <= $now }}

// Saudação por período do dia:
{{ $now.hour < 12 ? 'Bom dia' : $now.hour < 18 ? 'Boa tarde' : 'Boa noite' }}

// Data formatada em PT-BR:
{{ DateTime.fromISO($json.created_at).setLocale('pt-BR').toFormat('dd/MM/yyyy') }}

// Verificar se campo existe e tem valor:
{{ $json.phone && $json.phone.length > 0 ? $json.phone : null }}
```

---

## Integrações CRM

### Padrão HTTP Request Genérico

```javascript
// GET — buscar contato:
Método: GET
URL: {{ $env.CRM_BASE_URL }}/contacts/{{ $json.contact_id }}
Header: Authorization: Bearer {{ $env.CRM_API_KEY }}

// POST — criar contato:
Método: POST
URL: {{ $env.CRM_BASE_URL }}/contacts
Body: { "email": "{{ $json.email }}", "phone": "{{ $json.phone }}" }

// PATCH — atualizar campo:
Método: PATCH
URL: {{ $env.CRM_BASE_URL }}/contacts/{{ $json.contact_id }}
Body: { "last_followup": "{{ $now.toISO() }}" }
```

### CRMs com Nós Nativos no n8n

| CRM | Termo para search_nodes |
|---|---|
| HubSpot | `hubspot` |
| Salesforce | `salesforce` |
| Pipedrive | `pipedrive` |
| Zoho CRM | `zoho` |
| ActiveCampaign | `activecampaign` |
| Google Sheets (CRM simples) | `googleSheets` |
| Notion (CRM simples) | `notion` |
| Airtable | `airtable` |

### Padrão Upsert de Contato

```
[Receber dados do lead]
        |
        v
[HTTP GET: buscar por email no CRM]
        |
        v
[IF: contato já existe?]
    Sim |             | Não
        v             v
[HTTP PATCH:      [HTTP POST:
 atualizar]        criar novo]
    |                  |
    +------------------+
              |
              v
[Set: consolidar ID do contato]
```

---

## Sintaxe de Expressões n8n

### Regras Fundamentais

```javascript
// Campo simples:
{{ $json.nome }}

// Campo com espaço:
{{ $json['nome completo'] }}

// WEBHOOK — body é obrigatório:
{{ $json.body.mensagem }}           // CORRETO
{{ $json.mensagem }}                // ERRADO — não funciona em webhooks

// Referenciar nó pelo nome exato:
{{ $('Nome do Nó').item.json.campo }}
{{ $('Nome do Nó').first().json.campo }}
{{ $('Nome do Nó').all() }}

// Primeiro e último item:
{{ $input.first().json.campo }}
{{ $input.last().json.campo }}

// Valor padrão se campo não existe:
{{ $json.telefone ?? 'sem telefone' }}
```

### Variáveis por Contexto

| Variável | Disponível em | Descrição |
|---|---|---|
| `$json` | Expressões e Code | Dados do item atual |
| `$input` | Expressões | Todos os itens do nó anterior |
| `$('NomeNó')` | Expressões | Referenciar qualquer nó já executado |
| `$workflow` | Expressões | Metadados do workflow (id, name) |
| `$execution` | Expressões | Dados da execução atual |
| `$env` | Expressões | Variáveis de ambiente da instância n8n |
| `$now` | Expressões | Data/hora atual (objeto Luxon DateTime) |
| `$today` | Expressões | Data atual sem horário |
| `$input.all()` | Code Node (JS) | Todos os itens de entrada |

### Code Node JavaScript — Padrões

```javascript
// Run Once for All Items — processar lista:
const resultado = [];

for (const item of $input.all()) {
  const d = item.json;
  resultado.push({
    json: {
      nome: d.name || d.nome,
      telefone: d.phone?.replace(/\D/g, ''),
      atualizado_em: $now.toISO(),
    }
  });
}

return resultado;
```

```javascript
// Run Once for Each Item — transformar item atual:
return {
  json: {
    ...item.json,
    processado: true,
    timestamp: $now.toISO(),
  }
};
```

---

## Boas Práticas

### Nomenclatura de Nós

- Usar nomes descritivos em PT-BR: "Receber Mensagem WhatsApp", "Buscar Contato CRM"
- Evitar nomes padrão como "HTTP Request1", "If", "Code"
- Padrão: **verbo no infinitivo + objeto** → "Enviar Email", "Validar Telefone", "Atualizar CRM"

### Estrutura Recomendada

```
[Trigger] → [Validar Entrada] → [Buscar Dados] → [Processar/Decidir] → [Executar Ação] → [Confirmar]
```

### Tratamento de Erros

1. **Error Trigger Workflow:** Criar workflow separado com Error Trigger para capturar falhas e
   notificar a equipe (WhatsApp, e-mail ou Slack).
2. **Stop and Error:** Usar para validações críticas — ex: telefone vazio, credencial inválida.
3. **Continue on Error:** Configurar para nós de processamento em lote — um erro individual não
   deve interromper os demais.
4. **Validação antecipada:** Verificar campos obrigatórios com IF logo após o trigger.

### Nunca Fazer

- Nunca armazenar API keys diretamente em expressões ou nós Code — usar `$env`
- Nunca usar `n8n_update_full_workflow` para pequenas correções
- Nunca criar workflow sem executar `validate_workflow` ao final
- Nunca editar workflow ativo em produção sem duplicar e testar antes
- Nunca ignorar erros de validação — interpretar e corrigir antes de salvar

### Performance

- Usar `splitInBatches` ao processar listas com mais de 50 itens
- Configurar retry automático em HTTP Request para APIs externas (2-3 tentativas)
- Em follow-up, usar Wait Node em vez de múltiplos workflows agendados separados

---

## Como Solicitar Workflows ao Claude

### Informações Necessárias

1. **Objetivo:** O que o workflow deve fazer?
2. **Trigger:** Como ele começa? (WhatsApp, agendamento, evento externo, manual)
3. **Integrações:** Quais sistemas? (WhatsApp, CRM, planilha, e-mail, API)
4. **Regras de negócio:** Quais condições o workflow deve avaliar?
5. **Resultado esperado:** O que deve acontecer ao final?

### Exemplo de Solicitação Clara

> "Crie um workflow que recebe mensagens do WhatsApp, verifica se o número está no Google
> Sheets — se sim responde com o nome do cliente; se não cadastra e responde com mensagem de
> boas-vindas. Após 24h sem resposta, enviar um follow-up com template aprovado."

### O que Claude vai fazer

1. Confirmar o entendimento antes de criar
2. Pesquisar nós e templates adequados via MCP
3. Criar o workflow diretamente na instância n8n
4. Validar automaticamente com `validate_workflow`
5. Apresentar resumo com IDs, nomes dos nós e próximos passos
6. Apontar o que ainda precisa de configuração manual (credenciais, templates Meta, etc.)

---

## Referências Rápidas

### Termos para `search_templates`

```
"whatsapp customer service"
"whatsapp ai agent"
"whatsapp chatbot"
"lead follow up"
"crm contact sync"
"ai agent tools"
"schedule automation"
```

### Termos para `search_nodes`

```
"whatsapp"          → WhatsApp Trigger, WhatsApp Business Cloud
"ai agent"          → AI Agent (LangChain Tools Agent)
"openai"            → OpenAI Chat Model
"anthropic"         → Anthropic Chat Model
"memory"            → Simple Memory, Window Buffer Memory
"schedule"          → Schedule Trigger
"wait"              → Wait Node
"split in batches"  → Split In Batches
"google sheets"     → Google Sheets
"http request"      → HTTP Request
"email"             → Send Email, Gmail, Outlook
```

### Links de Referência

- Documentação n8n: https://docs.n8n.io
- WhatsApp Trigger: https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.whatsapptrigger/
- WhatsApp Business Cloud: https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.whatsapp/
- AI Agent Node: https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/
- Expressões n8n: https://docs.n8n.io/code/expressions/
- Templates da Comunidade: https://n8n.io/workflows/
- Repositório n8n-mcp: https://github.com/czlonkowski/n8n-mcp
- Repositório n8n-skills: https://github.com/czlonkowski/n8n-skills
