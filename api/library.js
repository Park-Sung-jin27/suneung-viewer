import { handleLibrary } from "./_libraryStore.js";

export default function handler(req, res) {
  return handleLibrary(req, res);
}
