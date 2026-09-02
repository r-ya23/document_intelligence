-- Containerization: turn a "container" from a UI-only bucket into a persisted, schema-driven
-- dataset. A container owns a *field schema* (container_fields); every document that belongs to
-- the container is extracted against that schema, so labels/types are consistent across the set.
-- This makes structured filters reliable and per-container aggregates possible.
--
-- Additive only: existing documents get container_id = null (uncontained / global) and keep
-- working via the open-ended extraction fallback. Nothing here is destructive.

-- ---------------------------------------------------------------------------
-- containers: one row per dataset the user defines
-- ---------------------------------------------------------------------------
create table containers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  doc_type      text check (doc_type in ('invoice', 'contract', 'resume', 'other')),
  default_mode  text not null default 'auto' check (default_mode in ('auto', 'manual')),
  created_at    timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- container_fields: THE SCHEMA. one row per field a container expects its
-- documents to have. field_type drives casting for filters + aggregates.
-- ---------------------------------------------------------------------------
create table container_fields (
  id            uuid primary key default gen_random_uuid(),
  container_id  uuid not null references containers(id) on delete cascade,
  label         text not null,                     -- e.g. 'total_due'
  field_type    text not null default 'text'
                  check (field_type in ('text', 'number', 'currency', 'date')),
  required      boolean not null default false,
  description   text,                              -- optional hint fed to the extraction model
  sort_order    int not null default 0,            -- display order in the review UI
  created_at    timestamptz default now(),
  unique (container_id, label)
);

create index container_fields_container_id_idx on container_fields (container_id);

-- ---------------------------------------------------------------------------
-- link documents to their container (nullable for back-compat with existing rows)
-- ---------------------------------------------------------------------------
alter table documents
  add column container_id uuid references containers(id) on delete set null;

create index documents_container_id_idx on documents (container_id);

-- ---------------------------------------------------------------------------
-- fields: denormalize the schema's field_type onto each extracted field so
-- query-time casting needs no join, and a field's type is frozen even if the
-- container schema later changes. is_schema_field distinguishes fields that
-- match the container schema from "extra" fields the model surfaced (loose-
-- with-flagging: extras are captured, not discarded).
-- ---------------------------------------------------------------------------
alter table fields
  add column field_type text not null default 'text'
    check (field_type in ('text', 'number', 'currency', 'date'));

alter table fields
  add column is_schema_field boolean not null default true;

-- ---------------------------------------------------------------------------
-- RLS: open policies, matching the existing tables (assignment scope, see decisions.md)
-- ---------------------------------------------------------------------------
alter table containers enable row level security;
alter table container_fields enable row level security;

create policy "allow all" on containers for all using (true) with check (true);
create policy "allow all" on container_fields for all using (true) with check (true);

-- realtime: let the frontend subscribe to container + schema changes like it does documents/fields
alter publication supabase_realtime add table containers;
alter publication supabase_realtime add table container_fields;
