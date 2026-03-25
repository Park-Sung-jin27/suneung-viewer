// ============================================================
// BogiTable.jsx
// "맞으면 ○, 틀리면 ×" 표 형식 보기 렌더링 컴포넌트
// QuizPanel.jsx 에 import해서 사용
// ============================================================

export function BogiTable({ bogiTable, sel, onSelect }) {
  if (!bogiTable) return null;
  const { instruction, headers, rows } = bogiTable;

  return (
    <div style={{
      margin: '10px 0 14px',
      border: '1.5px solid #374151',
      borderRadius: '6px',
      overflow: 'hidden',
      fontFamily: "'Noto Serif KR', 'Apple SD Gothic Neo', serif",
    }}>
      {/* 지시문 */}
      {instruction && (
        <div style={{
          padding: '8px 14px',
          fontSize: '0.84rem',
          fontWeight: '600',
          color: '#111827',
          background: '#f9fafb',
          borderBottom: '1px solid #d1d5db',
          letterSpacing: '-0.01em',
        }}>
          {instruction}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        {/* 헤더 */}
        <thead>
          <tr>
            <th style={{
              padding: '8px 14px', textAlign: 'center',
              fontWeight: '700', fontSize: '0.84rem',
              background: '#f3f4f6', border: '1px solid #d1d5db',
              width: '76%', letterSpacing: '-0.01em',
            }}>
              {headers[0]}
            </th>
            <th style={{
              padding: '8px 14px', textAlign: 'center',
              fontWeight: '700', fontSize: '0.84rem',
              background: '#f3f4f6', border: '1px solid #d1d5db',
              width: '24%',
            }}>
              {headers[1]}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => {
            const isSelected = sel && sel.endsWith(`_c${row.num}`);
            const rowBg   = isSelected ? (row.ok ? '#ecfdf5' : '#fef2f2') : (i % 2 === 0 ? '#fff' : '#fafafa');
            const acColor = row.ok ? '#059669' : '#dc2626';

            return (
              <tr
                key={row.num}
                onClick={() => onSelect && onSelect(row.num)}
                style={{ background: rowBg, cursor: 'pointer', transition: 'background 0.15s' }}
              >
                {/* 판단할 내용 */}
                <td style={{
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  lineHeight: '1.65',
                  color: '#111827',
                  letterSpacing: '-0.01em',
                  verticalAlign: 'middle',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '8px' }}>
                    {/* 선지 번호 뱃지 */}
                    <span style={{
                      minWidth: '20px', height: '20px', borderRadius: '50%', marginTop: '2px',
                      background: isSelected ? acColor : '#e5e7eb',
                      color: isSelected ? '#fff' : '#6b7280',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: '700', flexShrink: 0,
                    }}>
                      {row.num}
                    </span>
                    <span>{row.content}</span>
                  </span>
                </td>

                {/* 판단 결과 ○ / × */}
                <td style={{
                  border: '1px solid #d1d5db',
                  textAlign: 'center', verticalAlign: 'middle',
                  background: isSelected ? (row.ok ? '#d1fae5' : '#fee2e2') : 'transparent',
                  transition: 'background 0.15s',
                }}>
                  <span style={{
                    fontSize: '1.4rem', fontWeight: '900',
                    color: isSelected ? acColor : '#374151',
                    fontFamily: 'sans-serif',
                    display: 'block', lineHeight: 1, padding: '8px 0',
                  }}>
                    {row.result}
                  </span>
                  {isSelected && (
                    <span style={{ fontSize: '0.65rem', color: acColor, display: 'block', paddingBottom: '4px' }}>
                      {row.ok ? '일치 ✓' : '불일치 ✗'}
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
