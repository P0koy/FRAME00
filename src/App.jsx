/*
Pinned subject: FRAME99, a Russian-language cultural rating platform for film, series, and anime.
Audience: thoughtful viewers who want to explain a score, not merely drop a star rating.
Single job: make the reason behind a personal 1–99 score instantly legible.
Design plan: archival film contact sheet meets editorial colophon. Type: Arial Black for display numerals, system grotesk for UI, Georgia italic for human voice. Palette: ink #080808, paper #F1EFE8, graphite #1A1A1A, ash #9B9B96, signal #D8FF3E. Layout: full-bleed score ledger with offset poster columns. Signature: oversized score numerals crossed by a fluorescent calibration line.
*/
import { useMemo, useState } from "react";
import { Search, ArrowRight, Heart, X, ChevronDown, Check, Menu, UserRound, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Toaster, toast } from "./ui.jsx";
import "./styles.css";

const works = [
  { id: 1, title: "ДЮНА", original: "Dune", year: 2021, type: "Фильм", score: 84, user: "noirframe", note: "Редкий блокбастер, где масштаб не съедает тишину.", poster: "dune", meta: "США · 155 мин · Дени Вильнёв", count: "12 481", ratings: [6,13,24,45,80,142,310,522,688,401] },
  { id: 2, title: "ИДЕАЛЬНАЯ ГРУСТЬ", original: "Perfect Blue", year: 1997, type: "Аниме", score: 91, user: "miro", note: "Монтаж превращает сомнение в физическое пространство.", poster: "blue", meta: "Япония · 81 мин · Сатоси Кон", count: "8 904" },
  { id: 3, title: "РАЗДЕЛЕНИЕ", original: "Severance", year: 2022, type: "Сериал", score: 88, user: "sector7", note: "Форма офиса становится главным антагонистом.", poster: "severance", meta: "США · 2 сезона · продолжается", count: "10 317" },
  { id: 4, title: "ПРОШЛЫЕ ЖИЗНИ", original: "Past Lives", year: 2023, type: "Фильм", score: 77, user: "mari.a", note: "Очень точная история о жизни, которой не случилось.", poster: "lives", meta: "США · 106 мин · Селин Сон", count: "5 266" },
];

const criteria = [
  { key: "content", short: "МАТЕРИАЛ", title: "МАТЕРИАЛ / СОДЕРЖАНИЕ", text: "Насколько последовательно и содержательно произведение работает со своим материалом." },
  { key: "composition", short: "КОМПОЗИЦИЯ", title: "КОМПОЗИЦИЯ / ТЕМП", text: "Как структура, ритм и длительность служат задаче произведения." },
  { key: "execution", short: "РЕАЛИЗАЦИЯ", title: "РЕАЛИЗАЦИЯ / ТЕХНИКА", text: "Насколько профессионально замысел воплощён выбранными средствами." },
  { key: "integrity", short: "ЦЕЛОСТНОСТЬ", title: "ЦЕЛОСТНОСТЬ / АВТОРСКИЙ ЯЗЫК", text: "Насколько форма, содержание, тон и художественные решения работают как единое целое." },
];

const levels = ["критически слабо", "очень слабо", "слабо", "ниже среднего", "средний уровень", "выше среднего", "сильно", "очень сильно", "выдающийся уровень", "почти эталонно"];
const multiplier = (impression) => 1 + ((impression - 1) * 1.475) / 9;
const finalScore = (scores, impression) => Math.round(Object.values(scores).reduce((a,b)=>a+b,0) * multiplier(impression));

function Logo({ onClick }) {
  return <button className="logo" onClick={onClick} aria-label="На главную">FRAME<span>99</span></button>;
}

function Header({ page, setPage }) {
  const [open, setOpen] = useState(false);
  return <header className="header">
    <Logo onClick={()=>setPage("home")} />
    <nav className={open ? "nav open" : "nav"}>
      <button onClick={()=>{setPage("catalog");setOpen(false)}}>КАТАЛОГ</button>
      <button onClick={()=>{setPage("reviews");setOpen(false)}}>РЕЦЕНЗИИ</button>
      <button onClick={()=>{setPage("method");setOpen(false)}}>МЕТОДИКА</button>
      <button onClick={()=>{setPage("profile");setOpen(false)}}><UserRound size={17}/> ПРОФИЛЬ</button>
    </nav>
    <button className="menu" onClick={()=>setOpen(!open)} aria-label="Меню">{open?<X/>:<Menu/>}</button>
  </header>
}

function Poster({ kind, compact=false }) {
  return <div className={`poster ${kind} ${compact ? "compact" : ""}`} aria-label="Постер">
    <span className="poster-index">F.99</span>
    <span className="poster-mark">{kind === "dune" ? "DUNE" : kind === "blue" ? "BLUE" : kind === "severance" ? "SVR" : "PL"}</span>
  </div>
}

