-- Strata schema: documents, fields, audit_log
-- Mirrors implementation-plan.md section 2.2

create extension if not exists vector;
create extension if not exists pgcrypto; -- gen_random_uuid()

create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null,
  doc_type text,                          -- 'invoice' | 'contract' | 'resume' | null (unknown)
  status text not null default 'queued',  -- queued | extracting | structuring | ready_for_review | verified | failed
  error_message text,                     -- set when status = 'failed'
  raw_text text,                          -- extracted plain text, used for embeddings
  embedding vector(1024),                 -- pgvector column, dims match embedding model
  created_at timestamptz default now()
);

create table fields (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  label text not null,                    -- e.g. 'total_due'
  value text,
  source_span text,                       -- raw text span the value was read from, for the highlight UI
  confidence text not null default 'high' check (confidence in ('high', 'review')),
  verified boolean not null default false,
  created_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  field_id uuid references fields(id) on delete cascade,
  old_value text,
  new_value text,
  edited_at timestamptz default now()
);

-- helpful indexes for the query-router filter path and document lookups
create index fields_document_id_idx on fields (document_id);
create index fields_label_idx on fields (label);
create index audit_log_field_id_idx on audit_log (field_id);

-- vector similarity index — build after some rows exist; ivfflat needs data to tune `lists` well,
-- fine as a default at assignment scale.
create index documents_embedding_idx on documents using ivfflat (embedding vector_cosine_ops);

-- row-level security: open read/write for now (assignment scope) — see decisions.md.
-- a real product would gate these by user/org via auth.uid() checks.
alter table documents enable row level security;
alter table fields enable row level security;
alter table audit_log enable row level security;

create policy "allow all" on documents for all using (true) with check (true);
create policy "allow all" on fields for all using (true) with check (true);
create policy "allow all" on audit_log for all using (true) with check (true);

-- realtime: allow the frontend to subscribe to document status changes
alter publication supabase_realtime add table documents;
alter publication supabase_realtime add table fields;
