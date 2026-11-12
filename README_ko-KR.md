<p align="center"><picture><source media="(prefers-reduced-motion: reduce)" srcset="./docs/assets/cover-motion-still.webp" /><source media="(prefers-reduced-motion: no-preference)" srcset="./docs/assets/cover-motion.webp" /><img src="./docs/assets/cover.webp" width="100%" alt="LitFamily 커버: 장갑 기계 일곱 대가 각자 칸에 서 있고, 일곱 번째 칸의 LitGravity 기계(어두운 구형 머리를 자이로 고리가 감싼 기계)가 머리와 가슴의 주황 코어를 켜고 테두리에 불이 들어옵니다. 위에는 LITFAMILY, 아래에는 KEEP THE WORK LIT." /></picture></p>

<h1 align="center">LitGravity</h1>
<p align="center"><strong>Keep the work lit.</strong></p>

<p align="center">LitGravity는 Google의 Antigravity CLI(<code>agy</code>)에 일하는 습관을 붙여 줍니다. 고치기 전에 계획하고, 만든 것을 확인하고, 끝낼 때 인계 메모를 남깁니다. 그래서 다음 대화가 이번 대화가 멈춘 자리에서 바로 이어집니다. npm 명령 하나로 agy 플러그인으로 설치됩니다.</p>

<p align="center">
<a href="https://www.npmjs.com/package/@litfamily/litgravity"><img src="https://img.shields.io/npm/v/@litfamily/litgravity?color=FF6337&amp;label=npm" alt="npm 버전" /></a>
<a href="https://www.npmjs.com/package/@litfamily/litgravity"><img src="https://img.shields.io/npm/dm/@litfamily/litgravity?color=D7F75B" alt="월간 npm 다운로드" /></a>
<a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT 라이선스" /></a>
<a href="https://github.com/wjgoarxiv/litgravity/stargazers"><img src="https://img.shields.io/github/stars/wjgoarxiv/litgravity?style=flat" alt="GitHub 스타" /></a>
</p>

<p align="center"><a href="#설치"><img src="./docs/assets/readme/icon-book.svg" width="16" alt="" /> 설치</a> &nbsp; <a href="#데모"><img src="./docs/assets/readme/icon-play.svg" width="16" alt="" /> 데모</a> &nbsp; <a href="#안전과-제거"><img src="./docs/assets/readme/icon-shield.svg" width="16" alt="" /> 업데이트·제거</a> &nbsp; <a href="#빠른-시작">빠른 시작</a> &nbsp; <a href="#만들-수-있는-것">만들 수 있는 것</a> &nbsp; <a href="#들어-있는-것">들어 있는 것</a> &nbsp; <a href="#지금-agy가-막아-두는-것">agy의 한계</a> &nbsp; <a href="./README.md">English</a></p>

