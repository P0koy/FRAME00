-- FRAME99: a rating is valid only when its owner has a review for the same rating.
-- Apply this migration in the Supabase SQL editor.

create or replace function public.enforce_rating_review()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.reviews r
    where r.rating_id = NEW.id
      and r.user_id = NEW.user_id
  ) then
    raise exception 'FRAME99: Рецензия обязательна для публикации оценки';
  end if;
  return NEW;
end;
$$;

-- The deferred constraint trigger allows the application to insert the rating
-- and its review in the same transaction through an RPC/function in the future.
drop trigger if exists rating_requires_review on public.ratings;
create constraint trigger rating_requires_review
after insert on public.ratings
deferrable initially deferred
for each row execute function public.enforce_rating_review();
