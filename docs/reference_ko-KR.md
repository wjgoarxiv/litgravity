# LitGravity 참고 문서

<p align="right"><a href="./reference.md">English</a> · <b>한국어</b></p>

설치와 일상적인 사용은 [README](../README_ko-KR.md)에 있습니다.

## 상태 표시줄

상태 표시줄은 프롬프트 아래 한 줄이고(트루컬러 터미널에서는 카드, 아래 참고), LitFamily 상태 표시줄 모양을 따릅니다. `[🔥LIT v…]` 표시(트루컬러에서는 ` 🔥LIT v… ` 알약) 뒤의 모든 칸은 LitGravity의 불꽃 주황 한 가지 색입니다. 순서는 `model [effort] │ ctx [█▎░] 42%/1049k │ quota [▌░]28% ↻ 2h5m`이고, 그 뒤에 지금 도는 lit 경로를 분홍 `🔥 LIT` 칩과 시계로, 그 경로가 지도에서 어디쯤인지를 보여 줍니다. litwork와 lit-loop는 열린 기준의 증거 파일을 읽어 PIN, RED, GREEN, VERIFY, REVIEW, RECORD 중 하나를, 계획과 start-work는 interview, plan, work, review, done 중 하나를 계획 행 수와 함께 보여 줍니다. lit-team은 레인을 보여 주고, agy가 함께 넘겨주는 비용, 백그라운드 작업, 브랜치, 제목이 이어집니다. 컨텍스트와 쿼터 게이지는 70%에서 노랑, 90%에서 빨강이 됩니다. 터미널이 좁으면 덧붙인 정보부터 빠지고 경로와 컨텍스트 게이지는 남습니다. `NO_COLOR`는 색을 끄고, `LITGRAVITY_HUD_ASCII=1`은 모든 기호를 ASCII로 바꿉니다. agy에 이미 다른 상태 표시줄이 있으면 설치기는 손대지 않습니다. `install --status-line --replace-status-line`을 쓰면 원래 값을 저장한 뒤 바꾸고, `uninstall`이 그 값을 되돌려 놓습니다.

트루컬러 터미널에서는 같은 내용을 더 넉넉하게 담은 테두리 카드가 됩니다. 위쪽 테두리에는 마크, 시계가 달린 경로, 상태 낱말 하나(READY, 현재 단계, YOUR TURN, DONE, REVIEW, REWIND, ERROR)가 있습니다. 안쪽에는 줄이지 않은 단계 지도와 오른쪽 끝의 마지막 도구와 지난 시간, 목표나 계획의 게이지와 `next ▸`, 열을 맞춘 스레드와 레인, 경로의 스킬이 차례로 놓입니다. 아래쪽 테두리에는 모델, 컨텍스트와 쿼터 게이지와 초기화까지 남은 시간, 브랜치, 비용, 버전이 있습니다. 테두리는 분홍에서 보라를 지나 LitGravity의 주황으로 물들고, 답을 기다릴 때는 호박색, 오류에서는 빨강이 됩니다. 모든 칸은 파일이나 agy가 넘겨준 값에서 읽고, 근거가 없는 칸은 비웁니다. 글자가 쓰지 않는 칸에는 반쯤 잠긴 해와 반짝이는 바다가 있습니다. 자리가 있으면 해는 세 줄이고, 없으면 한두 줄입니다. 해가 설 자리를 내려고 일하는 중과 기다리는 중 카드에서는 `next ▸` 뒤의 말을 앞부분만 남길 수 있습니다. YOUR TURN에서는 노을이 호박색이 되고, `lit adhd`에서는 무지개와 함께 색이 돕니다.