function Score({ value, label, small=false }) {
  return <div className={`score ${small ? "small" : ""}`}>
    <div><strong>{value}</strong><span>/99</span></div>
    {label && <p>{label}</p>}
  </div>
}

function WorkCard({ work, onOpen, feature=false }) {
  return <article className={`work-card ${feature ? "feature" : ""}`} onClick={()=>onOpen(work)}>
    <Poster kind={work.poster} compact={!feature}/>
    <div className="work-copy">
      <div className="eyebrow">{work.type} · {work.year}</div>
      <h3>{work.title}</h3>
      <Score value={work.score} small={!feature}/>
      <blockquote>«{work.note}»</blockquote>
      <div className="author">@{work.user} <ArrowRight size={16}/></div>
    </div>
  </article>
}

function SearchBox({ setSelected, setPage }) {
  const [term, setTerm] = useState("");
  const found = term.length > 1 ? works.filter(w => `${w.title} ${w.original} ${w.type}`.toLowerCase().includes(term.toLowerCase())) : [];
  return <div className="search-wrap">
    <Search size={26}/><input aria-label="Найти произведение" placeholder="Найти фильм, сериал или аниме..." value={term} onChange={e=>setTerm(e.target.value)}/><span className="search-key">⌘ K</span>
    {found.length > 0 && <div className="search-results">{found.map(w=><button key={w.id} onClick={()=>{setSelected(w);setPage("work");setTerm("")}}><Poster kind={w.poster} compact/><span><b>{w.title}</b><small>{w.type} · {w.year}</small></span><Score value={w.score} small/></button>)}</div>}
  </div>
}

function Home({ setSelected, setPage }) {
  return <>
    <section className="hero">
      <div className="hero-kicker">АРХИВ ЧЕЛОВЕЧЕСКОГО ВОСПРИЯТИЯ</div>
      <h1>У ЦИФРЫ<br/><i>ЕСТЬ</i> ПРИЧИНА.</h1>
      <p>Фильмы, сериалы и аниме: разберите по критериям, добавьте личное впечатление, объясните свой итог.</p>
      <SearchBox setSelected={setSelected} setPage={setPage}/>
      <div className="calibration"><span>01</span><div/><span>99</span></div>
    </section>
    <section className="section-pad">
      <div className="section-head"><div><span>СЕЙЧАС</span><h2>ПОСЛЕДНЕЕ ОЦЕНЁННОЕ</h2></div><button onClick={()=>setPage("catalog")}>СМОТРЕТЬ ВСЁ <ArrowRight/></button></div>
      <div className="editorial-grid">
        <WorkCard work={works[0]} onOpen={(w)=>{setSelected(w);setPage("work")}} feature/>
        <div className="side-grid">{works.slice(1).map(w=><WorkCard key={w.id} work={w} onOpen={(x)=>{setSelected(x);setPage("work")}}/>)}</div>
      </div>
    </section>
    <section className="manifesto section-pad">
      <div className="manifesto-num">40 <span>×</span> 2.475 <span>=</span> 99</div>
      <div><h2>НЕ ИСТИНА.<br/>АРГУМЕНТИРОВАННЫЙ ВЗГЛЯД.</h2><p>Четыре наблюдаемых критерия создают основу. «Общее впечатление» честно добавляет личное. Никаких звёзд и магии среднего арифметического.</p><button onClick={()=>setPage("method")}>КАК РАБОТАЕТ FRAME99 <ArrowRight/></button></div>
    </section>
  </>
}

