-- Supabase Storage metadata is read-only. Return the caller's object paths so
-- the app can delete the actual files through the Storage API before the
-- relational reset/account deletion transaction runs.

do $$
declare
  definition text;
  forbidden_block text := E'  -- Storage does not cascade with auth.users.\n  delete from storage.objects\n  where owner = target_user_id\n     or name like target_user_id::text || ''/%'';\n\n';
begin
  definition := pg_get_functiondef('public.purge_user_data(uuid)'::regprocedure);
  if position(forbidden_block in definition) > 0 then
    execute replace(definition, forbidden_block, '');
  end if;
end;
$$;

create or replace function public.list_own_storage_objects()
returns table(bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select object.bucket_id, object.name
  from storage.objects as object
  where auth.uid() is not null
    and object.bucket_id in (
      'app-media',
      'profile-avatars',
      'meal-photos',
      'todo-recipe-images'
    )
    and (
      object.owner_id = auth.uid()::text
      or object.name like auth.uid()::text || '/%'
    );
$$;

drop policy if exists "users delete own app storage objects" on storage.objects;
create policy "users delete own app storage objects"
on storage.objects for delete to authenticated
using (
  bucket_id in ('app-media', 'profile-avatars', 'meal-photos', 'todo-recipe-images')
  and (
    owner_id = auth.uid()::text
    or name like auth.uid()::text || '/%'
  )
);

revoke all on function public.list_own_storage_objects() from public;
grant execute on function public.list_own_storage_objects() to authenticated;

comment on function public.list_own_storage_objects() is
  'Lists the caller-owned app objects for deletion through the Storage API.';
