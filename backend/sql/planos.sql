ALTER TABLE IF EXISTS public.planos
  ADD COLUMN IF NOT EXISTS modulos TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS max_propostas INTEGER,
  ADD COLUMN IF NOT EXISTS sincronizacao_processos_habilitada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sincronizacao_processos_limite INTEGER;

COMMENT ON COLUMN public.planos.modulos IS 'Lista de módulos habilitados para o plano';
COMMENT ON COLUMN public.planos.max_propostas IS 'Número máximo de propostas permitidas para o plano';
COMMENT ON COLUMN public.planos.sincronizacao_processos_habilitada IS 'Indica se a sincronização automática de processos está habilitada para o plano';
COMMENT ON COLUMN public.planos.sincronizacao_processos_limite IS 'Limite de processos para sincronização automática do plano';