function RatingDialog({ work }) {
  const initial = { content:8, composition:9, execution:8, integrity:9 };
  const [scores, setScores] = useState(initial);
  const [impression, setImpression] = useState(8);
  const [review, setReview] = useState("");
  const total = finalScore(scores, impression);
  const base = Object.values(scores).reduce((a,b)=>a+b,0);
  const publish = () => toast.success("Оценка сохранена", { description: `${total}/99 · ${work.title}` });
  return <Dialog>
    <DialogTrigger asChild><Button className="primary-action">ОЦЕНИТЬ <ArrowRight/></Button></DialogTrigger>
    <DialogContent className="rating-dialog">
      <DialogTitle className="dialog-title">ОЦЕНИТЬ: {work.title}</DialogTitle>
      <DialogDescription className="sr-only">Форма оценки произведения по четырём объективным критериям и общему впечатлению.</DialogDescription>
      <div className="rating-layout">
        <div className="rating-aside"><Poster kind={work.poster}/><div className="live-score"><span>ИТОГ</span><Score value={total}/><small>База {base}/40 · ×{multiplier(impression).toFixed(3)}</small></div></div>
        <div className="rating-form">
          <div className="part-label">ОБЪЕКТИВНАЯ ЧАСТЬ <span>01</span></div>
          {criteria.map(c=><div className="criterion" key={c.key}>
            <div><TooltipProvider><Tooltip><TooltipTrigger asChild><button className="criterion-title">{c.title} <span>?</span></button></TooltipTrigger><TooltipContent>{c.text}</TooltipContent></Tooltip></TooltipProvider><small>{scores[c.key]} · {levels[scores[c.key]-1]}</small></div>
            <div className="number-row">{[1,2,3,4,5,6,7,8,9,10].map(n=><button key={n} className={scores[c.key]===n?"active":""} onClick={()=>setScores({...scores,[c.key]:n})}>{n}</button>)}</div>
          </div>)}
          <div className="subjective">
            <div className="part-label">СУБЪЕКТИВНАЯ ЧАСТЬ <span>02</span></div>
            <div className="criterion"><div><b>ОБЩЕЕ ВПЕЧАТЛЕНИЕ</b><small>{impression} · личная сила воздействия</small></div><div className="number-row accent">{[1,2,3,4,5,6,7,8,9,10].map(n=><button key={n} className={impression===n?"active":""} onClick={()=>setImpression(n)}>{n}</button>)}</div></div>
          </div>
          <label className="review-field"><span>РЕЦЕНЗИЯ <em>необязательно</em></span><textarea maxLength={10000} value={review} onChange={e=>setReview(e.target.value)} placeholder="Объясните свою оценку..."/><small className={review.length>0&&review.length<50?"warn":""}>{review.length} / 10 000 {review.length>0&&review.length<50?"· ещё минимум 50 символов":""}</small></label>
          <Button className="publish" onClick={publish} disabled={review.length>0&&review.length<50}>ОПУБЛИКОВАТЬ {total}/99 <Check/></Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
}

function Breakdown({ values={content:8,composition:9,execution:8,integrity:9}, impression=8 }) {
  const [open,setOpen]=useState(false); const base=Object.values(values).reduce((a,b)=>a+b,0);
  return <div className="breakdown"><button onClick={()=>setOpen(!open)}>ПОЧЕМУ {Math.round(base*multiplier(impression))}? <ChevronDown className={open?"rotate":""}/></button>{open&&<div className="breakdown-body">{criteria.map(c=><div key={c.key}><span>{c.short}</span><b>{values[c.key]}/10</b></div>)}<div className="formula-row"><span>БАЗА {base}/40</span><span>ВПЕЧАТЛЕНИЕ {impression}/10</span><span>×{multiplier(impression).toFixed(3)}</span></div></div>}</div>
}

function WorkPage({ work, setPage }) {
  const [liked,setLiked]=useState(false);
  return <main>
    <section className="work-hero">
      <Poster kind={work.poster}/>
      <div className="work-info">
        <div className="eyebrow">{work.type} · {work.year} · {work.meta}</div>
        <h1>{work.title}</h1><p className="original">{work.original}</p>
        <p className="synopsis">Будущее, в котором власть, вера и экология сплетаются вокруг самого ценного вещества во вселенной. Монументальная история о наследии, выборе и цене пророчества.</p>
        <div className="actions"><RatingDialog work={work}/><button className={liked?"icon-action liked":"icon-action"} onClick={()=>setLiked(!liked)}><Heart fill={liked?"currentColor":"none"}/> {liked?"В ЛЮБИМЫХ":"В ЛЮБИМОЕ"}</button></div>
      </div>
      <div className="community-score"><span>СРЕДНЯЯ ОЦЕНКА FRAME99</span><Score value={work.score}/><p>{work.count} оценок</p><Breakdown/></div>
    </section>
    <section className="distribution section-pad"><div className="section-head"><div><span>СООБЩЕСТВО</span><h2>РАСПРЕДЕЛЕНИЕ ВЗГЛЯДОВ</h2></div></div><div className="histogram">{(work.ratings||[8,16,22,41,74,130,250,420,580,310]).map((n,i)=><div key={i}><span style={{height:`${Math.max(8,n/6)}px`}}/><b>{i+1}</b></div>)}</div><p>Это не вердикт произведению. Это карта того, как его увидели разные люди.</p></section>
    <section className="section-pad"><div className="section-head"><div><span>ОБЪЯСНЕНИЯ</span><h2>РЕЦЕНЗИИ</h2></div><button>ВСЕ РЕЦЕНЗИИ <ArrowRight/></button></div><div className="review-grid"><ReviewCard name="noirframe" score="84" text="Редкий блокбастер, где масштаб не съедает тишину. Композиция держит медленный ритм уверенно, а звук работает почти как физическая сила."/><ReviewCard name="mari.a" score="76" text="Технически почти безупречно, но дистанция между мной и персонажами так и не исчезла. Именно поэтому впечатление ниже объективной базы."/></div></section>
  </main>
}

