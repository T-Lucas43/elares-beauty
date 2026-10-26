# Progresso e pendências — Elares Beauty

## Herdado e executado nesta cópia

Agenda lista/dia/semana/mês; exclusão de conflitos no banco e reservas simultâneas por profissional; permissões por perfil; atendimento avulso; recebimentos parciais, taxas, gorjetas, despesas, divisões percentuais/fixas, repasses, adiantamentos e caixa; relatórios PDF/CSV; PWA; TV; solicitações e confirmação manual de lembretes; pop-ups com a aplicação aberta. Testes do Barber anteriores não são evidência do Beauty: as suítes foram adaptadas e executadas contra servidor 3018 e banco Beauty.

## Adaptado / novo

Nome, textos, logo original Elares em violeta, ícones, PWA e cache próprio, temas claro/escuro, PDFs e TV Beauty; dados fictícios com seis serviços e três profissionais; duas demonstrações; módulos Clientes (histórico derivado dos atendimentos) e Relatórios em áreas próprias; configuração e cookies independentes; testes específicos Beauty.

## Validação concluída nesta etapa

- TypeScript: passou.
- Build de produção local: passou, sem publicação.
- Suíte final: 26/26 testes passaram no servidor e banco Beauty, incluindo catálogo, cookies exclusivos, agenda concorrente, financeiro, lembretes e isolamento.
- Edge headless: 36/36 verificações passaram (9 módulos, 1440/375 px, claro/escuro), sem overflow horizontal da página e sem erros JavaScript. As quatro visões de agenda foram exercitadas. Persistência do tema após recarregar, demonstração profissional mobile e bloqueio da TV para profissional comprovados. PDF e CSV retornaram sucesso.
- PDF final: 10 páginas A4 renderizadas com Poppler e inspecionadas em mosaico; primeira página também inspecionada ampliada. Texto extraído com pypdf sem Navalha/Barber e com marca Beauty. TV inspecionada após carregar os dados do salão.

## Pendências e limites

- Cadastro independente de cliente e edição de ficha além do histórico não fazem parte desta primeira adaptação; módulo atual deriva dos atendimentos e aplica permissões no servidor.
- Instalação efetiva no dispositivo e comportamento PWA em iOS/Android não foram comprovados por teste em Edge headless.
- Envio e entrega no WhatsApp nunca são inferidos da abertura; nenhum envio real foi testado. Telefone e sessão do salão devem ser configurados pela equipe antes do uso real.
- Recuperação por email, backups externos e restauração operacional dependem de configuração própria e validação; não há credenciais externas reutilizadas.
- Instalação inicial sofreu ENOSPC no C:. Tipos Next e atalhos npm foram reparados; os comandos finais de tipos, testes e build verificam os caminhos usados. Recomenda-se liberar espaço e executar npm ci novamente para instalação integral reproduzível. Não removemos dados de outros projetos.
- Produção, hospedagem, domínios e deploy não executados.

## Execução e evidências locais

A compilação final passou com um worker após limpar somente o cache .next desta cópia, com o servidor parado. A aplicação permanece executando com npm run start em http://127.0.0.1:3018. Banco e volume Docker Beauty permanecem ativos.

Script reproduzível: scripts/qa-beauty.mjs. Resultados e capturas em tmp/beauty-qa/results.json e PNG/PDF na mesma pasta, ignorados pelo Git. A cobertura visual automatizada não equivale a auditoria WCAG completa ou testes em celulares físicos. O disco C: apresentou falta de espaço e ainda precisa de espaço livre para futuras instalações e compilações.

## Modelo SaaS — contexto recebido, pendente de implementação

Foi recebido alinhamento de modelo para vários salões e administração da plataforma distinta do dono do salão: planos/limites configuráveis, pagamento e vencimento, ativação e renovação manual com auditoria. Cobrança manual, sem gateway obrigatório. Não há preço, duração de teste ou política de vencimento aprovada. A base já tem tenant_id e isolamento por empresa, mas isso não constitui gestão completa de assinaturas nem cadastro público independente: essa camada permanece pendente e não há cobrança ativa.
