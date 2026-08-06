import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import katex from "katex";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENGLISH_DB_PATH = path.join(
  ROOT,
  "english",
  "data",
  "english_exam_db_v2_1.json",
);
const ENGLISH_CANDIDATE_GATE_PATH = path.join(
  ROOT,
  "english",
  "scripts",
  "merge_candidate_overlay.mjs",
);
const ENGLISH_CANDIDATE_OVERLAY_PATH = path.join(
  ROOT,
  "english",
  "data",
  "candidates",
  "english_2026_09_candidate.json",
);
const ENGLISH_INTERNAL_CANDIDATE_OVERLAY_PATH = path.join(
  ROOT,
  "english",
  "data",
  "candidates",
  "english_2026_06_candidate.json",
);
const ENGLISH_SECOND_INTERNAL_CANDIDATE_OVERLAY_PATH = path.join(
  ROOT,
  "english",
  "data",
  "candidates",
  "english_2027_06_candidate.json",
);
const ENGLISH_THIRD_INTERNAL_CANDIDATE_OVERLAY_PATH = path.join(
  ROOT,
  "english",
  "data",
  "candidates",
  "english_2025_09_candidate.json",
);
const ENGLISH_FOURTH_INTERNAL_CANDIDATE_OVERLAY_PATH = path.join(
  ROOT,
  "english",
  "data",
  "candidates",
  "english_2024_09_candidate.json",
);
const ENGLISH_FIFTH_INTERNAL_CANDIDATE_OVERLAY_PATH = path.join(
  ROOT,
  "english",
  "data",
  "candidates",
  "english_2024_06_candidate.json",
);
const ENGLISH_SIXTH_INTERNAL_CANDIDATE_OVERLAY_PATH = path.join(
  ROOT,
  "english",
  "data",
  "candidates",
  "english_2025_csat_candidate.json",
);
const ENGLISH_CANDIDATE_SOURCE_DIRECTORY = path.join(
  ROOT,
  "raw_sources",
  "english_eval_pdfs",
);
const MATH_ANSWER_CROSSCHECK_PATH = path.join(
  ROOT,
  "평가원_수학영어_확장",
  "08_math_data",
  "math_answer_crosscheck_v1.json",
);
const MATH_VERIFIED_ANSWER_SOURCE =
  "KICE official answer table PDF; independent source matched; see math_answer_crosscheck_v1.json";
const MATH_ANSWER_CROSSCHECK_FINGERPRINT =
  "cf17c00a8c5884a61018362801cd5df6d3f3794c1da6c184895e74e7da1701ec";
const PUBLIC_DATA_DIRECTORY = path.join(ROOT, "public", "data", "eng-math");
const ENGLISH_FREE_OUTPUT_PATH = path.join(
  PUBLIC_DATA_DIRECTORY,
  "english-free-public.json",
);
const MATH_FREE_OUTPUT_PATH = path.join(
  PUBLIC_DATA_DIRECTORY,
  "math-free-public.json",
);
const CATALOG_OUTPUT_PATH = path.join(
  PUBLIC_DATA_DIRECTORY,
  "catalog-public.json",
);
const LEGACY_PUBLIC_DATA_PATHS = [
  path.join(PUBLIC_DATA_DIRECTORY, "english-2026-csat-public.json"),
  path.join(PUBLIC_DATA_DIRECTORY, "math-full-no-figure-public.json"),
];
const ENGLISH_FIGURE_PUBLIC_PATH = path.join(
  ROOT,
  "public",
  "images",
  "eng-math",
  "english",
  "2026-csat",
  "q25-figure.png",
);
const ENGLISH_FIGURE_PROTECTED_PATH = path.join(
  ROOT,
  "english",
  "assets",
  "2026-csat",
  "q25-figure.png",
);
const ENGLISH_EXCLUDED_IDS = new Set(["2026_csat_18"]);
const ENGLISH_FREE_IDS = [
  "2026_csat_19",
  "2026_csat_20",
  "2026_csat_21",
  "2026_csat_22",
  "2026_csat_23",
];
const ENGLISH_CANDIDATE_IDS = Array.from(
  { length: 28 },
  (_, index) => `2026_09_${index + 18}`,
);
const ENGLISH_INTERNAL_CANDIDATE_IDS = Array.from(
  { length: 28 },
  (_, index) => `2026_06_${index + 18}`,
);
const ENGLISH_SECOND_INTERNAL_CANDIDATE_IDS = Array.from(
  { length: 28 },
  (_, index) => `2027_06_${index + 18}`,
);
const ENGLISH_THIRD_INTERNAL_CANDIDATE_IDS = Array.from(
  { length: 28 },
  (_, index) => `2025_09_${index + 18}`,
);
const ENGLISH_FOURTH_INTERNAL_CANDIDATE_IDS = Array.from(
  { length: 28 },
  (_, index) => `2024_09_${index + 18}`,
);
const ENGLISH_FIFTH_INTERNAL_CANDIDATE_IDS = Array.from(
  { length: 28 },
  (_, index) => `2024_06_${index + 18}`,
);
const ENGLISH_SIXTH_INTERNAL_CANDIDATE_IDS = Array.from(
  { length: 28 },
  (_, index) => `2025_csat_${index + 18}`,
);
const MATH_FREE_IDS = [
  "2022_06_common_1",
  "2022_06_common_2",
  "2022_06_common_3",
  "2022_06_common_5",
  "2022_06_common_6",
];
const MATH_FIGURE_INTERNAL_VERIFIED_IDS = ["2022_06_common_4"];
const MATH_INTERNAL_VERIFIED_IDS = [
  "2022_06_common_7",
  "2022_06_common_8",
  "2022_06_common_9",
  "2022_06_common_10",
  "2022_06_common_11",
];
const MATH_SECOND_INTERNAL_VERIFIED_IDS = [
  "2022_06_common_12",
  "2022_06_common_13",
  "2022_06_common_14",
  "2022_06_common_15",
  "2022_06_common_16",
];
const MATH_THIRD_INTERNAL_VERIFIED_IDS = [
  "2022_06_common_17",
  "2022_06_common_18",
  "2022_06_common_19",
  "2022_06_common_20",
  "2022_06_common_21",
];
const MATH_FOURTH_INTERNAL_VERIFIED_IDS = ["2022_06_common_22"];
const MATH_STA_INTERNAL_VERIFIED_IDS = Array.from(
  { length: 5 },
  (_, index) => `2022_06_sta_${index + 23}`,
);
const MATH_CAL_INTERNAL_VERIFIED_IDS = Array.from(
  { length: 5 },
  (_, index) => `2022_06_cal_${index + 23}`,
);
const MATH_GEO_INTERNAL_VERIFIED_IDS = Array.from(
  { length: 5 },
  (_, index) => `2022_06_geo_${index + 23}`,
);
const MATH_STA_ADVANCED_INTERNAL_VERIFIED_IDS = [
  "2022_06_sta_28",
  "2022_06_sta_29",
  "2022_06_sta_30",
];
const MATH_CAL_ADVANCED_INTERNAL_VERIFIED_IDS = [
  "2022_06_cal_28",
  "2022_06_cal_29",
  "2022_06_cal_30",
];
const MATH_GEO_ADVANCED_INTERNAL_VERIFIED_IDS = [
  "2022_06_geo_28",
  "2022_06_geo_29",
  "2022_06_geo_30",
];
const MATH_2022_09_FIRST_INTERNAL_VERIFIED_IDS = Array.from(
  { length: 5 },
  (_, index) => `2022_09_common_${index + 1}`,
);
const MATH_2022_09_SECOND_INTERNAL_VERIFIED_IDS = Array.from(
  { length: 4 },
  (_, index) => `2022_09_common_${index + 6}`,
);
const MATH_2022_09_THIRD_INTERNAL_VERIFIED_IDS = [
  "2022_09_common_13",
  "2022_09_common_14",
  "2022_09_common_15",
  "2022_09_common_16",
  "2022_09_common_17",
  "2022_09_common_18",
  "2022_09_common_19",
];
const MATH_2022_09_STA_INTERNAL_VERIFIED_IDS = [
  "2022_09_sta_23",
  "2022_09_sta_24",
  "2022_09_sta_25",
  "2022_09_sta_27",
  "2022_09_sta_28",
  "2022_09_sta_29",
  "2022_09_sta_30",
];
const MATH_2022_09_CAL_INTERNAL_VERIFIED_IDS = [
  "2022_09_cal_23",
  "2022_09_cal_24",
  "2022_09_cal_25",
  "2022_09_cal_29",
  "2022_09_cal_30",
];
const MATH_2022_09_GEO_INTERNAL_VERIFIED_IDS = [
  "2022_09_geo_23",
  "2022_09_geo_24",
  "2022_09_geo_25",
  "2022_09_geo_30",
];
const MATH_2022_09_REMAINING_INTERNAL_VERIFIED_IDS = [
  "2022_09_common_10",
  "2022_09_common_11",
  "2022_09_common_12",
  "2022_09_common_20",
  "2022_09_common_21",
  "2022_09_common_22",
  "2022_09_sta_26",
  "2022_09_cal_26",
  "2022_09_cal_27",
  "2022_09_cal_28",
  "2022_09_geo_26",
  "2022_09_geo_27",
  "2022_09_geo_28",
  "2022_09_geo_29",
];
const MATH_2023_06_FIRST_INTERNAL_VERIFIED_IDS = [
  "2023_06_common_1",
  "2023_06_common_2",
  "2023_06_common_3",
  "2023_06_common_5",
  "2023_06_common_6",
  "2023_06_common_7",
  "2023_06_common_8",
  "2023_06_common_9",
];
const MATH_2023_06_SECOND_INTERNAL_VERIFIED_IDS = [
  "2023_06_common_11",
  "2023_06_common_12",
  "2023_06_common_14",
  "2023_06_common_15",
  "2023_06_common_16",
  "2023_06_common_17",
];
const MATH_2023_06_THIRD_INTERNAL_VERIFIED_IDS = [
  "2023_06_common_18",
  "2023_06_common_19",
  "2023_06_common_20",
  "2023_06_common_21",
  "2023_06_common_22",
];
const MATH_2023_06_STA_INTERNAL_VERIFIED_IDS = [
  "2023_06_sta_23",
  "2023_06_sta_25",
  "2023_06_sta_26",
  "2023_06_sta_27",
  "2023_06_sta_28",
  "2023_06_sta_29",
  "2023_06_sta_30",
];
const MATH_2023_06_CAL_INTERNAL_VERIFIED_IDS = [
  "2023_06_cal_23",
  "2023_06_cal_24",
  "2023_06_cal_25",
  "2023_06_cal_27",
  "2023_06_cal_28",
];
const MATH_2023_06_CAL_ADVANCED_INTERNAL_VERIFIED_IDS = ["2023_06_cal_30"];
const MATH_2023_06_GEO_INTERNAL_VERIFIED_IDS = [
  "2023_06_geo_23",
  "2023_06_geo_24",
  "2023_06_geo_25",
  "2023_06_geo_28",
];
const MATH_2023_06_REMAINING_INTERNAL_VERIFIED_IDS = [
  "2023_06_common_4",
  "2023_06_common_10",
  "2023_06_common_13",
  "2023_06_sta_24",
  "2023_06_cal_26",
  "2023_06_cal_29",
  "2023_06_geo_26",
  "2023_06_geo_27",
  "2023_06_geo_29",
  "2023_06_geo_30",
];
const MATH_2023_09_FIRST_INTERNAL_VERIFIED_IDS = [
  "2023_09_common_1",
  "2023_09_common_2",
  "2023_09_common_3",
  "2023_09_common_4",
  "2023_09_common_5",
  "2023_09_common_6",
  "2023_09_common_7",
  "2023_09_common_8",
  "2023_09_common_9",
  "2023_09_common_10",
  "2023_09_common_11",
];
const MATH_2023_09_SECOND_INTERNAL_VERIFIED_IDS = [
  "2023_09_common_12",
  "2023_09_common_13",
  "2023_09_common_14",
  "2023_09_common_15",
  "2023_09_common_16",
  "2023_09_common_17",
  "2023_09_common_18",
  "2023_09_common_19",
  "2023_09_common_20",
  "2023_09_common_21",
  "2023_09_common_22",
];
const MATH_2023_09_STA_INTERNAL_VERIFIED_IDS = [
  "2023_09_sta_23",
  "2023_09_sta_24",
  "2023_09_sta_25",
  "2023_09_sta_26",
  "2023_09_sta_27",
  "2023_09_sta_28",
  "2023_09_sta_29",
  "2023_09_sta_30",
];
const MATH_2023_09_CAL_INTERNAL_VERIFIED_IDS = [
  "2023_09_cal_23",
  "2023_09_cal_24",
  "2023_09_cal_25",
  "2023_09_cal_26",
  "2023_09_cal_27",
  "2023_09_cal_28",
  "2023_09_cal_29",
  "2023_09_cal_30",
];
const MATH_2023_09_GEO_INTERNAL_VERIFIED_IDS = [
  "2023_09_geo_23",
  "2023_09_geo_24",
  "2023_09_geo_25",
  "2023_09_geo_26",
  "2023_09_geo_27",
  "2023_09_geo_28",
  "2023_09_geo_29",
  "2023_09_geo_30",
];
const MATH_2024_06_FIRST_INTERNAL_VERIFIED_IDS = [
  "2024_06_common_1",
  "2024_06_common_2",
  "2024_06_common_3",
  "2024_06_common_4",
  "2024_06_common_5",
  "2024_06_common_6",
  "2024_06_common_7",
  "2024_06_common_8",
  "2024_06_common_9",
  "2024_06_common_10",
  "2024_06_common_11",
];
const MATH_2024_06_SECOND_INTERNAL_VERIFIED_IDS = [
  "2024_06_common_12",
  "2024_06_common_13",
  "2024_06_common_14",
  "2024_06_common_15",
  "2024_06_common_16",
  "2024_06_common_17",
  "2024_06_common_18",
  "2024_06_common_19",
  "2024_06_common_20",
  "2024_06_common_21",
  "2024_06_common_22",
];
const MATH_2024_06_STA_INTERNAL_VERIFIED_IDS = [
  "2024_06_sta_23",
  "2024_06_sta_24",
  "2024_06_sta_25",
  "2024_06_sta_26",
  "2024_06_sta_27",
  "2024_06_sta_28",
  "2024_06_sta_29",
  "2024_06_sta_30",
];
const MATH_2024_06_CAL_INTERNAL_VERIFIED_IDS = [
  "2024_06_cal_23",
  "2024_06_cal_24",
  "2024_06_cal_25",
  "2024_06_cal_26",
  "2024_06_cal_27",
  "2024_06_cal_28",
  "2024_06_cal_29",
  "2024_06_cal_30",
];
const MATH_2024_06_GEO_INTERNAL_VERIFIED_IDS = [
  "2024_06_geo_23",
  "2024_06_geo_24",
  "2024_06_geo_25",
  "2024_06_geo_26",
  "2024_06_geo_27",
  "2024_06_geo_28",
  "2024_06_geo_29",
  "2024_06_geo_30",
];
const MATH_2024_09_FIRST_INTERNAL_VERIFIED_IDS = [
  "2024_09_common_1",
  "2024_09_common_2",
  "2024_09_common_3",
  "2024_09_common_4",
  "2024_09_common_5",
  "2024_09_common_6",
  "2024_09_common_7",
  "2024_09_common_8",
  "2024_09_common_9",
  "2024_09_common_10",
  "2024_09_common_11",
];
const MATH_2024_09_SECOND_INTERNAL_VERIFIED_IDS = [
  "2024_09_common_12",
  "2024_09_common_13",
  "2024_09_common_14",
  "2024_09_common_15",
  "2024_09_common_16",
  "2024_09_common_17",
  "2024_09_common_18",
  "2024_09_common_19",
  "2024_09_common_20",
  "2024_09_common_21",
  "2024_09_common_22",
];
const MATH_2024_09_STA_INTERNAL_VERIFIED_IDS = [
  "2024_09_sta_23",
  "2024_09_sta_24",
  "2024_09_sta_25",
  "2024_09_sta_26",
  "2024_09_sta_27",
  "2024_09_sta_28",
  "2024_09_sta_29",
  "2024_09_sta_30",
];
const MATH_2024_09_CAL_INTERNAL_VERIFIED_IDS = [
  "2024_09_cal_23",
  "2024_09_cal_24",
  "2024_09_cal_25",
  "2024_09_cal_26",
  "2024_09_cal_27",
  "2024_09_cal_28",
  "2024_09_cal_29",
  "2024_09_cal_30",
];
const MATH_2024_09_GEO_INTERNAL_VERIFIED_IDS = [
  "2024_09_geo_23",
  "2024_09_geo_24",
  "2024_09_geo_25",
  "2024_09_geo_26",
  "2024_09_geo_27",
  "2024_09_geo_28",
  "2024_09_geo_29",
  "2024_09_geo_30",
];
const MATH_2025_06_FIRST_INTERNAL_VERIFIED_IDS = [
  "2025_06_common_1",
  "2025_06_common_2",
  "2025_06_common_3",
  "2025_06_common_4",
  "2025_06_common_5",
  "2025_06_common_6",
  "2025_06_common_7",
  "2025_06_common_8",
  "2025_06_common_9",
  "2025_06_common_10",
  "2025_06_common_11",
];
const MATH_2025_06_SECOND_INTERNAL_VERIFIED_IDS = [
  "2025_06_common_12",
  "2025_06_common_13",
  "2025_06_common_14",
  "2025_06_common_15",
  "2025_06_common_16",
  "2025_06_common_17",
  "2025_06_common_18",
  "2025_06_common_19",
  "2025_06_common_20",
  "2025_06_common_21",
  "2025_06_common_22",
];
const MATH_2025_06_STA_INTERNAL_VERIFIED_IDS = [
  "2025_06_sta_23",
  "2025_06_sta_24",
  "2025_06_sta_25",
  "2025_06_sta_26",
  "2025_06_sta_27",
  "2025_06_sta_28",
  "2025_06_sta_29",
  "2025_06_sta_30",
];
const MATH_2025_06_CAL_INTERNAL_VERIFIED_IDS = [
  "2025_06_cal_23",
  "2025_06_cal_24",
  "2025_06_cal_25",
  "2025_06_cal_26",
  "2025_06_cal_27",
  "2025_06_cal_28",
  "2025_06_cal_29",
  "2025_06_cal_30",
];
const MATH_2025_06_GEO_INTERNAL_VERIFIED_IDS = [
  "2025_06_geo_23",
  "2025_06_geo_24",
  "2025_06_geo_25",
  "2025_06_geo_26",
  "2025_06_geo_27",
  "2025_06_geo_28",
  "2025_06_geo_29",
  "2025_06_geo_30",
];
const MATH_2025_09_FIRST_INTERNAL_VERIFIED_IDS = [
  "2025_09_common_1",
  "2025_09_common_2",
  "2025_09_common_3",
  "2025_09_common_4",
  "2025_09_common_5",
  "2025_09_common_6",
  "2025_09_common_7",
  "2025_09_common_8",
  "2025_09_common_9",
  "2025_09_common_10",
  "2025_09_common_11",
];
const MATH_2025_09_SECOND_INTERNAL_VERIFIED_IDS = [
  "2025_09_common_12",
  "2025_09_common_13",
  "2025_09_common_14",
  "2025_09_common_15",
  "2025_09_common_16",
  "2025_09_common_17",
  "2025_09_common_18",
  "2025_09_common_19",
  "2025_09_common_20",
  "2025_09_common_21",
  "2025_09_common_22",
];
const MATH_2025_09_STA_INTERNAL_VERIFIED_IDS = [
  "2025_09_sta_23",
  "2025_09_sta_24",
  "2025_09_sta_25",
  "2025_09_sta_26",
  "2025_09_sta_27",
  "2025_09_sta_28",
  "2025_09_sta_29",
  "2025_09_sta_30",
];
const MATH_2025_09_CAL_INTERNAL_VERIFIED_IDS = [
  "2025_09_cal_23",
  "2025_09_cal_24",
  "2025_09_cal_25",
  "2025_09_cal_26",
  "2025_09_cal_27",
  "2025_09_cal_28",
  "2025_09_cal_29",
  "2025_09_cal_30",
];
const MATH_2025_09_GEO_INTERNAL_VERIFIED_IDS = [
  "2025_09_geo_23",
  "2025_09_geo_24",
  "2025_09_geo_25",
  "2025_09_geo_26",
  "2025_09_geo_27",
  "2025_09_geo_28",
  "2025_09_geo_29",
  "2025_09_geo_30",
];
const MATH_SOURCE_CORRECTION_IDS = ["2022_06_cal_29"];
const MATH_2022_09_SOURCE_CORRECTION_IDS = ["2022_09_common_11"];
const MATH_2023_06_SOURCE_CORRECTION_IDS = [
  "2023_06_common_6",
  "2023_06_common_19",
];
const MATH_2023_09_SOURCE_CORRECTION_IDS = ["2023_09_cal_25", "2023_09_geo_26"];
const MATH_2024_06_SOURCE_CORRECTION_IDS = ["2024_06_common_18", "2024_06_common_22"];
const MATH_2024_09_SOURCE_CORRECTION_IDS = ["2024_09_common_6"];
const MATH_2025_06_SOURCE_CORRECTION_IDS = ["2025_06_common_18"];
const MATH_2025_09_SOURCE_CORRECTION_IDS = [
  "2025_09_common_8",
  "2025_09_common_19",
  "2025_09_cal_26",
];
const MATH_INTERNAL_VERIFIED_ID_GROUPS = [
  MATH_FIGURE_INTERNAL_VERIFIED_IDS,
  MATH_INTERNAL_VERIFIED_IDS,
  MATH_SECOND_INTERNAL_VERIFIED_IDS,
  MATH_THIRD_INTERNAL_VERIFIED_IDS,
  MATH_FOURTH_INTERNAL_VERIFIED_IDS,
  MATH_STA_INTERNAL_VERIFIED_IDS,
  MATH_CAL_INTERNAL_VERIFIED_IDS,
  MATH_GEO_INTERNAL_VERIFIED_IDS,
  MATH_STA_ADVANCED_INTERNAL_VERIFIED_IDS,
  MATH_CAL_ADVANCED_INTERNAL_VERIFIED_IDS,
  MATH_GEO_ADVANCED_INTERNAL_VERIFIED_IDS,
  MATH_2022_09_FIRST_INTERNAL_VERIFIED_IDS,
  MATH_2022_09_SECOND_INTERNAL_VERIFIED_IDS,
  MATH_2022_09_THIRD_INTERNAL_VERIFIED_IDS,
  MATH_2022_09_STA_INTERNAL_VERIFIED_IDS,
  MATH_2022_09_CAL_INTERNAL_VERIFIED_IDS,
  MATH_2022_09_GEO_INTERNAL_VERIFIED_IDS,
  MATH_2022_09_REMAINING_INTERNAL_VERIFIED_IDS,
  MATH_2023_06_FIRST_INTERNAL_VERIFIED_IDS,
  MATH_2023_06_SECOND_INTERNAL_VERIFIED_IDS,
  MATH_2023_06_THIRD_INTERNAL_VERIFIED_IDS,
  MATH_2023_06_STA_INTERNAL_VERIFIED_IDS,
  MATH_2023_06_CAL_INTERNAL_VERIFIED_IDS,
  MATH_2023_06_CAL_ADVANCED_INTERNAL_VERIFIED_IDS,
  MATH_2023_06_GEO_INTERNAL_VERIFIED_IDS,
  MATH_2023_06_REMAINING_INTERNAL_VERIFIED_IDS,
  MATH_2023_09_FIRST_INTERNAL_VERIFIED_IDS,
  MATH_2023_09_SECOND_INTERNAL_VERIFIED_IDS,
  MATH_2023_09_STA_INTERNAL_VERIFIED_IDS,
  MATH_2023_09_CAL_INTERNAL_VERIFIED_IDS,
  MATH_2023_09_GEO_INTERNAL_VERIFIED_IDS,
  MATH_2024_06_FIRST_INTERNAL_VERIFIED_IDS,
  MATH_2024_06_SECOND_INTERNAL_VERIFIED_IDS,
  MATH_2024_06_STA_INTERNAL_VERIFIED_IDS,
  MATH_2024_06_CAL_INTERNAL_VERIFIED_IDS,
  MATH_2024_06_GEO_INTERNAL_VERIFIED_IDS,
  MATH_2024_09_FIRST_INTERNAL_VERIFIED_IDS,
  MATH_2024_09_SECOND_INTERNAL_VERIFIED_IDS,
  MATH_2024_09_STA_INTERNAL_VERIFIED_IDS,
  MATH_2024_09_CAL_INTERNAL_VERIFIED_IDS,
  MATH_2024_09_GEO_INTERNAL_VERIFIED_IDS,
  MATH_2025_06_FIRST_INTERNAL_VERIFIED_IDS,
  MATH_2025_06_SECOND_INTERNAL_VERIFIED_IDS,
  MATH_2025_06_STA_INTERNAL_VERIFIED_IDS,
  MATH_2025_06_CAL_INTERNAL_VERIFIED_IDS,
  MATH_2025_06_GEO_INTERNAL_VERIFIED_IDS,
  MATH_2025_09_FIRST_INTERNAL_VERIFIED_IDS,
  MATH_2025_09_SECOND_INTERNAL_VERIFIED_IDS,
  MATH_2025_09_STA_INTERNAL_VERIFIED_IDS,
  MATH_2025_09_CAL_INTERNAL_VERIFIED_IDS,
  MATH_2025_09_GEO_INTERNAL_VERIFIED_IDS,
];
const MATH_SOURCE_CORRECTION_ID_GROUPS = [
  MATH_SOURCE_CORRECTION_IDS,
  MATH_2022_09_SOURCE_CORRECTION_IDS,
  MATH_2023_06_SOURCE_CORRECTION_IDS,
  MATH_2023_09_SOURCE_CORRECTION_IDS,
  MATH_2024_06_SOURCE_CORRECTION_IDS,
  MATH_2024_09_SOURCE_CORRECTION_IDS,
  MATH_2025_06_SOURCE_CORRECTION_IDS,
  MATH_2025_09_SOURCE_CORRECTION_IDS,
];
const MATH_INTERNAL_VERIFIED_ID_COUNT =
  MATH_INTERNAL_VERIFIED_ID_GROUPS.flat().length;