function ReviewCard({name,score,text}) { const [like,setLike]=useState(false); return <article className="review-card"><div className="review-top"><div className="avatar">{name[0].toUpperCase()}</div><div><b>@{name}</b><small>12 сентября 2026</small></div><Score value={score} small/></div><p>«{text}»</p><div className="review-bottom"><Breakdown/><button onClick={()=>setLike(!like)} className={like?"liked":""}><Heart fill={like?"currentColor":"none"}/> {like?13:12}</button></div></article> }

function MethodPage() { return <main className="method-page section-pad"><div className="method-hero"><span>МЕТОДИКА FRAME99</span><h1>ДВЕ ЧАСТИ.<br/>ОДНА ЧЕСТНАЯ ЦИФРА.</h1><p>Не научная истина, а формализованный инструмент критического взгляда.</p></div><div className="method-grid"><div className="method-number">01</div><div><h2>ОБЪЕКТИВНАЯ ОСНОВА</h2><p>Четыре универсальных критерия. Каждый от 1 до 10. Мы оцениваем, насколько хорошо произведение делает то, что пытается сделать.</p>{criteria.map(c=><div className="method-criterion" key={c.key}><b>{c.title}</b><span>{c.text}</span></div>)}</div><div className="method-number accent-text">02</div><div><h2>ОБЩЕЕ ВПЕЧАТЛЕНИЕ</h2><p>Личный отклик от 1 до 10 превращается в множитель от ×1.000 до ×2.475. Субъективность не прячется, она получает отдельное место.</p></div><div className="method-number">99</div><div><h2>ИТОГ</h2><div className="formula-large">ROUND ( B × [1 + (I−1) × 1.475 / 9] )</div><p>Например: база 34/40, впечатление 8/10, множитель ×2.147. Итог: <strong>73/99</strong>.</p></div></div></main> }

function Catalog({setSelected,setPage}) { const [filter,setFilter]=useState("Все"); const shown=filter==="Все"?works:works.filter(w=>w.type===filter); return <main className="catalog section-pad"><div className="catalog-head"><span>АРХИВ</span><h1>НАЙТИ СЛЕДУЮЩЕЕ.</h1><SearchBox setSelected={setSelected} setPage={setPage}/></div><div className="filter-row">{["Все","Фильм","Сериал","Аниме"].map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div><div className="catalog-grid">{shown.map(w=><WorkCard key={w.id} work={w} onOpen={x=>{setSelected(x);setPage("work")}}/>)}</div></main> }

function Profile({setSelected,setPage}) { return <main><section className="profile-hero section-pad"><div className="avatar big">P</div><div><span>КУЛЬТУРНЫЙ ПРОФИЛЬ</span><h1>POKOLOKO</h1><p>Смотрю медленно. Люблю кино, которое продолжает работать после титров.</p></div><div className="profile-stats"><div><b>47</b><span>ОЦЕНОК</span></div><div><b>18</b><span>РЕЦЕНЗИЙ</span></div><div><b>12</b><span>ЛЮБИМЫХ</span></div></div></section><section className="section-pad"><div className="section-head"><div><span>ВКУС В ДВИЖЕНИИ</span><h2>ПОСЛЕДНИЕ ОЦЕНКИ</h2></div></div><div className="catalog-grid">{works.slice(0,3).map(w=><WorkCard key={w.id} work={w} onOpen={x=>{setSelected(x);setPage("work")}}/>)}</div></section></main> }

function Placeholder({title}) { return <main className="placeholder section-pad"><span>FRAME99</span><h1>{title}</h1><p>Этот раздел заложен в продуктовую архитектуру MVP.</p></main> }

export default function App() {
  const [page,setPage]=useState("home"); const [selected,setSelected]=useState(works[0]);
  const body = page==="home"?<Home setSelected={setSelected} setPage={setPage}/>:page==="work"?<WorkPage work={selected} setPage={setPage}/>:page==="method"?<MethodPage/>:page==="catalog"?<Catalog setSelected={setSelected} setPage={setPage}/>:page==="profile"?<Profile setSelected={setSelected} setPage={setPage}/>:<Placeholder title="РЕЦЕНЗИИ"/>;
  return <TooltipProvider><div className="app"><Header page={page} setPage={setPage}/>{body}<footer><Logo onClick={()=>setPage("home")}/><p>Система, в которой у цифры есть причина.</p><span>FRAME99 · 2026</span></footer><Toaster position="bottom-right"/></div></TooltipProvider>
}
