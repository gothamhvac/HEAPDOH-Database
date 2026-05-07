-- Rename existing cost fields to HEAP-specific and add DOH + our cost
alter table ac_models rename column labor_cost to heap_labor_cost;
alter table ac_models rename column parts_cost to heap_parts_cost;
alter table ac_models rename column total_cost to heap_total_cost;

alter table ac_models add column doh_labor_cost numeric(10,2);
alter table ac_models add column doh_parts_cost numeric(10,2);
alter table ac_models add column doh_total_cost numeric(10,2);

alter table ac_models add column our_cost numeric(10,2);