const MATH_SOURCE_CORRECTION_ID_COUNT =
  MATH_SOURCE_CORRECTION_ID_GROUPS.flat().length;
const MATH_SOLUTION_MIN_NARRATIVE_LENGTH = 20;
const MATH_SOLUTION_DRAFT_PATTERN =
  /TODO|TBD|미검증|AI생성|ProbDex|준비\s*중|임시|�|\?\?/i;
const MATH_VERIFIED_SOLUTION_FILENAME = "math_free_verified_solutions_v1.json";
const MATH_FIGURE_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_common_4_verified_solution_v1.json";
const MATH_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_common_7_11_verified_solutions_v1.json";
const MATH_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_common_12_16_verified_solutions_v1.json";
const MATH_THIRD_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_common_17_21_verified_solutions_v1.json";
const MATH_FOURTH_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_common_22_verified_solution_v1.json";
const MATH_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_sta_23_27_verified_solutions_v1.json";
const MATH_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_cal_23_27_verified_solutions_v1.json";
const MATH_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_geo_23_27_verified_solutions_v1.json";
const MATH_STA_ADVANCED_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_sta_28_30_verified_solutions_v1.json";
const MATH_CAL_ADVANCED_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_cal_28_30_verified_solutions_v1.json";
const MATH_GEO_ADVANCED_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_06_geo_28_30_verified_solutions_v1.json";
const MATH_2022_09_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_09_common_1_5_verified_solutions_v1.json";
const MATH_2022_09_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_09_common_6_9_verified_solutions_v1.json";
const MATH_2022_09_THIRD_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_09_common_13_19_verified_solutions_v1.json";
const MATH_2022_09_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_09_sta_23_30_verified_solutions_v1.json";
const MATH_2022_09_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_09_cal_23_30_verified_solutions_v1.json";
const MATH_2022_09_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_09_geo_23_30_verified_solutions_v1.json";
const MATH_2022_09_REMAINING_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2022_09_remaining_14_verified_solutions_v1.json";
const MATH_2023_06_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_06_common_1_9_verified_solutions_v1.json";
const MATH_2023_06_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_06_common_11_17_verified_solutions_v1.json";
const MATH_2023_06_THIRD_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_06_common_18_22_verified_solutions_v1.json";
const MATH_2023_06_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_06_sta_23_30_verified_solutions_v1.json";
const MATH_2023_06_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_06_cal_23_28_verified_solutions_v1.json";
const MATH_2023_06_CAL_ADVANCED_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_06_cal_30_verified_solution_v1.json";
const MATH_2023_06_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_06_geo_23_28_verified_solutions_v1.json";
const MATH_2023_06_REMAINING_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_06_remaining_10_verified_solutions_v1.json";
const MATH_2023_09_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_09_common_1_11_verified_solutions_v1.json";
const MATH_2023_09_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_09_common_12_22_verified_solutions_v1.json";
const MATH_2023_09_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_09_sta_23_30_verified_solutions_v1.json";
const MATH_2023_09_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_09_cal_23_30_verified_solutions_v1.json";
const MATH_2023_09_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2023_09_geo_23_30_verified_solutions_v1.json";
const MATH_2024_06_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2024_06_common_1_11_verified_solutions_v1.json";
const MATH_2024_06_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2024_06_common_12_22_verified_solutions_v1.json";
const MATH_2024_06_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2024_06_sta_23_30_verified_solutions_v1.json";
const MATH_2024_06_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2024_06_cal_23_30_verified_solutions_v1.json";
const MATH_2024_06_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2024_06_geo_23_30_verified_solutions_v1.json";
const MATH_2024_09_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2024_09_common_1_11_verified_solutions_v1.json";
const MATH_2024_09_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2024_09_common_12_22_verified_solutions_v1.json";
const MATH_2024_09_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2024_09_sta_23_30_verified_solutions_v1.json";
const MATH_2024_09_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2024_09_cal_23_30_verified_solutions_v1.json";
const MATH_2024_09_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2024_09_geo_23_30_verified_solutions_v1.json";
const MATH_2025_06_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2025_06_common_1_11_verified_solutions_v1.json";
const MATH_2025_06_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2025_06_common_12_22_verified_solutions_v1.json";
const MATH_2025_06_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2025_06_sta_23_30_verified_solutions_v1.json";
const MATH_2025_06_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2025_06_cal_23_30_verified_solutions_v1.json";
const MATH_2025_06_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2025_06_geo_23_30_verified_solutions_v1.json";
const MATH_2025_09_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2025_09_common_1_11_verified_solutions_v1.json";
const MATH_2025_09_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2025_09_common_12_22_verified_solutions_v1.json";
const MATH_2025_09_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2025_09_sta_23_30_verified_solutions_v1.json";
const MATH_2025_09_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2025_09_cal_23_30_verified_solutions_v1.json";
const MATH_2025_09_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME =
  "math_2025_09_geo_23_30_verified_solutions_v1.json";
const MATH_SOURCE_CORRECTION_FILENAME = "math_2022_06_source_corrections_v1.json";
const MATH_2022_09_SOURCE_CORRECTION_FILENAME =
  "math_2022_09_source_corrections_v1.json";
const MATH_2023_06_SOURCE_CORRECTION_FILENAME =
  "math_2023_06_source_corrections_v1.json";
const MATH_2023_09_SOURCE_CORRECTION_FILENAME =
  "math_2023_09_source_corrections_v1.json";
const MATH_2024_06_SOURCE_CORRECTION_FILENAME =
  "math_2024_06_source_corrections_v1.json";
const MATH_2024_09_SOURCE_CORRECTION_FILENAME =
  "math_2024_09_source_corrections_v1.json";
const MATH_2025_06_SOURCE_CORRECTION_FILENAME =
  "math_2025_06_source_corrections_v1.json";
const MATH_2025_09_SOURCE_CORRECTION_FILENAME =
  "math_2025_09_source_corrections_v1.json";
const MATH_VERIFIED_SOURCE_HASHES = {
  archiveSha256:
    "f8cd746470d14dfa8a75a1bac3da85cd57f630f57a6f1427e87c366113b610ce",
  problemSha256:
    "f11cb2940871bbee2196d3e9a4be6848a8bba00c729ed68bf6096c1f1c2dbaf3",
  answerSha256:
    "d6489fd49be06b0fd212ad5b4f855ea8b02952f12839211f6b64b93ae8844b75",
};
const MATH_2022_09_VERIFIED_SOURCE_HASHES = {
  archiveSha256:
    "1d1f16a13a6c326bd3e952765fcfe80d8ba8cebd23810354ab412c2558d77878",
  problemSha256:
    "ae723d4c3892cbeb12836301c69cabb6ed432845a3be259ab28b6916131b75bd",
  answerSha256:
    "8c1541d69fb9fd8b26a1e5a4ee85f8def670196a7cd6b474fc3404a07a09848d",
};
const MATH_2023_06_VERIFIED_SOURCE_HASHES = {
  archiveSha256:
    "52670128518e0c913ee086d8fdf4364718997feb40edb189510c7bd32e5943ac",
  problemSha256:
    "aa82f35e8f31049dbc75279de253ae9c3aeceb09d0a85bf53ba1ce2f882ce452",
  answerSha256:
    "5db0748417f984b6ac30c87bb351f2d8fca7dce276fc71f47b7ab944e9e64519",
};
const MATH_2023_09_VERIFIED_SOURCE_HASHES = {
  problemSha256:
    "2053cc454daa5fbcef7f3a5de1bbb07b55f814894f4ea0b78026c27d27f025fe",
  answerSha256:
    "f3c729d6c9165ecc0196d6ede078e03cd8a5457cda5066d7d0fca6645ebafd92",
  primaryAnswerImageSha256:
    "ca8dd66204c4df4af348dbc28183a17abf0ff19b415ab55d46fe92821d666ff9",
};
const MATH_2024_06_VERIFIED_SOURCE_HASHES = {
  problemSha256:
    "b66547e1edfb4e53380e8e30ffa087eb1c72ef9a5d03dfa491d33bd6b9c56a98",
  answerSha256:
    "98233f2ec85d25b33e78549a68d5baa836ff3979e21e58fedf83a8422856e495",
};
const MATH_2024_09_VERIFIED_SOURCE_HASHES = {
  problemSha256:
    "5b2e01cfa31c7932b58afc19d5bebd388292c8382c5013e7c857caf24a6f006a",
  answerSha256:
    "fe450875a7b50ddf5d9b950f0f22688855d4fe622a42604f972ee1ce18e1e188",
};
const MATH_2025_06_VERIFIED_SOURCE_HASHES = {
  problemSha256:
    "ea1db4dcf34481c3adcfdd58524701924dd7ac988708adbf16a8e942ee283cd4",
  answerSha256:
    "655f41600d4825dceca6d0248ce0e02916ee73a2e3ad0cd2d596fba8e843db8b",
};
const MATH_2025_09_VERIFIED_SOURCE_HASHES = {
  problemSha256:
    "10872f1ff40923c9e92705b49d60043ac9e4ddc58db744865b4188d075eef28c",
  answerSha256:
    "e06118d5649d9a7fd04606ae1400db967a9435b54ad7eb1d75e96fe7bd9a62c2",
};
const ENGLISH_CHOICE_MARKS = ["①", "②", "③", "④", "⑤"];
const ENGLISH_PUBLIC_CHOICE_FINGERPRINT =
  "bbcfd28510d68d5193210254f08f0df4ac457b0b4bcd5849eb9d2ee5196f4a63";
const ENGLISH_CHOICE_CONTAMINATION_PATTERNS = [
  /--\s*\d+\s+of\s+\d+\s*--/i,
  /이 문제지에 관한 저작권/,
  /이제 듣기 문제가 끝났습니다/,
  /\*?\s*확인 사항/,
  /\[\d{2}\s*[~～－-]\s*\d{2}\]\s*(?:다음|주어진|글의)/,
];
const MATH_FIGURE_BLOCKED_IDS = [
  "2022_06_common_4",
  "2023_06_common_4",
  "2023_09_cal_27",
  "2024_09_common_4",
  "2024_09_sta_24",
  "2025_06_common_4",
  "2025_09_common_4",
];
const MATH_REQUIRED_FIGURE_MANIFEST_FILENAME =
  "math_required_figures_v1.json";
