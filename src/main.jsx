import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Enhancements from './Enhancements.jsx';
import { supabase } from './lib/supabase.js';
import { runReviewEnhancements } from './reviewEnhancements.js';
import './clean.js';

const TYPE_LABELS = { film: 'Фильм', series: 'Сериал', anime: 'Аниме' };

function esc(value = '') {
  return String(value).replace(/[&<>\"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[ch]));
}

function renderTopFiveByReviews() {
  clearTimeout(renderTopFiveByReviews.timer);
  renderTopFiveByReviews.timer = window.setTimeout(async () => {
    const hero = document.querySelector('.hero');
    const catalog = document.querySelector('.catalog');
    const allowed = Boolean(hero || catalog);
    const existing = document.querySelector('.frame-top-five');
    if (!allowed) {
      existing?.remove();
      return;
    }

    let host = existing;
    if (!host) {
      host = document.createElement('section');
      host.className = 'frame-top-five';
      if (hero) hero.insertAdjacentElement('afterend', host);
      else {
        const head = catalog.querySelector('.catalog-head');
        if (head) head.insertAdjacentElement('afterend', host);
        else catalog.prepend(host);
      }
    } else {
      const parent = host.parentElement;
      if (hero && parent !== hero.parentElement) hero.insertAdjacentElement('afterend', host);
      if (catalog && !hero && parent !== catalog) {
        const head = catalog.querySelector('.catalog-head');
        if (head) head.insertAdjacentElement('afterend', host);
      }
    }

    const { data: media, error: mediaError } = await supabase
      .from('media')
      .select('id,title,media_type,release_year,poster_url,poster_position_x,poster_position_y')
      .limit(1000);
    if (mediaError || !media?.length) {
      host.innerHTML = '';
      return;
    }

    const ids = media.map(m => m.id);
    const [{ data: reviews }, { data: ratings }] = await Promise.all([
      supabase.from('reviews').select('media_id').in('media_id', ids),
      supabase.from('ratings').select('media_id,final_score').in('media_id', ids)
    ]);

    const reviewCounts = {};
    const ratingCounts = {};
    const ratingSums = {};
    (reviews || []).forEach(r => { reviewCounts[r.media_id] = (reviewCounts[r.media_id] || 0) + 1; });
    (ratings || []).forEach(r => {
      ratingCounts[r.media_id] = (ratingCounts[r.media_id] || 0) + 1;
      ratingSums[r.media_id] = (ratingSums[r.media_id] || 0) + Number(r.final_score || 0);
    });

    const top = media
      .map(m => ({
        ...m,
        reviewCount: reviewCounts[m.id] || 0,
        ratingCount: ratingCounts[m.id] || 0,
        avg: ratingCounts[m.id] ? ratingSums[m.id] / ratingCounts[m.id] : 0
      }))
      .filter(m => m.reviewCount > 0)
      .sort((a, b) => b.reviewCount - a.reviewCount || b.ratingCount - a.ratingCount || b.avg - a.avg || a.title.localeCompare(b.title, 'ru'))
      .slice(0, 5);

    if (!top.length) {
      host.innerHTML = '';
      return;
    }

    host.innerHTML = `<div class="frame-top-head"><div><span>СООБЩЕСТВО</span><h2>ТОП 5 ПО КОЛИЧЕСТВУ РЕЦЕНЗИЙ</h2></div><p>Пять произведений с наибольшим количеством опубликованных рецензий.</p></div><div class="frame-top-grid">${top.map((m, i) => `<button class="frame-top-item" data-work-id="${esc(m.id)}"><span class="frame-top-rank">${i + 1}</span><span class="frame-top-poster">${m.poster_url ? `<img src="${esc(m.poster_url)}" alt="" style="object-position:${Number(m.poster_position_x) || 50}% ${Number(m.poster_position_y) || 50}%"/>` : '<b>99</b>'}</span><span class="frame-top-title">${esc(m.title)}</span><small>${TYPE_LABELS[m.media_type] || 'Произведение'} · ${m.reviewCount} ${m.reviewCount === 1 ? 'рецензия' : (m.reviewCount < 5 ? 'рецензии' : 'рецензий')}</small></button>`).join('')}</div>`;

    host.querySelectorAll('[data-work-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const work = top.find(m => m.id === btn.dataset.workId);
        const card = [...document.querySelectorAll('.work-card')].find(c => c.textContent?.includes(work?.title || ''));
        card?.click();
      });
    });
  }, 260);
}

function TopFiveBridge() {
  useEffect(() => {
    renderTopFiveByReviews();
    let timer;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(renderTopFiveByReviews, 180);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const poll = window.setInterval(renderTopFiveByReviews, 1800);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      clearInterval(poll);
      clearTimeout(renderTopFiveByReviews.timer);
    };
  }, []);
  return null;
}

function ReviewEnhancementBridge(){
  useEffect(() => {
    runReviewEnhancements();
    let timer;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(runReviewEnhancements, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const poll = window.setInterval(runReviewEnhancements, 2500);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, []);
  return null;
}

createRoot(document.getElementById('root')).render(
  <>
    <App />
    <Enhancements />
    <ReviewEnhancementBridge />
    <TopFiveBridge />
  </>
);
