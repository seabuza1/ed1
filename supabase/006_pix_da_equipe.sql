-- =====================================================================
-- Acerto dos motoboys · Supabase · Pix "caiu" só pela equipe
-- Rodar uma vez no SQL Editor, depois do 005_leitura_ajustes.sql.
-- =====================================================================

-- O motoboy pode editar a própria comanda (RLS), mas o "caiu" do Pix antecipado é do Luan:
-- na mão do motoboy, a comanda nova entra sem a marca e a existente mantém a que tinha.
-- Sem usuário (SQL Editor, chave de serviço), não mexe.
create function public.pix_so_da_equipe() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null or (select public.e_equipe()) then return new; end if;
  if tg_op = 'INSERT' then
    new.pix_confirmado := false;
  else
    new.pix_confirmado := old.pix_confirmado;
  end if;
  return new;
end $$;
revoke execute on function public.pix_so_da_equipe() from public, anon, authenticated;

create trigger comandas_pix before insert or update of pix_confirmado on public.comandas
  for each row execute function public.pix_so_da_equipe();