const MATH_REQUIRED_FIGURE_SOURCE_HASHES = new Map([
  ["2022_06_common_4", MATH_VERIFIED_SOURCE_HASHES.problemSha256],
  ["2023_06_common_4", MATH_2023_06_VERIFIED_SOURCE_HASHES.problemSha256],
  ["2023_09_cal_27", MATH_2023_09_VERIFIED_SOURCE_HASHES.problemSha256],
  ["2024_09_common_4", MATH_2024_09_VERIFIED_SOURCE_HASHES.problemSha256],
  ["2024_09_sta_24", MATH_2024_09_VERIFIED_SOURCE_HASHES.problemSha256],
  ["2025_06_common_4", MATH_2025_06_VERIFIED_SOURCE_HASHES.problemSha256],
  ["2025_09_common_4", MATH_2025_09_VERIFIED_SOURCE_HASHES.problemSha256],
]);
const MATH_REQUIRED_FIGURE_SOURCE_PAGES = new Map([
  ["2022_06_common_4", 1],
  ["2023_06_common_4", 1],
  ["2023_09_cal_27", 15],
  ["2024_09_common_4", 1],
  ["2024_09_sta_24", 9],
  ["2025_06_common_4", 1],
  ["2025_09_common_4", 1],
]);
const MATH_REQUIRED_FIGURE_ASSETS = new Map([
  [
    "2022_06_common_4",
    {
      path: "평가원_수학영어_확장/08_math_data/assets/required_figures/2022_06_common_4.png",
      sha256:
        "5863e5d9e278eb230b54c9909336cae6a61dc5c2c66178a5bee28acbf58f4a36",
    },
  ],
  [
    "2023_06_common_4",
    {
      path: "평가원_수학영어_확장/08_math_data/assets/required_figures/2023_06_common_4.png",
      sha256:
        "4027f38a771046c221fca9b60492740fb357ef8523961e766e9fd21bc503b840",
    },
  ],
  [
    "2023_09_cal_27",
    {
      path: "평가원_수학영어_확장/08_math_data/assets/required_figures/2023_09_cal_27.png",
      sha256:
        "cf013a495bc67c3f4bf3fcc088d9be1cb2d6deddfa0efc8049dcd43a448f80c9",
    },
  ],
  [
    "2024_09_common_4",
    {
      path: "평가원_수학영어_확장/08_math_data/assets/required_figures/2024_09_common_4.png",
      sha256:
        "9b503b8f6bf2dbfa2a222895b2d12f823003db51244544e16beb077fd9a2a1bb",
    },
  ],
  [
    "2024_09_sta_24",
    {
      path: "평가원_수학영어_확장/08_math_data/assets/required_figures/2024_09_sta_24.png",
      sha256:
        "9a37fdfd7fbcb77d4531ac7eeb22e1fe3dcf467a204945f312e2ff56d75444fb",
    },
  ],
  [
    "2025_06_common_4",
    {
      path: "평가원_수학영어_확장/08_math_data/assets/required_figures/2025_06_common_4.png",
      sha256:
        "8bd667a8e21de7a010b504782451f5844887b4fc77d97f1f450b85faf7ae7410",
    },
  ],
  [
    "2025_09_common_4",
    {
      path: "평가원_수학영어_확장/08_math_data/assets/required_figures/2025_09_common_4.png",
      sha256:
        "b57fc758f2a5bdbaeabd10b31bd093ba840a2308af948c0051319dd2bf03a5f2",
    },
  ],
]);
const MATH_FIGURE_DESCRIPTION_IDS = [
  "2022_06_common_12",
  "2022_06_cal_26",
  "2022_06_cal_28",
  "2022_06_geo_26",
  "2022_06_geo_27",
  "2022_06_geo_28",
  "2022_06_geo_29",
  "2022_09_common_10",
  "2022_09_common_12",
  "2022_09_common_21",
  "2022_09_cal_26",
  "2022_09_cal_27",
  "2022_09_cal_28",
  "2022_09_geo_26",
  "2022_09_geo_27",
  "2022_09_geo_28",
  "2022_09_geo_29",
  "2023_06_common_10",
  "2023_06_common_13",
  "2023_06_cal_26",
  "2023_06_cal_29",
  "2023_06_geo_26",
  "2023_06_geo_27",
  "2023_06_geo_29",
  "2023_06_geo_30",
  "2023_09_common_12",
  "2023_09_common_13",
  "2023_09_common_21",
  "2023_09_cal_26",
  "2023_09_cal_28",
  "2023_09_cal_29",
  "2023_09_geo_25",
  "2023_09_geo_27",
  "2023_09_geo_28",
  "2023_09_geo_29",
  "2024_06_common_10",
  "2024_06_common_11",
  "2024_06_common_13",
  "2024_06_geo_25",
  "2024_06_geo_29",
  "2024_06_geo_30",
  "2024_09_common_20",
  "2024_09_cal_30",
  "2024_09_geo_26",
  "2024_09_geo_28",
  "2025_06_common_12",
  "2025_06_common_13",
  "2025_06_cal_26",
  "2025_06_geo_27",
  "2025_09_common_10",
  "2025_09_cal_26",
  "2025_09_geo_27",
  "2025_09_geo_28",
  "2025_09_geo_29",
  "2025_09_geo_30",
];
const MATH_FIGURE_DECORATIVE_IDS = [
  "2022_06_sta_29",
  "2022_06_sta_30",
  "2022_09_sta_26",
  "2023_06_sta_24",
  "2023_09_sta_26",
  "2023_09_sta_29",
  "2024_06_sta_29",
  "2024_06_sta_30",
  "2024_09_sta_28",
  "2024_09_sta_29",
  "2025_06_sta_27",
  "2025_06_sta_28",
];
const ENGLISH_SESSION_NUMBER_GROUPS = [
  [19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28],
  [29, 30, 31, 32, 33],
  [34, 35, 36, 37, 38],
  [36, 37, 38, 39, 40],
  [41, 42, 43, 44, 45],
];
const MATH_SESSION_EXAMS = [
  "2022_06",
  "2022_09",
  "2023_06",
  "2023_09",
  "2024_06",
  "2024_09",
  "2025_06",
  "2025_09",
];
const MATH_PUBLIC_EXAM_KEYS = MATH_SESSION_EXAMS.map(
  (examKey) => `math_${examKey}`,
);
const MATH_ANSWER_CROSSCHECK_EXAMS = [
  "math_2022_csat",
  "math_2023_csat",
  "math_2024_csat",
  "math_2025_csat",
  "math_2026_06",
  "math_2026_09",
  "math_2026_csat",
];
const MATH_SESSION_TRACKS = ["common", "cal", "sta", "geo"];
const SKIP_DIRECTORIES = new Set([".git", "dist", "node_modules"]);
const FORBIDDEN_PUBLIC_KEYS = new Set([
  "answerCrossCheck",
  "answerSource",
  "confidence",
  "coreConcepts",
  "difficultyLevel",
  "examKey",
  "extraction",
  "figureDesc",
  "hasFigure",
  "logicFlow",
  "meta",
  "metaSource",
  "notes",
  "pitfalls",
  "publicConnected",
  "questionFingerprint",
  "rawText",
  "source",
  "sourceArtifacts",
  "sourceIssue",
  "sourcePage",
  "status",
  "verification",
  "verifiedAt",
]);

function findFile(directory, filename) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === filename) return entryPath;
    if (entry.isDirectory()) {
      const found = findFile(entryPath, filename);
      if (found) return found;
    }
  }
  return null;
}

