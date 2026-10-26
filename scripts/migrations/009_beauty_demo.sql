-- Adaptação dos registros fictícios desta cópia. IDs legados preservam referências.
UPDATE tenants SET name='Elares Beauty',slug='elares-beauty' WHERE id='demo' AND slug='studio-da-navalha';
UPDATE professionals SET name='Marina Costa',specialty='Corte, escova e coloração',color='#7C3AED' WHERE tenant_id='demo' AND id='rafa' AND name='Rafael Costa';
UPDATE professionals SET name='Bianca Almeida',specialty='Hidratação e cuidados capilares',color='#6D28D9' WHERE tenant_id='demo' AND id='bruno' AND name='Bruno Almeida';
UPDATE professionals SET name='Luiza Santos',specialty='Manicure e sobrancelhas',color='#A855F7' WHERE tenant_id='demo' AND id='leo' AND name='Leonardo Santos';
UPDATE services SET name=CASE id WHEN 'barba' THEN 'Escova' WHEN 'combo' THEN 'Hidratação' WHEN 'acabamento' THEN 'Sobrancelhas' WHEN 'corte' THEN 'Corte' END,description='Serviço fictício de demonstração Elares Beauty' WHERE tenant_id='demo' AND id IN ('barba','combo','acabamento','corte');
UPDATE appointments a SET service_name_snapshot=s.name FROM services s WHERE a.service_id=s.id AND a.tenant_id='demo';
