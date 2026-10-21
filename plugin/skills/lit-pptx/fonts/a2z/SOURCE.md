# 에이투지체 (A2Z) — 번들 폰트 출처/공급망

- 폰트: 에이투지체 (A2Z), 제작 "오토노머스에이투지 × 이주임"
- 버전: v1.001
- 라이선스: **SIL Open Font License (OFL)** — 상업 사용·수정·재배포·임베딩 허용, 출처표기 불요, 폰트 자체 유료판매 금지
- 공식 배포: https://freesentation.blog/a2z · 레포: https://github.com/Freesentation/A2Z
- 다운로드(OTF): https://github.com/Freesentation/A2Z/raw/refs/heads/main/v1.001/에이투지체-otf-v1.001.zip
- **SHA256 (otf zip, 공급망 핀):** `e169dcd454b100fbf420a8bd86c67b88c9f939b8045a7792789fdf7dadfaf1a7`

## 웨이트 = 별도 family (중요)
각 웨이트가 독립 family로 등록됨. PowerPoint/pptxgenjs에서 굵기는 `bold=true`가 아니라 **family명 직접 지정**으로 선택.

| 파일 | name(1) EN | name(1) KR | weight |
|---|---|---|---|
| A2Z-Thin.otf | A2Z 1 Thin | 에이투지체 1 Thin | 100 |
| A2Z-ExtraLight.otf | A2Z 2 ExtraLight | 에이투지체 2 ExtraLight | 200 |
| A2Z-Light.otf | A2Z 3 Light | 에이투지체 3 Light | 300 |
| A2Z-Regular.otf | A2Z 4 Regular | 에이투지체 4 Regular | 400 |
| A2Z-Medium.otf | A2Z 5 Medium | 에이투지체 5 Medium | 500 |
| A2Z-SemiBold.otf | A2Z 6 SemiBold | 에이투지체 6 SemiBold | 600 |
| A2Z-Bold.otf | A2Z 7 Bold | 에이투지체 7 Bold | 700 |
| A2Z-ExtraBold.otf | A2Z 8 ExtraBold | 에이투지체 8 ExtraBold | 800 |
| A2Z-Black.otf | A2Z 9 Black | 에이투지체 9 Black | 900 |

- typo family(16) = `A2Z`, subfamily(17) = `N Weight`
- CJK 덱 호환을 위해 PPTX 출력은 한국어 family명(`에이투지체 N Weight`)을 1차로 사용 권장(Phase 4에서 확정).

## 라이선스 동봉
- `OFL.txt` 동봉 완료(SIL OFL 1.1 원문 + 폰트 name 테이블 기준 저작권 헤더: `Copyright © 2026 PT&`, 디자이너 Lee Juim). Reserved Font Name 미선언.
