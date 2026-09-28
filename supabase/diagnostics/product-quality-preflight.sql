-- READ ONLY: current product quality vocabulary, without interpreting its meaning.
-- Run by an authorized operator; no source values are transformed or imported.
begin transaction read only;
select organization_id,quality_code,quality_label_raw,count(*) as variant_count,
  count(*) filter(where is_active) as active_variant_count
from public.product_variants
group by organization_id,quality_code,quality_label_raw
order by organization_id,quality_code nulls first,quality_label_raw nulls first;
rollback;