카드는 폭이 60칸 이상이고, 터미널이 높이를 알려 줄 때는 20줄 이상이어야 나옵니다. 24줄부터는 한 줄이 더 생겨 해가 온전히 보입니다. 레인이 있으면 카드가 더 커집니다. 창이 낮으면 레인보다 스킬을 먼저 숨기고, 실패했거나 막힌 레인은 숨기지 않습니다. 그 밖에는 한 줄입니다. 좁거나 낮은 창(노을 색은 그대로), `NO_COLOR`, 256색과 16색(`LITGRAVITY_HUD_COLOR=256`으로 고를 수 있음), `LITGRAVITY_HUD_ASCII=1`, `COLORFGBG`가 밝은 배경이라고 알리는 터미널이 그렇습니다. 노을은 멈춰 있는 그림입니다. agy는 일이 있을 때만 상태 표시줄을 다시 그리고 쉬는 동안에는 손대지 않기 때문입니다.

알약과 게이지의 끝은 상태 표시줄, 카드, 설치기 어디서나 똑같이 둥글거나 똑같이 네모입니다. `LITGRAVITY_HUD_GLYPHS=round`(또는 `nerd`)는 둥근 끝을, `square`(또는 `basic`)는 네모난 끝을 고릅니다. `install --glyphs round`나 `update --glyphs square`는 같은 선택을 저장해 다음 세션부터, SSH에서도 그대로 씁니다. 그냥 다시 설치해도 선택은 남고, `--glyphs auto`가 선택을 지웁니다. 환경 변수가 먼저이고 저장한 선택이 그다음입니다. 둘 다 없거나 `auto`이면 Windows Terminal, VS Code, WezTerm, Ghostty, kitty에서는 둥글고, SSH로 접속한 창에서는 네모이며, 그 밖에는 Nerd Font가 깔려 있는지로 정합니다. 글꼴은 파일 이름만 하루에 한 번 봅니다.

`install`이나 `update`에 `--round`를 주면 아이콘 글꼴이 하나도 없을 때 글꼴 하나를 더합니다. 기호만 담은 Nerd Font v3.5.1(`SymbolsNerdFontMono-Regular.ttf`와 라이선스 파일)을 `~/Library/Fonts`에, Linux에서는 `${XDG_DATA_HOME:-~/.local/share}/fonts`에 넣습니다. 압축 파일과 두 파일의 SHA-256을 확인하고, 있던 파일은 덮어쓰지 않으며, 무엇이든 실패하면 글꼴 없이 설치를 마칩니다. `LITGRAVITY_ICON_FONT_SOURCE=<zip>`을 주면 그 압축 파일의 로컬 사본을 읽습니다. `uninstall`은 자기가 더한 파일이 그대로일 때만 지웁니다. 설치의 마지막 줄과 doctor 판정 바로 윗줄이 지금 상태를 알려 줍니다. `ROUND_ENDS: shown`은 상태 표시줄이 켜져 있고 둥근 끝을 저장했다는 뜻, `ready`는 이 터미널이 둥근 끝을 직접 그린다는 뜻, `check`는 아이콘 글꼴이 있지만 터미널이 그 글꼴을 쓰는지는 눈으로 봐야 안다는 뜻이고, `square`에는 이유와 고치는 방법 하나가 붙습니다. 상자가 보이면 터미널 글꼴을 온전한 Nerd Font로 바꾸거나, 기호 글꼴을 대체 글꼴로 더하거나(iTerm2 Non-ASCII Font, VS Code `terminal.integrated.fontFamily`, kitty `symbol_map`), `--glyphs square`를 저장하세요. Terminal.app에는 대체 글꼴 설정이 없어 온전한 Nerd Font가 필요합니다.

색이 꺼진 곳에서는 같은 줄이 다음처럼 평문으로 나옵니다.

```text
[LIT] | GF3.8 | ctx [#--] 42%/1049k | [LIT] . lit-loop 2:20 | [PIN] = RED . - GREEN . - VERIFY . - REVIEW . - RECORD .
```

