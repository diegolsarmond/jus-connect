-- View to expose user details matching application queries
CREATE OR REPLACE VIEW public.vw_usuarios AS
SELECT
    u.id,
    u.nome_completo,
    u.cpf,
    u.email,
    p.nome AS perfil,
    em.nome_empresa AS empresa,
    e.nome AS setor,
    u.oab,
    u.status,
    u.senha,
    u.telefone,
    u.ultimo_login,
    u.observacoes,
    u.datacriacao
FROM public.usuarios u
JOIN public.escritorios e ON u.setor = e.id
JOIN public.perfis p ON u.perfil = p.id
JOIN public.empresas em ON u.empresa = em.id;
