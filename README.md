# Elares Beauty

Sistema de gestão para salões da família Elares. Adaptação independente da base Elares Barber, preservando histórico e autoria de Tarcisio Lucas. Referência da base: commit fe89e5b. A documentação herdada permanece em docs/README_BASE_BARBER.md e demais documentos anteriores; suas referências de publicação dizem respeito ao Barber, não comprovam publicação ou validação do Beauty.

## Executar localmente

Node 22 e Docker Desktop. Copie .env.example para .env e gere senhas exclusivas antes de iniciar. Nunca copie arquivos de ambiente ou bancos do Barber.

1. npm ci
2. docker compose up -d db
3. npm run db:seed
4. npm run dev

Endereço: http://127.0.0.1:3018. PostgreSQL: 127.0.0.1:5548, banco elares_beauty, usuário beauty, volume elares_beauty_data. O .env local é ignorado e contém segredos exclusivos. A demonstração usa somente dados fictícios.

## Demonstrações

Use os botões Gestor e profissional e Profissional na entrada. Contas: demo@beauty.local e profissional@beauty.local; senha pública de demonstração DemoBeauty2026!. Não usar essas contas ou senha em ambiente real. As contas administrativas locais usam INITIAL_LOCAL_PASSWORD definido exclusivamente no .env do Beauty.

## Organização

- Agenda: components/Calendar.tsx; lib/booking.ts, availability.ts e calendar.ts; app/api/agenda.
- Profissionais: SettingsPanel.tsx e ProfessionalSettings.tsx; app/api/settings e my-profile.
- Serviços: configuração própria com habilitação, preço e duração por profissional; app/api/settings.
- Clientes: ClientsPanel.tsx e app/api/clients; histórico derivado dos atendimentos e filtrado no servidor.
- Financeiro: FinancePanel.tsx, lib/finance.ts, app/api/finance; avulsos em lib/walk-ins.ts.
- Relatórios: ReportsPanel.tsx e lib/financial-pdf.ts; PDF e CSV respeitam as permissões.
- Lembretes: ManualRemindersPanel.tsx, InAppNotifications.tsx, lib/manual-reminder-store.ts e app/api/reminders.
- Marca: lib/beauty.ts, app/beauty.css e public/brand/elares-beauty-*.svg. ThemeControl.tsx salva a preferência claro/escuro somente neste navegador.

## Validação

npm run typecheck; npm test (requer servidor e banco locais); npm run build; node scripts/qa-beauty.mjs (Edge instalado). As evidências de teste são locais, em tmp/beauty-qa. Veja docs/BEAUTY_PROGRESSO.md para resultado e limites da validação.

Nenhum deploy é parte desta etapa. O workflow GitHub realiza somente CI. Scripts antigos de hospedagem são referências herdadas e não configuram uma publicação Beauty.
