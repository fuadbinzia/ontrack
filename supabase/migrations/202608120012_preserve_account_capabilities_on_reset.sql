-- Reset removes user content and connections, but account flags and purchased
-- entitlements belong to the retained account. Account deletion still removes
-- them through their auth.users ON DELETE CASCADE constraints.

do $$
declare
  definition text;
  account_capability_block text := E'  delete from public.account_flags where user_id = target_user_id;\n  delete from public.agent_entitlements where user_id = target_user_id;\n  delete from public.addon_entitlements where user_id = target_user_id;\n';
begin
  definition := pg_get_functiondef('public.purge_user_data(uuid)'::regprocedure);
  if position(account_capability_block in definition) > 0 then
    execute replace(definition, account_capability_block, '');
  end if;
end;
$$;
