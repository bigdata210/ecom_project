let current=null, message='현재 위치로 기상청 관측값을 조회하세요.', busy=false, redraw=()=>{};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bindWeather(callback){redraw=callback;}
export function weatherPanel(){
  const metric=(name,value,unit)=>`<div class="weather-metric"><div><small>${name}</small><b>${value==null?'자료 없음':escape(value)+' '+unit}</b></div></div>`;
  return `<div class="card card-pad"><div class="card-heading"><h2>현재 위치 기상정보</h2><span class="pill ${current?'green':'demo'}">${current?'실제 관측':'위치 조회'}</span></div><p class="muted" role="status">${escape(message)}</p><button class="button primary" data-weather-locate ${busy?'disabled':''}>${busy?'조회 중…':'현재 위치로 '+(current?'새로고침':'날씨 조회')}</button>${current?`<div class="weather-hero"><span class="weather-temp">${escape(current.temperature)}°C</span></div><div class="weather-metrics">${metric('습도',current.humidity,'%')}${metric('풍속',current.windSpeed,'m/s')}${metric('1시간 강수량',current.precipitation,'mm')}</div><p class="muted">${escape(current.source)} · ${escape(current.observedAt.slice(0,4)+'-'+current.observedAt.slice(4,6)+'-'+current.observedAt.slice(6,8)+' '+current.observedAt.slice(9,11)+':'+current.observedAt.slice(11,13))} KST<br>관측 격자 X ${current.nx} / Y ${current.ny} · 현재 위치 주변 격자의 관측값입니다.</p>`:''}<p class="muted">위치 허용 후 조회하며 좌표를 DB에 저장하지 않습니다. 현재 위치는 시료 채취지점과 다를 수 있습니다. 예보·과거 조회·기압은 아직 연결하지 않았습니다.</p></div>`;
}
document.addEventListener('click',async event=>{
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
    current=data;message='현재 위치 주변의 최신 제공 관측값입니다.';
  }catch(error){message=error.code===1?'위치 권한이 거부되었습니다. 브라우저 사이트 설정에서 위치를 허용한 후 다시 조회하세요.':error.code===2?'현재 위치를 확인할 수 없습니다. 기기의 위치 설정을 확인하세요.':error.code===3?'위치 조회 시간이 초과되었습니다. 다시 시도하세요.':error.name==='TimeoutError'?'기상 조회 시간이 초과되었습니다. 다시 시도하세요.':error.message||'기상 조회에 실패했습니다.';}
  finally{busy=false;redraw();}
});
