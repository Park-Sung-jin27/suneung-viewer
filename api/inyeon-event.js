import { recordGrowthEvent } from "./_growthStore.js";

export default function handler(req, res) {
  return recordGrowthEvent(req, res);
}