몇몇 순간에는 줄의 모양이 바뀝니다. `lit adhd`가 경로일 때는 칸마다 색이 다른 느린 무지개가 됩니다. `lit-rewind`로 부르든, 스킬 이름을 그대로 치거나 `/` 뒤에 치든, 모델이 스스로 스킬을 불러오든 똑같습니다. 턴이 질문, 승인 요청, BLOCKED 보고로 끝나거나 목표가 결정을 기다리면, 줄이 호박색이 되고 다시 입력할 때까지 `⚠ YOUR TURN · <이유>`를 띄웁니다. `lit review work`가 도는 동안에는 다섯 레인(goal, qa, quality, security, context)이 보고하는 대로 레인마다 제 색과 판정 표시를 달고 나타나며, `2/5` 같은 수도 함께 보입니다. 경로가 도는 사이 계획이나 목표가 끝나면 `✦ DONE ✦`이 20초 동안 뜹니다. 같은 워크스페이스의 다른 대화는 `+2 running · 1 idle` 같은 수 하나로 보이고(줄이 좁으면 `+3 others`로 줄어듭니다), 각 대화의 훅이 남기는 작은 liveness 기록에서 읽습니다. 방금 끝난 start-work는 1분 동안 끝난 것으로 셉니다. agy는 줄을 다시 그리는 때를 스스로 정하므로 모든 모양은 멈춰 있는 그림이고, `NO_COLOR`에서도 표시 글자는 평문으로 남습니다.

## 코딩 에이전트에게 설치 맡기기

아무 폴더에서 연 코딩 에이전트에 아래를 붙여 넣으세요.

