# LitGravity 참고 문서

<p align="right"><a href="./reference.md">English</a> · <b>한국어</b></p>

설치와 일상적인 사용은 [README](../README_ko-KR.md)에 있습니다. 이 문서에는 그 가운데 네 절의 자세한 내용을 모았습니다.

## 상태 표시줄

상태 표시줄은 프롬프트 아래 한 줄이고, LitFamily 상태 표시줄 모양을 따릅니다. `[🔥LIT v…]` 표시 뒤의 모든 칸은 LitGravity의 불꽃 주황 한 가지 색입니다. 순서는 `model [effort] │ ctx [█▎░] 42%/1049k │ quota [▌░]28% ↻ 2h5m`이고, 그 뒤에 지금 도는 lit 경로를 분홍 `🔥 LIT` 칩과 시계로, 그 경로가 지도에서 어디쯤인지를 보여 줍니다. litwork와 lit-loop는 열린 기준의 증거 파일을 읽어 PIN, RED, GREEN, VERIFY, REVIEW, RECORD 중 하나를, 계획과 start-work는 interview, plan, work, review, done 중 하나를 계획 행 수와 함께 보여 줍니다. lit-team은 레인을 보여 주고, agy가 함께 넘겨주는 비용, 백그라운드 작업, 브랜치, 제목이 이어집니다. 컨텍스트와 쿼터 게이지는 70%에서 노랑, 90%에서 빨강이 됩니다. 터미널이 좁으면 덧붙인 정보부터 빠지고 경로와 컨텍스트 게이지는 남습니다. `NO_COLOR`는 색을 끄고, `LITGRAVITY_HUD_ASCII=1`은 모든 기호를 ASCII로 바꿉니다. agy에 이미 다른 상태 표시줄이 있으면 설치기는 손대지 않습니다. `install --status-line --replace-status-line`을 쓰면 원래 값을 저장한 뒤 바꾸고, `uninstall`이 그 값을 되돌려 놓습니다.

색이 꺼진 곳에서는 같은 줄이 다음처럼 평문으로 나옵니다.

```text
[LIT] | GF3.8 | ctx [#--] 42%/1049k | [LIT] . lit-loop 2:20 | [PIN] = RED . - GREEN . - VERIFY . - REVIEW . - RECORD .
```

몇몇 순간에는 줄의 모양이 바뀝니다. `lit adhd`가 경로일 때는 칸마다 색이 다른 느린 무지개가 됩니다. `lit-rewind`로 부르든, 스킬 이름을 그대로 치거나 `/` 뒤에 치든, 모델이 스스로 스킬을 불러오든 똑같습니다. 턴이 질문, 승인 요청, BLOCKED 보고로 끝나거나 목표가 결정을 기다리면, 줄이 호박색이 되고 다시 입력할 때까지 `⚠ YOUR TURN · <이유>`를 띄웁니다. `lit review work`가 도는 동안에는 다섯 레인(goal, qa, quality, security, context)이 보고하는 대로 레인마다 제 색과 판정 표시를 달고 나타나며, `2/5` 같은 수도 함께 보입니다. 경로가 도는 사이 계획이나 목표가 끝나면 `✦ DONE ✦`이 20초 동안 뜹니다. agy는 줄을 다시 그리는 때를 스스로 정하므로 모든 모양은 멈춰 있는 그림이고, `NO_COLOR`에서도 표시 글자는 평문으로 남습니다.

## 코딩 에이전트에게 설치 맡기기

아무 폴더에서 연 코딩 에이전트에 아래를 붙여 넣으세요.

```text
Google Antigravity CLI용 LitFamily 플러그인인 LitGravity를 설치해 줘.
공식 npm 패키지 @litfamily/litgravity만 써. 무엇이든 바꾸기 전에 계획을 보여 주고 내 승인을 기다려.
1. Node.js 20 이상과 agy가 PATH에 있는지 확인해 (`agy --version`).
2. 미리 보기: npx @litfamily/litgravity install --dry-run
3. 설치: npx @litfamily/litgravity install --yes
4. 확인: npx @litfamily/litgravity doctor 를 실행하고 마지막 줄을 알려 줘.
5. 무엇이 쓰였는지("Written:" 목록)와 설치기가 거부한 것이 있으면 알려 줘.
```

