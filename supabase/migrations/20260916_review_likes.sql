-- FRAME99: публичные лайки рецензий
-- Лайк принадлежит авторизованному пользователю.
-- Просмотр лайков открыт, чтобы показывать авторов лайков при наведении.

alter table public.review_likes enable row level security;

drop policy if exists "review_likes_select_public" on public.review_likes;
create policy "review_likes_select_public"
on public.review_likes
for select
to anon, authenticated
using (true);

drop policy if exists "review_likes_insert_own" on public.review_likes;
create policy "review_likes_insert_own"
on public.review_likes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "review_likes_delete_own" on public.review_likes;
create policy "review_likes_delete_own"
on public.review_likes
for delete
to authenticated
using (auth.uid() = user_id);
