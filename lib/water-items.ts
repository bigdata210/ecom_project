// Workflow suggestions only: these groups do not define legal test packages.
export const waterGroups: Record<string, string[]> = {
  '금속·원소': ['안티몬(Sb)', '비소(As)', '바륨(Ba)', '카드뮴(Cd)', '크롬(Cr)', '6가크롬(Cr6+)', '구리(Cu)', '용해성 철(Fe)', '수은(Hg)', '용해성 망간(Mn)', '니켈(Ni)', '납(Pb)', '셀레늄(Se)', '아연(Zn)'],
  '휘발성 유기화합물(VOC)': ['벤젠', '사염화탄소', '클로로포름', '1,2-다이클로로에탄', '다이클로로메탄', '테트라클로로에틸렌(PCE)', '트리클로로에틸렌(TCE)'],
  '기타 유기물': ['음이온계면활성제(ABS)', '다이에틸헥실프탈레이트(DEHP)', '1,4-다이옥세인', '헥사클로로벤젠', '포름알데히드', '노말헥산추출물질', '유기인', '폴리클로리네이티드비페닐(PCB)', '페놀류(phenols)'],
  '유기물·산소 지표': ['생물화학적산소요구량(BOD)', '화학적산소요구량(COD)', '용존산소(DO)', '총유기탄소(TOC)'],
  '질소·인': ['용존총질소(DTN)', '용존총인(DTP)', '암모니아성 질소(NH3-N)', '질산성질소(NO3-N)', '인산염 인(PO4-P)', '총질소(T-N)', '총인(T-P)'],
  '이온·무기물': ['염소이온(Cl-)', '시안(CN)', '불소(F)'],
  '현장·물리 지표': ['유량', '색도', '전기전도도(EC)', '수위', '수소이온농도(pH)', '부유물질(SS)', '수온', '투명도'],
  '생물 지표': ['조류', '클로로필-a(Chlorophyll-a)', '분원성대장균군', '총대장균군'],
};

/** Items in the same group as something already chosen, minus the chosen ones. */
export function recommendedItems(selection: Set<string>): string[] {
  return Object.values(waterGroups)
    .filter((items) => items.some((x) => selection.has(x)))
    .flat()
    .filter((x) => !selection.has(x));
}
