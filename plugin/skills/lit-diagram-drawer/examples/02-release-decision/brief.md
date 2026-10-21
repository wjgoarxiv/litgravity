# Diagram brief · 배포 승인 흐름

- Type: flowchart
- Audience: engineers and reviewers
- Purpose: 검증에 실패하면 변경을 다시 제출하고, 통과하면 담당자 승인 뒤 운영 환경에 배포한다.
- Theme: light
- Canvas: 16:9 slide, editable SVG in HTML
- Required facts:
- 변경 제출 participates in the labeled relationships below.
- 검증 통과? participates in the labeled relationships below.
- 담당자 승인 participates in the labeled relationships below.
- 운영 배포 participates in the labeled relationships below.
- Required relationships:
- 변경 제출 → 검증 통과? (검사)
- 검증 통과? → 담당자 승인 (예)
- 검증 통과? → 변경 제출 (아니오)
- 담당자 승인 → 운영 배포 (승인)
- Do not infer omitted systems or timing.
