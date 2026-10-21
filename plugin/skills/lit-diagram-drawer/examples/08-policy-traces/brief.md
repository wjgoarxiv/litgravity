# Diagram brief · 같은 요청, 다른 정책 결과

- Type: policy-trace-animated
- Audience: engineers and reviewers
- Purpose: 요청 문맥은 두 규칙 경로를 거쳐 허용 또는 거부로 끝나며 정지 화면만으로 결과를 읽을 수 있다.
- Theme: light
- Canvas: 16:9 slide, editable SVG in HTML
- Required facts:
- 요청 A participates in the labeled relationships below.
- 규칙: 역할 확인 participates in the labeled relationships below.
- 허용 participates in the labeled relationships below.
- 요청 B participates in the labeled relationships below.
- 규칙: 범위 확인 participates in the labeled relationships below.
- 거부 participates in the labeled relationships below.
- Required relationships:
- 요청 A → 규칙: 역할 확인 (context)
- 규칙: 역할 확인 → 허용 (allow)
- 요청 B → 규칙: 범위 확인 (context)
- 규칙: 범위 확인 → 거부 (deny)
- Do not infer omitted systems or timing.