function findFileBySha256(directory, expectedSha256, extension) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (
      entry.isFile() &&
      path.extname(entry.name).toLowerCase() === extension &&
      fileSha256(entryPath) === expectedSha256
    ) {
      return entryPath;
    }
    if (entry.isDirectory()) {
      const found = findFileBySha256(entryPath, expectedSha256, extension);
      if (found) return found;
    }
  }
  return null;
}

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function readJson(filePath, label) {
  if (!filePath || !existsSync(filePath)) fail("SOURCE_MISSING", label);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function fileSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readPngDimensions(filePath, id) {
  const bytes = readFileSync(filePath);
  const pngSignature = "89504e470d0a1a0a";
  if (
    bytes.length < 24 ||
    bytes.subarray(0, 8).toString("hex") !== pngSignature ||
    bytes.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    fail("MATH_REQUIRED_FIGURE_PNG", id);
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function answerMark(answer) {
  return ["①", "②", "③", "④", "⑤"][Number(answer) - 1] ?? null;
}

function contentFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requireText(value, code, detail) {
  if (typeof value !== "string" || !value.trim()) fail(code, detail);
}

function validateMathVerifiedSolutionSet({
  mathDbPath,
  mathDb,
  sourceDirectory,
  filename,
  expectedIds,
  expectedProblemPages,
  expectedSourceHashes = MATH_VERIFIED_SOURCE_HASHES,
  verifiedAt,
}) {
  const solutionPath = path.join(path.dirname(mathDbPath), filename);
  const database = readJson(solutionPath, filename);
  const metadata = database.metadata;
  if (metadata?.schemaVersion !== "math-verified-solution-v1") {
    fail("MATH_SOLUTION_SCHEMA", String(metadata?.schemaVersion));
  }
  if (
    metadata.status !== "internal_verified_candidate" ||
    metadata.publicConnected !== false
  ) {
    fail("MATH_SOLUTION_BOUNDARY", metadata.status);
  }
  if (
    metadata.itemCount !== expectedIds.length ||
    metadata.readyCount !== expectedIds.length
  ) {
    fail(
      "MATH_SOLUTION_METADATA_COUNT",
      `${metadata.itemCount}/${metadata.readyCount}`,
    );
  }
  if (metadata.verifiedAt !== verifiedAt) {
    fail("MATH_SOLUTION_VERIFIED_AT", String(metadata.verifiedAt));
  }
  for (const [key, expected] of Object.entries(expectedSourceHashes)) {
    if (metadata.sourceArtifacts?.[key] !== expected) {
      fail("MATH_SOLUTION_SOURCE_HASH", key);
    }
  }
  requireText(
    metadata.sourceArtifacts?.archiveUrl,
    "MATH_SOLUTION_SOURCE_URL",
    "archiveUrl",
  );
  const independentSourceUrls = metadata.sourceArtifacts?.independentSourceUrls;
  if (
    independentSourceUrls !== undefined &&
    (!Array.isArray(independentSourceUrls) ||
      independentSourceUrls.length < 2 ||
      new Set(independentSourceUrls).size !== independentSourceUrls.length ||
      independentSourceUrls.some(
        (sourceUrl) =>
          typeof sourceUrl !== "string" || !sourceUrl.startsWith("https://"),
      ))
  ) {
    fail("MATH_SOLUTION_INDEPENDENT_SOURCES", filename);
  }
  const solutionSourceUrls = metadata.sourceArtifacts?.solutionSourceUrls;
  if (
    solutionSourceUrls !== undefined &&
    (!Array.isArray(solutionSourceUrls) ||
      solutionSourceUrls.length === 0 ||
      new Set(solutionSourceUrls).size !== solutionSourceUrls.length ||
      solutionSourceUrls.some(
        (sourceUrl) =>
          typeof sourceUrl !== "string" || !sourceUrl.startsWith("https://"),
      ))
  ) {
    fail("MATH_SOLUTION_EXPLANATION_SOURCES", filename);
  }
  const replicaArtifacts =
    metadata.sourceArtifacts?.problemReplicaArtifacts ?? [];
  if (
    !Array.isArray(replicaArtifacts) ||
    replicaArtifacts.some(
      (artifact) =>
        typeof artifact?.filename !== "string" ||
        !artifact.filename.trim() ||
        typeof artifact.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(artifact.sha256),
    ) ||
    new Set(replicaArtifacts.map((artifact) => artifact.filename)).size !==
      replicaArtifacts.length
  ) {
    fail("MATH_SOLUTION_REPLICA_ARTIFACTS", filename);
  }
  const solutionArtifacts = metadata.sourceArtifacts?.solutionArtifacts ?? [];
  if (
    !Array.isArray(solutionArtifacts) ||
    solutionArtifacts.some(
      (artifact) =>
        typeof artifact?.filename !== "string" ||
        !artifact.filename.trim() ||
        typeof artifact.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(artifact.sha256),
    ) ||
    new Set(solutionArtifacts.map((artifact) => artifact.filename)).size !==
      solutionArtifacts.length
  ) {
    fail("MATH_SOLUTION_EXPLANATION_ARTIFACTS", filename);
  }
  requireText(metadata.note, "MATH_SOLUTION_NOTE", "metadata");
  if (sourceDirectory) {
    const problemPath = findFile(
      sourceDirectory,
      metadata.sourceArtifacts.problemFilename,
    );
    const answerPath = findFile(
      sourceDirectory,
      metadata.sourceArtifacts.answerFilename,
    );
    if (!problemPath || !answerPath) {
      fail("MATH_SOLUTION_SOURCE_FILE", sourceDirectory);
    }
    if (fileSha256(problemPath) !== metadata.sourceArtifacts.problemSha256) {
      fail("MATH_SOLUTION_PROBLEM_HASH", problemPath);
    }
    if (fileSha256(answerPath) !== metadata.sourceArtifacts.answerSha256) {
      fail("MATH_SOLUTION_ANSWER_HASH", answerPath);
    }
    const replicaFilenames =
      metadata.sourceArtifacts.problemReplicaFilenames ?? [];
    if (
      replicaArtifacts.length === 0 &&
      independentSourceUrls !== undefined &&
      replicaFilenames.length !== independentSourceUrls.length
    ) {
      fail("MATH_SOLUTION_REPLICA_COUNT", filename);
    }
    for (const replicaFilename of replicaFilenames) {
      const replicaPath = findFile(sourceDirectory, replicaFilename);
      if (
        !replicaPath ||
        fileSha256(replicaPath) !== metadata.sourceArtifacts.problemSha256
      ) {
        fail("MATH_SOLUTION_PROBLEM_REPLICA_HASH", replicaFilename);
      }
    }
    for (const replicaArtifact of replicaArtifacts) {
      const replicaPath = findFile(sourceDirectory, replicaArtifact.filename);
      if (!replicaPath || fileSha256(replicaPath) !== replicaArtifact.sha256) {
        fail("MATH_SOLUTION_PROBLEM_REPLICA_HASH", replicaArtifact.filename);
      }
    }
    for (const solutionArtifact of solutionArtifacts) {
      const solutionArtifactPath = findFile(
        sourceDirectory,
        solutionArtifact.filename,
      );
      if (
        !solutionArtifactPath ||
        fileSha256(solutionArtifactPath) !== solutionArtifact.sha256
      ) {
        fail("MATH_SOLUTION_EXPLANATION_HASH", solutionArtifact.filename);
      }
    }
    const primaryAnswerImageFilename =
      metadata.sourceArtifacts.primaryAnswerImageFilename;
    if (primaryAnswerImageFilename) {
      const primaryAnswerImagePath = findFile(
        sourceDirectory,
        primaryAnswerImageFilename,
      );
      if (
        !primaryAnswerImagePath ||
        fileSha256(primaryAnswerImagePath) !==
          metadata.sourceArtifacts.primaryAnswerImageSha256
      ) {
        fail("MATH_SOLUTION_PRIMARY_ANSWER_HASH", primaryAnswerImageFilename);
      }
    }
  }

  const questionsById = new Map(
    mathDb.questions.map((question) => [question.id, question]),
  );
  const sourceQuestions = expectedIds.map((id) => {
    const question = questionsById.get(id);
    if (!question) fail("MATH_SOLUTION_SOURCE_QUESTION", id);
    return {
      id: question.id,
      problem: question.problem_latex,
      choices: question.choices,
      answer: question.answer,
      answerType: question.answerType,
      answerCrossCheck: question.answerCrossCheck,
    };
  });
  const questionFingerprint = contentFingerprint(sourceQuestions);
  if (metadata.questionFingerprint !== questionFingerprint) {
    fail(
      "MATH_SOLUTION_QUESTION_FINGERPRINT",
      `${questionFingerprint} != ${metadata.questionFingerprint}`,
    );
  }

  const itemIds = Object.keys(database.items ?? {});
  if (stableJson(itemIds) !== stableJson(expectedIds)) {
    fail("MATH_SOLUTION_IDS", itemIds.join(","));
  }

  const items = expectedIds.map((id) => {
    const item = database.items[id];
    const question = questionsById.get(id);
    if (item?.id !== id || item.status !== "verified_internal_candidate") {
      fail("MATH_SOLUTION_ITEM_STATUS", id);
    }
    if (question.answerCrossCheck !== "full") {
      fail("MATH_SOLUTION_ANSWER_CROSS_CHECK", id);
    }
    const expectedAnswerMark =
      question.answerType === "choice" ? answerMark(question.answer) : null;
    if (
      Number(item.answer) !== Number(question.answer) ||
      item.answerMark !== expectedAnswerMark
    ) {
      fail("MATH_SOLUTION_ANSWER", id);
    }
    const expectedFigureAsset = MATH_REQUIRED_FIGURE_ASSETS.get(id);
    if (expectedFigureAsset) {
      const assetPath = path.join(ROOT, expectedFigureAsset.path);
      if (
        item.figureAsset !== expectedFigureAsset.path ||
        item.figureAssetSha256 !== expectedFigureAsset.sha256 ||
        item.figureAlt !== question.figureDesc ||
        !existsSync(assetPath) ||
        fileSha256(assetPath) !== expectedFigureAsset.sha256
      ) {
        fail("MATH_SOLUTION_FIGURE_ASSET", id);
      }
      requireText(item.figureAlt, "MATH_SOLUTION_FIGURE_ALT", id);
    } else if (
      Object.hasOwn(item, "figureAsset") ||
      Object.hasOwn(item, "figureAssetSha256") ||
      Object.hasOwn(item, "figureAlt")
    ) {
      fail("MATH_SOLUTION_UNAPPROVED_FIGURE_ASSET", id);
    }
    if (Object.hasOwn(item, "publicBlockedByFigureAsset")) {
      fail("MATH_SOLUTION_FIGURE_PUBLIC_BOUNDARY", id);
    }
    const expectedQuestionNumber = Number(id.split("_").at(-1));
    if (item.questionNumber !== expectedQuestionNumber) {
      fail("MATH_SOLUTION_QUESTION_NUMBER", id);
    }
    requireText(item.exam, "MATH_SOLUTION_EXAM", id);
    requireText(item.summary, "MATH_SOLUTION_SUMMARY", id);
    requireText(item.approach, "MATH_SOLUTION_APPROACH", id);
    requireText(item.correctReason, "MATH_SOLUTION_REASON", id);
    requireText(item.commonMistake, "MATH_SOLUTION_MISTAKE", id);
    const narrativeFields = {
      summary: item.summary,
      approach: item.approach,
      correctReason: item.correctReason,
      commonMistake: item.commonMistake,
    };
    for (const [field, text] of Object.entries(narrativeFields)) {
      if (text.trim().length < MATH_SOLUTION_MIN_NARRATIVE_LENGTH) {
        fail("MATH_SOLUTION_NARRATIVE_DEPTH", `${id}:${field}`);
      }
      if (MATH_SOLUTION_DRAFT_PATTERN.test(text)) {
        fail("MATH_SOLUTION_DRAFT_MARKER", `${id}:${field}`);
      }
    }
    if (
      new Set(Object.values(narrativeFields)).size !==
      Object.keys(narrativeFields).length
    ) {
      fail("MATH_SOLUTION_NARRATIVE_DUPLICATE", id);
    }
    if (expectedAnswerMark !== null) {
      const answerMarks = item.correctReason.match(/[①②③④⑤]/g) ?? [];
      if (
        !answerMarks.includes(expectedAnswerMark) ||
        answerMarks.some((mark) => mark !== expectedAnswerMark)
      ) {
        fail("MATH_SOLUTION_REASON_ANSWER", id);
      }
    } else if (!item.correctReason.includes(String(question.answer))) {
      fail("MATH_SOLUTION_REASON_ANSWER", id);
    }
    if (
      !Array.isArray(item.concepts) ||
      item.concepts.length < 2 ||
      item.concepts.some((concept) => !String(concept).trim()) ||
      new Set(item.concepts).size !== item.concepts.length
    ) {
      fail("MATH_SOLUTION_CONCEPTS", id);
    }
    if (!Array.isArray(item.steps) || item.steps.length < 2) {
      fail("MATH_SOLUTION_STEPS", id);
    }
    if (
      new Set(item.steps.map((step) => step?.title)).size !== item.steps.length
    ) {
      fail("MATH_SOLUTION_STEP_TITLES", id);
    }
    item.steps.forEach((step, index) => {
      requireText(step?.title, "MATH_SOLUTION_STEP_TITLE", `${id}:${index}`);
      requireText(
        step?.expression,
        "MATH_SOLUTION_STEP_EXPRESSION",
        `${id}:${index}`,
      );
      try {
        katex.renderToString(step.expression, {
          output: "mathml",
          strict: "ignore",
          throwOnError: true,
        });
      } catch {
        fail("MATH_SOLUTION_STEP_LATEX", `${id}:${index}`);
      }
      requireText(
        step?.explanation,
        "MATH_SOLUTION_STEP_EXPLANATION",
        `${id}:${index}`,
      );
      if (
        MATH_SOLUTION_DRAFT_PATTERN.test(
          `${step.title} ${step.expression} ${step.explanation}`,
        )
      ) {
        fail("MATH_SOLUTION_STEP_DRAFT_MARKER", `${id}:${index}`);
      }
    });
    const verification = item.verification;
    if (
      verification?.problemPage !== expectedProblemPages.get(id) ||
      verification?.answerTablePage !== 1 ||
      verification?.problemMatchedPdf !== true ||
      verification?.choicesMatchedPdf !== true ||
      verification?.answerMatchedPdf !== true ||
      verification?.independentDerivation !== true
    ) {
      fail("MATH_SOLUTION_VERIFICATION", id);
    }
    return item;
  });

  const serialized = stableJson(database);
  if (serialized.includes("ProbDex") || serialized.includes("AI생성-미검증")) {
    fail("MATH_SOLUTION_UNVERIFIED_SOURCE_LEAK", solutionPath);
  }
  return items;
}

function validateMathSourceCorrections({
  mathDbPath,
  mathDb,
  filename,
  expectedIds,
  expectedProblemPages,
  expectedIssueCodes,
  expectedSourceHashes,
}) {
  const correctionPath = path.join(path.dirname(mathDbPath), filename);
  const database = readJson(correctionPath, filename);
  const metadata = database.metadata;
  if (
    metadata?.schemaVersion !== "math-source-correction-v1" ||
    metadata.status !== "internal_source_corrected" ||
    metadata.publicConnected !== false ||
    metadata.itemCount !== expectedIds.length ||
    metadata.verifiedAt !== "2026-08-05"
  ) {
    fail("MATH_SOURCE_CORRECTION_METADATA", correctionPath);
  }
  for (const [key, expected] of Object.entries(expectedSourceHashes)) {
    if (metadata.sourceArtifacts?.[key] !== expected) {
      fail("MATH_SOURCE_CORRECTION_SOURCE_HASH", key);
    }
  }

  const questionsById = new Map(
    mathDb.questions.map((question) => [question.id, question]),
  );
  const sourceQuestions = expectedIds.map((id) => {
    const question = questionsById.get(id);
    if (!question) fail("MATH_SOURCE_CORRECTION_QUESTION", id);
    return {
      id: question.id,
      problem: question.problem_latex,
      choices: question.choices,
      answer: question.answer,
      answerType: question.answerType,
      answerCrossCheck: question.answerCrossCheck,
    };
  });
  const questionFingerprint = contentFingerprint(sourceQuestions);
  if (metadata.questionFingerprint !== questionFingerprint) {
    fail(
      "MATH_SOURCE_CORRECTION_FINGERPRINT",
      `${questionFingerprint} != ${metadata.questionFingerprint}`,
    );
  }
  if (
    stableJson(Object.keys(database.items ?? {})) !== stableJson(expectedIds)
  ) {
    fail(
      "MATH_SOURCE_CORRECTION_IDS",
      Object.keys(database.items ?? {}).join(","),
    );
  }

  for (const id of expectedIds) {
    const item = database.items[id];
    const question = questionsById.get(id);
    let sourceStateMatches = false;
    if (item?.correctionApplied === "problem_latex") {
      sourceStateMatches =
        question.problem_latex.includes(item.officialTextFragment) &&
        !question.problem_latex.includes(item.previousDbTextFragment);
    } else if (item?.correctionApplied === "choices") {
      const choice = question.choices.find(
        (candidate) => candidate.num === item.choiceNumber,
      );
      sourceStateMatches =
        choice?.latex === item.officialTextFragment &&
        choice.latex !== item.previousDbTextFragment;
    }
    if (item?.additionalCorrectedFields) {
      const expectedFields = ["figureDesc", "notes"];
      if (
        stableJson(item.additionalCorrectedFields) !== stableJson(expectedFields) ||
        !expectedFields.every(
          (field) =>
            typeof question[field] === "string" &&
            question[field].includes("반원") &&
            !question[field].includes("정사각형"),
        )
      ) {
        sourceStateMatches = false;
      }
    }
    if (
      item?.id !== id ||
      item.status !== "source_integrity_corrected" ||
      item.issueCode !== expectedIssueCodes.get(id) ||
      !sourceStateMatches ||
      item.verification?.problemPage !== expectedProblemPages.get(id) ||
      item.verification?.problemMatchedPdf !== true ||
      item.verification?.sourceDifferenceConfirmed !== true ||
      item.verification?.correctionAppliedToDatabase !== true ||
      item.verification?.releaseBlocked !== false
    ) {
      fail("MATH_SOURCE_CORRECTION_STATE", id);
    }
    requireText(
      item.previousDbTextFragment,
      "MATH_SOURCE_CORRECTION_PREVIOUS",
      id,
    );
    requireText(
      item.officialTextFragment,
      "MATH_SOURCE_CORRECTION_OFFICIAL",
      id,
    );
    requireText(item.reason, "MATH_SOURCE_CORRECTION_REASON", id);
  }
}

function validateMathAnswerCrosscheck(mathDb) {
  const manifest = readJson(
    MATH_ANSWER_CROSSCHECK_PATH,
    "math_answer_crosscheck_v1.json",
  );
  const expectedExamKeys = [...MATH_ANSWER_CROSSCHECK_EXAMS].sort();
  const actualExamKeys = Object.keys(manifest.exams ?? {}).sort();
  if (
    manifest.schemaVersion !== 1 ||
    manifest.status !== "verified_internal" ||
    manifest.scope?.examCount !== 7 ||
    manifest.scope?.questionCount !== 322 ||
    manifest.scope?.answerCrossCheck !== "full" ||
    manifest.scope?.answerFingerprint !==
      MATH_ANSWER_CROSSCHECK_FINGERPRINT ||
    manifest.scope?.publicConnected !== false ||
    manifest.scope?.verifiedSolutionCount !== 0
  ) {
    fail("MATH_ANSWER_CROSSCHECK_METADATA", "scope");
  }
  if (stableJson(actualExamKeys) !== stableJson(expectedExamKeys)) {
    fail("MATH_ANSWER_CROSSCHECK_EXAMS", actualExamKeys.join(","));
  }
  if (
    manifest.method?.primary !== "KICE official answer table PDF" ||
    !String(manifest.method?.secondary ?? "").trim() ||
    !String(manifest.method?.acceptanceRule ?? "").trim() ||
    manifest.method?.choiceForm !== "odd"
  ) {
    fail("MATH_ANSWER_CROSSCHECK_METHOD", "invalid");
  }
  if (
    manifest.sourceBoardUrls?.csat !==
      "https://www.suneung.re.kr/boardCnts/list.do?boardID=1500234&m=0403&s=suneung" ||
    manifest.sourceBoardUrls?.mock !==
      "https://www.suneung.re.kr/boardCnts/list.do?boardID=1500236&m=0403&s=suneung"
  ) {
    fail("MATH_ANSWER_CROSSCHECK_BOARD", "invalid");
  }
  const answerFingerprint = contentFingerprint(
    expectedExamKeys.map((examKey) => ({
      examKey,
      answers: manifest.exams[examKey].answers,
    })),
  );
  if (answerFingerprint !== MATH_ANSWER_CROSSCHECK_FINGERPRINT) {
    fail("MATH_ANSWER_CROSSCHECK_FINGERPRINT", answerFingerprint);
  }

  const sourceFiles = expectedExamKeys.map((examKey) => {
    const item = manifest.exams[examKey];
    const expectedRelativePath = path.posix.join(
      "raw_sources",
      "math_answer_pdfs",
      `${examKey}_official_answer.pdf`,
    );
    if (
      item?.officialFile !== expectedRelativePath ||
      !/^https:\/\/www\.suneung\.re\.kr\/boardCnts\/fileDown\.do\?fileSeq=[a-f0-9]{32}$/.test(
        item.officialDownloadUrl,
      ) ||
      !/^[a-f0-9]{64}$/.test(item.officialFileSha256) ||
      !String(item.independentSource ?? "").trim()
    ) {
      fail("MATH_ANSWER_CROSSCHECK_SOURCE", examKey);
    }
    return {
      examKey,
      path: path.join(ROOT, ...item.officialFile.split("/")),
      sha256: item.officialFileSha256,
    };
  });
  const sourcePresence = sourceFiles.map((item) => existsSync(item.path));
  if (sourcePresence.some(Boolean) && !sourcePresence.every(Boolean)) {
    fail(
      "MATH_ANSWER_CROSSCHECK_SOURCE_SET",
      sourceFiles
        .filter((_, index) => !sourcePresence[index])
        .map((item) => item.examKey)
        .join(","),
    );
  }
  if (sourcePresence.every(Boolean)) {
    for (const item of sourceFiles) {
      if (fileSha256(item.path) !== item.sha256) {
        fail("MATH_ANSWER_CROSSCHECK_SOURCE_HASH", item.examKey);
      }
    }
  }

  let verifiedQuestionCount = 0;
  for (const examKey of expectedExamKeys) {
    const manifestExam = manifest.exams[examKey];
    const examQuestions = mathDb.questions.filter(
      (question) => question.examKey === examKey,
    );
    if (examQuestions.length !== 46) {
      fail(
        "MATH_ANSWER_CROSSCHECK_EXAM_COUNT",
        `${examKey}:${examQuestions.length}`,
      );
    }
    for (const track of ["common", "sta", "cal", "geo"]) {
      const questions = examQuestions
        .filter((question) => question.track === track)
        .sort((left, right) => left.qid - right.qid);
      const answers = manifestExam.answers?.[track];
      const expectedCount = track === "common" ? 22 : 8;
      if (
        questions.length !== expectedCount ||
        !Array.isArray(answers) ||
        answers.length !== expectedCount
      ) {
        fail(
          "MATH_ANSWER_CROSSCHECK_TRACK_COUNT",
          `${examKey}:${track}`,
        );
      }
      questions.forEach((question, index) => {
        if (String(question.answer) !== String(answers[index])) {
          fail("MATH_ANSWER_CROSSCHECK_VALUE", question.id);
        }
        if (
          question.answerCrossCheck !== "full" ||
          question.answerSource !== MATH_VERIFIED_ANSWER_SOURCE
        ) {
          fail("MATH_ANSWER_CROSSCHECK_STATE", question.id);
        }
        if (
          question.answerType === "choice" &&
          (!Number.isInteger(Number(question.answer)) ||
            Number(question.answer) < 1 ||
            Number(question.answer) > 5)
        ) {
          fail("MATH_ANSWER_CROSSCHECK_CHOICE", question.id);
        }
        if (
          question.answerType === "short" &&
          (typeof question.answer !== "string" ||
            !/^\d+$/.test(question.answer))
        ) {
          fail("MATH_ANSWER_CROSSCHECK_SHORT", question.id);
        }
        verifiedQuestionCount += 1;
      });
    }
  }
  if (verifiedQuestionCount !== 322) {
    fail("MATH_ANSWER_CROSSCHECK_TOTAL", String(verifiedQuestionCount));
  }
  return sourcePresence.every(Boolean) ? "verified" : "recorded";
}

function validateMathVerifiedCoverage(mathDb) {
  const fullAnswerIds = mathDb.questions
    .filter((question) => question.answerCrossCheck === "full")
    .map((question) => question.id)
    .sort();
  const verifiedSolutionSourceQuestions = mathDb.questions.filter((question) =>
    MATH_PUBLIC_EXAM_KEYS.includes(question.examKey),
  );
  const verifiedSolutionSourceIds = verifiedSolutionSourceQuestions
    .map((question) => question.id)
    .sort();
  const internalIds = MATH_INTERNAL_VERIFIED_ID_GROUPS.flat();
  const sourceCorrectionIds = MATH_SOURCE_CORRECTION_ID_GROUPS.flat();
  const classifiedIds = [...MATH_FREE_IDS, ...internalIds];
  const duplicateIds = classifiedIds.filter(
    (id, index) => classifiedIds.indexOf(id) !== index,
  );

  if (
    mathDb.questions.length !== 690 ||
    fullAnswerIds.length !== 690 ||
    new Set(fullAnswerIds).size !== 690
  ) {
    fail(
      "MATH_VERIFIED_ANSWER_COVERAGE_COUNT",
      String(fullAnswerIds.length),
    );
  }
  if (
    verifiedSolutionSourceIds.length !== 368 ||
    verifiedSolutionSourceQuestions.some(
      (question) => question.answerCrossCheck !== "full",
    )
  ) {
    fail(
      "MATH_VERIFIED_SOLUTION_SOURCE_COUNT",
      String(verifiedSolutionSourceIds.length),
    );
  }
  if (
    MATH_FREE_IDS.length !== 5 ||
    internalIds.length !== 363 ||
    sourceCorrectionIds.length !== 13
  ) {
    fail(
      "MATH_VERIFIED_COVERAGE_CLASS_COUNTS",
      `${MATH_FREE_IDS.length}/${internalIds.length}/${sourceCorrectionIds.length}`,
    );
  }
  if (duplicateIds.length > 0) {
    fail(
      "MATH_VERIFIED_COVERAGE_DUPLICATE",
      [...new Set(duplicateIds)].join(","),
    );
  }
  const internalSet = new Set(internalIds);
  const invalidCorrectionIds = sourceCorrectionIds.filter(
    (id, index) =>
      sourceCorrectionIds.indexOf(id) !== index || !internalSet.has(id),
  );
  if (invalidCorrectionIds.length > 0) {
    fail(
      "MATH_VERIFIED_COVERAGE_CORRECTIONS",
      [...new Set(invalidCorrectionIds)].join(","),
    );
  }
  if (
    stableJson(classifiedIds.sort()) !==
    stableJson(verifiedSolutionSourceIds)
  ) {
    const classifiedSet = new Set(classifiedIds);
    const solutionSourceSet = new Set(verifiedSolutionSourceIds);
    const missing = verifiedSolutionSourceIds.filter(
      (id) => !classifiedSet.has(id),
    );
    const extra = classifiedIds.filter((id) => !solutionSourceSet.has(id));
    fail(
      "MATH_VERIFIED_COVERAGE_IDS",
      `missing=${missing.join(",")};extra=${extra.join(",")}`,
    );
  }
}

function validateMathVerifiedSolutions(mathDbPath, mathDb, sourceDirectory) {
  const publicItems = validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_FREE_IDS,
    expectedProblemPages: new Map([
      ["2022_06_common_1", 1],
      ["2022_06_common_2", 1],
      ["2022_06_common_3", 1],
      ["2022_06_common_5", 2],
      ["2022_06_common_6", 2],
    ]),
    verifiedAt: "2026-08-04",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_FIGURE_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_FIGURE_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([["2022_06_common_4", 1]]),
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_06_common_7", 2],
      ["2022_06_common_8", 3],
      ["2022_06_common_9", 3],
      ["2022_06_common_10", 3],
      ["2022_06_common_11", 4],
    ]),
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_SECOND_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_06_common_12", 4],
      ["2022_06_common_13", 5],
      ["2022_06_common_14", 5],
      ["2022_06_common_15", 6],
      ["2022_06_common_16", 6],
    ]),
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_THIRD_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_THIRD_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_06_common_17", 6],
      ["2022_06_common_18", 7],
      ["2022_06_common_19", 7],
      ["2022_06_common_20", 7],
      ["2022_06_common_21", 8],
    ]),
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_FOURTH_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_FOURTH_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([["2022_06_common_22", 8]]),
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_STA_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_06_sta_23", 9],
      ["2022_06_sta_24", 9],
      ["2022_06_sta_25", 10],
      ["2022_06_sta_26", 10],
      ["2022_06_sta_27", 11],
    ]),
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_CAL_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_06_cal_23", 13],
      ["2022_06_cal_24", 13],
      ["2022_06_cal_25", 14],
      ["2022_06_cal_26", 14],
      ["2022_06_cal_27", 15],
    ]),
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_GEO_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_06_geo_23", 17],
      ["2022_06_geo_24", 17],
      ["2022_06_geo_25", 18],
      ["2022_06_geo_26", 18],
      ["2022_06_geo_27", 19],
    ]),
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_STA_ADVANCED_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_STA_ADVANCED_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_06_sta_28", 11],
      ["2022_06_sta_29", 12],
      ["2022_06_sta_30", 12],
    ]),
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_CAL_ADVANCED_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_CAL_ADVANCED_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_06_cal_28", 15],
      ["2022_06_cal_29", 16],
      ["2022_06_cal_30", 16],
    ]),
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_GEO_ADVANCED_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_GEO_ADVANCED_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_06_geo_28", 19],
      ["2022_06_geo_29", 20],
      ["2022_06_geo_30", 20],
    ]),
    verifiedAt: "2026-08-05",
  });

  validateMathSourceCorrections({
    mathDbPath,
    mathDb,
    filename: MATH_SOURCE_CORRECTION_FILENAME,
    expectedIds: MATH_SOURCE_CORRECTION_IDS,
    expectedProblemPages: new Map([["2022_06_cal_29", 16]]),
    expectedIssueCodes: new Map([
      ["2022_06_cal_29", "problem_text_missing_symbol"],
    ]),
    expectedSourceHashes: MATH_VERIFIED_SOURCE_HASHES,
  });

  return publicItems;
}

function validateMath2022SeptemberVerifiedSolutions(
  mathDbPath,
  mathDb,
  sourceDirectory,
) {
  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2022_09_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2022_09_FIRST_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_09_common_1", 1],
      ["2022_09_common_2", 1],
      ["2022_09_common_3", 1],
      ["2022_09_common_4", 1],
      ["2022_09_common_5", 2],
    ]),
    expectedSourceHashes: MATH_2022_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2022_09_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2022_09_SECOND_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_09_common_6", 2],
      ["2022_09_common_7", 2],
      ["2022_09_common_8", 3],
      ["2022_09_common_9", 3],
    ]),
    expectedSourceHashes: MATH_2022_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  const internalItems = validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2022_09_THIRD_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2022_09_THIRD_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_09_common_13", 5],
      ["2022_09_common_14", 5],
      ["2022_09_common_15", 6],
      ["2022_09_common_16", 6],
      ["2022_09_common_17", 6],
      ["2022_09_common_18", 7],
      ["2022_09_common_19", 7],
    ]),
    expectedSourceHashes: MATH_2022_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2022_09_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2022_09_STA_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_09_sta_23", 9],
      ["2022_09_sta_24", 9],
      ["2022_09_sta_25", 10],
      ["2022_09_sta_27", 11],
      ["2022_09_sta_28", 11],
      ["2022_09_sta_29", 12],
      ["2022_09_sta_30", 12],
    ]),
    expectedSourceHashes: MATH_2022_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2022_09_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2022_09_CAL_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_09_cal_23", 13],
      ["2022_09_cal_24", 13],
      ["2022_09_cal_25", 14],
      ["2022_09_cal_29", 16],
      ["2022_09_cal_30", 16],
    ]),
    expectedSourceHashes: MATH_2022_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2022_09_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2022_09_GEO_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_09_geo_23", 17],
      ["2022_09_geo_24", 17],
      ["2022_09_geo_25", 18],
      ["2022_09_geo_30", 20],
    ]),
    expectedSourceHashes: MATH_2022_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2022_09_REMAINING_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2022_09_REMAINING_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2022_09_common_10", 3],
      ["2022_09_common_11", 4],
      ["2022_09_common_12", 4],
      ["2022_09_common_20", 7],
      ["2022_09_common_21", 8],
      ["2022_09_common_22", 8],
      ["2022_09_sta_26", 10],
      ["2022_09_cal_26", 14],
      ["2022_09_cal_27", 15],
      ["2022_09_cal_28", 15],
      ["2022_09_geo_26", 18],
      ["2022_09_geo_27", 19],
      ["2022_09_geo_28", 19],
      ["2022_09_geo_29", 20],
    ]),
    expectedSourceHashes: MATH_2022_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathSourceCorrections({
    mathDbPath,
    mathDb,
    filename: MATH_2022_09_SOURCE_CORRECTION_FILENAME,
    expectedIds: MATH_2022_09_SOURCE_CORRECTION_IDS,
    expectedProblemPages: new Map([["2022_09_common_11", 4]]),
    expectedIssueCodes: new Map([
      ["2022_09_common_11", "problem_text_grouping_error"],
    ]),
    expectedSourceHashes: MATH_2022_09_VERIFIED_SOURCE_HASHES,
  });

  return internalItems;
}

