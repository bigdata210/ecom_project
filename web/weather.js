let current=null, message='현재 위치로 기상청 관측값을 조회하세요.', busy=false, redraw=()=>{};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cities=[['서울',37.5665,126.9780],['부산',35.1796,129.0756],['대구',35.8714,128.6014],['광주',35.1595,126.8526],['대전',36.3504,127.3845]];
let cityResults=[],citiesBusy=false,lastCities=0,locationInfo=null;
const observed=value=>/^\d{8} \d{4}$/.test(value)?`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)} ${value.slice(9,11)}:${value.slice(11,13)} KST`:'관측시각 확인 불가';
const today=()=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'full'}).format(new Date());
async function loadCities(){
 if(citiesBusy)return;citiesBusy=true;redraw();
 cityResults=await Promise.all(cities.map(async ([name,lat,lon])=>{try{
 const response=await fetch(`/api/weather?lat=${lat}&lon=${lon}`,{signal:AbortSignal.timeout(35000),cache:'no-store'});
 const data=await response.json();if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'지역 기상 조회 실패');return {name,data};
 }catch(error){return {name,error:error.name==='TimeoutError'?'조회 시간 초과':error.message||'조회 실패'};}}));
 lastCities=Date.now();citiesBusy=false;redraw();
}
export function bindWeather(callback){redraw=callback;if(document.querySelector('[data-weather-panel]')&&!citiesBusy&&Date.now()-lastCities>600000)void loadCities();}
function regionalPanel(){return `<div data-weather-panel><div class="card-heading"><div><h2>${escape(today())} 기상정보</h2><p class="muted">주요 5개 지역 · 기상청 최신 제공 관측값</p></div><button class="button secondary" data-weather-cities ${citiesBusy?'disabled':''}>${citiesBusy?'조회 중…':'지역 날씨 새로고침'}</button></div><div class="regional-weather-grid">${(cityResults.length?cityResults:cities.map(([name])=>({name}))).map(city=>`<article class="regional-weather-card"><h3>${city.name}</h3><p class="muted">도심 대표 좌표 기준</p>${city.data?`<div class="weather-temp">${escape(city.data.temperature)}°C</div><p>습도 ${escape(city.data.humidity??'자료 없음')}${city.data.humidity==null?'':'%'}<br>풍속 ${escape(city.data.windSpeed??'자료 없음')}${city.data.windSpeed==null?'':' m/s'}<br>1시간 강수량 ${escape(city.data.precipitation??'자료 없음')}${city.data.precipitation==null?'':' mm'}</p><p class="muted">관측 ${escape(observed(city.data.observedAt))}<br>출처: 기상청 초단기실황</p>`:`<p class="muted" role="status">${escape(city.error||'관측자료 조회 중…')}</p>`}</article>`).join('')}</div></div>`;}

export function weatherPanel(){
  const metric=(name,value,unit)=>`<div class="weather-metric"><div><small>${name}</small><b>${value==null?'자료 없음':escape(value)+' '+unit}</b></div></div>`;
  return `<div class="card card-pad">${regionalPanel()}<div class="water-summary"><div class="card-heading"><h2>내 위치 주변 날씨</h2><span class="pill ${current?'green':'demo'}">${current?'실제 관측':'위치 조회'}</span></div><p class="muted" role="status">${escape(message)}</p><button class="button primary" data-weather-locate ${busy?'disabled':''}>${busy?'조회 중…':'현재 위치 기준'}</button>${current?`<p><b>조회 위치: 위도 ${locationInfo.lat.toFixed(4)}°, 경도 ${locationInfo.lon.toFixed(4)}°</b><br><span class="muted">위치 정확도 약 ${Math.round(locationInfo.accuracy)}m · 조회 ${escape(locationInfo.requestedAt)}</span></p><div class="weather-hero"><span class="weather-temp">${escape(current.temperature)}°C</span></div><div class="weather-metrics">${metric('습도',current.humidity,'%')}${metric('풍속',current.windSpeed,'m/s')}${metric('1시간 강수량',current.precipitation,'mm')}</div><p class="muted">${escape(current.source)} · ${escape(current.observedAt.slice(0,4)+'-'+current.observedAt.slice(4,6)+'-'+current.observedAt.slice(6,8)+' '+current.observedAt.slice(9,11)+':'+current.observedAt.slice(11,13))} KST<br>관측 격자 X ${current.nx} / Y ${current.ny} · 현재 위치 주변 격자의 관측값입니다.</p>`:''}<p class="muted">위치 허용 후 조회하며 좌표를 DB에 저장하지 않습니다. 현재 위치는 시료 채취지점과 다를 수 있습니다. 예보·과거 조회·기압은 아직 연결하지 않았습니다.</p></div></div>`;
}
document.addEventListener('click',async event=>{
  if(event.target.closest('[data-weather-cities]')){await loadCities();return;}
  if(!event.target.closest('[data-weather-locate]')||busy)return;
  busy=true;current=null;message='브라우저 위치 권한을 확인하고 있습니다.';redraw();
  try{
    if(!navigator.geolocation)throw Error('이 브라우저는 위치 조회를 지원하지 않습니다.');
    const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:15000,maximumAge:300000}));
    const {latitude,longitude}=position.coords;
    if(latitude<32||latitude>40||longitude<123||longitude>133)throw Error('현재 위치가 국내 기상 조회 지원 범위를 벗어났습니다.');
    message='기상청 관측자료를 조회하고 있습니다.';redraw();
    const response=await fetch(`/api/weather?lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}`,{signal:AbortSignal.timeout(35000),cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'기상정보를 조회하지 못했습니다.');
    locationInfo={lat:latitude,lon:longitude,accuracy:position.coords.accuracy,requestedAt:new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(new Date())+' KST'};current=data;message='현재 위치 주변의 최신 제공 관측값입니다.';
  }catch(error){message=error.code===1?'위치 권한이 거부되었습니다. 브라우저 사이트 설정에서 위치를 허용한 후 다시 조회하세요.':error.code===2?'현재 위치를 확인할 수 없습니다. 기기의 위치 설정을 확인하세요.':error.code===3?'위치 조회 시간이 초과되었습니다. 다시 시도하세요.':error.name==='TimeoutError'?'기상 조회 시간이 초과되었습니다. 다시 시도하세요.':error.message||'기상 조회에 실패했습니다.';}
  finally{busy=false;redraw();}
});
