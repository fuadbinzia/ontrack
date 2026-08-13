-- PostgreSQL sum(bigint) returns numeric; accept those aggregate values directly.

create or replace function public.analytics_latency_percentile(
  sample_count numeric,
  b100 numeric,
  b250 numeric,
  b500 numeric,
  b1000 numeric,
  b2000 numeric,
  b5000 numeric,
  bslow numeric,
  maximum_ms integer,
  requested_percentile numeric
)
returns integer
language sql
immutable
as $$
  select case
    when sample_count <= 0 then null
    when b100 >= ceil(sample_count * requested_percentile) then 100
    when b100 + b250 >= ceil(sample_count * requested_percentile) then 250
    when b100 + b250 + b500 >= ceil(sample_count * requested_percentile) then 500
    when b100 + b250 + b500 + b1000 >= ceil(sample_count * requested_percentile) then 1000
    when b100 + b250 + b500 + b1000 + b2000 >= ceil(sample_count * requested_percentile) then 2000
    when b100 + b250 + b500 + b1000 + b2000 + b5000 >= ceil(sample_count * requested_percentile) then 5000
    when bslow > 0 then maximum_ms
    else maximum_ms
  end
$$;

revoke all on function public.analytics_latency_percentile(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer, numeric)
from public, anon, authenticated;
grant execute on function public.analytics_latency_percentile(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer, numeric)
to service_role;