function validateMath2023JuneVerifiedSolutions(
  mathDbPath,
  mathDb,
  sourceDirectory,
) {
  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_06_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_06_FIRST_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_06_common_1", 1],
      ["2023_06_common_2", 1],
      ["2023_06_common_3", 1],
      ["2023_06_common_5", 2],
      ["2023_06_common_6", 2],
      ["2023_06_common_7", 2],
      ["2023_06_common_8", 3],
      ["2023_06_common_9", 3],
    ]),
    expectedSourceHashes: MATH_2023_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_06_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_06_SECOND_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_06_common_11", 4],
      ["2023_06_common_12", 4],
      ["2023_06_common_14", 5],
      ["2023_06_common_15", 6],
      ["2023_06_common_16", 6],
      ["2023_06_common_17", 6],
    ]),
    expectedSourceHashes: MATH_2023_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_06_THIRD_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_06_THIRD_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_06_common_18", 7],
      ["2023_06_common_19", 7],
      ["2023_06_common_20", 7],
      ["2023_06_common_21", 8],
      ["2023_06_common_22", 8],
    ]),
    expectedSourceHashes: MATH_2023_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_06_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_06_STA_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_06_sta_23", 9],
      ["2023_06_sta_25", 10],
      ["2023_06_sta_26", 10],
      ["2023_06_sta_27", 11],
      ["2023_06_sta_28", 11],
      ["2023_06_sta_29", 12],
      ["2023_06_sta_30", 12],
    ]),
    expectedSourceHashes: MATH_2023_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_06_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_06_CAL_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_06_cal_23", 13],
      ["2023_06_cal_24", 13],
      ["2023_06_cal_25", 14],
      ["2023_06_cal_27", 15],
      ["2023_06_cal_28", 15],
    ]),
    expectedSourceHashes: MATH_2023_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_06_CAL_ADVANCED_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_06_CAL_ADVANCED_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([["2023_06_cal_30", 16]]),
    expectedSourceHashes: MATH_2023_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_06_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_06_GEO_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_06_geo_23", 17],
      ["2023_06_geo_24", 17],
      ["2023_06_geo_25", 18],
      ["2023_06_geo_28", 19],
    ]),
    expectedSourceHashes: MATH_2023_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_06_REMAINING_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_06_REMAINING_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_06_common_4", 1],
      ["2023_06_common_10", 3],
      ["2023_06_common_13", 5],
      ["2023_06_sta_24", 9],
      ["2023_06_cal_26", 14],
      ["2023_06_cal_29", 16],
      ["2023_06_geo_26", 18],
      ["2023_06_geo_27", 19],
      ["2023_06_geo_29", 20],
      ["2023_06_geo_30", 20],
    ]),
    expectedSourceHashes: MATH_2023_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathSourceCorrections({
    mathDbPath,
    mathDb,
    filename: MATH_2023_06_SOURCE_CORRECTION_FILENAME,
    expectedIds: MATH_2023_06_SOURCE_CORRECTION_IDS,
    expectedProblemPages: new Map([
      ["2023_06_common_6", 2],
      ["2023_06_common_19", 7],
    ]),
    expectedIssueCodes: new Map([
      ["2023_06_common_6", "problem_text_missing_boundary_equality"],
      ["2023_06_common_19", "problem_text_grouping_error"],
    ]),
    expectedSourceHashes: MATH_2023_06_VERIFIED_SOURCE_HASHES,
  });
}

function validateMath2023SeptemberVerifiedSolutions(
  mathDbPath,
  mathDb,
  sourceDirectory,
) {
  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_09_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_09_FIRST_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_09_common_1", 1],
      ["2023_09_common_2", 1],
      ["2023_09_common_3", 1],
      ["2023_09_common_4", 2],
      ["2023_09_common_5", 2],
      ["2023_09_common_6", 2],
      ["2023_09_common_7", 2],
      ["2023_09_common_8", 3],
      ["2023_09_common_9", 3],
      ["2023_09_common_10", 3],
      ["2023_09_common_11", 4],
    ]),
    expectedSourceHashes: MATH_2023_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_09_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_09_SECOND_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_09_common_12", 4],
      ["2023_09_common_13", 4],
      ["2023_09_common_14", 5],
      ["2023_09_common_15", 6],
      ["2023_09_common_16", 6],
      ["2023_09_common_17", 6],
      ["2023_09_common_18", 7],
      ["2023_09_common_19", 7],
      ["2023_09_common_20", 7],
      ["2023_09_common_21", 8],
      ["2023_09_common_22", 8],
    ]),
    expectedSourceHashes: MATH_2023_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_09_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_09_STA_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_09_sta_23", 9],
      ["2023_09_sta_24", 9],
      ["2023_09_sta_25", 10],
      ["2023_09_sta_26", 10],
      ["2023_09_sta_27", 11],
      ["2023_09_sta_28", 11],
      ["2023_09_sta_29", 12],
      ["2023_09_sta_30", 12],
    ]),
    expectedSourceHashes: MATH_2023_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_09_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_09_CAL_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_09_cal_23", 13],
      ["2023_09_cal_24", 13],
      ["2023_09_cal_25", 14],
      ["2023_09_cal_26", 14],
      ["2023_09_cal_27", 15],
      ["2023_09_cal_28", 15],
      ["2023_09_cal_29", 16],
      ["2023_09_cal_30", 16],
    ]),
    expectedSourceHashes: MATH_2023_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2023_09_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2023_09_GEO_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2023_09_geo_23", 17],
      ["2023_09_geo_24", 17],
      ["2023_09_geo_25", 18],
      ["2023_09_geo_26", 18],
      ["2023_09_geo_27", 19],
      ["2023_09_geo_28", 19],
      ["2023_09_geo_29", 20],
      ["2023_09_geo_30", 20],
    ]),
    expectedSourceHashes: MATH_2023_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathSourceCorrections({
    mathDbPath,
    mathDb,
    filename: MATH_2023_09_SOURCE_CORRECTION_FILENAME,
    expectedIds: MATH_2023_09_SOURCE_CORRECTION_IDS,
    expectedProblemPages: new Map([
      ["2023_09_cal_25", 14],
      ["2023_09_geo_26", 18],
    ]),
    expectedIssueCodes: new Map([
      ["2023_09_cal_25", "problem_text_denominator_error"],
      ["2023_09_geo_26", "problem_text_missing_positive_condition"],
    ]),
    expectedSourceHashes: MATH_2023_09_VERIFIED_SOURCE_HASHES,
  });
}

function validateMath2024JuneVerifiedSolutions(
  mathDbPath,
  mathDb,
  sourceDirectory,
) {
  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2024_06_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2024_06_FIRST_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2024_06_common_1", 1],
      ["2024_06_common_2", 1],
      ["2024_06_common_3", 1],
      ["2024_06_common_4", 2],
      ["2024_06_common_5", 2],
      ["2024_06_common_6", 2],
      ["2024_06_common_7", 2],
      ["2024_06_common_8", 3],
      ["2024_06_common_9", 3],
      ["2024_06_common_10", 3],
      ["2024_06_common_11", 4],
    ]),
    expectedSourceHashes: MATH_2024_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2024_06_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2024_06_SECOND_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2024_06_common_12", 4],
      ["2024_06_common_13", 4],
      ["2024_06_common_14", 5],
      ["2024_06_common_15", 6],
      ["2024_06_common_16", 6],
      ["2024_06_common_17", 6],
      ["2024_06_common_18", 7],
      ["2024_06_common_19", 7],
      ["2024_06_common_20", 7],
      ["2024_06_common_21", 8],
      ["2024_06_common_22", 8],
    ]),
    expectedSourceHashes: MATH_2024_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2024_06_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2024_06_STA_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2024_06_sta_23", 9],
      ["2024_06_sta_24", 9],
      ["2024_06_sta_25", 10],
      ["2024_06_sta_26", 10],
      ["2024_06_sta_27", 11],
      ["2024_06_sta_28", 11],
      ["2024_06_sta_29", 12],
      ["2024_06_sta_30", 12],
    ]),
    expectedSourceHashes: MATH_2024_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2024_06_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2024_06_CAL_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2024_06_cal_23", 13],
      ["2024_06_cal_24", 13],
      ["2024_06_cal_25", 14],
      ["2024_06_cal_26", 14],
      ["2024_06_cal_27", 15],
      ["2024_06_cal_28", 15],
      ["2024_06_cal_29", 16],
      ["2024_06_cal_30", 16],
    ]),
    expectedSourceHashes: MATH_2024_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2024_06_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2024_06_GEO_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2024_06_geo_23", 17],
      ["2024_06_geo_24", 17],
      ["2024_06_geo_25", 18],
      ["2024_06_geo_26", 18],
      ["2024_06_geo_27", 19],
      ["2024_06_geo_28", 19],
      ["2024_06_geo_29", 20],
      ["2024_06_geo_30", 20],
    ]),
    expectedSourceHashes: MATH_2024_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathSourceCorrections({
    mathDbPath,
    mathDb,
    filename: MATH_2024_06_SOURCE_CORRECTION_FILENAME,
    expectedIds: MATH_2024_06_SOURCE_CORRECTION_IDS,
    expectedProblemPages: new Map([
      ["2024_06_common_18", 7],
      ["2024_06_common_22", 8],
    ]),
    expectedIssueCodes: new Map([
      ["2024_06_common_18", "problem_text_grouping_error"],
      ["2024_06_common_22", "problem_text_grouping_error"],
    ]),
    expectedSourceHashes: MATH_2024_06_VERIFIED_SOURCE_HASHES,
  });
}

function validateMath2024SeptemberVerifiedSolutions(
  mathDbPath,
  mathDb,
  sourceDirectory,
) {
  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2024_09_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2024_09_FIRST_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2024_09_common_1", 1],
      ["2024_09_common_2", 1],
      ["2024_09_common_3", 1],
      ["2024_09_common_4", 1],
      ["2024_09_common_5", 2],
      ["2024_09_common_6", 2],
      ["2024_09_common_7", 2],
      ["2024_09_common_8", 3],
      ["2024_09_common_9", 3],
      ["2024_09_common_10", 3],
      ["2024_09_common_11", 4],
    ]),
    expectedSourceHashes: MATH_2024_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2024_09_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2024_09_SECOND_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2024_09_common_12", 4],
      ["2024_09_common_13", 5],
      ["2024_09_common_14", 5],
      ["2024_09_common_15", 6],
      ["2024_09_common_16", 6],
      ["2024_09_common_17", 6],
      ["2024_09_common_18", 7],
      ["2024_09_common_19", 7],
      ["2024_09_common_20", 7],
      ["2024_09_common_21", 8],
      ["2024_09_common_22", 8],
    ]),
    expectedSourceHashes: MATH_2024_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2024_09_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2024_09_STA_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2024_09_sta_23", 9],
      ["2024_09_sta_24", 9],
      ["2024_09_sta_25", 10],
      ["2024_09_sta_26", 10],
      ["2024_09_sta_27", 11],
      ["2024_09_sta_28", 11],
      ["2024_09_sta_29", 12],
      ["2024_09_sta_30", 12],
    ]),
    expectedSourceHashes: MATH_2024_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2024_09_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2024_09_CAL_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2024_09_cal_23", 13],
      ["2024_09_cal_24", 13],
      ["2024_09_cal_25", 14],
      ["2024_09_cal_26", 14],
      ["2024_09_cal_27", 15],
      ["2024_09_cal_28", 15],
      ["2024_09_cal_29", 16],
      ["2024_09_cal_30", 16],
    ]),
    expectedSourceHashes: MATH_2024_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2024_09_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2024_09_GEO_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2024_09_geo_23", 17],
      ["2024_09_geo_24", 17],
      ["2024_09_geo_25", 18],
      ["2024_09_geo_26", 18],
      ["2024_09_geo_27", 19],
      ["2024_09_geo_28", 19],
      ["2024_09_geo_29", 20],
      ["2024_09_geo_30", 20],
    ]),
    expectedSourceHashes: MATH_2024_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathSourceCorrections({
    mathDbPath,
    mathDb,
    filename: MATH_2024_09_SOURCE_CORRECTION_FILENAME,
    expectedIds: MATH_2024_09_SOURCE_CORRECTION_IDS,
    expectedProblemPages: new Map([["2024_09_common_6", 2]]),
    expectedIssueCodes: new Map([
      ["2024_09_common_6", "problem_text_grouping_error"],
    ]),
    expectedSourceHashes: MATH_2024_09_VERIFIED_SOURCE_HASHES,
  });
}

function validateMath2025JuneVerifiedSolutions(
  mathDbPath,
  mathDb,
  sourceDirectory,
) {
  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2025_06_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2025_06_FIRST_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2025_06_common_1", 1],
      ["2025_06_common_2", 1],
      ["2025_06_common_3", 1],
      ["2025_06_common_4", 1],
      ["2025_06_common_5", 2],
      ["2025_06_common_6", 2],
      ["2025_06_common_7", 2],
      ["2025_06_common_8", 3],
      ["2025_06_common_9", 3],
      ["2025_06_common_10", 3],
      ["2025_06_common_11", 4],
    ]),
    expectedSourceHashes: MATH_2025_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2025_06_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2025_06_SECOND_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2025_06_common_12", 4],
      ["2025_06_common_13", 5],
      ["2025_06_common_14", 5],
      ["2025_06_common_15", 6],
      ["2025_06_common_16", 6],
      ["2025_06_common_17", 6],
      ["2025_06_common_18", 7],
      ["2025_06_common_19", 7],
      ["2025_06_common_20", 7],
      ["2025_06_common_21", 8],
      ["2025_06_common_22", 8],
    ]),
    expectedSourceHashes: MATH_2025_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2025_06_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2025_06_STA_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2025_06_sta_23", 9],
      ["2025_06_sta_24", 9],
      ["2025_06_sta_25", 10],
      ["2025_06_sta_26", 10],
      ["2025_06_sta_27", 11],
      ["2025_06_sta_28", 11],
      ["2025_06_sta_29", 12],
      ["2025_06_sta_30", 12],
    ]),
    expectedSourceHashes: MATH_2025_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2025_06_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2025_06_CAL_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2025_06_cal_23", 13],
      ["2025_06_cal_24", 13],
      ["2025_06_cal_25", 14],
      ["2025_06_cal_26", 14],
      ["2025_06_cal_27", 15],
      ["2025_06_cal_28", 15],
      ["2025_06_cal_29", 16],
      ["2025_06_cal_30", 16],
    ]),
    expectedSourceHashes: MATH_2025_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2025_06_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2025_06_GEO_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2025_06_geo_23", 17],
      ["2025_06_geo_24", 17],
      ["2025_06_geo_25", 18],
      ["2025_06_geo_26", 18],
      ["2025_06_geo_27", 19],
      ["2025_06_geo_28", 19],
      ["2025_06_geo_29", 20],
      ["2025_06_geo_30", 20],
    ]),
    expectedSourceHashes: MATH_2025_06_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathSourceCorrections({
    mathDbPath,
    mathDb,
    filename: MATH_2025_06_SOURCE_CORRECTION_FILENAME,
    expectedIds: MATH_2025_06_SOURCE_CORRECTION_IDS,
    expectedProblemPages: new Map([["2025_06_common_18", 7]]),
    expectedIssueCodes: new Map([
      ["2025_06_common_18", "problem_text_grouping_error"],
    ]),
    expectedSourceHashes: MATH_2025_06_VERIFIED_SOURCE_HASHES,
  });
}

function validateMath2025SeptemberVerifiedSolutions(
  mathDbPath,
  mathDb,
  sourceDirectory,
) {
  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2025_09_FIRST_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2025_09_FIRST_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2025_09_common_1", 1],
      ["2025_09_common_2", 1],
      ["2025_09_common_3", 1],
      ["2025_09_common_4", 1],
      ["2025_09_common_5", 2],
      ["2025_09_common_6", 2],
      ["2025_09_common_7", 2],
      ["2025_09_common_8", 3],
      ["2025_09_common_9", 3],
      ["2025_09_common_10", 3],
      ["2025_09_common_11", 4],
    ]),
    expectedSourceHashes: MATH_2025_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2025_09_SECOND_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2025_09_SECOND_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2025_09_common_12", 4],
      ["2025_09_common_13", 5],
      ["2025_09_common_14", 5],
      ["2025_09_common_15", 6],
      ["2025_09_common_16", 6],
      ["2025_09_common_17", 6],
      ["2025_09_common_18", 7],
      ["2025_09_common_19", 7],
      ["2025_09_common_20", 7],
      ["2025_09_common_21", 8],
      ["2025_09_common_22", 8],
    ]),
    expectedSourceHashes: MATH_2025_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2025_09_STA_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2025_09_STA_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2025_09_sta_23", 9],
      ["2025_09_sta_24", 9],
      ["2025_09_sta_25", 10],
      ["2025_09_sta_26", 10],
      ["2025_09_sta_27", 11],
      ["2025_09_sta_28", 11],
      ["2025_09_sta_29", 12],
      ["2025_09_sta_30", 12],
    ]),
    expectedSourceHashes: MATH_2025_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2025_09_CAL_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2025_09_CAL_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2025_09_cal_23", 13],
      ["2025_09_cal_24", 13],
      ["2025_09_cal_25", 14],
      ["2025_09_cal_26", 14],
      ["2025_09_cal_27", 15],
      ["2025_09_cal_28", 15],
      ["2025_09_cal_29", 16],
      ["2025_09_cal_30", 16],
    ]),
    expectedSourceHashes: MATH_2025_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathVerifiedSolutionSet({
    mathDbPath,
    mathDb,
    sourceDirectory,
    filename: MATH_2025_09_GEO_INTERNAL_VERIFIED_SOLUTION_FILENAME,
    expectedIds: MATH_2025_09_GEO_INTERNAL_VERIFIED_IDS,
    expectedProblemPages: new Map([
      ["2025_09_geo_23", 17],
      ["2025_09_geo_24", 17],
      ["2025_09_geo_25", 18],
      ["2025_09_geo_26", 18],
      ["2025_09_geo_27", 19],
      ["2025_09_geo_28", 19],
      ["2025_09_geo_29", 20],
      ["2025_09_geo_30", 20],
    ]),
    expectedSourceHashes: MATH_2025_09_VERIFIED_SOURCE_HASHES,
    verifiedAt: "2026-08-05",
  });

  validateMathSourceCorrections({
    mathDbPath,
    mathDb,
    filename: MATH_2025_09_SOURCE_CORRECTION_FILENAME,
    expectedIds: MATH_2025_09_SOURCE_CORRECTION_IDS,
    expectedProblemPages: new Map([
      ["2025_09_common_8", 3],
      ["2025_09_common_19", 7],
      ["2025_09_cal_26", 14],
    ]),
    expectedIssueCodes: new Map([
      ["2025_09_common_8", "choice_text_contamination"],
      ["2025_09_common_19", "problem_text_grouping_error"],
      ["2025_09_cal_26", "problem_text_shape_error"],
    ]),
    expectedSourceHashes: MATH_2025_09_VERIFIED_SOURCE_HASHES,
  });
}

