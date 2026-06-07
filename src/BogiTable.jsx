// ============================================================
// BogiTable.jsx
// <보기> 표 렌더링 통합 컴포넌트 — 2가지 shape 지원
//   1) 선지 판정표: rows = { num, content, result, ok }  → 클릭 가능 ○×표
//   2) 데이터표:   rows = { label, <header>: value... } → 비클릭 일반 표
//      (예: 2026_9월 r20269d Q17 — headers ["소리","A","B","C","D"])
// QuizPanel.jsx 에 import해서 사용
// ============================================================

const cellBorder = "1px solid #d1d5db";

function DataTable({ instruction, headers, rows }) {
  return (
    <div
      style={{
        margin: "10px 0 14px",
        border: "1.5px solid #374151",
        borderRadius: "6px",
        overflow: "hidden",
        fontFamily: "'Noto Serif KR', 'Apple SD Gothic Neo', serif",
      }}
    >
      {instruction && (
        <div
          style={{
            padding: "8px 14px",
            fontSize: "0.84rem",
            fontWeight: "600",
            color: "#111827",
            background: "#f9fafb",
            borderBottom: "1px solid #d1d5db",
            letterSpacing: "-0.01em",
            whiteSpace: "pre-line",
          }}
        >
          {instruction}
        </div>
      )}

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.875rem",
        }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "8px 10px",
                  textAlign: "center",
                  fontWeight: "700",
                  fontSize: "0.84rem",
                  background: "#f3f4f6",
                  border: cellBorder,
                  letterSpacing: "-0.01em",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
              <td
                style={{
                  padding: "8px 10px",
                  border: cellBorder,
                  textAlign: "center",
                  fontWeight: "600",
                  color: "#111827",
                  background: "#f9fafb",
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                {row.label}
              </td>
              {headers.slice(1).map((h, j) => (
                <td
                  key={j}
                  style={{
                    padding: "8px 10px",
                    border: cellBorder,
                    textAlign: "center",
                    color: "#111827",
                  }}
                >
                  {row[h]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BogiTable({ bogiTable, sel, onSelect }) {
  if (!bogiTable) return null;
  const { instruction, headers, rows } = bogiTable;
  if (!Array.isArray(headers) || !Array.isArray(rows) || rows.length === 0)
    return null;

  // shape 판별: 선지 판정표는 rows에 num + content 보유
  const isChoiceTable = rows[0].num != null && rows[0].content != null;
  if (!isChoiceTable)
    return (
      <DataTable instruction={instruction} headers={headers} rows={rows} />
    );

  return (
    <div
      style={{
        margin: "10px 0 14px",
        border: "1.5px solid #374151",
        borderRadius: "6px",
        overflow: "hidden",
        fontFamily: "'Noto Serif KR', 'Apple SD Gothic Neo', serif",
      }}
    >
      {/* 지시문 */}
      {instruction && (
        <div
          style={{
            padding: "8px 14px",
            fontSize: "0.84rem",
            fontWeight: "600",
            color: "#111827",
            background: "#f9fafb",
            borderBottom: "1px solid #d1d5db",
            letterSpacing: "-0.01em",
          }}
        >
          {instruction}
        </div>
      )}

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.875rem",
        }}
      >
        {/* 헤더 */}
        <thead>
          <tr>
            <th
              style={{
                padding: "8px 14px",
                textAlign: "center",
                fontWeight: "700",
                fontSize: "0.84rem",
                background: "#f3f4f6",
                border: cellBorder,
                width: "76%",
                letterSpacing: "-0.01em",
              }}
            >
              {headers[0]}
            </th>
            <th
              style={{
                padding: "8px 14px",
                textAlign: "center",
                fontWeight: "700",
                fontSize: "0.84rem",
                background: "#f3f4f6",
                border: cellBorder,
                width: "24%",
              }}
            >
              {headers[1]}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => {
            const isSelected = sel && sel.endsWith(`_c${row.num}`);
            const rowBg = isSelected
              ? row.ok
                ? "#ecfdf5"
                : "#fef2f2"
              : i % 2 === 0
                ? "#fff"
                : "#fafafa";
            const acColor = row.ok ? "#059669" : "#dc2626";

            return (
              <tr
                key={row.num}
                onClick={() => onSelect && onSelect(row.num)}
                style={{
                  background: rowBg,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                {/* 판단할 내용 */}
                <td
                  style={{
                    padding: "10px 14px",
                    border: cellBorder,
                    lineHeight: "1.65",
                    color: "#111827",
                    letterSpacing: "-0.01em",
                    verticalAlign: "middle",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "flex-start",
                      gap: "8px",
                    }}
                  >
                    {/* 선지 번호 뱃지 */}
                    <span
                      style={{
                        minWidth: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        marginTop: "2px",
                        background: isSelected ? acColor : "#e5e7eb",
                        color: isSelected ? "#fff" : "#6b7280",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        fontWeight: "700",
                        flexShrink: 0,
                      }}
                    >
                      {row.num}
                    </span>
                    <span>{row.content}</span>
                  </span>
                </td>

                {/* 판단 결과 ○ / × */}
                <td
                  style={{
                    border: cellBorder,
                    textAlign: "center",
                    verticalAlign: "middle",
                    background: isSelected
                      ? row.ok
                        ? "#d1fae5"
                        : "#fee2e2"
                      : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: "900",
                      color: isSelected ? acColor : "#374151",
                      fontFamily: "sans-serif",
                      display: "block",
                      lineHeight: 1,
                      padding: "8px 0",
                    }}
                  >
                    {row.result}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        color: acColor,
                        display: "block",
                        paddingBottom: "4px",
                      }}
                    >
                      {row.ok ? "일치 ✓" : "불일치 ✗"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
