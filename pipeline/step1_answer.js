import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractAnswers(pdfPath) {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system:
      '너는 수능 정답표에서 문항번호와 정답을 추출하는 전문가다.\n' +
      '반드시 순수 JSON만 출력하라. 설명, 마크다운, 기타 텍스트 없음.\n' +
      '반드시 1번~34번만 추출하라. 35번 이상은 선택과목이므로 절대 포함하지 않는다.\n' +
      '존재하지 않는 문항은 절대 만들어내지 말 것.\n' +
      '출력 형식: { "1": 3, "2": 1, "3": 5 } (문항번호: 정답번호)',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: '이 정답표에서 모든 문항의 정답을 추출해라.',
          },
        ],
      },
    ],
  });

  const text = response.content[0].text.trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
  return JSON.parse(text);
}

// 테스트 실행
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pdfPath = process.argv[2];
  const maxQuestion = parseInt(process.argv[3]) || 45;

  if (!pdfPath) {
    console.error('사용법: node pipeline/step1_answer.js [정답표PDF경로] [최대문항수]');
    process.exit(1);
  }

  extractAnswers(pdfPath)
    .then((result) => {
      Object.keys(result).forEach(key => {
        if (parseInt(key) > maxQuestion) delete result[key];
      });
      console.log(`추출 완료: 1~${maxQuestion}번 (총 ${Object.keys(result).length}문항)`);
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error('오류:', err.message);
      process.exit(1);
    });
}
