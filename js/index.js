// ---- 유틸 ----
const el = (s, r=document) => r.querySelector(s);
const els = (s, r=document) => r.querySelectorAll(s);

const fmt = new Intl.NumberFormat('ko-KR'); // 기본 소수점 자릿수 규칙을 그대로 사용
const fmt0 = new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}); // 소수점은 표시하지 않고 반올림해서 정수로 만듦

today = new Date();
yyyy_mm_dd = d => d.toISOString().slice(0,10);
function getStart(days){ 
    const s = new Date();
    s.setDate(s.getDate() - days);
    return s;
}

const lower = s => (s||'').toLowerCase();

// ---- 현재 상태 ----
const state = {base:"USD", days:30, chart:null};

// ---- 상태에 따른 그래프 제목 변환 ----
const Moneytrans = {USD:'원/달러', JPY:'원/엔', EUR:'원/유로', GBP:'원/파운드'};
function updateTitle(){
    const h = `${Moneytrans[state.base] || `원/${state.base}`} 환율 (최근 ${state.days}일)`; // 상태에 맞게 변경
    const h2 = el("#graph-title"); 
    if(h2) h2.innerHTML = h;
}

// ---- 헤더 버튼 이벤트 구현 ---
function setTab(view){
    // 그래프를 기준으로 true, false 설정
    const g = view === 'graph';
    el('#view-graph').hidden = !g;
    el('#view-soccer').hidden = g;

    // 그래프 화면 전환 버튼
    const btnG = el('#tab-graph');
    const btnS = el('#tab-soccer');

    if (btnG) btnG.setAttribute('aria-selected', g ? 'true' : "false");
    if (btnS) btnS.setAttribute('aria-selected', g ? 'false' : "true");
    if(g){ updateTitle(); drawChart(); }
}

// ---- 이벤트 핸들러 ----
el("#tab-graph")?.addEventListener('click', () => setTab('graph'));
el("#tab-soccer")?.addEventListener('click', () => setTab('soccer'));

// ---- API (Fawaz Ahmed currency-api) ----
async function fetchDaily(base, date) { //지정 날짜의 환율을 가져옴
    const d = yyyy_mm_dd(date);
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${d}/v1/currencies/${lower(base)}.json`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('daily fetch failed ' +d);
    return res.json();
}
async function fetchLatest(base){ //최신 환율을 가져옴
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${lower(base)}.json`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('latest fetch failed');
    return res.json();
}

// ---- chart ----
async function drawChart() {
    updateTitle();
    const base = state.base.toUpperCase();
    const sym = "KRW";

    // 최대 80번 request, 날짜 가져오기
    const start = getStart(state.days);
    const dates = [];
    const MAX_REQ = 80;
    const step = Math.max(1, Math.ceil(state.days / MAX_REQ)); //너무 많은 요청을 막는 간격
    for(let d = new Date(start); d <= today; d.setDate(d.getDate()+step))
        dates.push(new Date(d))

    const results = new Array(dates.length); //결과 배열
    let cursor = 0;
    const CONC = 6;
    
    async function worker() { //날짜마다 api에 요청
        while (cursor < dates.length){
            const i = cursor ++;
            try{
                const j = await fetchDaily(base, dates[i]);
                // j = { usd: { krw: 1385 } } 구조 → 값 꺼내기
                results[i] = j?.[lower(base)]?.[lower(sym)] ?? null;
            }catch(e){
                results[i] = null;
            } 
        }
    }
    // worker 6개를 동시에 실행해서 병렬 처리
    await Promise.all(Array.from({length:CONC}, ()=>worker()));

    const labels = []; // 날짜
    const values = []; // 환율
    for (let i=0; i<results.length; i++){
        const v = results[i];
        if (typeof v==='number' && Number.isFinite(v)){
            labels.push(yyyy_mm_dd(dates[i]));
            values.push(v);
        }
    }
    if (!labels.length){
        console.error('[drawChart] empty data');
        return;
    }

    const ctx = el('#chart').getContext('2d'); // 그래프를 그리는 canvas
    if(state.chart) state.chart.destroy(); // 이미 있으면 제거
    state.chart = new Chart(ctx, {
        type: 'line', // 선 그래프
        data: { 
            labels, 
            datasets: [{ 
                label:`${base}→KRW`, // 제목
                data:values, /// y축 환율 데이터
                tension:.25, 
                pointRadius:0, 
                borderWidth:2 
            }] 
        },
        options: {
            responsive: true, // 반응형
            maintainAspectRatio: false, // 높이/너비 고정 x
            interaction: { mode: `index`, intersect: false },
            scales: { // x, y 축 스타일
                x: { ticks: { color:`#b7c0d1` }, grid: { color: "rgba(255,255,255,.08)"}},
                y:{ ticks:{ color:'#b7c0d1', callback:v=>fmt.format(v) }, grid:{ color:'rgba(255,255,255,.08)' } }
            },
            plugins: { legend: { labels: { color: '#e9eef7'}}}
        }
    });
}

// ---- 환율 전환 버튼(chip) ----
els('.chip').forEach(btn=>{
    btn.addEventListener("click", ()=>{
        const group = btn.closest('.switcher');
        if (group) els('.chip', group).forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        if(btn.dataset.base){ state.base = btn.dataset.base.toUpperCase(); }
        if(btn.dataset.days){ state.days = parseInt(btn.dataset.days,10)||90; }
        // 그래프 탭일 때만 타이틀/차트 업데이트
        if(!el('#view-graph').hidden){ updateTitle(); drawChart(); }
    })
})

(async function init(){
    // 초기 탭은 그래프
    setTab('graph');
    drawChart();
})();
