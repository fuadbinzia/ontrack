-- Journal add-on: entitlement id only. Pages stay device-local (no sync domain).
alter table public.addon_entitlements
drop constraint if exists addon_entitlements_addon_id_check;

alter table public.addon_entitlements
add constraint addon_entitlements_addon_id_check
check (
  addon_id in (
    'food',
    'fitness',
    'plants',
    'travel',
    'vision-board',
    'games',
    'vehicles',
    'health',
    'finance',
    'journal'
  )
);
