-- Save route start/end addresses per organization
alter table organizations add column route_start_address text;
alter table organizations add column route_end_address text;