function validateEnglishCandidateOverlay(overlayPath, expectedIds) {
  const overlay = readJson(overlayPath, "english candidate overlay");
  const candidateQuestions = overlay.questions;
  if (
    overlay.status !== "internal_candidate" ||
    overlay.publicConnected !== false ||
    overlay.summary?.questionCount !== 28 ||
    overlay.summary?.answerCrossCheckCount !== 28 ||
    overlay.summary?.questionAnswerReadyCount !== 28 ||
    overlay.summary?.reviewReadyCount !== 28 ||
    overlay.summary?.figureAssetCount !== 3 ||
    overlay.summary?.blockedCount !== 0 ||
    !Array.isArray(candidateQuestions) ||
    candidateQuestions.length !== 28
  ) {
    fail("ENGLISH_CANDIDATE_CATALOG_SCOPE", overlay.candidateId ?? "unknown");
  }
  if (
    stableJson(candidateQuestions.map((question) => question.id)) !==
      stableJson(expectedIds) ||
    candidateQuestions.some(
      (question, index) =>
        Number(question.qid) !== index + 18 ||
        question.status !== "question_answer_ready" ||
        question.reviewStatus !== "ready",
    )
  ) {
    fail("ENGLISH_CANDIDATE_CATALOG_QUESTION", overlay.candidateId);
  }
  const sourceArtifacts = Object.values(overlay.sourceArtifacts ?? {});
  if (sourceArtifacts.length !== 3) {
    fail("ENGLISH_CANDIDATE_SOURCE_ARTIFACTS", String(sourceArtifacts.length));
  }
  const availableSourceCount = sourceArtifacts.filter(
    (artifact) =>
      typeof artifact.filename === "string" &&
      existsSync(
        path.join(ENGLISH_CANDIDATE_SOURCE_DIRECTORY, artifact.filename),
      ),
  ).length;
  if (
    availableSourceCount > 0 &&
    availableSourceCount < sourceArtifacts.length
  ) {
    fail(
      "ENGLISH_CANDIDATE_SOURCE_PARTIAL",
      `${availableSourceCount}/${sourceArtifacts.length}`,
    );
  }
  const candidateArguments = [
    ENGLISH_CANDIDATE_GATE_PATH,
    "--overlay",
    overlayPath,
    "--check",
  ];
  if (availableSourceCount === sourceArtifacts.length) {
    candidateArguments.push("--source-dir", ENGLISH_CANDIDATE_SOURCE_DIRECTORY);
  }
  try {
    execFileSync(process.execPath, candidateArguments, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim();
    fail("ENGLISH_CANDIDATE_GATE", detail);
  }

  return candidateQuestions.map((question) => ({
    id: question.id,
    qid: Number(question.qid),
  }));
}

function validateEnglishCandidate() {
  const catalogCandidateQuestions = validateEnglishCandidateOverlay(
    ENGLISH_CANDIDATE_OVERLAY_PATH,
    ENGLISH_CANDIDATE_IDS,
  );
  validateEnglishCandidateOverlay(
    ENGLISH_INTERNAL_CANDIDATE_OVERLAY_PATH,
    ENGLISH_INTERNAL_CANDIDATE_IDS,
  );
  validateEnglishCandidateOverlay(
    ENGLISH_SECOND_INTERNAL_CANDIDATE_OVERLAY_PATH,
    ENGLISH_SECOND_INTERNAL_CANDIDATE_IDS,
  );
  validateEnglishCandidateOverlay(
    ENGLISH_THIRD_INTERNAL_CANDIDATE_OVERLAY_PATH,
    ENGLISH_THIRD_INTERNAL_CANDIDATE_IDS,
  );
  validateEnglishCandidateOverlay(
    ENGLISH_FOURTH_INTERNAL_CANDIDATE_OVERLAY_PATH,
    ENGLISH_FOURTH_INTERNAL_CANDIDATE_IDS,
  );
  validateEnglishCandidateOverlay(
    ENGLISH_FIFTH_INTERNAL_CANDIDATE_OVERLAY_PATH,
    ENGLISH_FIFTH_INTERNAL_CANDIDATE_IDS,
  );
  validateEnglishCandidateOverlay(
    ENGLISH_SIXTH_INTERNAL_CANDIDATE_OVERLAY_PATH,
    ENGLISH_SIXTH_INTERNAL_CANDIDATE_IDS,
  );
  return catalogCandidateQuestions;
}

function parseMathSessionId(id) {
  const match = String(id).match(
    /^(\d{4}_(?:06|09))_(common|cal|sta|geo)_(\d+)$/,
  );
  if (!match) fail("MATH_SESSION_ID_FORMAT", id);
  return {
    scopeKey: `${match[1]}|${match[2]}`,
    questionNumber: Number(match[3]),
  };
}

function buildFiveQuestionGroups(questions, scopeKey) {
  if (questions.length < 5) {
    fail("SESSION_SCOPE_TOO_SMALL", `${scopeKey}:${questions.length}`);
  }

  const groups = [];
  for (let offset = 0; offset < questions.length; offset += 5) {
    const start =
      questions.length - offset >= 5 ? offset : questions.length - 5;
    const group = questions.slice(start, start + 5);
    if (groups.some((candidate) => candidate[0].id === group[0].id)) continue;
    groups.push(group);
  }
  return groups;
}

function validateFiveQuestionGroup(group, scopeKey) {
  if (group.length !== 5) {
    fail("SESSION_QUESTION_COUNT", `${scopeKey}:${group.length}`);
  }
  if (new Set(group.map((question) => question.id)).size !== 5) {
    fail("SESSION_QUESTION_DUPLICATE", scopeKey);
  }
}

function validateSessionCatalog(english, math) {
  const englishByNumber = new Map();
  for (const question of english) {
    const match = question.id.match(/^2026_csat_(\d+)$/);
    if (!match) fail("ENGLISH_SESSION_ID_FORMAT", question.id);
    englishByNumber.set(Number(match[1]), question);
  }

  const englishGroups = ENGLISH_SESSION_NUMBER_GROUPS.map((numbers) =>
    numbers.map((number) => {
      const question = englishByNumber.get(number);
      if (!question) fail("ENGLISH_SESSION_QUESTION_MISSING", String(number));
      return question;
    }),
  );
  const englishCoverage = new Set();
  for (const group of englishGroups) {
    validateFiveQuestionGroup(group, "english");
    group.forEach((question) => englishCoverage.add(question.id));
  }
  if (
    englishGroups.length !== 6 ||
    englishCoverage.size !== english.length ||
    english.some((question) => !englishCoverage.has(question.id))
  ) {
    fail(
      "ENGLISH_SESSION_COVERAGE",
      `${englishGroups.length}:${englishCoverage.size}`,
    );
  }
  if (
    englishByNumber.get(41)?.passage !== englishByNumber.get(42)?.passage ||
    englishByNumber.get(43)?.passage !== englishByNumber.get(44)?.passage ||
    englishByNumber.get(44)?.passage !== englishByNumber.get(45)?.passage
  ) {
    fail("ENGLISH_SESSION_SHARED_PASSAGE", "41-45");
  }

  const mathByScope = new Map();
  for (const question of math) {
    const parsed = parseMathSessionId(question.id);
    if (!mathByScope.has(parsed.scopeKey)) mathByScope.set(parsed.scopeKey, []);
    mathByScope.get(parsed.scopeKey).push({
      ...question,
      sessionQuestionNumber: parsed.questionNumber,
    });
  }

  const expectedScopeKeys = MATH_SESSION_EXAMS.flatMap((exam) =>
    MATH_SESSION_TRACKS.map((track) => `${exam}|${track}`),
  );
  if (
    mathByScope.size !== expectedScopeKeys.length ||
    expectedScopeKeys.some((scopeKey) => !mathByScope.has(scopeKey))
  ) {
    fail("MATH_SESSION_SCOPE_COUNT", String(mathByScope.size));
  }

  let mathGroupCount = 0;
  const mathCoverage = new Set();
  for (const scopeKey of expectedScopeKeys) {
    const scopedQuestions = mathByScope
      .get(scopeKey)
      .sort(
        (left, right) =>
          left.sessionQuestionNumber - right.sessionQuestionNumber,
      );
    const groups = buildFiveQuestionGroups(scopedQuestions, scopeKey);
    mathGroupCount += groups.length;
    for (const group of groups) {
      validateFiveQuestionGroup(group, scopeKey);
      for (const question of group) {
        if (parseMathSessionId(question.id).scopeKey !== scopeKey) {
          fail("MATH_SESSION_SCOPE_MIXED", question.id);
        }
        mathCoverage.add(question.id);
      }
    }
  }

  if (
    mathGroupCount !== 88 ||
    mathCoverage.size !== math.length ||
    math.some((question) => !mathCoverage.has(question.id))
  ) {
    fail("MATH_SESSION_COVERAGE", `${mathGroupCount}:${mathCoverage.size}`);
  }
}

function hasExactQuestionIds(questions, expectedIds) {
  const actualIds = questions.map((question) => question.id);
  return (
    actualIds.length === expectedIds.length &&
    actualIds.every((id, index) => id === expectedIds[index])
  );
}

function buildPublicCatalog(english, math, englishCandidateQuestions) {
  const englishByNumber = new Map(
    english.map((question) => [
      Number(question.id.replace("2026_csat_", "")),
      question,
    ]),
  );
  const englishCsatPacks = ENGLISH_SESSION_NUMBER_GROUPS.map(
    (numbers, index) => {
      const questions = numbers.map((number) => englishByNumber.get(number));
      if (questions.some((question) => !question)) {
        fail("ENGLISH_CATALOG_QUESTION_MISSING", numbers.join(","));
      }
      const isFree = hasExactQuestionIds(questions, ENGLISH_FREE_IDS);
      return {
        id: `english-${String(index + 1).padStart(2, "0")}`,
        examKey: "2026_csat",
        examLabel: "2026학년도 수능",
        trackKey: "english",
        trackLabel: "영어",
        label: `${numbers[0]}~${numbers.at(-1)}번`,
        note:
          index === 4
            ? "앞 묶음의 3문항을 복습합니다."
            : index === 5
              ? "공통 지문 문항을 함께 풉니다."
              : "",
        questionCount: 5,
        scopeQuestionCount: 27,
        access: isFree ? "free" : "locked",
      };
    },
  );
  const englishCandidateGroups = buildFiveQuestionGroups(
    englishCandidateQuestions,
    "english|2026_09",
  );
  const englishCandidateCoverage = new Set(
    englishCandidateGroups.flatMap((group) =>
      group.map((question) => question.id),
    ),
  );
  if (
    englishCandidateGroups.length !== 6 ||
    englishCandidateCoverage.size !== 28 ||
    englishCandidateQuestions.some(
      (question) => !englishCandidateCoverage.has(question.id),
    )
  ) {
    fail(
      "ENGLISH_CANDIDATE_CATALOG_COVERAGE",
      `${englishCandidateGroups.length}:${englishCandidateCoverage.size}`,
    );
  }
  const englishCandidatePacks = englishCandidateGroups.map(
    (questions, index) => {
      validateFiveQuestionGroup(questions, "english|2026_09");
      const numbers = questions.map((question) => question.qid);
      return {
        id: `english-2026-09-${String(index + 1).padStart(2, "0")}`,
        examKey: "2026_09",
        examLabel: "2026학년도 9월 모의평가",
        trackKey: "english",
        trackLabel: "영어",
        label: `${numbers[0]}~${numbers.at(-1)}번`,
        note: numbers[0] === 41 ? "공통 지문 문항을 함께 풉니다." : "",
        questionCount: 5,
        scopeQuestionCount: 28,
        access: "locked",
      };
    },
  );
  const englishPacks = [...englishCsatPacks, ...englishCandidatePacks];

  const mathByScope = new Map();
  for (const question of math) {
    const parsed = parseMathSessionId(question.id);
    if (!mathByScope.has(parsed.scopeKey)) mathByScope.set(parsed.scopeKey, []);
    mathByScope.get(parsed.scopeKey).push({
      ...question,
      sessionQuestionNumber: parsed.questionNumber,
    });
  }

  const trackLabels = {
    common: "공통",
    cal: "미적분",
    sta: "확률과통계",
    geo: "기하",
  };
  const mathPacks = [];
  for (const examKey of MATH_SESSION_EXAMS) {
    for (const trackKey of MATH_SESSION_TRACKS) {
      const scopeKey = `${examKey}|${trackKey}`;
      const scopedQuestions = mathByScope
        .get(scopeKey)
        .sort(
          (left, right) =>
            left.sessionQuestionNumber - right.sessionQuestionNumber,
        );
      const groups = buildFiveQuestionGroups(scopedQuestions, scopeKey);
      const examLabel = scopedQuestions[0]?.label.split(" · ")[0] ?? examKey;

      groups.forEach((questions, index) => {
        const questionNumbers = questions.map(
          (question) => question.sessionQuestionNumber,
        );
        const choiceCount = questions.filter(
          (question) => question.responseType === "choice",
        ).length;
        const shortCount = questions.length - choiceCount;
        const responseSummary = [
          choiceCount ? `선다형 ${choiceCount}` : "",
          shortCount ? `단답형 ${shortCount}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const isFree = hasExactQuestionIds(questions, MATH_FREE_IDS);

        mathPacks.push({
          id: `math-${examKey}-${trackKey}-${String(index + 1).padStart(2, "0")}`,
          examKey,
          examLabel,
          trackKey,
          trackLabel: trackLabels[trackKey],
          label: `${questionNumbers.join("·")}번`,
          note:
            index === groups.length - 1 && scopedQuestions.length % 5 !== 0
              ? `마지막 ${scopedQuestions.length % 5}문항과 앞 문항을 함께 복습합니다.`
              : "",
          responseSummary,
          questionCount: 5,
          scopeQuestionCount: scopedQuestions.length,
          access: isFree ? "free" : "locked",
        });
      });
    }
  }

  const englishFreePacks = englishPacks.filter(
    (pack) => pack.access === "free",
  );
  const mathFreePacks = mathPacks.filter((pack) => pack.access === "free");
  if (englishPacks.length !== 12 || englishFreePacks.length !== 1) {
    fail(
      "ENGLISH_CATALOG_BOUNDARY",
      `${englishPacks.length}:${englishFreePacks.length}`,
    );
  }
  if (mathPacks.length !== 88 || mathFreePacks.length !== 1) {
    fail(
      "MATH_CATALOG_BOUNDARY",
      `${mathPacks.length}:${mathFreePacks.length}`,
    );
  }

  return {
    version: 1,
    subjects: {
      english: {
        totalQuestionCount: 55,
        freeQuestionCount: 5,
        lockedQuestionCount: 50,
        packCount: 12,
        freePackId: englishFreePacks[0].id,
        packs: englishPacks,
      },
      math: {
        totalQuestionCount: 361,
        freeQuestionCount: 5,
        lockedQuestionCount: 356,
        packCount: 88,
        freePackId: mathFreePacks[0].id,
        packs: mathPacks,
      },
    },
  };
}

function validateEnglishChoices(question) {
  if (!Array.isArray(question.choices) || question.choices.length !== 5) {
    fail("ENGLISH_CHOICE_COUNT", question.id);
  }

  const allowEmptyText = question.type === "문장 삽입";
  question.choices.forEach((choice, index) => {
    const expectedNumber = index + 1;
    const text = choice.text;
    if (Number(choice.num) !== expectedNumber) {
      fail(
        "ENGLISH_CHOICE_NUMBER_ORDER",
        `${question.id}:${choice.num}!=${expectedNumber}`,
      );
    }
    if (choice.mark !== ENGLISH_CHOICE_MARKS[index]) {
      fail(
        "ENGLISH_CHOICE_MARK_ORDER",
        `${question.id}:${choice.mark}!=${ENGLISH_CHOICE_MARKS[index]}`,
      );
    }
    if (typeof text !== "string" || (!allowEmptyText && !text.trim())) {
      fail("ENGLISH_CHOICE_TEXT_MISSING", `${question.id}:${expectedNumber}`);
    }
    if (
      ENGLISH_CHOICE_CONTAMINATION_PATTERNS.some((pattern) =>
        pattern.test(text),
      )
    ) {
      fail("ENGLISH_CHOICE_CONTAMINATION", `${question.id}:${expectedNumber}`);
    }
  });

  const answer = Number(question.answer);
  if (!Number.isInteger(answer) || answer < 1 || answer > 5) {
    fail("ENGLISH_ANSWER_INVALID", `${question.id}:${question.answer}`);
  }
}

function englishChoiceFingerprint(questions) {
  const fingerprintInput = questions.map((question) => [
    question.id,
    question.choices.map((choice) => [
      Number(choice.num),
      choice.mark,
      choice.text,
    ]),
  ]);
  return createHash("sha256")
    .update(JSON.stringify(fingerprintInput))
    .digest("hex");
}

function formatMathLabel(question) {
  const sessionLabel =
    question.session === "6월" ? "6월 모의평가" : "9월 모의평가";
  const trackLabel = {
    common: "공통",
    cal: "미적분",
    geo: "기하",
    sta: "확률과 통계",
  }[question.track];

  if (!trackLabel) fail("MATH_TRACK_INVALID", question.id);
  return `${question.schoolYear}학년도 ${sessionLabel} · ${trackLabel} ${question.qid}번`;
}

function uniqueIdSet(ids, code) {
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) fail(code, "duplicate id");
  return idSet;
}

function assertMatchingIds(actualIds, expectedIds, code) {
  const missing = [...expectedIds].filter((id) => !actualIds.has(id));
  const unexpected = [...actualIds].filter((id) => !expectedIds.has(id));
  if (missing.length || unexpected.length) {
    fail(
      code,
      `missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}`,
    );
  }
}

function validateMathRequiredFigureAssets(
  mathDbPath,
  mathDb,
  sourceDirectory = null,
) {
  const manifestPath = path.join(
    path.dirname(mathDbPath),
    MATH_REQUIRED_FIGURE_MANIFEST_FILENAME,
  );
  const manifest = readJson(
    manifestPath,
    MATH_REQUIRED_FIGURE_MANIFEST_FILENAME,
  );
  const metadata = manifest.metadata;
  if (
    metadata?.schemaVersion !== "math-required-figure-v1" ||
    metadata.status !== "internal_source_verified" ||
    metadata.publicConnected !== false ||
    metadata.itemCount !== MATH_FIGURE_BLOCKED_IDS.length ||
    metadata.verifiedAt !== "2026-08-06"
  ) {
    fail("MATH_REQUIRED_FIGURE_METADATA", String(metadata?.status));
  }

  const itemIds = Object.keys(manifest.items ?? {});
  if (stableJson(itemIds) !== stableJson(MATH_FIGURE_BLOCKED_IDS)) {
    fail("MATH_REQUIRED_FIGURE_IDS", itemIds.join(","));
  }

  const questionsById = new Map(
    mathDb.questions.map((question) => [question.id, question]),
  );
  const assetDirectory = path.join(
    path.dirname(mathDbPath),
    "assets",
    "required_figures",
  );
  if (sourceDirectory && !existsSync(sourceDirectory)) {
    fail("MATH_REQUIRED_FIGURE_SOURCE_DIRECTORY", sourceDirectory);
  }

  for (const id of MATH_FIGURE_BLOCKED_IDS) {
    const item = manifest.items[id];
    const question = questionsById.get(id);
    const expectedFigureAsset = MATH_REQUIRED_FIGURE_ASSETS.get(id);
    const expectedAssetPath = path
      .relative(ROOT, path.join(assetDirectory, `${id}.png`))
      .split(path.sep)
      .join("/");
    if (
      item?.id !== id ||
      item.status !== "source_verified_internal_asset" ||
      item.assetPath !== expectedAssetPath ||
      item.assetPath !== expectedFigureAsset?.path ||
      item.assetSha256 !== expectedFigureAsset?.sha256 ||
      !question ||
      question.answerCrossCheck !== "full" ||
      question.hasFigure !== true ||
      item.figureAlt !== question.figureDesc
    ) {
      fail("MATH_REQUIRED_FIGURE_ITEM", id);
    }

    const assetPath = path.resolve(ROOT, item.assetPath);
    const assetRelative = path.relative(assetDirectory, assetPath);
    if (
      !assetRelative ||
      assetRelative.startsWith("..") ||
      path.isAbsolute(assetRelative) ||
      path.extname(assetPath).toLowerCase() !== ".png" ||
      !existsSync(assetPath) ||
      !/^[a-f0-9]{64}$/.test(item.assetSha256) ||
      fileSha256(assetPath) !== item.assetSha256
    ) {
      fail("MATH_REQUIRED_FIGURE_ASSET", id);
    }

    const dimensions = readPngDimensions(assetPath, id);
    const source = item.source;
    const crop = source?.crop;
    if (
      item.assetWidth !== dimensions.width ||
      item.assetHeight !== dimensions.height ||
      source?.problemSha256 !== MATH_REQUIRED_FIGURE_SOURCE_HASHES.get(id) ||
      source?.page !== MATH_REQUIRED_FIGURE_SOURCE_PAGES.get(id) ||
      source?.renderDpi !== 180 ||
      !Number.isInteger(crop?.x) ||
      crop.x < 0 ||
      !Number.isInteger(crop?.y) ||
      crop.y < 0 ||
      crop.width !== dimensions.width ||
      crop.height !== dimensions.height
    ) {
      fail("MATH_REQUIRED_FIGURE_SOURCE", id);
    }
    requireText(source.exam, "MATH_REQUIRED_FIGURE_EXAM", id);
    requireText(
      source.problemFilename,
      "MATH_REQUIRED_FIGURE_FILENAME",
      id,
    );
    if (
      sourceDirectory &&
      !findFileBySha256(sourceDirectory, source.problemSha256, ".pdf")
    ) {
      fail("MATH_REQUIRED_FIGURE_SOURCE_FILE", id);
    }
  }

}

function validateMathFigurePolicy(mathDb) {
  const blockedIds = uniqueIdSet(
    MATH_FIGURE_BLOCKED_IDS,
    "MATH_FIGURE_BLOCKED_DUPLICATE",
  );
  const descriptionIds = uniqueIdSet(
    MATH_FIGURE_DESCRIPTION_IDS,
    "MATH_FIGURE_DESCRIPTION_DUPLICATE",
  );
  const decorativeIds = uniqueIdSet(
    MATH_FIGURE_DECORATIVE_IDS,
    "MATH_FIGURE_DECORATIVE_DUPLICATE",
  );

  if (blockedIds.size !== 7)
    fail("MATH_FIGURE_BLOCKED_COUNT", String(blockedIds.size));
  if (descriptionIds.size !== 55)
    fail("MATH_FIGURE_DESCRIPTION_COUNT", String(descriptionIds.size));
  if (decorativeIds.size !== 12)
    fail("MATH_FIGURE_DECORATIVE_COUNT", String(decorativeIds.size));

  const policyIds = new Set([
    ...blockedIds,
    ...descriptionIds,
    ...decorativeIds,
  ]);
  if (policyIds.size !== 74)
    fail("MATH_FIGURE_POLICY_COUNT", String(policyIds.size));

  const fullFigureQuestions = mathDb.questions.filter(
    (question) =>
      MATH_PUBLIC_EXAM_KEYS.includes(question.examKey) &&
      question.answerCrossCheck === "full" &&
      question.hasFigure === true,
  );
  const fullFigureIds = new Set(
    fullFigureQuestions.map((question) => question.id),
  );
  if (fullFigureIds.size !== 74)
    fail("MATH_FULL_FIGURE_COUNT", String(fullFigureIds.size));
  assertMatchingIds(fullFigureIds, policyIds, "MATH_FIGURE_POLICY_MISMATCH");

  const descriptionsById = new Map(
    fullFigureQuestions.map((question) => [question.id, question.figureDesc]),
  );
  for (const id of descriptionIds) {
    if (!String(descriptionsById.get(id) ?? "").trim())
      fail("MATH_FIGURE_DESCRIPTION_MISSING", id);
  }

  return { blockedIds, descriptionIds, decorativeIds };
}

function hasInlineChoiceMarkers(question) {
  return (
    question.group === "grammar" ||
    question.group === "irrelevant" ||
    question.group === "vocab" ||
    (question.group === "order" && (question.qid === 38 || question.qid === 39))
  );
}

function stripPdfPageTail(text) {
  return text.replace(/\s+--\s*\d+\s+of\s+\d+\s*--[\s\S]*$/, "");
}

function findLastChoiceBlockStart(text) {
  let best = -1;
  let start = text.indexOf(ENGLISH_CHOICE_MARKS[0]);

  while (start >= 0) {
    let position = start;
    let complete = true;
    for (const mark of ENGLISH_CHOICE_MARKS.slice(1)) {
      position = text.indexOf(mark, position + 1);
      if (position < 0) {
        complete = false;
        break;
      }
    }
    if (complete) best = start;
    start = text.indexOf(ENGLISH_CHOICE_MARKS[0], start + 1);
  }

  if (best >= 0) return best;
  const fallback = text.lastIndexOf("\n①");
  return fallback >= 0 ? fallback + 1 : -1;
}

function trimInlineMarkerTail(text) {
  const fifth = text.indexOf("⑤");
  if (fifth < 0) return text;

  const searchFrom = fifth + 1;
  const tail = text.slice(searchFrom);
  const cuts = [
    /\s+\[\d{2}\s*[~～－-]\s*\d{2}\]/,
    /\s+\d{1,2}\.\s+[A-Z]/,
    /\s+[A-Z][A-Za-z0-9'’.-]*(?:\s+[A-Z][A-Za-z0-9'’.-]*){0,5}\s+(?:Program|Festival|Event|Competition|Contest|Workshop|Camp|Notice)\b/,
  ]
    .map((pattern) => pattern.exec(tail))
    .filter(Boolean)
    .map((match) => searchFrom + match.index);

  return cuts.length
    ? text.slice(0, Math.min(...cuts)).replace(/\s+$/, "")
    : text;
}

function restoreBlankMarker(question, text) {
  if (question.group !== "blank" || question.qid < 31 || question.qid > 34) {
    return text.replace(/\t/g, " ");
  }
  if (text.includes("____")) return text.replace(/\t/g, " ");

  let restored = text.replace(/\t+\s*([.,;:?!])/, " ____$1");
  if (restored === text)
    restored = restored.replace(/a\(n\)\s*\t+\s*/, "a(n) ____ ");
  if (restored === text)
    restored = restored.replace(/\bthat\s*\n\s*\./, "that ____.");
  if (restored === text) restored = restored.replace(/\t+/, " ____ ");
  restored = restored.replace(/\t/g, " ");
  if (!restored.includes("____")) {
    const beforeFallback = restored;
    restored = restored.replace(/\s*(\[[23]점\])/, " ____ $1");
    if (restored === beforeFallback) restored += "\n____";
  }
  return restored;
}

function normalizePassageLineBreaks(text) {
  let source = String(text ?? "").replace(/\r\n?/g, "\n");
  let lead = "";
  const firstBreak = source.indexOf("\n");
  if (firstBreak > 0) {
    const firstLine = source.slice(0, firstBreak).trim();
    if (/^\d{1,2}\./.test(firstLine) && firstLine.length <= 180) {
      lead = firstLine;
      source = source.slice(firstBreak + 1);
    }
  }

  const body = source
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n{2,}/)
    .map((part) =>
      part
        .replace(/[ \t]*\n[ \t]*/g, " ")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n")
    .replace(/(\S)\s+(\*+\s)/g, "$1\n$2");

  return lead ? `${lead}\n\n${body}` : body;
}

function cutChoicesFromRaw(rawText, question) {
  let body = stripPdfPageTail(rawText).replace(/\s+$/, "");
  const choiceStart = findLastChoiceBlockStart(body);
  if (hasInlineChoiceMarkers(question)) {
    body = trimInlineMarkerTail(body);
  } else if (
    choiceStart >= 0 &&
    (question.figure || choiceStart > Math.max(80, body.length * 0.35))
  ) {
    body = body.slice(0, choiceStart).replace(/\s+$/, "");
  }
  return normalizePassageLineBreaks(restoreBlankMarker(question, body)).replace(
    /\s+$/,
    "",
  );
}

function removeLeadingStem(passage, stem) {
  const normalizedStem = normalizePassageLineBreaks(stem).trim();
  const separator = passage.indexOf("\n\n");
  const normalizedPrefix = passage
    .slice(0, separator >= 0 ? separator : passage.length)
    .replace(/\s+/g, " ")
    .trim();
  if (
    separator >= 0 &&
    normalizedPrefix === normalizedStem.replace(/\s+/g, " ")
  ) {
    return passage.slice(separator + 2).trim();
  }
  if (normalizedStem && passage.startsWith(normalizedStem))
    return passage.slice(normalizedStem.length).trim();
  return passage;
}

function validateEnglishPassage(question, passage) {
  if (
    ENGLISH_CHOICE_CONTAMINATION_PATTERNS.slice(0, -1).some((pattern) =>
      pattern.test(passage),
    )
  ) {
    fail("ENGLISH_PASSAGE_CONTAMINATION", question.id);
  }
  const nextQuestionMatch =
    ENGLISH_CHOICE_CONTAMINATION_PATTERNS.at(-1).exec(passage);
  if (
    nextQuestionMatch &&
    nextQuestionMatch.index > Math.max(80, passage.length * 0.35)
  ) {
    fail("ENGLISH_PASSAGE_NEXT_QUESTION_LEAK", question.id);
  }
  if (
    !hasInlineChoiceMarkers(question) &&
    ENGLISH_CHOICE_MARKS.every((mark) => passage.includes(mark))
  ) {
    fail("ENGLISH_PASSAGE_CHOICE_LEAK", question.id);
  }
}

function assertNoForbiddenKeys(value, location = "root") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoForbiddenKeys(item, `${location}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const isApprovedFigureNotes =
      key === "notes" && location.endsWith(".figure");
    if (FORBIDDEN_PUBLIC_KEYS.has(key) && !isApprovedFigureNotes) {
      fail("PUBLIC_FIELD_LEAK", `${location}.${key}`);
    }
    assertNoForbiddenKeys(child, `${location}.${key}`);
  }
}

function projectEnglishFigure(question) {
  const figure = question.figure;
  if (!figure) return null;
  if (
    figure.kind !== "stacked_horizontal_bar" ||
    typeof figure.assetPath !== "string" ||
    !figure.assetPath.startsWith("/images/") ||
    typeof figure.title !== "string" ||
    !figure.title.trim() ||
    typeof figure.alt !== "string" ||
    !figure.alt.trim() ||
    figure.unit !== "%" ||
    !Number.isInteger(figure.sourcePage) ||
    figure.sourcePage < 1
  ) {
    fail("ENGLISH_FIGURE_SCHEMA", question.id);
  }

  if (!Array.isArray(figure.categories) || figure.categories.length === 0) {
    fail("ENGLISH_FIGURE_CATEGORIES", question.id);
  }
  if (!Array.isArray(figure.series) || figure.series.length === 0) {
    fail("ENGLISH_FIGURE_SERIES", question.id);
  }
  if (
    !Array.isArray(figure.notes) ||
    figure.notes.some((note) => !String(note).trim())
  ) {
    fail("ENGLISH_FIGURE_NOTES", question.id);
  }

  const categoryIds = figure.categories.map((category) => category.id);
  if (
    new Set(categoryIds).size !== categoryIds.length ||
    figure.categories.some(
      (category) =>
        typeof category.id !== "string" ||
        !category.id ||
        !String(category.label).trim(),
    )
  ) {
    fail("ENGLISH_FIGURE_CATEGORY_ID", question.id);
  }

  const seriesIds = figure.series.map((series) => series.id);
  if (
    new Set(seriesIds).size !== seriesIds.length ||
    figure.series.some(
      (series) =>
        typeof series.id !== "string" ||
        !series.id ||
        !String(series.label).trim() ||
        !series.values ||
        typeof series.values !== "object",
    )
  ) {
    fail("ENGLISH_FIGURE_SERIES_ID", question.id);
  }

  for (const series of figure.series) {
    const valueKeys = Object.keys(series.values).sort();
    if (stableJson(valueKeys) !== stableJson([...categoryIds].sort())) {
      fail("ENGLISH_FIGURE_VALUE_KEYS", `${question.id}:${series.id}`);
    }
    for (const value of Object.values(series.values)) {
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        fail("ENGLISH_FIGURE_VALUE", `${question.id}:${series.id}`);
      }
    }
  }

  for (const categoryId of categoryIds) {
    const total = figure.series.reduce(
      (sum, series) => sum + series.values[categoryId],
      0,
    );
    if (total > 100)
      fail("ENGLISH_FIGURE_STACK_TOTAL", `${question.id}:${categoryId}`);
  }

  const isProtectedEnglishFigure =
    question.id === "2026_csat_25" &&
    figure.assetPath === "/images/eng-math/english/2026-csat/q25-figure.png";
  const assetPath = isProtectedEnglishFigure
    ? ENGLISH_FIGURE_PROTECTED_PATH
    : path.resolve(
        path.join(ROOT, "public"),
        figure.assetPath.replace(/^[/\\]+/, ""),
      );
  if (!existsSync(assetPath)) {
    fail("ENGLISH_FIGURE_ASSET", question.id);
  }

  return {
    kind: figure.kind,
    assetPath: figure.assetPath,
    title: figure.title,
    alt: figure.alt,
    unit: figure.unit,
    categories: figure.categories,
    series: figure.series,
    notes: figure.notes,
  };
}

function buildPublicData(
  mathSourceDirectory = null,
  math2022SeptemberSourceDirectory = null,
  math2023JuneSourceDirectory = null,
  math2023SeptemberSourceDirectory = null,
  math2024JuneSourceDirectory = null,
  math2024SeptemberSourceDirectory = null,
  math2025JuneSourceDirectory = null,
  math2025SeptemberSourceDirectory = null,
  mathFigureSourceDirectory = null,
) {
  const englishCandidateQuestions = validateEnglishCandidate();
  const mathDbPath = findFile(ROOT, "math_exam_db_v2_0.json");
  const explainPath = findFile(ROOT, "eng_explain_2026csat.json");
  const englishDb = readJson(ENGLISH_DB_PATH, "english_exam_db_v2_1.json");
  const mathDb = readJson(mathDbPath, "math_exam_db_v2_0.json");
  const mathAnswerSource = validateMathAnswerCrosscheck(mathDb);
  validateMathRequiredFigureAssets(
    mathDbPath,
    mathDb,
    mathFigureSourceDirectory,
  );
  const mathVerifiedSolutions = validateMathVerifiedSolutions(
    mathDbPath,
    mathDb,
    mathSourceDirectory,
  );
  validateMath2022SeptemberVerifiedSolutions(
    mathDbPath,
    mathDb,
    math2022SeptemberSourceDirectory,
  );
  validateMath2023JuneVerifiedSolutions(
    mathDbPath,
    mathDb,
    math2023JuneSourceDirectory,
  );
  validateMath2023SeptemberVerifiedSolutions(
    mathDbPath,
    mathDb,
    math2023SeptemberSourceDirectory,
  );
  validateMath2024JuneVerifiedSolutions(
    mathDbPath,
    mathDb,
    math2024JuneSourceDirectory,
  );
  validateMath2024SeptemberVerifiedSolutions(
    mathDbPath,
    mathDb,
    math2024SeptemberSourceDirectory,
  );
  validateMath2025JuneVerifiedSolutions(
    mathDbPath,
    mathDb,
    math2025JuneSourceDirectory,
  );
  validateMath2025SeptemberVerifiedSolutions(
    mathDbPath,
    mathDb,
    math2025SeptemberSourceDirectory,
  );
  validateMathVerifiedCoverage(mathDb);
  const mathVerifiedSolutionsById = new Map(
    mathVerifiedSolutions.map((item) => [
      item.id,
      {
        summary: item.summary,
        approach: item.approach,
        concepts: [...item.concepts],
        steps: item.steps.map((step) => ({
          title: step.title,
          expression: step.expression,
          explanation: step.explanation,
        })),
        correctReason: item.correctReason,
        commonMistake: item.commonMistake,
      },
    ]),
  );
  const explanationDb = readJson(explainPath, "eng_explain_2026csat.json");
  const explanations = new Map(
    Object.values(explanationDb.items).map((item) => [item.id, item]),
  );

  const englishSource = englishDb.questions.filter(
    (question) => question.examId === "2026_csat",
  );
  if (englishSource.length !== 28)
    fail("ENGLISH_SOURCE_SCOPE", String(englishSource.length));

  const englishReadySource = englishSource.filter(
    (question) =>
      !ENGLISH_EXCLUDED_IDS.has(question.id) &&
      explanations.get(question.id)?.status === "ready",
  );
  englishReadySource.forEach(validateEnglishChoices);
  const choiceFingerprint = englishChoiceFingerprint(englishReadySource);
  if (choiceFingerprint !== ENGLISH_PUBLIC_CHOICE_FINGERPRINT) {
    fail(
      "ENGLISH_CHOICE_FINGERPRINT",
      `${choiceFingerprint} != ${ENGLISH_PUBLIC_CHOICE_FINGERPRINT}`,
    );
  }

  const english = englishReadySource.map((question) => {
    const review = explanations.get(question.id);
    if (String(question.answer) !== String(review.answer))
      fail("ENGLISH_ANSWER_MISMATCH", question.id);
    if (!Array.isArray(review.evidence) || review.evidence.length === 0) {
      fail("ENGLISH_EVIDENCE_MISSING", question.id);
    }
    if (!review.trap || typeof review.trap.reason !== "string") {
      fail("ENGLISH_TRAP_MISSING", question.id);
    }

    const rawPassage =
      question.sharedPassage?.trim() ||
      cutChoicesFromRaw(question.rawText, question);
    const passage = question.sharedPassage?.trim()
      ? rawPassage
      : removeLeadingStem(rawPassage, question.stem);
    if (!passage) fail("ENGLISH_PASSAGE_MISSING", question.id);
    validateEnglishPassage(question, passage);
    const figure = projectEnglishFigure(question);

    const evidence = review.evidence.map((item, index) => {
      if (item.in === "figure") {
        const series = question.figure?.series?.find(
          (candidate) => candidate.id === item.seriesId,
        );
        const value = series?.values?.[item.categoryId];
        if (
          !figure ||
          !question.figure.categories.some(
            (category) => category.id === item.categoryId,
          ) ||
          value !== item.value ||
          !String(item.display ?? "").trim()
        ) {
          fail("ENGLISH_FIGURE_EVIDENCE_MISMATCH", `${question.id}:${index}`);
        }
        return {
          origin: "figure",
          role: item.role,
          quote: item.display,
          translation: item.translation,
        };
      }

      const sourceText = question[item.in];
      if (
        typeof sourceText !== "string" ||
        sourceText.slice(item.charStart, item.charStart + item.quote.length) !==
          item.quote
      ) {
        fail("ENGLISH_EVIDENCE_MISMATCH", `${question.id}:${index}`);
      }
      return {
        origin: "text",
        role: item.role,
        quote: item.quote,
        translation: item.translation,
      };
    });

    return {
      id: question.id,
      label: `${question.schoolYear}학년도 수능 · ${question.qid}번`,
      prompt: question.stem,
      passage,
      ...(figure ? { figure } : {}),
      choices: question.choices.map((choice) => ({
        number: choice.num,
        mark: choice.mark,
        text: choice.text,
      })),
      answer: Number(question.answer),
      review: {
        summary: review.summary,
        approach: review.typeApproach,
        reason: review.correctReason,
        trap: {
          mark: review.trap.mark,
          text: review.trap.text,
          reason: review.trap.reason,
        },
        evidence,
      },
    };
  });

  if (english.length !== 27)
    fail("ENGLISH_PUBLIC_COUNT", String(english.length));
  const englishEvidenceCount = english.reduce(
    (count, question) => count + question.review.evidence.length,
    0,
  );
  if (englishEvidenceCount !== 61)
    fail("ENGLISH_EVIDENCE_COUNT", String(englishEvidenceCount));

  const mathFigurePolicy = validateMathFigurePolicy(mathDb);
  const math = mathDb.questions
    .filter(
      (question) =>
        MATH_PUBLIC_EXAM_KEYS.includes(question.examKey) &&
        question.answerCrossCheck === "full" &&
        !mathFigurePolicy.blockedIds.has(question.id),
    )
    .map((question) => {
      const isChoice = question.answerType === "choice";
      const isShort = question.answerType === "short";
      const solution = mathVerifiedSolutionsById.get(question.id);
      const figureDescription = mathFigurePolicy.descriptionIds.has(question.id)
        ? question.figureDesc
        : null;
      if (!isChoice && !isShort) fail("MATH_RESPONSE_TYPE", question.id);
      if (!String(question.problem_latex ?? "").trim())
        fail("MATH_PROMPT_MISSING", question.id);
      if (!Array.isArray(question.choices))
        fail("MATH_CHOICES_MISSING", question.id);
      if (figureDescription !== null && !String(figureDescription).trim()) {
        fail("MATH_FIGURE_DESCRIPTION_MISSING", question.id);
      }

      if (isChoice) {
        if (question.choices.length !== 5)
          fail("MATH_CHOICE_COUNT", question.id);
        if (
          !question.choices.some(
            (choice) => Number(choice.num) === Number(question.answer),
          )
        ) {
          fail("MATH_ANSWER_MISMATCH", question.id);
        }
      }
      if (
        isShort &&
        (question.choices.length !== 0 ||
          !/^\d+$/.test(String(question.answer)))
      ) {
        fail("MATH_SHORT_FORMAT", question.id);
      }

      return {
        id: question.id,
        label: formatMathLabel(question),
        responseType: question.answerType,
        prompt: question.problem_latex,
        choices: question.choices.map((choice) => ({
          number: choice.num,
          mark: choice.mark,
          text: choice.latex,
        })),
        answer: isChoice ? Number(question.answer) : String(question.answer),
        ...(solution ? { solution } : {}),
        ...(figureDescription !== null ? { figureDescription } : {}),
      };
    });

  if (math.length !== 361) fail("MATH_PUBLIC_COUNT", String(math.length));
  if (
    math.filter((question) => question.responseType === "choice").length !== 257
  ) {
    fail("MATH_CHOICE_SCOPE", "expected 257");
  }
  if (
    math.filter((question) => question.responseType === "short").length !== 104
  ) {
    fail("MATH_SHORT_SCOPE", "expected 104");
  }
  if (math.some((question) => mathFigurePolicy.blockedIds.has(question.id))) {
    fail("MATH_BLOCKED_FIGURE_LEAK", "public data");
  }
  const mathSolutionIds = math
    .filter((question) => Object.hasOwn(question, "solution"))
    .map((question) => question.id);
  if (stableJson(mathSolutionIds) !== stableJson(MATH_FREE_IDS)) {
    fail("MATH_SOLUTION_PUBLIC_IDS", mathSolutionIds.join(","));
  }

  const describedQuestions = math.filter((question) =>
    mathFigurePolicy.descriptionIds.has(question.id),
  );
  if (
    describedQuestions.length !== 55 ||
    describedQuestions.some(
      (question) => !String(question.figureDescription ?? "").trim(),
    )
  ) {
    fail(
      "MATH_FIGURE_DESCRIPTION_PUBLIC_CHECK",
      String(describedQuestions.length),
    );
  }

  const decorativeQuestions = math.filter((question) =>
    mathFigurePolicy.decorativeIds.has(question.id),
  );
  if (
    decorativeQuestions.length !== 12 ||
    decorativeQuestions.some((question) =>
      Object.hasOwn(question, "figureDescription"),
    )
  ) {
    fail(
      "MATH_DECORATIVE_FIGURE_PUBLIC_CHECK",
      String(decorativeQuestions.length),
    );
  }

  if (
    math.some(
      (question) =>
        Object.hasOwn(question, "figureDescription") &&
        !mathFigurePolicy.descriptionIds.has(question.id),
    )
  ) {
    fail("MATH_UNAPPROVED_FIGURE_DESCRIPTION", "public data");
  }

  validateSessionCatalog(english, math);
  const catalog = buildPublicCatalog(english, math, englishCandidateQuestions);
  const englishFreeQuestions = english.filter((question) =>
    ENGLISH_FREE_IDS.includes(question.id),
  );
  const mathFreeQuestions = math.filter((question) =>
    MATH_FREE_IDS.includes(question.id),
  );
  if (!hasExactQuestionIds(englishFreeQuestions, ENGLISH_FREE_IDS)) {
    fail(
      "ENGLISH_FREE_BOUNDARY",
      englishFreeQuestions.map((question) => question.id).join(","),
    );
  }
  if (!hasExactQuestionIds(mathFreeQuestions, MATH_FREE_IDS)) {
    fail(
      "MATH_FREE_BOUNDARY",
      mathFreeQuestions.map((question) => question.id).join(","),
    );
  }
  const freeEvidenceCount = englishFreeQuestions.reduce(
    (count, question) => count + question.review.evidence.length,
    0,
  );
  if (freeEvidenceCount !== 10) {
    fail("ENGLISH_FREE_EVIDENCE_COUNT", String(freeEvidenceCount));
  }

  const englishFree = {
    packId: catalog.subjects.english.freePackId,
    questions: englishFreeQuestions,
  };
  const mathFree = {
    packId: catalog.subjects.math.freePackId,
    questions: mathFreeQuestions,
  };
  const allowedSolutionKeys = [
    "approach",
    "commonMistake",
    "concepts",
    "correctReason",
    "steps",
    "summary",
  ];
  const allowedStepKeys = ["explanation", "expression", "title"];
  for (const question of mathFree.questions) {
    if (Object.hasOwn(question, "review")) {
      fail("MATH_REVIEW_PUBLIC_FIELD_LEAK", question.id);
    }
    const expectedSolution = mathVerifiedSolutionsById.get(question.id);
    if (!expectedSolution || !question.solution) {
      fail("MATH_SOLUTION_PUBLIC_MISSING", question.id);
    }
    if (
      stableJson(Object.keys(question.solution).sort()) !==
      stableJson(allowedSolutionKeys)
    ) {
      fail("MATH_SOLUTION_PUBLIC_KEYS", question.id);
    }
    if (
      question.solution.steps.some(
        (step) =>
          stableJson(Object.keys(step).sort()) !== stableJson(allowedStepKeys),
      )
    ) {
      fail("MATH_SOLUTION_PUBLIC_STEP_KEYS", question.id);
    }
    if (stableJson(question.solution) !== stableJson(expectedSolution)) {
      fail("MATH_SOLUTION_PUBLIC_DRIFT", question.id);
    }
  }
  assertNoForbiddenKeys({ englishFree, mathFree });

  const freeIds = new Set([...ENGLISH_FREE_IDS, ...MATH_FREE_IDS]);
  const lockedIds = [...english, ...math, ...englishCandidateQuestions]
    .map((question) => question.id)
    .filter((id) => !freeIds.has(id));
  if (lockedIds.length !== 406 || new Set(lockedIds).size !== 406) {
    fail("LOCKED_QUESTION_COUNT", String(lockedIds.length));
  }

  return { englishFree, mathFree, catalog, lockedIds, mathAnswerSource };
}

function verifyArtifact(filePath, expected) {
  if (!existsSync(filePath))
    fail("PUBLIC_ARTIFACT_MISSING", path.relative(ROOT, filePath));
  const actual = readFileSync(filePath, "utf8");
  if (actual !== stableJson(expected)) {
    const expectedHash = createHash("sha256")
      .update(stableJson(expected))
      .digest("hex")
      .slice(0, 12);
    const actualHash = createHash("sha256")
      .update(actual)
      .digest("hex")
      .slice(0, 12);
    fail(
      "PUBLIC_ARTIFACT_DRIFT",
      `${path.basename(filePath)} ${actualHash} != ${expectedHash}`,
    );
  }
}

function verifyArtifactMissing(filePath) {
  if (existsSync(filePath)) {
    fail("LOCKED_PUBLIC_ARTIFACT", path.relative(ROOT, filePath));
  }
}

function verifyPublishedFileSet(directory) {
  if (!existsSync(directory)) {
    fail("PUBLIC_DIRECTORY_MISSING", path.relative(ROOT, directory));
  }
  const expectedNames = [
    "catalog-public.json",
    "english-free-public.json",
    "math-free-public.json",
  ];
  const actualNames = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  if (stableJson(actualNames) !== stableJson(expectedNames)) {
    fail("PUBLIC_FILE_SET", `actual=${actualNames.join(",") || "none"}`);
  }
}

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function verifyLockedIdsAbsent(directory, lockedIds) {
  const textExtensions = new Set([
    ".css",
    ".html",
    ".js",
    ".json",
    ".map",
    ".svg",
    ".txt",
    ".xml",
  ]);
  const lockedIdPattern = new RegExp(
    `(?:${lockedIds
      .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})(?![A-Za-z0-9_])`,
  );
  for (const filePath of listFiles(directory)) {
    if (!textExtensions.has(path.extname(filePath).toLowerCase())) continue;
    const contents = readFileSync(filePath, "utf8");
    const match = contents.match(lockedIdPattern);
    if (match) {
      fail(
        "LOCKED_QUESTION_ID_LEAK",
        `${path.relative(ROOT, filePath)}:${match[0]}`,
      );
    }
  }
}

function verifyPublishedBoundary(baseDirectory, data) {
  const dataDirectory = path.join(baseDirectory, "data", "eng-math");
  verifyPublishedFileSet(dataDirectory);
  verifyArtifact(
    path.join(dataDirectory, "english-free-public.json"),
    data.englishFree,
  );
  verifyArtifact(
    path.join(dataDirectory, "math-free-public.json"),
    data.mathFree,
  );
  verifyArtifact(path.join(dataDirectory, "catalog-public.json"), data.catalog);
  verifyArtifactMissing(
    path.join(dataDirectory, "english-2026-csat-public.json"),
  );
  verifyArtifactMissing(
    path.join(dataDirectory, "math-full-no-figure-public.json"),
  );
  verifyArtifactMissing(
    path.join(
      baseDirectory,
      "images",
      "eng-math",
      "english",
      "2026-csat",
      "q25-figure.png",
    ),
  );
  verifyLockedIdsAbsent(baseDirectory, data.lockedIds);
}

function parseArguments() {
  const values = process.argv.slice(2);
  const mode = values[0] ?? "--check";
  let mathSourceDirectory = null;
  let math2022SeptemberSourceDirectory = null;
  let math2023JuneSourceDirectory = null;
  let math2023SeptemberSourceDirectory = null;
  let math2024JuneSourceDirectory = null;
  let math2024SeptemberSourceDirectory = null;
  let math2025JuneSourceDirectory = null;
  let math2025SeptemberSourceDirectory = null;
  let mathFigureSourceDirectory = null;
  for (let index = 1; index < values.length; index += 1) {
    const value = values[index];
    if (
      value !== "--math-source-dir" &&
      value !== "--math-2022-09-source-dir" &&
      value !== "--math-2023-06-source-dir" &&
      value !== "--math-2023-09-source-dir" &&
      value !== "--math-2024-06-source-dir" &&
      value !== "--math-2024-09-source-dir" &&
      value !== "--math-2025-06-source-dir" &&
      value !== "--math-2025-09-source-dir" &&
      value !== "--math-figure-source-dir"
    ) {
      fail("ARGUMENT_INVALID", value);
    }
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      fail("ARGUMENT_VALUE_MISSING", value);
    }
    if (value === "--math-source-dir") {
      mathSourceDirectory = path.resolve(next);
    } else if (value === "--math-2022-09-source-dir") {
      math2022SeptemberSourceDirectory = path.resolve(next);
    } else if (value === "--math-2023-06-source-dir") {
      math2023JuneSourceDirectory = path.resolve(next);
    } else if (value === "--math-2023-09-source-dir") {
      math2023SeptemberSourceDirectory = path.resolve(next);
    } else if (value === "--math-2024-06-source-dir") {
      math2024JuneSourceDirectory = path.resolve(next);
    } else if (value === "--math-2024-09-source-dir") {
      math2024SeptemberSourceDirectory = path.resolve(next);
    } else if (value === "--math-2025-06-source-dir") {
      math2025JuneSourceDirectory = path.resolve(next);
    } else if (value === "--math-2025-09-source-dir") {
      math2025SeptemberSourceDirectory = path.resolve(next);
    } else {
      mathFigureSourceDirectory = path.resolve(next);
    }
    index += 1;
  }
  return {
    mode,
    mathSourceDirectory,
    math2022SeptemberSourceDirectory,
    math2023JuneSourceDirectory,
    math2023SeptemberSourceDirectory,
    math2024JuneSourceDirectory,
    math2024SeptemberSourceDirectory,
    math2025JuneSourceDirectory,
    math2025SeptemberSourceDirectory,
    mathFigureSourceDirectory,
  };
}

const options = parseArguments();
const mode = options.mode;
const data = buildPublicData(
  options.mathSourceDirectory,
  options.math2022SeptemberSourceDirectory,
  options.math2023JuneSourceDirectory,
  options.math2023SeptemberSourceDirectory,
  options.math2024JuneSourceDirectory,
  options.math2024SeptemberSourceDirectory,
  options.math2025JuneSourceDirectory,
  options.math2025SeptemberSourceDirectory,
  options.mathFigureSourceDirectory,
);

if (mode === "--write") {
  mkdirSync(PUBLIC_DATA_DIRECTORY, { recursive: true });
  writeFileSync(ENGLISH_FREE_OUTPUT_PATH, stableJson(data.englishFree), "utf8");
  writeFileSync(MATH_FREE_OUTPUT_PATH, stableJson(data.mathFree), "utf8");
  writeFileSync(CATALOG_OUTPUT_PATH, stableJson(data.catalog), "utf8");
  LEGACY_PUBLIC_DATA_PATHS.forEach((filePath) => {
    if (existsSync(filePath)) unlinkSync(filePath);
  });
  verifyPublishedBoundary(path.join(ROOT, "public"), data);
  console.log(
    `ENG_MATH_PUBLIC_DATA: wrote free=10 locked=406 catalogs=12/88 englishCandidates=196/417 mathAnswers=690/${data.mathAnswerSource} mathSolutions=5public+${MATH_INTERNAL_VERIFIED_ID_COUNT}internal mathRequiredFigures=7internal mathFigureSource=${options.mathFigureSourceDirectory ? "verified" : "recorded"} mathSourceCorrections=${MATH_SOURCE_CORRECTION_ID_COUNT} mathSource=${options.mathSourceDirectory ? "verified" : "recorded"} math2022_09Source=${options.math2022SeptemberSourceDirectory ? "verified" : "recorded"} math2023_06Source=${options.math2023JuneSourceDirectory ? "verified" : "recorded"} math2023_09Source=${options.math2023SeptemberSourceDirectory ? "verified" : "recorded"} math2024_06Source=${options.math2024JuneSourceDirectory ? "verified" : "recorded"} math2024_09Source=${options.math2024SeptemberSourceDirectory ? "verified" : "recorded"} math2025_06Source=${options.math2025JuneSourceDirectory ? "verified" : "recorded"} math2025_09Source=${options.math2025SeptemberSourceDirectory ? "verified" : "recorded"}`,
  );
} else if (mode === "--check") {
  verifyPublishedBoundary(path.join(ROOT, "public"), data);
  console.log(
    `ENG_MATH_PUBLIC_DATA: pass free=10 locked=406 catalogs=12/88 englishCandidates=196/417 mathAnswers=690/${data.mathAnswerSource} mathSolutions=5public+${MATH_INTERNAL_VERIFIED_ID_COUNT}internal mathRequiredFigures=7internal mathFigureSource=${options.mathFigureSourceDirectory ? "verified" : "recorded"} mathSourceCorrections=${MATH_SOURCE_CORRECTION_ID_COUNT} mathSource=${options.mathSourceDirectory ? "verified" : "recorded"} math2022_09Source=${options.math2022SeptemberSourceDirectory ? "verified" : "recorded"} math2023_06Source=${options.math2023JuneSourceDirectory ? "verified" : "recorded"} math2023_09Source=${options.math2023SeptemberSourceDirectory ? "verified" : "recorded"} math2024_06Source=${options.math2024JuneSourceDirectory ? "verified" : "recorded"} math2024_09Source=${options.math2024SeptemberSourceDirectory ? "verified" : "recorded"} math2025_06Source=${options.math2025JuneSourceDirectory ? "verified" : "recorded"} math2025_09Source=${options.math2025SeptemberSourceDirectory ? "verified" : "recorded"}`,
  );
} else if (mode === "--check-dist") {
  verifyPublishedBoundary(path.join(ROOT, "dist"), data);
  console.log(
    `ENG_MATH_DIST_BOUNDARY: pass free=10 locked=406 catalogs=12/88 englishCandidates=196/417 mathAnswers=690/${data.mathAnswerSource} mathSolutions=5public+${MATH_INTERNAL_VERIFIED_ID_COUNT}internal mathRequiredFigures=7internal mathFigureSource=${options.mathFigureSourceDirectory ? "verified" : "recorded"} mathSourceCorrections=${MATH_SOURCE_CORRECTION_ID_COUNT} mathSource=${options.mathSourceDirectory ? "verified" : "recorded"} math2022_09Source=${options.math2022SeptemberSourceDirectory ? "verified" : "recorded"} math2023_06Source=${options.math2023JuneSourceDirectory ? "verified" : "recorded"} math2023_09Source=${options.math2023SeptemberSourceDirectory ? "verified" : "recorded"} math2024_06Source=${options.math2024JuneSourceDirectory ? "verified" : "recorded"} math2024_09Source=${options.math2024SeptemberSourceDirectory ? "verified" : "recorded"} math2025_06Source=${options.math2025JuneSourceDirectory ? "verified" : "recorded"} math2025_09Source=${options.math2025SeptemberSourceDirectory ? "verified" : "recorded"}`,
  );
} else {
  fail("MODE_INVALID", mode);
}
