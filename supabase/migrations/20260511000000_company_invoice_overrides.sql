-- Per-company invoice text overrides. Lets two companies running through
-- the same system end up with visually different DOH/HEAP invoices —
-- e.g. one company prints "Window AC" beside the model number, the other
-- prints "Sleeve unit"; one lists "Bracket, screws" for window install
-- materials, the other "Bracket, hardware kit".
--
-- Shape is open jsonb so we can add fields without a migration each time.
-- Known keys (all optional, each one a free-text string):
--   model_suffix_window
--   model_suffix_wall
--   model_suffix_portable
--   doh_materials_window
--   doh_materials_wall
--   doh_materials_portable

alter table companies add column invoice_overrides jsonb not null default '{}'::jsonb;
