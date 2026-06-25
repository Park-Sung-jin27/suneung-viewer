import { handleInyeonRoom } from "../_inyeonRoomStore.js";

export default function handler(req, res) {
  return handleInyeonRoom(req, res, req.query?.code);
}
