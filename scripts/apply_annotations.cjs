// apply_annotations.cjs
// 사용법: node scripts/apply_annotations.cjs
// annotations.json을 읽어 all_data_204.json에 일괄 반영

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../public/data/all_data_204.json");
const ANN_PATH = path.join(__dirname, "../public/data/annotations.json");

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const anns = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));

let applied = 0;
let warned = 0;

Object.entries(anns).forEach(function ([yr, sets]) {
  var yearData = data[yr];
  if (!yearData) {
    console.log("WARN: 연도 없음 - " + yr);
    warned++;
    return;
  }

  Object.entries(sets).forEach(function ([setId, annList]) {
    if (!annList || annList.length === 0) return; // 빈 배열은 스킵

    var set =
      (yearData.reading || []).find(function (s) {
        return s.id === setId;
      }) ||
      (yearData.literature || []).find(function (s) {
        return s.id === setId;
      });

    if (!set) {
      console.log("WARN: 세트 없음 - " + yr + " / " + setId);
      warned++;
      return;
    }

    // sentId 유효성 검증
    var sentIds = (set.sents || []).map(function (s) {
      return s.id;
    });
    annList.forEach(function (ann) {
      if (ann.sentId && !sentIds.includes(ann.sentId)) {
        console.log("WARN: sentId 없음 - " + ann.sentId + " (" + setId + ")");
        warned++;
      }
      if (ann.sentFrom && !sentIds.includes(ann.sentFrom)) {
        console.log(
          "WARN: sentFrom 없음 - " + ann.sentFrom + " (" + setId + ")",
        );
        warned++;
      }
      if (ann.sentTo && !sentIds.includes(ann.sentTo)) {
        console.log("WARN: sentTo 없음 - " + ann.sentTo + " (" + setId + ")");
        warned++;
      }
    });

    set.annotations = annList;
    console.log("OK: " + yr + " / " + setId + " - " + annList.length + "개");
    applied++;
  });
});

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
console.log("\n완료: " + applied + "개 세트 반영, " + warned + "개 경고");
