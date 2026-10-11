-- Keep the attendance status enum in sync with the roster UI and Server Action.
-- Resolve the column's enum type instead of assuming a particular type name.
do $$
declare
  status_type_schema name;
  status_type_name name;
begin
  select type_namespace.nspname, status_type.typname
    into status_type_schema, status_type_name
  from pg_attribute as attendance_column
  join pg_class as attendance_table
    on attendance_table.oid = attendance_column.attrelid
  join pg_namespace as table_namespace
    on table_namespace.oid = attendance_table.relnamespace
  join pg_type as status_type
    on status_type.oid = attendance_column.atttypid
  join pg_namespace as type_namespace
    on type_namespace.oid = status_type.typnamespace
  where table_namespace.nspname = 'public'
    and attendance_table.relname = 'attendance'
    and attendance_column.attname = 'status'
    and not attendance_column.attisdropped
    and status_type.typtype = 'e';

  if status_type_name is null then
    raise exception 'Expected public.attendance.status to use an enum type.';
  end if;

  execute format(
    'alter type %I.%I add value if not exists %L',
    status_type_schema,
    status_type_name,
    'Late'
  );
  execute format(
    'alter type %I.%I add value if not exists %L',
    status_type_schema,
    status_type_name,
    'Excused'
  );
end;
$$;