```text
Google Antigravity CLI용 LitFamily 플러그인인 LitGravity를 설치해 줘.
공식 npm 패키지 @litfamily/litgravity만 쓰고 다른 출처는 더하지 마. 훅 승인, 신뢰, 로그인은 나 대신 하지 마.
1. Node.js 20 이상과 agy가 PATH에 있는지 확인해 (`agy --version`).
2. 미리 보기: npx --yes @litfamily/litgravity@latest install --dry-run --round --status-line
   무엇이 바뀌는지 보여 줘. FAIL로 끝난 미리 보기는 아무것도 바꾸지 않은 거야.
3. 아래를 기본값과 함께 나에게 물어봐.
   - 모두 기본값으로 할까? (그렇다면 5번 설치 줄 그대로)
   - 어디에서 쓸까? 기본값은 모든 프로젝트. 한 프로젝트에서만 쓰려면 그 폴더에서 모든 명령에 --scope project를 붙이고 --status-line은 빼.
   - agy 규칙 폴더에 짧은 규칙 파일을 더할까? 기본값은 예. 아니면 아래의 모든 install, update 명령에 --no-agent-file을 붙여. 아예 끄는 것은 나중에 내가 고를 수 있어: npx --yes @litfamily/litgravity@latest config agentFile off
   - agy 프롬프트 아래에 상태 표시줄을 보일까? 내가 보는 부분이고 둥근 끝도 여기에 나오며, --status-line을 줄 때만 켜져. 기본값은 예. agy에 이미 다른 상태 표시줄이 있으면 --status-line을 뺄지 --replace-status-line을 더할지 내가 골라(옛것은 저장되고 uninstall이 되돌려 놔).
   - 둥근 끝에 쓸 아이콘 글꼴을 더할까? --round는 아이콘 글꼴이 하나도 없을 때만 SymbolsNerdFontMono-Regular.ttf와 라이선스 파일을 macOS는 ~/Library/Fonts, Linux는 ~/.local/share/fonts($XDG_DATA_HOME이 있으면 $XDG_DATA_HOME/fonts)에 넣어. 공식 Nerd Fonts 릴리스에서 받아 SHA-256을 확인해. Windows에서는 아무것도 넣지 않아. 아니면 --round를 빼.
   - 둥근 끝과 네모난 끝은 나중에 고를 수 있어: npx --yes @litfamily/litgravity@latest update --yes --glyphs auto|round|square
4. 내 승인을 기다려.
5. 설치: npx --yes @litfamily/litgravity@latest install --yes --round --status-line
   나중에 업데이트할 때: npx --yes @litfamily/litgravity@latest update --yes --round
6. 확인: npx --yes @litfamily/litgravity@latest doctor
   마지막 줄이 "LitGravity: ready"로 시작해야 하고, 설치 출력에 ROUND_ENDS:로 시작하는 줄이 있어야 해. 실패한 단계가 있으면 그 줄을 보여 주고 멈춰.
7. 이것을 보여 주고 양쪽 끝이 둥근지 물어봐:  LIT 
   둥글면: npx --yes @litfamily/litgravity@latest update --yes --glyphs round
   상자로 보이면: npx --yes @litfamily/litgravity@latest update --yes --glyphs square
   거기서도 둥근 끝을 보려면 내가 터미널 글꼴을 온전한 Nerd Font로 바꾸거나 기호 글꼴을 대체 글꼴로 더해야 해(Terminal.app에는 대체 글꼴 설정이 없어).
   SSH나 휴대폰이면 둥글게 보일 때만 바꾸고 그대로 둬. 되돌리기: npx --yes @litfamily/litgravity@latest update --yes --glyphs auto
8. 무엇이 쓰였는지("Written:" 목록), 설치기가 거부한 것, 그리고 나만 할 수 있는 일을 알려 줘: agy가 열려 있으면 끄고 다시 시작하기, agy에 한 번 로그인하기. agy에서 승인을 기다리는 것은 없어.
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

옮겨 간 스킬 아홉 개는 고정 엔진(`office`, `diagram`, `readme`, `sciviz`, `motion`)을 함께 가져갔고, `litgravity runtime`과 렌더가 통과할 때까지 영상 턴을 붙잡던 훅도 같이 옮겨 갔습니다. wjgoarxiv-skills의 agy용 사본은 엔진 설치 스크립트와 엔진 캐시를 따로 갖고 있고 검사도 명령으로 실행하므로, LitGravity 내부에 기대지 않고 동작합니다.

## 지금 agy가 막아 두는 것, 자세히

아래는 실제 설치에서 확인한 agy 1.4.3의 사실입니다. LitGravity는 이 한계 안에서 동작하고, 중요한 곳에서는 그렇다고 말합니다.

- **쓰기 전에 막을 수 없습니다.** agy의 PreToolUse 훅은 보이는 모든 호출에 결정을 내려야 하고, 빈 답은 거부로 읽히며, `allow`는 사용자의 승인 확인을 건너뛰게 할 수 있습니다. 그래서 LitGravity는 파일 쓰기와 셸 명령이 일어나기 전에는 건드리지 않습니다. lit-plan 턴이 `plans/` 밖을 바꾸면 직후에 되돌리라고 알리고, 부정이나 완곡 표현이 겹겹이 쌓인 글은 쓰인 뒤에 보고합니다. 유일한 사전 차단은 lit-plan 턴에서 쓰기가 가능한 하위 에이전트입니다.
- **헤드리스 실행은 물어볼 수 없습니다.** `agy -p`에서 권한이 필요한 `run_command`나 `write_file`은 거부되고, 그 거부가 실행을 빈 답으로 끝냅니다(JSON의 `denied_actions`에 나옵니다). 작업 공간 안의 `read_file`은 동작합니다. 스킬은 먼저 읽고, 필요한 권한을 적어 `BLOCKED`로 보고합니다. 스크립트로 쓰려면 agy 설정에 허용 규칙을 넣거나 `--dangerously-skip-permissions`를 쓰되, 위험은 직접 감수해야 합니다. 헤드리스 실행이 스킬 파일을 읽어야 한다면 프로젝트 범위 설치(`--scope project`)를 쓰세요. 같은 확인에서, 실제 경로가 작업 공간 밖에 있는 플러그인은 `read_file`이 거부되었습니다.
- **이미지 보기.** agy의 모델은 `read_file`로 PNG를 봅니다. 시각 스킬의 모든 확인 단계가 이것에 기대고 있으며, 프롬프트에 한 번도 나오지 않은 단어만 담긴 그림으로 확인했습니다.
- **Starter Quota.** 모델 호출은 모두 계정 할당량에서 차감됩니다. 그래서 테스트와 확인은 비용이 들지 않는 `agy plugin validate`와 `/hooks`, `/skills`, `/agents`를 쓰고, LitGravity를 만드는 동안 실제 호출은 몇 번에 그쳤습니다.
- **압축 이벤트도, 슬래시 명령 폴더도, 플러그인의 MCP 서버도 아직 없습니다.** `lit-handoff`가 `.litgravity/handoff/latest.md`를 쓰고 새 대화가 그곳을 안내받습니다. 명령 역할은 스킬이 합니다(`/litgravity:<스킬-id>`). `wikify`는 스킬 안의 스크립트 하위 명령으로 돌아갑니다.
- **lsp 도구가 없습니다.** `lsp`와 `lsp-setup` 스킬은 언어별 검사기를 명령줄에서 돌립니다.
- **`/goal`과 `run_workflow` (1.5.10).** agy의 `/goal`은 대화형 프롬프트에만 있고, 훅은 슬래시 명령을 칠 수 없습니다. 그래서 걸린 계획 목표는 LitGravity의 Stop 훅이 턴이 끝날 때마다(최대 7초) 확인하고, 답장은 붙여 넣을 `/goal <cond>` 한 줄을 줍니다. `run_workflow`는 에이전트를 부르는 Python 스크립트를 돌립니다(`agent`, `parallel`, `pipeline`, 에이전트마다 모델 등급, 따로 떨어진 복제본을 쓰는 `workspace="branch"`). `ultra-brainstorm`과 `lit team`이 이것을 쓰고, 워크플로 에이전트는 사용자에게 아무것도 묻지 못합니다.

## 자동 실행과 미뤄 둔 단계

승인된 계획의 start-work 실행은, 계획이 끝났다고 말할 때까지 Stop 훅이 몰고 갑니다. 전체 계약은 `plugin/skills/start-work/references/autopilot.md`에 있고, 여기는 짧게 줄인 것입니다.

- **닫기.** 모든 행이 체크되고 `## Done when`의 `check: \`<cmd>\`` 줄이 0으로 끝나면 한 줄을 남기고 닫힙니다. 검사는 평범한 테스트 명령이어야 합니다(`npm test`, `npm run <script>`, `node --test …`, `pytest`, `cargo test`, `go test`, `make test` 등). 셸 없이 돌고 20초에서 멈춥니다. Stop에 주어진 시간이 30초이고, 그중 7초를 목표 확인에 쓸 수 있기 때문입니다. 시간을 넘긴 검사는 "끝났다고 증명되지 않음"으로 남습니다. 아직 도는 하위 레인이 있으면 닫히지 않습니다.
- **밀기와 받은편지함.** 계획 상태가 그대로이면 최대 두 번 밀고, 받은편지함을 한 번 보여 준 뒤 조용히 있습니다. 새로 체크된 행, 새로 미뤄 둔 단계, 30분 동안 말이 없는 레인은 새 상태입니다.
- **행.** 행 아래 `BLOCKED: <필요한 것>`은 사용자의 답으로 풀 수 있다는 뜻이고, `IMPOSSIBLE: <이유>`는 어떤 답으로도 못 푼다는 뜻입니다. `WAITING-ON-USER:`로 시작하는 답장은 받은편지함을 부릅니다.
- **미뤄 둔 단계.** 모델은 허락되지 않은 단계를 실행하는 대신 `ledger-append.mjs --kind park --command "<cmd>" --cwd <dir>`를 적습니다. `[B]`는 로컬 단계(프로젝트 안의 새 파일과 폴더, 이름을 적은 파일의 `git add`), `[X]`는 그 밖의 전부입니다. 읽어 낼 수 없는 단계는 보류되고, 비밀 파일이나 agy 홈을 가리키는 단계는 거절됩니다.
- **답.** `lit approve`는 보여 준 `[B]` 단계를 셸 없이 실행합니다. `lit approve x`는 정확히 이것만 입력했을 때 `[X]` 단계도 `/bin/sh`로 따로 묶인 프로세스 그룹에서 실행합니다. 둘 다 마지막 받은편지함이 보여 준 단계만 실행하고, 단계마다 다시 확인하고, 25초 안에 멈춥니다. `lit approve x`는 agy 자체의 승인 창 바깥에서 실행합니다. `npx @litfamily/litgravity inbox`(다음 릴리스부터)는 각 답이 무엇을 실행할지 모델을 거치지 않고 훅이 가진 목록 그대로 보여 주므로, 모델이 옮겨 적은 받은편지함과 맞춰 볼 수 있습니다. `lit deny`는 같은 폴더의 같은 명령을 이번 실행 동안 거절합니다. `lit skip-row [N]`, `lit pause`, `lit resume`은 이름대로 합니다. 한국어로도 됩니다: `lit 승인`, `lit 거절`, `lit 멈춤`, `lit 재개`. 실행 상태 파일이 망가지면 어떤 답도 아무것도 실행하지 않습니다. 이때 `lit cancel`을 입력하면 그 실행이 끝나고, 망가진 파일은 옆에 `<conversation>.run.json.unreadable`로 남습니다.
- **실행 헌장.** `Run charter: commit on <branch> in <repo>`가 있으면 그 브랜치에 커밋할 수 있습니다. lit-plan이 질문한 뒤 당신의 `yes` 전에 이 줄이 바뀌면 효력이 없습니다.
- **agy 목표.** `goal: native` 줄이 있는 계획에만 `/goal`이 제안되고, 조건은 스스로 끝납니다: `…, or the latest reply starts with WAITING-ON-USER:, or after 30 turns`.
- **agy가 허락하지 않는 것(BLOCKED).** PreToolUse가 판단을 건너뛸 수 없어서, 모델이 미뤄야 할 단계를 실행하는 것을 막지 못합니다. 미루기는 안내입니다. Stop의 글은 모델에게만 가므로, 받은편지함은 모델이 다시 적어 줘야 합니다. 어떤 훅도 `/goal`을 칠 수 없습니다.

