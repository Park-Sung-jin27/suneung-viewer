import { recordWaitlist } from "./_growthStore.js";

export default function handler(req, res) {
  return recordWaitlist(req, res);
}