## 확장을 손으로 설치하기

[README](../README_ko-KR.md#확장)에는 같은 네 단계를 대신 해 주는 `extensions` 명령이 있습니다.

직접 하고 싶다면 네 단계는 평범한 셸 줄입니다. wjgoarxiv-skills는 <https://github.com/wjgoarxiv/wjgoarxiv-skills>에 공개되어 있습니다. 저장소는 한 번만 클론하면 됩니다(`git clone https://github.com/wjgoarxiv/wjgoarxiv-skills`). 확장 하나는 네 줄로 설치합니다. agy를 쓰는 워크스페이스에서 zsh나 bash에 한 줄씩 붙여 넣고, `<id>`와 클론 경로는 직접 채웁니다.

```bash
find .agents/skills _agents/skills ~/.gemini/config/skills ~/.gemini/skills -maxdepth 2 -name SKILL.md -exec grep -l -E '^name: *"?<id>"? *$' {} + 2>/dev/null
if [ -e ~/.gemini/config/skills/<id> ] || [ -L ~/.gemini/config/skills/<id> ]; then b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S); mkdir -p "$b" && mv ~/.gemini/config/skills/<id> "$b/" && echo "moved to $b/<id>"; fi
mkdir -p ~/.gemini/config/skills && [ ! -e ~/.gemini/config/skills/<id> ] && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/<id>" ~/.gemini/config/skills/<id>
printf '{"id":"%s","source":"%s","variant":"litgravity","installed_at":"%s"}\n' <id> "<path to your wjgoarxiv-skills clone>/variants/litgravity/<id>" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ~/.gemini/config/skills/<id>/.litfamily-extension.json
```

첫 줄은 살펴보기만 합니다. agy 1.5.6은 스킬을 이름으로 네 폴더에서 불러옵니다(워크스페이스의 `.agents/skills`와 `_agents/skills`, 그다음 `~/.gemini/config/skills`와 `~/.gemini/skills`). 이름이 같은 스킬이 둘이면 아무 말 없이 하나만 남기기 때문에, 첫 줄은 그 이름을 가진 스킬의 `SKILL.md`를 모두 출력하고 하나도 없으면 아무것도 출력하지 않습니다. 설치 폴더 바깥에서 나온 사본이 있으면 같은 방식으로 옮겨 둡니다. 둘째 줄은 이미 있는 사본을 통째로 `~/.gemini/extension-backups/` 아래 날짜 폴더로 옮깁니다. agy는 이 폴더를 읽지 않고, 사본 안에 둔 내 파일도 그대로 그곳에 남습니다. 셋째 줄은 비워 둔 자리에 확장을 복사하므로 옛 사본이 새 사본 안에 들어가거나 섞이지 않습니다. 넷째 줄은 사본 안에 작은 영수증 `.litfamily-extension.json`을 씁니다. id, 원본 폴더, 변형, 설치 시각이 들어갑니다.

한 워크스페이스에서만 쓰려면 첫 줄을 실행한 뒤 워크스페이스 루트에서 아래 세 줄을 실행합니다.

```bash
if [ -e .agents/skills/<id> ] || [ -L .agents/skills/<id> ]; then b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S)-project; mkdir -p "$b" && mv .agents/skills/<id> "$b/" && echo "moved to $b/<id>"; fi
mkdir -p .agents/skills && [ ! -e .agents/skills/<id> ] && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/<id>" .agents/skills/<id>
printf '{"id":"%s","source":"%s","variant":"litgravity","installed_at":"%s"}\n' <id> "<path to your wjgoarxiv-skills clone>/variants/litgravity/<id>" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .agents/skills/<id>/.litfamily-extension.json
```

새 대화를 열거나 `/skills reload`를 입력하면 스킬이 `/<id>`로 답합니다. 업데이트할 때는 같은 줄을 다시 실행합니다. 옛 사본은 새 날짜 폴더로 옮겨지고 영수증은 새로 씁니다. 지우고 싶으면 둘째 줄만 실행합니다. 어떤 줄도 파일을 지우지 않으니, 필요 없어진 백업은 `~/.gemini/extension-backups/`에서 정리합니다(`extensions prune-backups`가 대신 해 줍니다).

`litgravity install`은 자기 플러그인 폴더에만 쓰므로, LitGravity를 업그레이드하거나 지워도 복사본은 그대로이고, 스텁(`litgravity:<id>`)과 복사본(`<id>`)은 이름이 겹치지 않습니다.

고정 엔진(`office`, `diagram`, `readme`, `sciviz`, `motion`)과 `litgravity runtime`, 렌더가 통과할 때까지 영상 턴을 붙잡던 훅도 함께 옮겨 갔습니다. wjgoarxiv-skills의 agy용 사본은 엔진 설치 스크립트와 엔진 캐시를 따로 갖고 있고 검사도 명령으로 실행하므로, LitGravity 내부에 기대지 않고 동작합니다.

## 지금 agy가 막아 두는 것, 자세히

아래는 실제 설치에서 확인한 agy 1.4.3의 사실입니다. LitGravity는 이 한계 안에서 동작하고, 중요한 곳에서는 그렇다고 말합니다.

- **쓰기 전에 막을 수 없습니다.** agy의 PreToolUse 훅은 보이는 모든 호출에 결정을 내려야 하고, 빈 답은 거부로 읽히며, `allow`는 사용자의 승인 확인을 건너뛰게 할 수 있습니다. 그래서 LitGravity는 파일 쓰기와 셸 명령이 일어나기 전에는 건드리지 않습니다. lit-plan 턴이 `plans/` 밖을 바꾸면 직후에 되돌리라고 알리고, 부정이나 완곡 표현이 겹겹이 쌓인 글은 쓰인 뒤에 보고합니다. 유일한 사전 차단은 lit-plan 턴에서 쓰기가 가능한 하위 에이전트입니다.
- **헤드리스 실행은 물어볼 수 없습니다.** `agy -p`에서 권한이 필요한 `run_command`나 `write_file`은 거부되고, 그 거부가 실행을 빈 답으로 끝냅니다(JSON의 `denied_actions`에 나옵니다). 작업 공간 안의 `read_file`은 동작합니다. 스킬은 먼저 읽고, 필요한 권한을 적어 `BLOCKED`로 보고합니다. 스크립트로 쓰려면 agy 설정에 허용 규칙을 넣거나 `--dangerously-skip-permissions`를 쓰되, 위험은 직접 감수해야 합니다. 헤드리스 실행이 스킬 파일을 읽어야 한다면 프로젝트 범위 설치(`--scope project`)를 쓰세요. 같은 확인에서, 실제 경로가 작업 공간 밖에 있는 플러그인은 `read_file`이 거부되었습니다.
- **이미지 보기.** agy의 모델은 `read_file`로 PNG를 봅니다. 시각 스킬의 모든 확인 단계가 이것에 기대고 있으며, 프롬프트에 한 번도 나오지 않은 단어만 담긴 그림으로 확인했습니다.
- **Starter Quota.** 모델 호출은 모두 계정 할당량에서 차감됩니다. 그래서 테스트와 확인은 비용이 들지 않는 `agy plugin validate`와 `/hooks`, `/skills`, `/agents`를 쓰고, LitGravity를 만드는 동안 실제 호출은 몇 번에 그쳤습니다.
- **압축 이벤트도, 슬래시 명령 폴더도, 플러그인의 MCP 서버도 아직 없습니다.** `lit-handoff`가 `.litgravity/handoff/latest.md`를 쓰고 새 대화가 그곳을 안내받습니다. 명령 역할은 스킬이 합니다(`/litgravity:<스킬-id>`). `wikify`는 스킬 안의 스크립트 하위 명령으로 돌아갑니다.
- **lsp 도구가 없습니다.** `lsp`와 `lsp-setup` 스킬은 언어별 검사기를 명령줄에서 돌립니다.
