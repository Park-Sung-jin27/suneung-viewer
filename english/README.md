# English Exam DB

This folder is for the separate English reading-pattern project.

It is independent from the Korean viewer data file:

- Not used: `public/data/all_data_204.json`
- DB file: `english/data/english_exam_db.json`
- Rebuild command: `node english/scripts/build_english_db.mjs`

Current scope:

- Exams: 2017~2026 school-year June, September, CSAT English, plus 2027 school-year June
- Questions: 18~45
- Main pattern targets: 20~24, 31~40
- CSAT form: odd form

Known hold:

- `2021_csat_18` through `2021_csat_45` need OCR because the source problem PDF is image-only.
