-- Die Einstellung blendet ausschließlich die Darstellung aus; Punkte bleiben erhalten.
begin;
alter table public.tasks add column if not exists checklist_hide_completed boolean not null default false;
notify pgrst, 'reload schema';
commit;
