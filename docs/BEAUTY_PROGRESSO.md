# Progresso e pendências — Elares Beauty

## Herdado e executado nesta cópia

Agenda lista/dia/semana/mês; exclusão de conflitos no banco e reservas simultâneas por profissional; permissões por perfil; atendimento avulso; recebimentos parciais, taxas, gorjetas, despesas, divisões percentuais/fixas, repasses, adiantamentos e caixa; relatórios PDF/CSV; PWA; TV; solicitações e confirmação manual de lembretes; pop-ups com a aplicação aberta. Testes do Barber anteriores não são evidência do Beauty: as suítes foram adaptadas e executadas contra servidor 3018 e banco Beauty.

## Adaptado / novo

Nome, textos, logo original Elares em violeta, ícones, PWA e cache próprio, temas claro/escuro, PDFs e TV Beauty; dados fictícios com seis serviços e três profissionais; duas demonstrações; módulos Clientes (histórico derivado dos atendimentos) e Relatórios em áreas próprias; configuração e cookies independentes; testes específicos Beauty.

## Validação em andamento

- TypeScript: passou.
- Build de produção local: passou, sem publicação.
- 24 testes de domínio/integração adaptados: passaram no banco Beauty; 2 testes específicos de catálogo e cookies Beauty: passaram.
- Conferência visual final desktop/mobile e exportações: em andamento.
- PDF: primeira página renderizada e inspecionada; rodapé legado encontrado e corrigido; falta renderizar versão final e todas as páginas.

## Pendências e limites

- Cadastro independente de cliente e edição de ficha além do histórico não fazem parte desta primeira adaptação; módulo atual deriva dos atendimentos e aplica permissões no servidor.
- Instalação efetiva no dispositivo e comportamento PWA em iOS/Android não foram comprovados por teste em Edge headless.
- Envio e entrega no WhatsApp nunca são inferidos da abertura; nenhum envio real foi testado. Telefone e sessão do salão devem ser configurados pela equipe antes do uso real.
- Recuperação por email, backups externos e restauração operacional dependem de configuração própria e validação; não há credenciais externas reutilizadas.
- Instalação inicial sofreu ENOSPC no C:. Tipos Next e atalhos npm foram reparados; os comandos finais de tipos, testes e build verificam os caminhos usados. Recomenda-se liberar espaço e executar npm ci novamente para instalação integral reproduzível. Não removemos dados de outros projetos.
- Produção, hospedagem, domínios e deploy não executados.

## Modelo SaaS — contexto recebido, pendente de implementação

Foi recebido alinhamento de modelo para vários salões e administração da plataforma distinta do dono do salão: planos/limites configuráveis, pagamento e vencimento, ativação e renovação manual com auditoria. Cobrança manual, sem gateway obrigatório. Não há preço, duração de teste ou política de vencimento aprovada. A base já tem tenant_id e isolamento por empresa, mas isso não constitui gestão completa de assinaturas nem cadastro público independente: essa camada permanece pendente e não há cobrança ativa.
