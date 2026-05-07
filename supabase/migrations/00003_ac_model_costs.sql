-- Add cost fields to AC models
alter table ac_models add column labor_cost numeric(10,2);
alter table ac_models add column parts_cost numeric(10,2);
alter table ac_models add column total_cost numeric(10,2);
