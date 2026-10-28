// Synthetic presentation data. Replace this module through the service adapter.
export const domains = {
  water: {name:'수질', icon:'drop', label:'수질', color:'#2563eb'},
  air: {name:'대기', icon:'wind', label:'대기', color:'#5486a8'},
  sediment: {name:'해양저질', icon:'waves', label:'해양저질', color:'#a76a3e'},
};
export const jobs = [
  {id:'JOB-1028-01',file:'중금속_수질_1028.pdf',site:'방류구 1',time:'10.28 09:30',date:'2026-10-28',status:'review',domain:'water',author:'김측정',type:'중금속',pages:8},
  {id:'JOB-1028-02',file:'VOC_분석결과.pdf',site:'지하수 2',time:'10.28 09:12',date:'2026-10-28',status:'processing',domain:'water',author:'이분석',type:'VOC',pages:5},
  {id:'JOB-1027-01',file:'유기인_측정결과.pdf',site:'방류구 1',time:'10.27 16:40',date:'2026-10-27',status:'confirmed',domain:'water',author:'김측정',type:'유기인',pages:3},
  {id:'JOB-1027-02',file:'수질_측정성적서.pdf',site:'하천 지점 A',time:'10.27 15:20',date:'2026-10-27',status:'confirmed',domain:'water',author:'박검수',type:'수질 성적서',pages:3},
  {id:'JOB-1027-03',file:'대기_배출가스_1027.pdf',site:'배출구 A',time:'10.27 14:10',date:'2026-10-27',status:'review',domain:'air',author:'이분석',type:'대기 성적서',pages:6},
  {id:'JOB-1026-01',file:'대기_먼지_1026.pdf',site:'배출구 B',time:'10.26 11:20',date:'2026-10-26',status:'failed',domain:'air',author:'김측정',type:'대기 성적서',pages:2},
  {id:'JOB-1026-02',file:'해양저질_중금속.pdf',site:'해역 S-01',time:'10.26 10:30',date:'2026-10-26',status:'review',domain:'sediment',author:'박검수',type:'해양저질',pages:4},
];
export const statuses = {review:{text:'검수 대기',tone:'amber'},processing:{text:'처리 중',tone:'blue'},confirmed:{text:'확정',tone:'green'},failed:{text:'실패',tone:'red'}};
export const measurements = {
  water:[{name:'pH',value:'7.2',unit:'-',limit:'-',warning:false},{name:'BOD',value:'3.1',unit:'mg/L',limit:'-',warning:false},{name:'총질소',value:'12.3',unit:'mg/L',limit:'-',warning:false},{name:'총인',value:'0.21',unit:'mg/L',limit:'0.20',warning:true}],
  air:[{name:'먼지',value:'12.4',unit:'mg/Sm³',limit:'-',warning:false},{name:'질소산화물',value:'28.6',unit:'ppm',limit:'-',warning:false},{name:'산소농도',value:'8.2',unit:'%',limit:'-',warning:false},{name:'가스온도',value:'132',unit:'°C',limit:'-',warning:false}],
  sediment:[{name:'COD',value:'8.4',unit:'mg/g',limit:'-',warning:false},{name:'강열감량',value:'4.2',unit:'%',limit:'-',warning:false},{name:'구리',value:'21.3',unit:'mg/kg',limit:'-',warning:false},{name:'납',value:'18.7',unit:'mg/kg',limit:'-',warning:false}],
};
export const templates = [
  {name:'수질 분석 결과표',domain:'water',type:'양식형',version:'v1.2',status:'기본 양식'},
  {name:'중금속 1차·2차 결과표',domain:'water',type:'양식형 · 파일 2개',version:'v1.0',status:'활성'},
  {name:'대기 측정 대장',domain:'air',type:'누적형',version:'v1.0',status:'활성'},
  {name:'해양저질 분석 결과표',domain:'sediment',type:'양식형',version:'v1.0',status:'활성'},
];
