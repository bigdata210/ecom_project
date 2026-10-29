const state={catalog:null,regions:[],province:'',district:'',basin:'',station:'',item:'m05',day:'',mode:'daily',result:null,error:'',loading:false,initializing:false};
let redraw=()=>{},sequence=0;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valueText=value=>value==null?'자료 없음':new Intl.NumberFormat('ko-KR',{maximumSignificantDigits:6}).format(value);
const label=name=>name.replace('특별자치도','').replace('특별자치시','').replace('특별시','').replace('광역시','').replace(/도$/,'');
function matches(s,ignore=''){
  return (ignore==='province'||!state.province||s.province===state.province)
    &&(ignore==='district'||!state.district||s.district===state.district)
    &&(ignore==='basin'||!state.basin||s.basin===state.basin);
}
function select(id,title,values,selected,empty='전체'){
  return `<label class="field">${title}<select id="water-${id}" class="control"><option value="">${empty}</option>${values.map(([v,t])=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
}
async function getJson(url){
  const response=await fetch(url,{signal:AbortSignal.timeout(110000),cache:'no-store'});
  let data;try{data=await response.json();}catch{throw Error('수질 서버 응답을 읽을 수 없습니다. 배포 상태를 확인하세요.');}
  if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'수질 자료 조회에 실패했습니다.');
  return data;
}
async function initialize(){
  if(state.initializing||state.catalog)return;
  state.initializing=true;
  try{
    const results=await Promise.allSettled([getJson('/api/water/catalog'),getJson('/assets/korea-regions.json')]);
    if(results[0].status==='rejected')throw results[0].reason;
    state.catalog=results[0].value;state.day=state.catalog.defaultDate;
    if(results[1].status==='fulfilled')state.regions=results[1].value;
    else state.error='지도 경계를 불러오지 못했습니다. 지역 선택 목록으로 조회할 수 있습니다.';
  }catch(error){state.error=error.message;}
  finally{state.initializing=false;redraw();}
}
export function bindWaterMap(callback){
  redraw=callback;
  if(document.querySelector('[data-water-map]')&&!state.catalog&&!state.initializing&&!state.error)void initialize();
}
export async function queryWater(){
  const token=++sequence;state.loading=true;state.error='';state.result=null;redraw();
  const params=new URLSearchParams({day:state.day,item:state.item,mode:state.mode,province:state.province,district:state.district,basin:state.basin,station:state.station});
  try{const result=await getJson('/api/water/summary?'+params);if(token===sequence)state.result=result;}
  catch(error){if(token===sequence)state.error=error.name==='TimeoutError'?'수질 조회 시간이 초과되었습니다. 지역이나 측정소를 좁혀 다시 조회하세요.':error.message;}
  finally{if(token===sequence){state.loading=false;redraw();}}
}
function resultPanel(){
  if(state.loading)return '<div class="empty-state" role="status">선택한 날짜의 모든 페이지를 조회하고 있습니다…</div>';
  const r=state.result;
  if(!r)return '<div class="empty-state">지도에서 지역을 선택하거나 조건을 설정한 뒤 평균 조회를 누르세요.</div>';
  const place=[state.province||'전국',state.district,state.basin].filter(Boolean).map(esc).join(' · ');
  return `<div class="water-result"><p class="muted">${place} · ${esc(r.day)} · ${r.mode==='daily'?'일간 유효 관측값 평균':'측정소별 해당 날짜 최종 관측값 평균'}</p><h3>${esc(r.item.name)}</h3><div class="water-average">${valueText(r.average)} <small>${esc(r.item.unit)}</small></div><div class="water-statistics"><span>유효 관측 <b>${r.validCount}건</b></span><span>자료 있는 측정소 <b>${r.stationCount}/${r.selectedStationCount}개</b></span><span>제외 <b>${r.excludedCount}건</b></span></div>${r.message?`<p role="status">${esc(r.message)}</p>`:''}${r.lastObserved?`<p class="muted">실제 자료시각: ${esc(r.firstObserved)} ~ ${esc(r.lastObserved)} (KST)</p>`:''}${r.dateOnly?'<p class="panel-note warning">원본이 날짜까지만 제공되어 시·분 단위 실시간 여부는 확인할 수 없습니다.</p>':''}<details open><summary>측정소별 결과</summary><div class="table-wrap water-station-table"><table class="data-table"><thead><tr><th>측정소</th><th>지역</th><th>수계</th><th>${r.mode==='daily'?'일간 평균':'최종값'}</th><th>유효/제외</th><th>자료시각</th></tr></thead><tbody>${r.stations.map(s=>`<tr><td>${esc(s.name)}<small class="muted"> ${esc(s.id)}</small></td><td>${esc([s.province,s.district].filter(Boolean).join(' ')||'소재지 미연결')}</td><td>${esc(s.basin)}</td><td>${valueText(s.average)}</td><td>${s.count} / ${s.excluded}</td><td>${esc(s.latest||'자료 없음')}</td></tr>`).join('')||'<tr><td colspan="6">연결된 측정소 없음</td></tr>'}</tbody></table></div></details><p class="muted">출처: ${esc(r.source)}${r.retrievedAt?' · 조회 '+esc(r.retrievedAt.replace('T',' ').slice(0,19))+' KST':''}<br>선택 항목의 유효 숫자만 산술평균합니다. -999(정량한계 미만)·ND·빈값은 제외하고 실제 0은 포함합니다. 측정소별 관측 건수에 따라 가중치가 달라지며 공식 지역 대표 수질이나 판정등급이 아닙니다.${r.duplicateCount?' 동일 값 중복 '+r.duplicateCount+'건 제외.':''}${r.outsideCount?' 조건 외 자료 '+r.outsideCount+'건 제외.':''}</p></div>`;
}
export function waterMapPanel(){
  if(!state.catalog)return `<section class="card card-pad" data-water-map><h2>전국 수질자동측정망</h2><p role="status">${esc(state.error||'지도와 측정소 코드표를 불러오는 중…')}</p>${state.error?'<button class="button secondary" data-water-retry>다시 불러오기</button>':''}</section>`;
  const stations=state.catalog.stations;
  const provinces=[...new Set(state.regions.length?state.regions.map(r=>r.name):stations.map(s=>s.province).filter(Boolean))];
  const districts=[...new Set(stations.filter(s=>matches(s,'district')).map(s=>s.district).filter(Boolean))].sort();
  const basins=[...new Set(stations.map(s=>s.basin))];
  const available=stations.filter(s=>matches(s));
  const item=state.catalog.items.find(i=>i.id===state.item);
  return `<section class="card card-pad water-map-panel" data-water-map><div class="card-heading"><div><h2>전국 수질자동측정망</h2><p class="muted">지도에서 지역을 클릭해 항목별 평균을 조회하세요.</p></div><span class="pill">공공 수질 DB</span></div><div class="panel-note">${esc(state.catalog.notice)}</div><div class="water-map-layout"><div class="water-map-column"><svg class="korea-map" viewBox="0 0 470 440" aria-label="대한민국 시도별 수질 조회 지도" role="group">${state.regions.map(r=>`<path d="${r.path}" fill-rule="evenodd" tabindex="0" role="button" aria-label="${esc(r.name)} 평균 조회" aria-pressed="${r.name===state.province}" class="water-region ${r.name===state.province?'selected':''}" data-water-region="${esc(r.name)}"><title>${esc(r.name)}</title></path>`).join('')}</svg><div class="water-region-list"><button class="button ${!state.province?'primary':'secondary'} small" data-water-region="">전국</button>${provinces.map(p=>`<button class="button ${p===state.province?'primary':'secondary'} small" data-water-region="${esc(p)}">${label(p)}</button>`).join('')}</div><p class="muted map-source">지도: 통계청 SGIS 2018 경계, <a href="https://github.com/southkorea/southkorea-maps/tree/master/kostat/2018/json" target="_blank" rel="noopener">southkorea-maps</a> 가공 (공공누리 1유형). 경계는 참고용입니다.</p></div><div class="water-map-controls"><div class="water-filter-grid">${select('province','시·도',provinces.map(p=>[p,p]),state.province)}${select('district','시·군·구',districts.map(d=>[d,d]),state.district)}${select('basin','수계',basins.map(b=>[b,b]),state.basin)}${select('station','측정소',available.map(s=>[s.id,s.name+' ('+s.id+')']),state.station)}<label class="field">측정항목<select id="water-item" class="control">${state.catalog.items.map(i=>`<option value="${i.id}" ${i.id===state.item?'selected':''}>${esc(i.name)} (${esc(i.unit)})</option>`).join('')}</select></label><label class="field">조회일 (KST)<input id="water-day" type="date" class="control" min="2000-01-01" max="${state.catalog.today}" value="${state.day}"></label><label class="field">집계 방식<select id="water-mode" class="control"><option value="daily" ${state.mode==='daily'?'selected':''}>일간 평균</option><option value="latest" ${state.mode==='latest'?'selected':''}>선택일 최종값 평균</option></select></label></div><div class="toolbar"><button class="button primary" data-water-query ${state.loading?'disabled':''}>${state.loading?'조회 중…':'평균 조회'}</button><button class="button secondary" data-water-today>오늘로 설정</button></div><p class="muted">${available.length}개 측정소 · 기본 조회일은 공개 지연을 고려한 100일 전입니다. 오늘 자료는 없을 수 있습니다. 센서 1·2·3 및 ECD는 별도 항목으로 조회합니다.</p>${state.error?`<p class="panel-note warning" role="alert">${esc(state.error)}</p>`:''}${resultPanel()}</div></div><details><summary>자료 범위와 지역 연결 기준</summary><p class="muted">${esc(state.catalog.reference)}. 코드표에 있는 71개 측정소 중 주소를 확인한 69개를 지역에 연결했습니다. 미호천·임하호는 소재지가 미연결되어 전국·수계·측정소 조회에만 포함됩니다. 목록에 없는 신규 측정소는 포함되지 않습니다. 방사성·먹는물·일반 수질측정망은 자동측정망 평균에 섞지 않습니다. 자동측정망에 없는 BOD 등은 이 화면에서 제공하지 않습니다.</p></details></section>`;
}
function invalidate(){sequence++;state.loading=false;state.result=null;state.error='';}
document.addEventListener('click',async event=>{
  if(event.target.closest('[data-water-retry]')){state.error='';await initialize();return;}
  const region=event.target.closest('[data-water-region]');
  if(region){invalidate();state.province=region.dataset.waterRegion;state.district='';state.station='';state.basin='';await queryWater();return;}
  if(event.target.closest('[data-water-query]')){await queryWater();return;}
  if(event.target.closest('[data-water-today]')){invalidate();state.day=state.catalog.today;redraw();}
});
document.addEventListener('keydown',event=>{
  const region=event.target.closest('path[data-water-region]');
  if(region&&(event.key==='Enter'||event.key===' ')){event.preventDefault();region.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
});
document.addEventListener('change',event=>{
  const key=event.target.id?.replace(/^water-/,'');
  if(!['province','district','basin','station','item','day','mode'].includes(key))return;
  invalidate();state[key]=event.target.value;
  if(key==='province'){state.district='';state.station='';}
  if(key==='district'||key==='basin')state.station='';
  redraw();
});