**`lit` 없는 프롬프트의 힌트.** `lit`로 시작하지 않는 프롬프트에는 맞을 만한 스킬(그림, 발표 자료, Word 문서, 디버깅, 모션)과 "none"을 적은 짧은 메모나, 짧은 카탈로그 한 줄이 붙을 수 있습니다. 힌트마다 봉인해 둔 시험 프롬프트 절반에서 재현율 0.85 이상, 비슷한 요청 오탐 0.10 이하를 통과했습니다. 슬래시 명령에는 아무것도 붙지 않습니다.

## 스킬 계획, 목표 파일, adhd 커서

- **스킬 계획.** 활성화 메모는 스킬을 세 개까지 적습니다. 첫 번째는 경로이고, 나머지는 작업에 쓰인 말에서 나옵니다(계통도, 영상, 발표 자료, 웹 페이지, 그림, 다이어그램, 설명서, crucible 점검). `.agents/skills/<id>`와 `~/.gemini/config/skills/<id>` 어디에도 없는 확장은 설치하는 줄과 함께 보입니다. `lit +a +b <task>`는 추측 대신 적은 이름을 적은 순서대로 씁니다. 스킬이 아닌 이름은 메모와 함께 빠집니다.
- **목표 파일.** `.litgravity/goal/consent.json`은 물어본 조건을 30분 동안 들고 있고, `owner.json`은 `yes`에 따라 LitGravity가 건 목표를 적어 둡니다. 같은 `yes`가 그 계획으로 start-work도 시작하고, 시작이 거절되면 목표도 걸지 않습니다. 확인 명령을 목표로 만들 수 없는 계획은 `Approve plan and start work? (yes / no)`로 묻습니다. lit-plan의 질문만 목표를 걸 수 있고, 읽기 전용 스킬은 절대 걸지 않습니다. `lit cancel`과 달성된 확인은 `owner.json`을 지웁니다. 새 대화는 7일이 지났거나 계획이 사라진 기록을 지우고 한 번 알려 줍니다.
- **adhd 커서.** `lit adhd`는 폴더마다 작은 파일 하나를 LitGravity 상태 폴더 아래(`adhd/<hash>.cursor.json`)에 둡니다. 카드를 그린 시각, 이미 본 완료, 보여 준 할 일이 들어 있습니다. 기본 카드만 커서를 옮깁니다. 망가진 커서는 처음 보는 것으로 읽습니다.
