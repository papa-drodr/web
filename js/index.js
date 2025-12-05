// ---- 유틸 ----
const el = (s, r=document) => r.querySelector(s);
const els = (s, r=document) => r.querySelectorAll(s);

const fmt = new Intl.NumberFormat('ko-KR'); // 기본 소수점 자릿수 규칙을 그대로 사용
const fmt0 = new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}); // 소수점은 표시하지 않고 반올림해서 정수로 만듦
const fmt1 = new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1});


today = new Date();
yyyy_mm_dd = d => d.toISOString().slice(0,10);
function getStart(days){ 
    const s = new Date();
    s.setDate(s.getDate() - days);
    return s;
}

const lower = s => (s||'').toLowerCase();

// ---- 현재 상태 ----
const state = {base:"USD", days:30, chart:null, soccerChart: null};

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
    if(g){ 
        updateTitle(); 
        drawChart(); 
    }
    else{
        drawSoccerChart();
    }
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

    const loader = el('#graph-loading');
    if (loader) loader.hidden = false;

    try {
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
    } finally {
    if (loader) loader.hidden = true;
    }
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

// ---- 기준 환율 ----
async function updateQuickRates(){
    const codes = ['USD', 'JPY', 'EUR', 'GBP'];
    const ids={USD:'qr-usd',JPY:'qr-jpy',EUR:'qr-eur',GBP:'qr-gbp'};
    await Promise.all(codes.map(async c=>{
        try{
            const data = await fetchLatest(c); // 가장 최근 환율
            const rate = data?.[lower(c)]?.krw; // 데이터가 없으면 무시
            const box = document.getElementById(ids[c]);
            box.textContent = (typeof rate==='number')?  `${fmt0.format(rate)} KRW` : '—';
        }catch{ const box = document.getElementById(ids[c]); if(box) box.textContent= '—'}
    }));
    const up=el('#qr-updated'); if(up) up.textContent=`기준시간 ${new Date().toLocaleDateString('ko-KR')}`;
}

// ---- 계산기 ----
async function convert(amount, from, to) {
    const data = await fetchLatest(from);
    const rate = data?.[lower(from)]?.[lower(to)];
    if(typeof rate !== 'number' || ! Number.isFinite(rate)) throw new Error('환율 오류');
    return { result : amount*rate, rate};   
}
el('#convert').addEventListener('click', async ()=>{
    const a = parseFloat(el('#amount').value||'0');
    const f = el('#from').value.trim();
    const t = el('#to').value.trim();
    if(!a || a<0){ alert('금액 확인'); return; }
    try{
        const d = await convert(a, f, t);
        el('#convert-result').textContent = `= ${fmt1.format(d.result)} ${t}`;
        el('#rate-note').textContent = `1 ${f} = ${fmt1.format(d.rate)} ${t}`;
      }catch(e){ console.error(e); alert('환전 오류'); }
    });


// ---- 축구 탭 ----
const transfers = [
    {name:"Neymar",   year:"2017-08-03", fee:222e6},
    {name:"Mbappe",   year:"2018-07-01", fee:180e6},
    {name:"Dembele",  year:"2017-08-25", fee:148e6},
    {name:"Isak",     year:"2025-09-01", fee:145e6},
    {name:"Coutinho", year:"2018-01-06", fee:135e6},
];

// 이적 날짜별 당시 EUR→KRW 환율 단위: 1 EUR 당 KRW
const TRANSFER_EUR_KRW = {
    "2017-08-03": 1320, // Neymar
    "2018-07-01": 1300, // Mbappe
    "2017-08-25": 1330, // Dembele
    "2025-09-01": 1500, // Isak (미래 값은 임의)
    "2018-01-06": 1280  // Coutinho
};

// ===== 축구 탭 그래프 (고정 환율 사용) =====
async function drawSoccerChart(){
    const labels = transfers.map(t => t.name);

    let nowRate = null;
    try{
      const latest = await fetchLatest('EUR');
      if (latest && latest.eur && typeof latest.eur.krw === 'number') {
        nowRate = latest.eur.krw;
      }
    }catch(e){
      console.error('[soccer] latest EUR fetch fail', e);
    }

    if (typeof nowRate !== 'number' || !isFinite(nowRate)) {
      console.error('[soccer] nowRate missing');
      return;
    }

    const oldVals = [];
    const newVals = [];
    const rows    = [];

    // 선수별 데이터 계산
    for (const t of transfers){
      // 이적 날짜 기준 환율 (없으면 현재 환율로 대체)
        let rate = TRANSFER_EUR_KRW[t.year];
        if (typeof rate !== 'number' || !isFinite(rate)) {
            rate = nowRate;
        }

        const oldKrw = t.fee * rate;
        const newKrw = t.fee * nowRate;

        oldVals.push(oldKrw);
        newVals.push(newKrw);

        rows.push({
            name   : t.name,
            year   : t.year.slice(0,4),
            fee    : t.fee,
            rateOld: rate,
            krwNew : newKrw
        });
    }

    // 3) 차트 그리기
    const ctx = el('#soccer-chart').getContext('2d');
    if(state.soccerChart) state.soccerChart.destroy();
    state.soccerChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '당시 환율 기준',
            data: oldVals,
            borderWidth: 1,
            backgroundColor: 'rgba(90,169,255,0.4)'
          },
          {
            label: '현재 환율 기준',
            data: newVals,
            borderWidth: 1,
            backgroundColor: 'rgba(90,169,255,0.9)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: '#b7c0d1' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            ticks: {
              color: '#b7c0d1',
              callback: v => fmt0.format(v)
            },
            grid: { color: 'rgba(255,255,255,0.08)' }
          }
        },
        plugins: {
          legend: { labels: { color: '#e9eef7' } },
          tooltip: {
            callbacks: {
              label: function(ctx){
                const v = ctx.parsed.y;
                return ctx.dataset.label + ': ' + fmt0.format(v) + ' KRW';
              }
            }
          }
        }
      }
    });

    // 4) 테이블 채우기
    const tbody = el('#soccer-tbody');
    if (tbody){
      tbody.innerHTML = rows.map(function(r){
        return '<tr>' +
          '<td>' + r.name + '</td>' +
          '<td>' + r.year + '</td>' +
          '<td>' + fmt1.format(r.fee / 1e6) + ' M€</td>' +
          '<td>' + (r.rateOld ? fmt0.format(r.rateOld) : '—') + '</td>' +
          '<td>' + (r.krwNew ? fmt0.format(r.krwNew) : '—') + '</td>' +
        '</tr>';
      }).join('');
    }

  }


async function init(){
    // 초기 탭은 그래프
    setTab('graph'); // setTab에서 updateTitle() + drawChart() 호출함
    updateQuickRates();
}

//DOM 로드 후에 스크립트 실행
document.addEventListener('DOMContentLoaded', () => {
    init();
});
