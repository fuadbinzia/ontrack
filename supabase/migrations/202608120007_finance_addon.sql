-- Finance add-on: entitlement id + app_state sync domain (JSON blob).
alter table public.app_state
drop constraint if exists app_state_domain_check;

alter table public.app_state
add constraint app_state_domain_check
check (
  domain in (
    'addons',
    'agents',
    'preferences',
    'schedule',
    'plants',
    'travel',
    'todos',
    'vision-board',
    'vehicles',
    'finance'
  )
);

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
    'finance'
  )
);
