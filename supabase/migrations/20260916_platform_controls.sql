-- FRAME99 platform controls
-- 1) Reviews are mandatory for ratings and are created atomically.
-- 2) A regular user can submit a review for the same work no more than once per 15 minutes.
-- 3) An admin can delete reviews/ratings and temporarily ban a user from submitting reviews.
-- 4) Existing reviews and their ratings are cleared once, as requested.

create table if not exists public.review_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  banned_until timestamptz not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.review_submission_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  last_submitted_at timestamptz not null,
  primary key (user_id, media_id)
);

alter table public.review_bans enable row level security;
alter table public.review_submission_limits enable row level security;

-- Remove the previous deferred trigger approach. It cannot work with the
-- application's separate REST requests for rating and review.
drop trigger if exists rating_requires_review on public.ratings;
drop function if exists public.enforce_rating_review();

-- Remove old review data and ratings so no orphan ratings remain.
delete from public.review_likes;
delete from public.reviews;
delete from public.ratings;

-- The client must use the RPC below rather than direct inserts.
revoke insert, update on public.ratings from authenticated;
revoke insert, update on public.reviews from authenticated;

create or replace function public.create_rating_with_review(
  p_media_id uuid,
  p_content_score integer,
  p_composition_score integer,
  p_execution_score integer,
  p_integrity_score integer,
  p_impression_score integer,
  p_review_body text
)
returns public.ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rating public.ratings;
  v_last timestamptz;
  v_banned_until timestamptz;
  v_body text := trim(coalesce(p_review_body, ''));
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'FRAME99: Войдите в аккаунт.';
  end if;

  if not exists (select 1 from public.media m where m.id = p_media_id) then
    raise exception 'FRAME99: Произведение не найдено.';
  end if;

  if length(v_body) < 50 then
    raise exception 'FRAME99: Рецензия обязательна и должна содержать минимум 50 символов.';
  end if;

  if length(v_body) > 10000 then
    raise exception 'FRAME99: Рецензия не может быть длиннее 10 000 символов.';
  end if;

  if exists (
    select 1 from public.review_bans b
    where b.user_id = auth.uid()
      and b.banned_until > now()
  ) then
    select b.banned_until into v_banned_until
    from public.review_bans b
    where b.user_id = auth.uid();
    raise exception 'FRAME99: Вам запрещено публиковать рецензии до %.', to_char(v_banned_until at time zone 'UTC', 'DD.MM.YYYY HH24:MI');
  end if;

  delete from public.review_bans
  where user_id = auth.uid() and banned_until <= now();

  select l.last_submitted_at into v_last
  from public.review_submission_limits l
  where l.user_id = auth.uid() and l.media_id = p_media_id;

  if v_last is not null and v_last > now() - interval '15 minutes' then
    v_remaining := greatest(1, ceil(extract(epoch from ((v_last + interval '15 minutes') - now())) / 60.0)::integer);
    raise exception 'FRAME99: Новую рецензию на это произведение можно отправить через % минут.', v_remaining;
  end if;

  insert into public.ratings (
    user_id,
    media_id,
    content_score,
    composition_score,
    execution_score,
    integrity_score,
    impression_score
  ) values (
    auth.uid(),
    p_media_id,
    p_content_score,
    p_composition_score,
    p_execution_score,
    p_integrity_score,
    p_impression_score
  ) returning * into v_rating;

  insert into public.reviews (rating_id, user_id, media_id, body)
  values (v_rating.id, auth.uid(), p_media_id, v_body);

  insert into public.review_submission_limits (user_id, media_id, last_submitted_at)
  values (auth.uid(), p_media_id, now())
  on conflict (user_id, media_id)
  do update set last_submitted_at = excluded.last_submitted_at;

  return v_rating;
end;
$$;

revoke all on function public.create_rating_with_review(uuid, integer, integer, integer, integer, integer, text) from public;
grant execute on function public.create_rating_with_review(uuid, integer, integer, integer, integer, integer, text) to authenticated;

create or replace function public.admin_delete_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rating_id uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_email <> 'kanshoev.amika@gmail.com' then
    raise exception 'FRAME99: Доступ запрещён.';
  end if;

  select r.rating_id into v_rating_id
  from public.reviews r
  where r.id = p_review_id;

  delete from public.review_likes where review_id = p_review_id;
  delete from public.reviews where id = p_review_id;

  if v_rating_id is not null then
    delete from public.ratings where id = v_rating_id;
  end if;
end;
$$;

create or replace function public.admin_ban_reviews(
  p_user_id uuid,
  p_minutes integer,
  p_reason text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_email <> 'kanshoev.amika@gmail.com' then
    raise exception 'FRAME99: Доступ запрещён.';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'FRAME99: Нельзя заблокировать самого себя.';
  end if;

  if p_minutes is null or p_minutes < 1 or p_minutes > 43200 then
    raise exception 'FRAME99: Срок запрета должен быть от 1 до 43 200 минут.';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'FRAME99: Пользователь не найден.';
  end if;

  v_until := now() + make_interval(mins => p_minutes);

  insert into public.review_bans (user_id, banned_until, reason, created_by)
  values (p_user_id, v_until, nullif(trim(coalesce(p_reason, '')), ''), auth.uid())
  on conflict (user_id)
  do update set banned_until = excluded.banned_until,
                reason = excluded.reason,
                created_by = excluded.created_by,
                created_at = now();

  return v_until;
end;
$$;

create or replace function public.admin_unban_reviews(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_email <> 'kanshoev.amika@gmail.com' then
    raise exception 'FRAME99: Доступ запрещён.';
  end if;

  delete from public.review_bans where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_review(uuid) from public;
grant execute on function public.admin_delete_review(uuid) to authenticated;
revoke all on function public.admin_ban_reviews(uuid, integer, text) from public;
grant execute on function public.admin_ban_reviews(uuid, integer, text) to authenticated;
revoke all on function public.admin_unban_reviews(uuid) from public;
grant execute on function public.admin_unban_reviews(uuid) to authenticated;

-- Only the designated admin can see ban records directly.
drop policy if exists "admin_read_review_bans" on public.review_bans;
create policy "admin_read_review_bans"
on public.review_bans
for select
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'kanshoev.amika@gmail.com');
