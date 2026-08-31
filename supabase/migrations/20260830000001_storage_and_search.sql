-- Storage bucket for uploaded documents (private)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage RLS: open access for now, matching table policies (assignment scope, see decisions.md)
create policy "allow all reads" on storage.objects for select using (bucket_id = 'documents');
create policy "allow all inserts" on storage.objects for insert with check (bucket_id = 'documents');
create policy "allow all updates" on storage.objects for update using (bucket_id = 'documents');
create policy "allow all deletes" on storage.objects for delete using (bucket_id = 'documents');

-- Semantic search RPC used by query-router in 'semantic' mode.
-- Returns documents ordered by cosine distance to the query embedding.
create or replace function match_documents (
  query_embedding vector(1024),
  match_threshold float default 0.5,
  match_count int default 10
)
returns table (
  id uuid,
  name text,
  doc_type text,
  raw_text text,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.name,
    documents.doc_type,
    documents.raw_text,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.embedding is not null
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
