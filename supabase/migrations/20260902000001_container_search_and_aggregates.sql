-- Container-scoped search + provenance + per-container aggregates.
--
-- Replaces match_documents with a version that:
--   * accepts an optional filter_container_id (null = global search across all documents)
--   * returns container_id + container_name on every hit (provenance for the global-search UI)
-- and adds container_field_aggregate for numeric/currency rollups over a container's fields.

-- ---------------------------------------------------------------------------
-- match_documents: semantic search, optionally scoped to one container.
-- filter_container_id null  -> global search (scope omitted)
-- filter_container_id set   -> only documents in that container
-- Every row carries which container it came from, so global results can show provenance.
-- ---------------------------------------------------------------------------
create or replace function match_documents (
  query_embedding vector(1024),
  match_threshold float default 0.5,
  match_count int default 10,
  filter_container_id uuid default null
)
returns table (
  id uuid,
  name text,
  doc_type text,
  raw_text text,
  similarity float,
  container_id uuid,
  container_name text
)
language sql stable
as $$
  select
    documents.id,
    documents.name,
    documents.doc_type,
    documents.raw_text,
    1 - (documents.embedding <=> query_embedding) as similarity,
    documents.container_id,
    containers.name as container_name
  from documents
  left join containers on containers.id = documents.container_id
  where documents.embedding is not null
    and (filter_container_id is null or documents.container_id = filter_container_id)
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- container_field_aggregate: run a numeric aggregate over one field label
-- across all documents in a container. Safe because the container schema
-- guarantees consistent labels/types within the set. Values are stored as
-- text in `fields.value`; we strip common currency/formatting characters
-- before casting so '$1,250.00' aggregates as 1250.00.
--
-- agg: 'sum' | 'avg' | 'count' | 'min' | 'max'
--   count returns the number of matching field rows (no cast needed).
--   sum/avg/min/max cast value to numeric after stripping non-numeric chars;
--   rows whose value doesn't parse to a number are ignored.
-- ---------------------------------------------------------------------------
create or replace function container_field_aggregate (
  p_container_id uuid,
  p_label text,
  p_agg text default 'sum'
)
returns numeric
language plpgsql stable
as $$
declare
  result numeric;
begin
  if p_agg = 'count' then
    select count(*)
      into result
      from fields
      join documents on documents.id = fields.document_id
     where documents.container_id = p_container_id
       and fields.label = p_label;
    return coalesce(result, 0);
  end if;

  if p_agg not in ('sum', 'avg', 'min', 'max') then
    raise exception 'Unsupported aggregate: %', p_agg;
  end if;

  -- cast the cleaned value to numeric; skip rows that don't look numeric.
  execute format(
    'select %s(cleaned)
       from (
         select nullif(regexp_replace(fields.value, ''[^0-9.\-]'', '''', ''g''), '''')::numeric as cleaned
           from fields
           join documents on documents.id = fields.document_id
          where documents.container_id = $1
            and fields.label = $2
            and fields.value ~ ''[0-9]''
       ) t',
    p_agg
  )
  into result
  using p_container_id, p_label;

  return result;
end;
$$;
