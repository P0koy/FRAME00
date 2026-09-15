-- FRAME99 catalog moderation, poster proposals and clean-start rules

alter table public.media
  add column if not exists poster_position_x numeric not null default 50,
  add column if not exists poster_position_y numeric not null default 50;

create table if not exists public.poster_proposals (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  poster_url text not null,
  position_x numeric not null default 50,
  position_y numeric not null default 50,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists poster_proposals_media_idx on public.poster_proposals(media_id, created_at desc);
create index if not exists poster_proposals_status_idx on public.poster_proposals(status);

alter table public.poster_proposals enable row level security;

drop policy if exists "poster_proposals_read_own" on public.poster_proposals;
create policy "poster_proposals_read_own"
on public.poster_proposals
for select to authenticated
using (user_id = auth.uid() or lower(coalesce(auth.jwt() ->> 'email', '')) = 'kanshoev.amika@gmail.com');

drop policy if exists "poster_proposals_insert_own" on public.poster_proposals;
create policy "poster_proposals_insert_own"
on public.poster_proposals
for insert to authenticated
with check (user_id = auth.uid());

create or replace function public.admin_delete_media(p_media_id uuid)
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
  delete from public.media where id = p_media_id;
end;
$$;

create or replace function public.admin_delete_poster(p_media_id uuid)
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
  update public.media
  set poster_url = null, poster_position_x = 50, poster_position_y = 50
  where id = p_media_id;
end;
$$;

create or replace function public.admin_update_media_poster(
  p_media_id uuid,
  p_poster_url text,
  p_position_x numeric default 50,
  p_position_y numeric default 50
)
returns public.media
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_media public.media;
begin
  if v_email <> 'kanshoev.amika@gmail.com' then
    raise exception 'FRAME99: Доступ запрещён.';
  end if;
  update public.media
  set poster_url = nullif(p_poster_url, ''),
      poster_position_x = greatest(0, least(100, coalesce(p_position_x, 50))),
      poster_position_y = greatest(0, least(100, coalesce(p_position_y, 50)))
  where id = p_media_id
  returning * into v_media;
  if v_media.id is null then raise exception 'FRAME99: Произведение не найдено.'; end if;
  return v_media;
end;
$$;

create or replace function public.admin_review_poster_proposal(
  p_proposal_id uuid,
  p_approve boolean
)
returns public.poster_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_proposal public.poster_proposals;
begin
  if v_email <> 'kanshoev.amika@gmail.com' then
    raise exception 'FRAME99: Доступ запрещён.';
  end if;
  select * into v_proposal from public.poster_proposals where id = p_proposal_id for update;
  if v_proposal.id is null then raise exception 'FRAME99: Предложение постера не найдено.'; end if;
  if p_approve then
    update public.media
    set poster_url = v_proposal.poster_url,
        poster_position_x = v_proposal.position_x,
        poster_position_y = v_proposal.position_y
    where id = v_proposal.media_id;
    update public.poster_proposals set status = 'approved' where id = p_proposal_id returning * into v_proposal;
  else
    update public.poster_proposals set status = 'rejected' where id = p_proposal_id returning * into v_proposal;
  end if;
  return v_proposal;
end;
$$;

create or replace function public.admin_delete_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rating_id uuid;
  v_user_id uuid;
  v_media_id uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_email <> 'kanshoev.amika@gmail.com' then
    raise exception 'FRAME99: Доступ запрещён.';
  end if;
  select r.rating_id, r.user_id, r.media_id into v_rating_id, v_user_id, v_media_id
  from public.reviews r where r.id = p_review_id;
  delete from public.review_likes where review_id = p_review_id;
  delete from public.reviews where id = p_review_id;
  if v_rating_id is not null then delete from public.ratings where id = v_rating_id; end if;
  if v_user_id is not null and v_media_id is not null then
    delete from public.review_submission_limits where user_id = v_user_id and media_id = v_media_id;
  end if;
end;
$$;

revoke all on function public.admin_delete_media(uuid) from public;
grant execute on function public.admin_delete_media(uuid) to authenticated;
revoke all on function public.admin_delete_poster(uuid) from public;
grant execute on function public.admin_delete_poster(uuid) to authenticated;
revoke all on function public.admin_update_media_poster(uuid, text, numeric, numeric) from public;
grant execute on function public.admin_update_media_poster(uuid, text, numeric, numeric) to authenticated;
revoke all on function public.admin_review_poster_proposal(uuid, boolean) from public;
grant execute on function public.admin_review_poster_proposal(uuid, boolean) to authenticated;
revoke all on function public.admin_delete_review(uuid) from public;
grant execute on function public.admin_delete_review(uuid) to authenticated;

-- Clean the catalogue from the temporary/sample titles requested by the owner.
delete from public.media
where lower(trim(title)) in ('дюна', 'dune', 'похуй');
