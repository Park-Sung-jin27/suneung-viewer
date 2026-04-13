import fs from "fs";

try {
  const mainPath = "./public/data/all_data_204.json";
  // 🎯 읽어올 파일명을 문학 데이터로 변경
  const updatedPath = "./lit_2026_rebuilt.json";

  const mainData = JSON.parse(fs.readFileSync(mainPath, "utf8"));
  const updatedData = JSON.parse(fs.readFileSync(updatedPath, "utf8"));

  // 🎯 이번에는 reading이 아니라 literature(문학) 배열을 타겟으로 합니다.
  const literature = mainData["2026수능"].literature;
  const newSets = Array.isArray(updatedData)
    ? updatedData
    : Object.values(updatedData);

  newSets.forEach((newSet) => {
    if (!newSet.id) return;

    // 혹시 모를 클로드의 스키마 오류 자동 교정
    if (newSet.questions) {
      newSet.questions = newSet.questions.map((q) => {
        if (q.qText && !q.t) q.t = q.qText;
        if (q.bogiText && !q.bogi) q.bogi = q.bogiText;
        if (typeof q.id === "string" && q.id.startsWith("q")) {
          q.id = q.id.replace("q", "");
        }
        return q;
      });
    }

    // 기존 문학 데이터와 ID를 대조하여 덮어쓰기
    const idx = literature.findIndex((r) => r.id === newSet.id);
    if (idx !== -1) {
      literature[idx] = newSet;
      console.log(
        `[성공] ${newSet.title} (${newSet.range}) 문학 데이터 업데이트 완료!`,
      );
    } else {
      console.log(
        `[알림] 기존에 없던 ${newSet.title} 데이터를 새로 추가합니다.`,
      );
      literature.push(newSet);
    }
  });

  fs.writeFileSync(mainPath, JSON.stringify(mainData, null, 2), "utf8");
  console.log("🎉 문학 데이터 병합이 완벽하게 완료되었습니다!");
} catch (e) {
  console.error("⚠️ 오류 발생:", e.message);
}
