// Display offsets only; never infer a blank from arbitrary whitespace or the answer.
export function splitEnglishBlankText(text = '', spans = []) {
  const parts = [];
  let cursor = 0;
  for (const span of spans) {
    if (!Number.isInteger(span.start) || span.start < cursor || span.length !== 1 || text.slice(span.start, span.start + 1) !== '\t') {
      throw new Error('Invalid English blank position');
    }
    parts.push({ text: text.slice(cursor, span.start) });
    parts.push({ blank: true, width: span.width === 'short' ? 'short' : 'long' });
    cursor = span.start + span.length;
  }
  parts.push({ text: text.slice(cursor) });
  return parts;
}
