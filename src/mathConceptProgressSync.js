import {
  normalizeMathConceptProgress,
  summarizeMathConceptProgress,
} from "./mathConceptProgress.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUserId(userId) {
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
    throw new Error("MATH_CONCEPT_AUTH_USER_ID");
  }
  return userId.toLowerCase();
}

function stableHash(value) {
  let hash = 0xcbf29ce484222325n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function validConceptMap(validConcepts) {
  if (!Array.isArray(validConcepts)) {
    throw new Error("MATH_CONCEPT_CATALOG");
  }
  return new Map(validConcepts.map((concept) => [concept.id, concept.unitId]));
}

export function mathConceptProgressToEventRows(
  progress,
  authenticatedUserId,
  validConcepts,
) {
  const userId = validateUserId(authenticatedUserId);
  const conceptUnits = validConceptMap(validConcepts);
  return normalizeMathConceptProgress(progress).completions
    .filter(
      (completion) =>
        conceptUnits.get(completion.conceptId) === completion.unitId,
    )
    .map((completion) => ({
      event_id: `concept-v1:${stableHash(completion.conceptId)}:complete`,
      user_id: userId,
      subject: "math",
      activity_type: "concept_complete",
      problem_key: completion.conceptId,
      source_session_id: `concept-v1:${completion.unitId}`,
      occurred_at: completion.completedAt,
      correct: null,
      outcome: "completed",
      correct_first: null,
      review_offset: null,
    }));
}

export function memberConceptEventsToProgress(rows, validConcepts) {
  if (!Array.isArray(rows)) {
    throw new Error("MATH_CONCEPT_EVENT_ROWS");
  }
  const conceptUnits = validConceptMap(validConcepts);
  const completions = rows
    .filter((row) => {
      const unitId = String(row?.source_session_id ?? "").replace(
        /^concept-v1:/,
        "",
      );
      return (
        row?.subject === "math" &&
        row?.activity_type === "concept_complete" &&
        row?.outcome === "completed" &&
        conceptUnits.get(row?.problem_key) === unitId &&
        Number.isFinite(Date.parse(row?.occurred_at))
      );
    })
    .map((row) => ({
      conceptId: row.problem_key,
      unitId: row.source_session_id.replace(/^concept-v1:/, ""),
      completedAt: row.occurred_at,
    }));
  return normalizeMathConceptProgress({ version: 1, completions });
}

export async function syncMemberMathConceptProgress({
  supabase,
  authenticatedUserId,
  progress,
  validConcepts,
  now = new Date(),
}) {
  if (!supabase || typeof supabase.from !== "function") {
    throw new Error("MATH_CONCEPT_SUPABASE_CLIENT");
  }
  const userId = validateUserId(authenticatedUserId);
  const rows = mathConceptProgressToEventRows(progress, userId, validConcepts);

  if (rows.length > 0) {
    const { error } = await supabase.from("learning_events").upsert(rows, {
      onConflict: "user_id,event_id",
      ignoreDuplicates: true,
    });
    if (error) {
      throw new Error(
        `MATH_CONCEPT_SYNC:${error.message || error.code || "unknown"}`,
      );
    }
  }

  const { data, error } = await supabase
    .from("learning_events")
    .select(
      "event_id,subject,activity_type,problem_key,source_session_id,occurred_at,outcome",
    )
    .eq("user_id", userId)
    .eq("activity_type", "concept_complete")
    .order("occurred_at", { ascending: true });
  if (error) {
    throw new Error(
      `MATH_CONCEPT_FETCH:${error.message || error.code || "unknown"}`,
    );
  }
  if (!Array.isArray(data)) {
    throw new Error("MATH_CONCEPT_FETCH_DATA");
  }

  const remoteProgress = memberConceptEventsToProgress(data, validConcepts);
  const mergedProgress = normalizeMathConceptProgress({
    version: 1,
    completions: [
      ...normalizeMathConceptProgress(progress).completions,
      ...remoteProgress.completions,
    ],
  });
  return {
    syncedEventCount: rows.length,
    progress: mergedProgress,
    summary: summarizeMathConceptProgress(mergedProgress, validConcepts, now),
  };
}