> [!TIP]
> npm 명령 하나로 LitGravity를 agy 플러그인으로 설치합니다([설치](#설치)). 그다음 agy 프롬프트를 `lit`으로 시작하면 되고, 순서는 [빠른 시작](#빠른-시작)에 있습니다.

## 데모

`lit`을 치면 무엇이 도는지, 이 Mac의 실제 훅과 상태 표시줄에서 가져왔습니다. 친 프롬프트, 끼워 넣은 경로 안내, lit-loop 지도를 단 상태 표시줄 순서입니다.

<!-- demo-gif --><p align="center"><img src="./docs/assets/litgravity/demo-ignition.webp" width="960" alt="터미널 갈무리. 프롬프트는 lit add a --shout flag that prints the greeting in capitals, with a test. 훅은 LIT 표시와 LIT IGNITED · lit-loop로 답하고, 먼저 읽을 lit-loop 스킬 파일을 알리고, 도구 기록이 대화 ledger에 남는다고 안내합니다. 아래 상태 표시줄에는 모델, 42퍼센트 컨텍스트 게이지, 시계가 달린 lit-loop 칩, PIN이 켜진 PIN부터 RECORD까지의 지도가 보입니다." /></p>

## 빠른 시작

1. [LitGravity를 설치](#설치)한 뒤 프로젝트에서 agy를 엽니다. `/skills`로 LitGravity 스킬을, `/hooks`로 플러그인의 훅을 볼 수 있습니다.
2. 프롬프트를 `lit`으로 시작합니다. 뒤에 오는 단어가 경로를 고르며, 아래 표에 정리했습니다.
3. 계획을 승인한 뒤 `lit start plans/<slug>.md`를 실행하면 계획의 행을 하나씩 테스트와 함께 만들어 갑니다.
4. 멈추기 전에 `lit handoff`. 다음에는 `lit recap`이 어디까지 했는지 읽어 줍니다.

```text
입력      lit plan a tiny todo app
동작      plan 스킬을 읽고 저장소를 살핀 뒤, 작업 순서와 확인 기준을 plans/todo-app.md에 씀
마무리    "계획을 저장했습니다. 괜찮으면 `lit start plans/todo-app.md`를 실행하세요."
```

| 입력 | 일어나는 일 |
|---|---|
| `lit` | 기본 루프가 돌거나, `lit start`로 시작해 둔 계획을 이어받습니다 |
| 경로가 이미 켜진 상태에서 다시 `lit` | 짧은 "이어 갑니다" 메모만 갑니다 |
| `lit plan`, `lit review`, `lit research`, `lit debug`, `lit handoff`, `lit recap`, `lit brainstorm`, `lit korean` | 그 경로를 고릅니다 |
| `lit <다른 경로>` | 경로를 바꿉니다 |
| 그 자리에 쓴 스킬 id(`lit debugging`, `lit structural-search`) | 그 스킬을 실행합니다. `/litgravity:<스킬-id>`는 같은 일을 슬래시 명령으로 합니다 |
| `lit new` | 처음부터 다시 시작합니다 |

`npx @litfamily/litgravity list`는 모든 스킬과 그 스킬에 닿는 단어를 출력합니다.

## 만들 수 있는 것

아래 그림은 모두 이 Mac에서 나온 실제 결과물입니다. `lit-adhd` 브리프는 실제 agy 대화 세 개를 수집기가 읽어 그렸고, 나머지는 각 스킬의 예제를 그 스킬의 엔진이 만든 것입니다. 덱, P&ID, 장치도, 영상은 이제 wjgoarxiv-skills에 있는 스킬이 만든 것이며([확장](#확장) 참고), 그 확장을 설치하면 agy가 같은 방식으로 만듭니다.

| 그림 | 스킬 | 보여 주는 것 |
|---|---|---|
| <img src="./docs/assets/litgravity/showcase/deck-themes.webp" width="480" alt="물류 플랫폼을 다룬 같은 한국어 덱을 네 가지 톤으로 그린 그림. 호박색 연도가 있는 어두운 표지, KPI 네 개가 있는 남색 표지, 크림 바탕의 코발트 표지, 청록 표지가 있고, 각 표지 아래에 월별 화물 막대 차트와 요점 두 줄, 데이터 표가 있는 차트 슬라이드가 있습니다." /> | `lit-pptx` | 한 덱을 네 가지 톤으로 만든 모습입니다. 차트와 KPI 줄은 편집할 수 있는 원본 그대로이고, Pretendard가 들어 있으며, 넘침·대비·빈 슬라이드 검사를 통과했습니다. |
| <img src="./docs/assets/litgravity/showcase/pid-dosing-skid.webp" width="480" alt="차아염소산나트륨 주입 스키드의 P&amp;ID. 레벨 전송기와 경보가 달린 저장 탱크 TK-101, 필터와 체크 밸브 뒤의 주·예비 정량 펌프 P-101A와 P-101B, 탱크로 돌아가는 안전 밸브 PSV-101, 펌프로 신호를 보내는 FE-101·FT-101·FIC-101 유량 루프, 범례, 노트, 표제란이 있습니다." /> | `lit-schematic` | ISA-5.1 태그, 라인 번호, 범례, 표제란을 갖춘 P&amp;ID입니다. 선 위 글자, 기호를 지나는 선, 끊긴 선이 없다는 검사를 통과했습니다. |
| <img src="./docs/assets/litgravity/showcase/schematics.webp" width="480" alt="두 그림. 구리 튜브 다발과 배플, 새들 받침이 보이는 셸앤튜브 열교환기 등각 절단도에 부품 이름이 달려 있고, 옆에는 논문용 두 패널 흡착 장치 그림이 있습니다. a는 가스 실린더, 질량 유량 조절기, 오븐 안의 컬럼, 질량 분석기의 흐름도, b는 흡착층과 열전대가 있는 컬럼입니다." /> | `lit-schematic` | 같은 스킬이 장치를 등각 절단도로, 그리고 논문용 두 패널 그림으로 그린 예입니다. |
| <img src="./docs/assets/litgravity/showcase/motion-film.webp" width="480" alt="어두운 한 가지 스타일로 된 12초 영상의 네 장면. 작게 시작해서 끝까지 옆에 그려지는 고리, One clock for every frame 옆의 막대 차트, 한 화면에 한 가지 생각 옆의 점을 잇는 선, Same house, every film 위의 청록과 호박색 타일." /> | `lit-typographic-motion` | 한 줄짜리 한국어 요청으로 만든 12초 영상의 네 장면입니다. 스킬이 먼저 트리트먼트를 쓰고, 사운드와 함께 한 프레임씩 렌더링한 뒤, 깜빡임·가독성·루프 검사를 거쳤습니다. |
| <img src="./docs/assets/litgravity/showcase/adhd-brief-ko.webp" width="480" alt="어두운 대화 창에 뜬 lit adhd 브리프. 세션 세 개를 세는 제목, P&amp;ID와 랜딩 페이지를 만들던 진행 중 카드 두 장과 각각 쓴 파일, 다음 단계, 끝난 덱 세션 한 줄짜리 표, 로드맵 한 줄, 추천 다음 단계 상자가 있습니다." /> | `lit-adhd` | 정신없던 하루 끝에 `lit adhd`를 입력하면 KPI 보드가 나옵니다. 그림 속 세션별 브리프는 `lit adhd 자세히`로 보드 아래에 붙습니다. |

lit-adhd 보드에는 지금 할 일 하나와 입력할 말, 끝난 마일스톤과 남은 마일스톤의 진행 막대, `할 일 → 어떻게` 모양의 알림이 들어갑니다. 알림은 나를 기다리는 대화, 커밋 안 된 변경, 아직 도는 레인, 일주일 넘게 멈춘 계획을 다룹니다.

## 설치

Node.js 20 이상과, 한 번 로그인해 둔 Antigravity CLI가 필요합니다. 아무 폴더에서 실행하세요. 깨진 곳이 없으면 확인 명령의 마지막 줄이 `LitGravity: ready`입니다.

```bash
npx @litfamily/litgravity install
npx @litfamily/litgravity doctor
```

나중에 업데이트할 때는 같은 `install`을 다시 실행합니다. 수명 주기 명령은 모두 [안전과 제거](#안전과-제거)에 있습니다. 코딩 에이전트에게 설치를 맡기려면 [참고 문서](./docs/reference_ko-KR.md#코딩-에이전트에게-설치-맡기기)의 프롬프트를 붙여 넣으세요.

설치기는 먼저 쓸 위치를 모두 보여 주고, 복사 전후에 `agy plugin validate`로 플러그인을 검증합니다. agy는 플러그인의 훅, 스킬, 에이전트를 신뢰 단계 없이 불러오므로 따로 승인할 것이 없습니다. 기본값은 플러그인을 `~/.gemini/config/plugins/litgravity`에 복사하는 것이라 모든 프로젝트에서 LitGravity를 쓸 수 있습니다.

| 옵션 | 하는 일 |
|---|---|
| `--scope project` | 한 프로젝트의 `./.agents/plugins/litgravity`에만 복사합니다 |
| `--dry-run` | 미리 보기만 하고 아무것도 쓰지 않습니다 |
| `--yes` | 터미널 없는 셸(에이전트, CI)은 미리 보기만 하는데, 이때도 설치합니다 |
| `--no-agent-file` | 전역 규칙 파일을 한 번만 건너뜁니다 |
| `--status-line` | 백업 뒤 agy 사용자 설정에 선택형 상태 표시줄을 더합니다 |

사용자 범위 설치는 `~/.gemini/config/rules/litgravity.md`에 LitGravity 전용 규칙 파일 하나를 남깁니다. agy가 매 세션 시작에 그 폴더를 읽기 때문입니다. 규칙은 일부러 짧게(lit 호출어, 계획과 핸드오프의 위치, 릴리스 동결) 두어서 어떤 스킬이 뜨기 전에 기본 규칙이 서도록 합니다. 대화형 설치는 먼저 묻고 No라고 답하면 규칙을 끈 채로 저장하며, `--yes`는 규칙을 더합니다. 나중에 끄거나 프로젝트 블록을 넣는 명령은 [수명 주기 표](#안전과-제거)에 있습니다.

`doctor`는 설치된 사본, 검증 결과, 훅 이벤트 6개와 각 훅 스크립트의 실행 확인, 전역 규칙 파일, 스킬과 에이전트 전체, 확장과 그 설치 명령, 남아 있는 옛 엔진 캐시나 잘못 놓인 보관 사본, 스킬이 부르는 호스트 프로그램을 보여 줍니다.

설치기는 프로젝트 바깥 몇 군데에 파일을 쓰고, 그 위치는 아래 그림에 있습니다. 목적지가 심볼릭 링크이거나, 다른 데서 온 폴더이거나, 직접 고친 사본이면 `No files written.`을 남기고 멈춥니다. 문제가 없으면 플러그인을 복사하고 규칙 파일과 작은 영수증을 씁니다. LitGravity가 디스크에 남기는 나머지는 대화가 나중에 쓰고, 설치한 확장은 설치기가 바꾸지 않습니다(확장 폴더는 `extensions check`에 보여 줄 것이 있는지 한 번 읽기만 합니다).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/litgravity/diagrams/install-map.ko.dark.png">
    <img src="./docs/assets/litgravity/diagrams/install-map.ko.light.png" width="900" alt="litgravity install의 흐름도. 계획을 출력한 뒤 목적지 상태를 확인한다. 심볼릭 링크, 남의 것, 수정본이면 No files written.을 남기고 멈추며, 수정본에는 saved/로 옮기는 명령을 안내한다. 새것이거나 LitGravity 사본이면 agy plugin validate로 검증하고, 플러그인을 ~/.gemini/config/plugins/litgravity(프로젝트 범위는 ./.agents/plugins/litgravity)에 복사한 뒤 다시 검증한다. 마지막 단계는 전역 규칙 파일 ~/.gemini/config/rules/litgravity.md를 쓰고, ~/.local/share/litgravity/ 아래에 receipt.json, backups/, saved/를 두고, --status-line일 때만 ~/.gemini/antigravity-cli/settings.json을 바꾼다. 아래 두 띠: 대화가 나중에 쓰는 곳(~/.local/state/litgravity/, plans/, ledger·handoff·goals가 든 .litgravity/)과 설치기가 건드리지 않는 곳(직접 복사한 확장 ~/.gemini/config/skills/<id>, agy 자격 증명 파일).">
  </picture>
</p>

<p align="center"><img src="./docs/assets/litgravity/install-doctor.webp" width="960" alt="터미널 갈무리. 설치 명령은 Status: Ready로 끝나고, doctor 명령은 서른 개의 통과 확인 뒤에 LitGravity: ready로 끝납니다." /></p>

## 들어 있는 것

모든 lit 턴은 아래 부품으로 같은 순서를 따릅니다. 큰 변경은 첫 편집 전에 계획으로 적고, 작업은 한 대화보다 오래 남는 목표 기록 아래에서 행마다 테스트와 함께 만들며, 합치기 전에는 두 번째 눈이 검토합니다. 조사는 출처를 밝히고, 문서와 글은 깔끔하게 읽히며, 턴은 다음 대화가 읽을 인계 메모로 끝납니다.

| 부분 | 내용 | 역할 |
|---|---|---|
| 스킬 42개 | 참고 문서와 스크립트를 담은 agy 스킬 33개와 확장의 스텁 9개 | 계획, 구현, 확인, 조사, 작성, 인계 |
| 에이전트 11개 | agy가 타입 이름으로 시작하는 하위 에이전트 | 계획, 실행, 검증, 검토, 한국어 글 |
| 훅 6개 | 세션 시작, 매 턴, 매 도구 호출, 종료 게이트에서 실행 | `lit` 라우팅, 미완 턴 붙잡기, 도구 ledger 기록 |

agy는 `SKILL.md`의 앞 24,000바이트만 불러오므로, 필요할 때 읽는 스킬 33개는 참고 문서, 스크립트, 템플릿을 자기 폴더에 두고 긴 내용은 `references/`에 넣어 스킬이 열 파일을 알려 줍니다. 스킬 묶음은 루프와 목표, 아이디어와 계획, 구현, 검토와 정리, 조사와 지식, 팀, 글, 이어가기와 안내, 도구이고, 옮겨 간 묶음의 스텁 9개가 더해집니다([확장](#확장) 참고).

- **호스트 프로그램.** 스킬은 이미 설치된 Python 3, 브라우저 작업용 Chrome 또는 Chromium, ast-grep, ripgrep, `lsp`가 돌리는 언어별 검사기를 부릅니다. 빠진 것과 설치 명령은 `doctor`가 알려 주며, LitGravity는 소프트웨어를 전역으로 설치하지 않습니다.
- **에이전트.** agy가 `invoke_subagent`로 타입 이름을 지정해 시작합니다. lit-planner, lit-executor, lit-verifier, qa-runner, quality-reviewer, librarian-researcher, 그리고 한국어 글 에이전트 5개(korean-style-analyzer, korean-prose-editor, meaning-preservation-auditor, native-flow-reviewer, polish-orchestrator)입니다. 검토용 에이전트와 한국어 에이전트는 읽기와 검색 도구만 받습니다.
- **모델.** `npx @litfamily/litgravity models`는 agy가 제공하는 모델과 추론 강도를 agy에서 직접 읽어 보여 줍니다. Google이 나중에 모델을 추가하면 LitGravity를 업데이트하지 않아도 목록에 나타납니다.

<details>
<summary>훅 이벤트 6개</summary>

- SessionStart는 새 대화가 시작될 때 한 번, LitGravity 경로 목록과 업데이트 알림, 최근 인계 메모 위치를 알려 줍니다.
- PreInvocation은 `lit` 라우터입니다. agy에는 프롬프트 훅이 없으므로, 한 턴의 첫 모델 호출에서 라우터가 대화 기록의 가장 최근 프롬프트를 읽고, 다시 진입 규칙을 적용한 뒤, 읽을 스킬 파일을 알리는 단계 하나를 끼워 넣습니다.
- PostInvocation과 Stop은 agy가 미리 실행할 수 없는 검사를 맡습니다([한계](#지금-agy가-막아-두는-것) 참고). Stop은 끝나지 않은 턴도 붙잡으며, 자세한 내용은 [붙잡힌 턴](#붙잡힌-턴과-ledger)에 있습니다.
- PreToolUse는 lit-plan이 켜져 있는 동안 쓰기가 가능한 하위 에이전트를 거절합니다.
- PostToolUse는 경로가 켜져 있는 동안 도구 호출마다 `.litgravity/ledger/<대화>.jsonl`에 한 줄을 남깁니다. 키 모양의 값은 가립니다. ledger가 조용하면 훅이 불러와지지 않은 것입니다.

</details>

### 상태 표시줄

프롬프트 아래 한 줄이 지금 작업이 어디쯤인지 보여 줍니다. 모델과 강도, 컨텍스트와 쿼터 게이지, 시계가 달린 지금 경로, 현재 단계가 켜진 경로 지도 순서입니다. 아래 갈무리는 이 Mac에서 실제로 렌더링한 것으로, `lit`을 치기 전과 친 뒤입니다.

<p align="center"><img src="./docs/assets/litgravity/status-states.webp" width="960" alt="상태 표시줄의 터미널 갈무리. lit 전에는 모델과 42퍼센트 컨텍스트 게이지만 보이고, lit 뒤에는 시계가 달린 lit-loop 칩과 PIN이 켜진 PIN부터 RECORD까지의 지도가 덧붙습니다." /></p>

설치할 때 `--status-line`을 주면 켜집니다. 칸 구성, 색, 평문 모양, `lit adhd`·YOUR TURN·검토 레인·DONE 모양은 [참고 문서](./docs/reference_ko-KR.md#상태-표시줄)에 있습니다.

## 확장

LitGravity는 agy용 LitFamily 코어이고, 그 자체로 완결되어 있습니다. 계획, 구현, 확인, 조사, 인계, `lit` 라우터가 모두 이 패키지에 들어 있습니다. 파일을 만드는 스킬(슬라이드, Word 문서, 다이어그램, 장치도, 그림, 화면, 영상, README 커버)은 저마다 엔진을 끌어오고 예전에는 패키지의 대부분을 차지했지만, 실제로는 대개 한두 개만 씁니다. 그래서 이제 이 스킬들은 LitFamily 확장으로 확장 선반인 wjgoarxiv-skills 저장소 한곳에 있고, 스킬마다 agy용 폴더가 있습니다.

그림 왼쪽은 모두 npm 패키지에 들어 있고, 코어는 오른쪽 없이도 계획하고, 구현하고, 확인하고, 조사하고, 인계까지 합니다. 쓰는 확장을 LitGravity와 함께 설치하면 LitFamily를 온전히 쓸 수 있고, 나머지를 설치하지 않아도 코어에서 빠지는 것은 없습니다.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/litgravity/diagrams/core-extensions.ko.dark.png">
    <img src="./docs/assets/litgravity/diagrams/core-extensions.ko.light.png" width="900" alt="두 영역으로 나뉜 그림. 왼쪽 LitGravity 플러그인에는 아홉 묶음(루프와 목표, 아이디어와 계획, 구현, 검토와 정리, 조사와 지식, 팀, 글, 이어가기와 안내, 도구)으로 나눈 코어 스킬 33개, 에이전트 11개, 훅 6개, 그리고 옛 이름을 지키는 스텁 9개(lit-pptx, lit-docx, lit-diagram-drawer, lit-schematic, lit-scientific-visualization, frontend-ui-ux, visual-qa, lit-typographic-motion, readme-studio)가 있다. 오른쪽 wjgoarxiv-skills 확장은 decks, documents, figures, design, video-covers 다섯 패밀리이고 폴더는 variants/litgravity/<id>다. 그 폴더에서 install <id> --yes 화살표가 litgravity extensions install 카드로 간다. 카드에는 네 단계가 번호로 적혀 있다. 같은 이름 스킬을 확인하고 있으면 멈춤, 옛 사본은 통째로 ~/.gemini/extension-backups/<날짜>/로 옮김, 비운 자리에 복사, 사본 안에 영수증 쓰기. 새 사본 + 영수증 화살표가 agy 사용자 스킬 ~/.gemini/config/skills/<id>로 이어지고, 이 스킬은 /<id>로 응답한다. 스텁에서도 설치돼 있으면이라는 화살표가 같은 곳으로 간다. 그 아래 카드에는 나머지 동사 list, check, update, remove, prune-backups가 있고 --yes 전에는 계획만 출력한다고 적혀 있다. 설치돼 있지 않으면 스텁은 이 명령과 손으로 붙여 넣는 네 줄을 알려 준다는 메모가 붙어 있다.">
  </picture>
</p>

| wjgoarxiv-skills의 묶음 | 확장 |
|---|---|
| `decks` | `lit-pptx` |
| `documents` | `lit-docx` |
| `figures` | `lit-diagram-drawer`, `lit-schematic`, `lit-scientific-visualization` |
| `design` | `frontend-ui-ux`, `visual-qa` |
| `video-covers` | `lit-typographic-motion`, `readme-studio` |

LitGravity는 확장마다 옛 이름으로 짧은 스텁을 남겨 두므로, `lit deck …`, `lit motion …`, `/litgravity:lit-pptx` 같은 요청은 여전히 쓸모 있는 곳에 닿습니다. 스텁은 설치된 사본이 있으면 턴을 그 사본에 넘기고, 아직 설치하지 않았으면 설치 명령을 알려 줄 뿐 아무것도 만들지 않습니다. 설치기도 설치나 업데이트가 끝날 때마다 같은 안내를 보여 주고, 그 뒤 첫 agy 대화에서 한 번 더 알려 줍니다.

가장 쉬운 길은 LitGravity의 `extensions` 명령입니다. 무언가를 바꾸는 동사는 먼저 계획을 출력하고 `--yes`를 기다리므로, 어떤 폴더가 어디로 옮겨지는지 미리 읽어 볼 수 있습니다.

```bash
npx @litfamily/litgravity extensions install lit-pptx          # 계획만 출력
npx @litfamily/litgravity extensions install lit-pptx --yes    # 실행 (--project: 이 워크스페이스에만)
```

| 동사 | 하는 일 |
|---|---|
| `install` | 옛 사본을 백업한 뒤 새 사본과 영수증을 넣습니다 |
| `list` | 확장마다 설치됨(영수증 포함), 설치 안 됨, 영수증 없음, 같은 이름 스킬에 가려짐을 보여 줍니다 |
| `update` | 원본을 새로 받아 파일이 바뀐 확장만 다시 설치합니다 |
| `remove` | 자기 사본을 백업으로 옮깁니다. 영수증 없는 폴더는 사용자 것이라 거절합니다 |
| `check` | 아무것도 바꾸지 않고, 중복·영수증 없는 사본·사라진 원본마다 고칠 한 줄을 출력합니다 |
| `prune-backups` | 백업과 크기를 보여 주고 `--yes`를 줄 때만 지웁니다 |

몇 가지 규칙 덕분에 이 명령은 안전하고 다루기 쉽습니다.

- **같은 이름 확인.** `install`은 복사하기 전에 agy가 읽는 모든 폴더를 살펴, 같은 이름의 스킬이 있으면 그 경로를 알려 주며 멈춥니다. 내 스킬은 절대 옮기지 않으며, `--allow-shadow`를 주면 경고만 하고 설치합니다.
- **백업.** 목적지에 이미 사본이 있으면 새 사본을 넣기 전에 통째로 `~/.gemini/extension-backups/` 아래 날짜 폴더로 옮깁니다.
- **원본.** wjgoarxiv-skills에서 agy 폴더만 얕게 받아 `~/.cache/litgravity/extensions-src`에 따로 두므로 직접 클론할 일이 없습니다. 이미 클론해 둔 저장소가 있으면 `--from <경로>`로 그것을 읽습니다.
- **여러 개 한 번에.** `--family <이름>`과 `--all`로 여러 개를 고릅니다. 자세한 내용은 `npx @litfamily/litgravity extensions help`에 있고, `doctor`도 `check`를 돌려 요약을 보여 줍니다.

새 대화를 열거나 `/skills reload`를 입력하면 스킬이 `/<id>`로 답합니다. 손으로 설치하는 네 줄과 워크스페이스 전용 줄, 사본을 업데이트하고 지우는 방법은 [참고 문서](./docs/reference_ko-KR.md#확장을-손으로-설치하기)에 있습니다.

## lit 한 턴이 도는 방식

대화를 돌리고 모델을 고르는 것은 여전히 agy입니다. LitGravity는 직접 읽을 수 있는 평범한 파일로 정해진 순서를 더하므로, 어디까지 했는지 다시 설명하거나 무엇이 실제로 돌아가는지 손으로 확인할 일이 줄어듭니다.

| agy가 하는 일 | lit이 더하는 일 |
|---|---|
| 한 줄만 치면 빠르게 시작합니다 | 첫 편집 전에 `plans/`에 계획을 적습니다 |
| 대화가 길어져 컨텍스트가 차면 지난 대화를 잊습니다 | 다음 턴이 읽을 `.litgravity/` 인계를 남깁니다 |
| 모델이 그렇다고 하면 끝냅니다 | 계획에 맞춰 확인하고, 확인하지 못한 곳은 미확인으로 표시합니다 |

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/litgravity/diagrams/lit-route.ko.dark.png">
    <img src="./docs/assets/litgravity/diagrams/lit-route.ko.light.png" width="900" alt="agy에서 lit 한 턴이 도는 흐름도. lit plan a tiny todo app을 입력하면 PreInvocation 훅이 대화 기록에서 프롬프트를 읽고 lit-plan/SKILL.md를 먼저 읽으라는 단계 하나를 주입한다. 모델 호출 뒤 PreToolUse 훅이 invoke_subagent 직전에 확인하고 하위 에이전트 11종 가운데 하나를 시작하게 두는데, lit-plan 중에는 읽기 전용만 허용한다. 도구 호출마다 PostToolUse 훅이 .litgravity/ledger/<conversation>.jsonl에 한 줄을 기록한다. PostInvocation 훅은 경계와 문장을 검사해 plans/ 밖 변경을 되돌리라고 모델에게 알린다(턴마다 최대 두 번). Stop 훅은 남은 일이 있는지 묻는다. 붙잡으면 턴이 이어지고(연속 최대 세 번, pause로 풀림), 풀어 주면 턴이 끝난다. 아래 다음 턴들: plans/<slug>.md에 대한 lit start, 다섯 레인(goal, qa, quality, security, context)의 lit review, .litgravity/handoff/latest.md를 쓰는 lit handoff, 그리고 다음 대화에 그 메모를 가리켜 주는 SessionStart 훅.">
  </picture>
</p>

agy는 플러그인에 프롬프트 자체를 받는 훅을 주지 않으므로, PreInvocation 훅이 그 턴의 첫 모델 호출에서 방향을 잡고 나머지 훅은 턴의 한 순간씩을 맡아 지켜봅니다. 순간마다 나중에 열어 볼 수 있는 파일(계획, ledger, 인계 메모)이 남고, 다음 턴들은 이 파일에서 이어 갑니다.

- **`lit start`** 는 계획대로 만들고, 테스트와 실제 화면 확인으로 검증합니다. 아무도 확인하지 못한 부분은 미확인으로 표시합니다.
- **`lit review`** 는 결과를 다섯 레인으로 검토합니다.
- **`lit handoff`** 는 무엇을 만들었고 어떻게 확인했고 무엇이 남았는지 `.litgravity/handoff/latest.md`에 적습니다. 다음 대화의 SessionStart 훅이 그 메모를 가리켜 줍니다.

### 계획 턴이 할 수 있는 일

`lit plan` 턴은 계획만 합니다. agy에는 쓰기가 일어나기 전에 안전하게 멈출 방법이 없어서([한계](#지금-agy가-막아-두는-것) 참고), 대부분은 먼저 요청하고 나중에 확인하는 방식입니다.

- 라우터는 모델에게 `plans/`와 `.litgravity/` 아래에만 쓰고 셸은 읽기 전용 명령만 쓰라고 알립니다. 쓰기나 명령을 실제로 허락할지는 여전히 사용자의 승인 확인이 정합니다.
- 모델 호출이 끝날 때마다, 그리고 턴이 끝날 때 경계 검사가 턴 시작 때의 작업 공간 상태와 지금을 비교합니다. `plans/` 밖에서 바뀌거나 지워진 파일은 보고되고 되돌리라는 요청이 가며, 턴당 최대 두 번입니다. 디스크에 아무것도 바꾸지 않은 명령은 이 검사에 흔적을 남기지 않습니다.
- 하위 에이전트는 읽기 전용이 아니면 시작 전에 거절됩니다. 허용되는 것은 lit-planner, librarian-researcher, lit-verifier, quality-reviewer, 한국어 글 에이전트입니다.

경로 상태는 프로젝트 밖의 `~/.local/state/litgravity/`에 있어서, 계획 턴이 다루라고 안내받는 파일과 떨어져 있습니다. 그 상태가 손상되면 하위 에이전트 제한과 계획 게이트는 켜진 채로 남고, 사라지면 훅이 옆에 둔 경로 기록을 대신 읽습니다.

### 붙잡힌 턴과 ledger

공정 설비로 생각하는 편이 편하다면, 같은 흐름을 플랜트로 그려 두었습니다. 프롬프트가 원료로 들어오고, PreInvocation 라우터가 헤더 노릇을 하며, 경로 단어마다 해당 용기로 가는 라인이 열립니다. 읽기 쉽게 하려고 단계를 한 줄로 이어 그렸지만, agy에서는 단계마다 따로 입력하는 `lit` 프롬프트이고 보통 다음 턴에 옵니다.

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="./docs/assets/litgravity/schematic/lit-plant.ko.dark.png">
    <source media="(prefers-reduced-motion: reduce)" srcset="./docs/assets/litgravity/schematic/lit-plant.ko.png">
    <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/litgravity/schematic/lit-plant-loop.ko.dark.webp">
    <source media="(prefers-color-scheme: light)" srcset="./docs/assets/litgravity/schematic/lit-plant-loop.ko.webp">
    <img src="./docs/assets/litgravity/schematic/lit-plant-loop.ko.webp" width="900" alt="agy의 lit 워크플로를 공정 흐름도로 그린 그림. lit 프롬프트와 지난 인계 메모가 PreInvocation 라우터로 들어간다. 위쪽 헤더에서 경로 단어마다 라인이 내려가 lit plan은 lit-plan, lit start는 start-work, lit review는 review-work 용기로, lit handoff는 lit-handoff 유닛으로 간다. lit-plan과 start-work 사이에는 분석계 AIC-101(Stop: 계획 파일 있나?)이 삼방 밸브를 움직여 턴을 풀어 주거나 되돌리고, start-work와 review-work 사이에서는 AIC-102(Stop: 열린 행 있나?)가 같은 일을 한다. 용기마다 샘플 라인이 PostToolUse ledger(.litgravity/ledger/<conversation>.jsonl)로 내려간다. lit-handoff 유닛은 latest.md를 도면 밖으로 내보낸다. 스트림 표에는 경로마다 스킬, 산출물(plans/<slug>.md, 계획 행 체크와 테스트 실행, file:line을 앞세운 발견 사항, .litgravity/handoff/latest.md), Stop 훅이 붙잡는지가 정리되어 있다. 움직이는 버전에서는 모든 스트림을 따라 점선이 흐른다.">
  </picture>
</p>

용기마다 샘플 라인이 ledger로 빠지고, 인계 메모는 오른쪽으로 나가 다음 대화를 기다립니다. 용기 사이에서는 Stop 훅의 분석계 두 대가 일이 남은 턴을 붙잡습니다.

| 경로 | 끝에서 붙잡히는 동안 |
|---|---|
| lit-plan | `plans/<slug>.md`가 아직 없습니다 |
| start-work | 승인된 계획에 열린 행이 있습니다 |
| litgoal, lit-loop | 목표 기록에 열린 기준이 있습니다 |

진전 없이 연달아 붙잡히는 것은 최대 세 번입니다. `pause`라고 말하거나 ledger에 `BLOCKED at row N:`, `PAUSED at row N:`, `CANCELLED:`를 적으면 풀립니다. 아래 갈무리는 아무것도 쓰지 않은 계획 턴이 실제로 붙잡힌 모습입니다.

<p align="center"><img src="./docs/assets/litgravity/handoff-hold.webp" width="960" alt="터미널 갈무리. 계획 파일 없이 끝난 lit plan a tiny todo app 프롬프트 뒤에 Stop 훅이 decision continue와 계획 파일을 요구하는 lit-plan 게이트 사유로 답합니다. 아래쪽에는 read_file 도구 호출을 기록한 ledger 한 줄이 보입니다." /></p>

## 지금 agy가 막아 두는 것

아래는 실제 설치에서 확인한 agy 1.4.3의 사실입니다. LitGravity는 이 한계 안에서 동작하며, 항목마다 전체 내용은 [참고 문서](./docs/reference_ko-KR.md#지금-agy가-막아-두는-것-자세히)에 있습니다.

- **쓰기 전에 막을 수 없습니다.** agy의 PreToolUse 훅은 보이는 모든 호출에 결정을 내려야 하므로, LitGravity는 파일 변경과 글을 일어난 뒤에 확인합니다. 유일한 사전 차단은 lit-plan 턴에서 쓰기가 가능한 하위 에이전트입니다.
- **헤드리스 실행은 물어볼 수 없습니다.** `agy -p`에서 권한이 필요한 `run_command`나 `write_file`은 거부되고 실행이 끝납니다. 스킬은 먼저 읽고, 필요한 권한을 적어 `BLOCKED`로 보고합니다.
- **이미지 보기.** agy의 모델은 `read_file`로 PNG를 보고, 시각 스킬의 모든 확인 단계가 이것에 기댑니다.
- **Starter Quota.** 모델 호출은 모두 계정 할당량에서 차감되므로, 테스트와 확인은 비용이 들지 않는 `agy plugin validate`와 `/hooks`, `/skills`, `/agents`를 씁니다.
- **압축 이벤트도, 슬래시 명령 폴더도, 플러그인의 MCP 서버도 아직 없습니다.** 인계 메모, 명령 역할을 하는 스킬(`/litgravity:<스킬-id>`), 스크립트 하위 명령이 그 자리를 채웁니다.
- **lsp 도구가 없습니다.** `lsp`와 `lsp-setup` 스킬은 언어별 검사기를 명령줄에서 돌립니다.

## 안전과 제거

수명 주기 명령은 모두 `--dry-run`으로 먼저 미리 볼 수 있고, 훅이 하나 깨져도 대화는 계속됩니다. 대화가 프로젝트에 만든 파일(`plans/`, `.litgravity/`)은 그대로 남습니다.

| 작업 | 명령 |
|---|---|
| 설치 | `npx @litfamily/litgravity install` |
| 업데이트 | `npx @litfamily/litgravity install` (검증하고 그 자리에서 교체) |
| 전역 규칙 끄기/켜기 | `npx @litfamily/litgravity config agentFile off` (또는 `on`) |
| 프로젝트 블록 | `npx @litfamily/litgravity agent-file project --dir <경로>` (저장소의 `AGENTS.md`에 표시된 블록만 씀) |
| 확인 | `npx @litfamily/litgravity doctor` |
| 확장 | `npx @litfamily/litgravity extensions list` (그다음 `install`, `update`, `remove`, `check`, `prune-backups`) |
| 제거 | `npx @litfamily/litgravity uninstall --yes` |

설치기는 자기 플러그인 폴더, 데이터 디렉터리, 규칙 파일, 그리고 요청했을 때 상태 표시줄 키만 쓰며, agy 자격 증명 파일은 읽지 않습니다.

<details>
<summary>각 부분이 쓰는 곳과 남기는 것</summary>

- 설치기는 자기 플러그인 폴더, 데이터 디렉터리(`$XDG_DATA_HOME/litgravity`), agy 전역 규칙 폴더의 전용 규칙 파일, 그리고 요청했을 때 agy 사용자 설정의 상태 표시줄 키만 씁니다. 설정 파일은 먼저 백업합니다. agy 자격 증명 파일은 읽지 않습니다. 설치기가 쓰지 않은 규칙 파일은 합치지 않고 첫 쓰기 전에 설치를 멈춥니다.
- 심볼릭 링크이거나, 남의 파일이거나, 설치 뒤 수정된 대상은 첫 쓰기 전에 설치를 멈춥니다. 수정한 사본을 남기고 싶으면 설치기가 알려 주는 명령으로 `~/.local/share/litgravity/saved/<범위>-<날짜>`에 옮깁니다. 이 폴더를 agy 플러그인 폴더 밖에 둔 데는 이유가 있습니다. agy는 플러그인 폴더에 있는 폴더를 모두 불러오므로, 플러그인 옆에 둔 사본은 두 번째 LitGravity로 돌아갑니다. `doctor`는 그런 사본이 남아 있으면 경고합니다. `--dry-run`은 아무것도 바꾸지 않습니다.
- `extensions`는 범위에 맞는 agy 스킬 폴더(`~/.gemini/config/skills/<id>` 또는 `.agents/skills/<id>`), `~/.gemini/extension-backups/`, 자기 원본 클론 `~/.cache/litgravity/extensions-src`에만 씁니다. `--yes`가 없으면 계획만 출력합니다. 다른 곳에 둔 같은 이름의 스킬은 옮기지 않고, 영수증 없는 폴더는 제거하지 않으며, 지우는 일은 `prune-backups --yes`로 `~/.gemini/extension-backups/` 안에서만 합니다.
- 0.1.8까지의 릴리스는 엔진 캐시를 `~/.local/share/litgravity/runtime/`(`$XDG_DATA_HOME/litgravity/runtime/`)에 두었고, 150 MB가 넘기도 합니다. 이제 확장을 포함해 그곳을 읽거나 쓰는 것은 없고 `uninstall`도 남겨 두므로, 공간이 필요하면 그 폴더를 지우세요. 폴더가 남아 있는 동안은 `doctor`가 알려 줍니다.
- agy를 시작하기 전에 `LITGRAVITY_HOOK_TRACE=<파일>`을 지정하면 훅 호출마다 한 줄씩 기록합니다. 지정하지 않으면 꺼져 있습니다.

</details>

## 참고 문서

[docs/reference_ko-KR.md](./docs/reference_ko-KR.md)에는 대부분 한 번만 필요한 내용을 모았습니다. [상태 표시줄](./docs/reference_ko-KR.md#상태-표시줄) 전체, [코딩 에이전트용 설치 프롬프트](./docs/reference_ko-KR.md#코딩-에이전트에게-설치-맡기기), [확장을 손으로 설치하기](./docs/reference_ko-KR.md#확장을-손으로-설치하기), [지금 agy가 막아 두는 것, 자세히](./docs/reference_ko-KR.md#지금-agy가-막아-두는-것-자세히)입니다.

## 패밀리

LitGravity는 LitFamily 패키지 일곱 개 중 하나이고, 각 패키지는 같은 일하는 방식을 코딩 에이전트 하나에 붙여 주며 따로 설치되고 따로 동작합니다. 쓰는 에이전트에 맞는 것 하나만 설치하면 되고, 다른 패키지는 필요 없습니다. 일곱 패키지와 각 패키지가 맡은 에이전트는 [LitFamily](https://github.com/wjgoarxiv/litfamily)에 모여 있습니다.

커버의 장갑 기계 일곱 대가 이 일곱 패키지이고, 일곱 번째 칸의 궤도 기계가 LitGravity입니다. 커버의 모션은 LitFamily 모션 스킬로 만든 브랜드 연출로, 그려서 움직인 그림이라 실제 agy 세션을 녹화한 장면은 들어 있지 않습니다. 시스템에서 동작 줄이기를 켜 두었다면 정지 프레임이 대신 보입니다.

<p align="center"><img src="./docs/assets/litfamily-machines.png" width="100%" alt="LitFamily 기계 일곱 대가 모두 불이 켜진 채 나란히 서 있습니다. LitClaude, LitHermes, LitCodex, LitOpenCode, LitGrok, LitMuse, LitGravity. 위에는 LITFAMILY, 아래에는 KEEP THE WORK LIT." /></p>

## 라이선스

MIT. [LICENSE](./LICENSE)를 보세요.

LitGravity와 LitFamily 이름과 로고는 [상표 정책](./TRADEMARK.md)을 따릅니다.
