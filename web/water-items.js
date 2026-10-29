// Workflow suggestions only: these groups do not define legal test packages.
export const waterGroups = {
  '금속·원소': ['안티몬(Sb)','비소(As)','바륨(Ba)','카드뮴(Cd)','크롬(Cr)','6가크롬(Cr6+)','구리(Cu)','용해성 철(Fe)','수은(Hg)','용해성 망간(Mn)','니켈(Ni)','납(Pb)','셀레늄(Se)','아연(Zn)'],
  '휘발성 유기화합물(VOC)': ['벤젠','사염화탄소','클로로포름','1,2-다이클로로에탄','다이클로로메탄','테트라클로로에틸렌(PCE)','트리클로로에틸렌(TCE)'],
  '기타 유기물': ['음이온계면활성제(ABS)','다이에틸헥실프탈레이트(DEHP)','1,4-다이옥세인','헥사클로로벤젠','포름알데히드','노말헥산추출물질','유기인','폴리클로리네이티드비페닐(PCB)','페놀류(phenols)'],
  '유기물·산소 지표': ['생물화학적산소요구량(BOD)','화학적산소요구량(COD)','용존산소(DO)','총유기탄소(TOC)'],
  '질소·인': ['용존총질소(DTN)','용존총인(DTP)','암모니아성 질소(NH3-N)','질산성질소(NO3-N)','인산염 인(PO4-P)','총질소(T-N)','총인(T-P)'],
  '이온·무기물': ['염소이온(Cl-)','시안(CN)','불소(F)'],
  '현장·물리 지표': ['유량','색도','전기전도도(EC)','수위','수소이온농도(pH)','부유물질(SS)','수온','투명도'],
  '생물 지표': ['조류','클로로필-a(Chlorophyll-a)','분원성대장균군','총대장균군'],
};
export const waterSelection = new Set();
let activeGroup = '전체';
export function recommendedItems(){
  return Object.values(waterGroups).filter(items=>items.some(x=>waterSelection.has(x)))
    .flat().filter(x=>!waterSelection.has(x));
}
const itemButton=(name,recommended=false)=>`<button type="button" class="water-item ${waterSelection.has(name)?'chosen':''}" data-action="water-toggle" data-item="${name}" aria-pressed="${waterSelection.has(name)}">${waterSelection.has(name)?'✓ ':recommended?'+ ':''}${name}</button>`;
export function waterPicker(){
  const suggested=recommendedItems();
  return `<section class="card card-pad water-picker"><div class="card-heading"><h2>수질 측정항목 선택</h2><span class="muted" role="status">${waterSelection.size}개 선택</span></div><p class="muted">항목을 클릭하면 같은 그룹의 항목을 추천합니다. 추천은 업무 편의용이며 분석 의뢰·법정 필수항목을 뜻하지 않습니다.</p><div class="water-chips">${['전체',...Object.keys(waterGroups)].map(g=>`<button type="button" class="button ${activeGroup===g?'primary':'secondary'}" data-action="water-group" data-group="${g}" aria-pressed="${activeGroup===g}">${g}</button>`).join('')}</div><div class="water-catalog">${Object.entries(waterGroups).filter(([g])=>activeGroup==='전체'||activeGroup===g).map(([g,items])=>`<h3>${g}</h3><div class="water-chips">${items.map(x=>itemButton(x)).join('')}</div>`).join('')}</div><div class="water-summary"><h3>선택한 항목</h3><div class="water-chips">${[...waterSelection].map(x=>itemButton(x)).join('')||'<span class="muted">아직 선택하지 않았습니다.</span>'}</div>${waterSelection.size?'<button class="button secondary" data-action="water-clear">선택 초기화</button>':''}</div>${suggested.length?`<div class="water-summary"><h3>함께 선택할 항목 추천</h3><p class="muted">선택한 항목과 같은 그룹 · 클릭한 항목만 추가됩니다.</p><div class="water-chips">${suggested.map(x=>itemButton(x,true)).join('')}</div><button class="button secondary" data-action="water-add-recommended">추천 ${suggested.length}개 모두 추가</button></div>`:''}<p class="muted">항목 목록은 화면에서만 선택됩니다. 실제 PDF 추출·Excel 반영은 변환 API 연결 후 적용됩니다. 크롬과 6가크롬 등은 별도 항목으로 유지합니다.</p></section>`;
}
export function handleWaterAction(action,data){
  if(action==='water-toggle'){waterSelection.has(data.item)?waterSelection.delete(data.item):waterSelection.add(data.item);}
  else if(action==='water-group')activeGroup=data.group;
  else if(action==='water-clear')waterSelection.clear();
  else if(action==='water-add-recommended')recommendedItems().forEach(x=>waterSelection.add(x));
  else return false;
  return true;
}
