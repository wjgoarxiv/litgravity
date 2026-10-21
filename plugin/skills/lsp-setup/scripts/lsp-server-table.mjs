// Hand-maintained table shared by detect-lsp.mjs and verify-lsp.mjs.
//
// language         id used for references/<language>/README.md (c-cpp covers C and C++)
// serverId/command the language-server launch line verify-lsp.mjs spawns over stdio. A wrong entry shows up as a
//                  real roundtrip failure; the lines come from each server's published documentation.
// extensions       file extensions that select this entry (lower case, with the dot)
// checkers         one-shot CLI executables worth probing for this language (type checkers, linters, builders)
// wired            true when ../../lsp/scripts/diagnostics.mjs normalises this language's checker output
// buildCheck       the project command to cite as evidence when no checker is wired (the user's own build)
// projectFiles     config and manifest files whose presence is worth reporting ("*" is a wildcard)
// install          per-OS command the USER could run for the server (darwin, linux, win32). No script here
//                  executes it. Commands age, so the package manager's own output is the final word.

export const LANGUAGES = [
  { language: 'typescript', serverId: 'typescript', command: ['typescript-language-server', '--stdio'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'],
    checkers: ['tsc', 'eslint'], wired: true, buildCheck: 'npx tsc --noEmit -p tsconfig.json',
    projectFiles: ['tsconfig.json', 'jsconfig.json', 'package.json'],
    install: {
      darwin: 'npm install --save-dev typescript typescript-language-server   (or: brew install typescript-language-server)',
      linux: 'npm install --save-dev typescript typescript-language-server',
      win32: 'npm install --save-dev typescript typescript-language-server',
    } },
  { language: 'python', serverId: 'basedpyright', command: ['basedpyright-langserver', '--stdio'],
    extensions: ['.py', '.pyi'], checkers: ['pyright', 'basedpyright', 'ruff', 'mypy'], wired: true,
    buildCheck: 'python3 -m pytest -q',
    projectFiles: ['pyrightconfig.json', 'pyproject.toml', 'ruff.toml', 'mypy.ini', 'setup.cfg'],
    install: {
      darwin: 'uv tool install basedpyright   (or: brew install basedpyright)',
      linux: 'uv tool install basedpyright   (or: pipx install basedpyright)',
      win32: 'uv tool install basedpyright   (or: pip install basedpyright)',
    } },
  { language: 'go', serverId: 'gopls', command: ['gopls'], extensions: ['.go'],
    checkers: ['gopls', 'go'], wired: true, buildCheck: 'go vet ./...', projectFiles: ['go.mod', 'go.work'],
    install: {
      darwin: 'go install golang.org/x/tools/gopls@latest   (or: brew install gopls)',
      linux: 'go install golang.org/x/tools/gopls@latest',
      win32: 'go install golang.org/x/tools/gopls@latest',
    } },
  { language: 'rust', serverId: 'rust', command: ['rust-analyzer'], extensions: ['.rs'],
    checkers: ['cargo', 'rustc'], wired: true, buildCheck: 'cargo check --all-targets',
    projectFiles: ['Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml'],
    install: {
      darwin: 'rustup component add rust-analyzer rust-src   (or: brew install rust-analyzer)',
      linux: 'rustup component add rust-analyzer rust-src',
      win32: 'rustup component add rust-analyzer rust-src',
    } },
  { language: 'c-cpp', serverId: 'clangd', command: ['clangd', '--background-index', '--clang-tidy'],
    extensions: ['.c', '.cpp', '.cc', '.cxx', '.c++', '.h', '.hpp', '.hh', '.hxx', '.h++'],
    checkers: ['clangd', 'clang', 'cc', 'clang-tidy'], wired: true, buildCheck: 'cmake --build build',
    projectFiles: ['compile_commands.json', '.clangd', 'CMakeLists.txt', 'Makefile'],
    install: {
      darwin: 'brew install llvm   (keg-only: add "$(brew --prefix llvm)/bin" to PATH), or use the clangd that xcrun --find clangd locates',
      linux: 'sudo apt install clangd   (Fedora: sudo dnf install clang-tools-extra; Arch: sudo pacman -S clang)',
      win32: 'winget install LLVM.LLVM   (or: choco install llvm)',
    } },
  { language: 'java', serverId: 'jdtls', command: ['jdtls'], extensions: ['.java'],
    checkers: ['javac', 'mvn', 'gradle'], wired: false, buildCheck: 'mvn -q -DskipTests compile   or   ./gradlew compileJava',
    projectFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'gradlew'],
    install: {
      darwin: 'brew install jdtls',
      linux: 'download a release from https://github.com/eclipse-jdtls/eclipse.jdt.ls, extract it and put its jdtls launcher on PATH (Arch AUR: jdtls)',
      win32: 'download a release from https://github.com/eclipse-jdtls/eclipse.jdt.ls, extract it and put its jdtls launcher on PATH',
    } },
  { language: 'kotlin', serverId: 'kotlin-ls', command: ['kotlin-lsp', '--stdio'], extensions: ['.kt', '.kts'],
    checkers: ['kotlinc', 'gradle'], wired: false, buildCheck: './gradlew compileKotlin',
    projectFiles: ['build.gradle.kts', 'settings.gradle.kts', 'gradlew'],
    install: {
      darwin: 'brew install JetBrains/utils/kotlin-lsp',
      linux: 'download a release from https://github.com/Kotlin/kotlin-lsp, extract it and symlink its launcher as kotlin-lsp on PATH',
      win32: 'download a release from https://github.com/Kotlin/kotlin-lsp, extract it and put its launcher on PATH',
    } },
  { language: 'csharp', serverId: 'csharp', command: ['csharp-ls'], extensions: ['.cs'],
    checkers: ['dotnet'], wired: false, buildCheck: 'dotnet build --no-restore -v q',
    projectFiles: ['*.sln', '*.slnx', '*.csproj', 'global.json'],
    install: {
      darwin: 'dotnet tool install -g csharp-ls   (needs the .NET SDK; add ~/.dotnet/tools to PATH)',
      linux: 'dotnet tool install -g csharp-ls   (needs the .NET SDK; add ~/.dotnet/tools to PATH)',
      win32: 'dotnet tool install -g csharp-ls   (needs the .NET SDK)',
    } },
  { language: 'razor', serverId: 'razor', command: ['roslyn-language-server', '--stdio'], extensions: ['.razor', '.cshtml'],
    checkers: ['dotnet'], wired: false, buildCheck: 'dotnet build --no-restore -v q', projectFiles: ['*.csproj', '*.sln'],
    install: {
      darwin: 'dotnet tool install -g roslyn-language-server --prerelease   (see references/csharp/README.md)',
      linux: 'dotnet tool install -g roslyn-language-server --prerelease   (see references/csharp/README.md)',
      win32: 'dotnet tool install -g roslyn-language-server --prerelease   (see references/csharp/README.md)',
    } },
  { language: 'swift', serverId: 'sourcekit-lsp', command: ['sourcekit-lsp'], extensions: ['.swift'],
    checkers: ['swift', 'swiftc'], wired: false, buildCheck: 'swift build', projectFiles: ['Package.swift', 'compile_commands.json'],
    install: {
      darwin: 'xcode-select --install   (or install Xcode); sourcekit-lsp ships in the toolchain, find it with xcrun --find sourcekit-lsp',
      linux: 'install a toolchain from https://www.swift.org/install/linux/ ; sourcekit-lsp is in its usr/bin',
      win32: 'install the Swift toolchain from https://www.swift.org/install/windows/ ; sourcekit-lsp is in its bin directory',
    } },
  { language: 'ruby', serverId: 'ruby-lsp', command: ['ruby-lsp'], extensions: ['.rb', '.rake', '.gemspec', '.ru'],
    checkers: ['ruby', 'rubocop'], wired: false, buildCheck: 'bundle exec rubocop --format json',
    projectFiles: ['Gemfile', 'Gemfile.lock', '.rubocop.yml', '.ruby-version'],
    install: {
      darwin: 'gem install ruby-lsp   (use a Homebrew or version-manager Ruby, not the system Ruby)',
      linux: 'gem install ruby-lsp',
      win32: 'gem install ruby-lsp   (RubyInstaller)',
    } },
  { language: 'php', serverId: 'php', command: ['intelephense', '--stdio'], extensions: ['.php'],
    checkers: ['php', 'phpstan', 'psalm'], wired: false, buildCheck: 'php -l <file>   or   vendor/bin/phpstan analyse --error-format=json',
    projectFiles: ['composer.json', 'composer.lock', 'phpstan.neon'],
    install: {
      darwin: 'npm install -g intelephense',
      linux: 'npm install -g intelephense',
      win32: 'npm install -g intelephense',
    } },
  { language: 'dart', serverId: 'dart', command: ['dart', 'language-server', '--protocol=lsp'], extensions: ['.dart'],
    checkers: ['dart', 'flutter'], wired: false, buildCheck: 'dart analyze --format=machine   (Flutter: flutter analyze)',
    projectFiles: ['pubspec.yaml', 'analysis_options.yaml'],
    install: {
      darwin: 'brew tap dart-lang/dart && brew install dart   (or brew install dart-sdk, or the Flutter SDK, which bundles dart)',
      linux: 'follow https://dart.dev/get-dart (Google apt repository) or install the Flutter SDK',
      win32: 'choco install dart-sdk   (or install the Flutter SDK)',
    } },
  { language: 'elixir', serverId: 'elixir-ls', command: ['elixir-ls'], extensions: ['.ex', '.exs'],
    checkers: ['mix', 'elixir'], wired: false, buildCheck: 'mix compile --warnings-as-errors',
    projectFiles: ['mix.exs', 'mix.lock', '.formatter.exs', '.tool-versions'],
    install: {
      darwin: 'brew install elixir-ls',
      linux: 'download the release zip from https://github.com/elixir-lsp/elixir-ls/releases, unzip it and symlink language_server.sh as elixir-ls on PATH',
      win32: 'download the release zip from https://github.com/elixir-lsp/elixir-ls/releases and put language_server.bat on PATH',
    } },
  { language: 'zig', serverId: 'zls', command: ['zls'], extensions: ['.zig', '.zon'],
    checkers: ['zig'], wired: false, buildCheck: 'zig build --summary all   or   zig ast-check <file>',
    projectFiles: ['build.zig', 'build.zig.zon'],
    install: {
      darwin: 'brew install zls   (the zls version must match your zig version)',
      linux: 'download the zls release that matches your zig version from https://github.com/zigtools/zls/releases (Arch: sudo pacman -S zls)',
      win32: 'download the zls release that matches your zig version from https://github.com/zigtools/zls/releases',
    } },
  { language: 'lua', serverId: 'lua-ls', command: ['lua-language-server'], extensions: ['.lua'],
    checkers: ['lua-language-server', 'luac', 'luacheck'], wired: false, buildCheck: 'lua-language-server --check . --checklevel=Warning',
    projectFiles: ['.luarc.json', '.luarc.jsonc', '.luacheckrc'],
    install: {
      darwin: 'brew install lua-language-server',
      linux: 'download a release from https://github.com/LuaLS/lua-language-server/releases and put its bin directory on PATH (Arch: sudo pacman -S lua-language-server)',
      win32: 'download a release from https://github.com/LuaLS/lua-language-server/releases and put its bin directory on PATH',
    } },
  { language: 'bash', serverId: 'bash', command: ['bash-language-server', 'start'], extensions: ['.sh', '.bash', '.zsh', '.ksh'],
    checkers: ['shellcheck', 'bash'], wired: true, buildCheck: 'shellcheck -f json <file>',
    projectFiles: ['.shellcheckrc'],
    install: {
      darwin: 'npm install -g bash-language-server   and   brew install shellcheck',
      linux: 'npm install -g bash-language-server   and   sudo apt install shellcheck (Fedora: sudo dnf install ShellCheck)',
      win32: 'npm install -g bash-language-server   and   scoop install shellcheck (or: choco install shellcheck)',
    } },
  { language: 'yaml', serverId: 'yaml-ls', command: ['yaml-language-server', '--stdio'], extensions: ['.yaml', '.yml'],
    checkers: ['yamllint', 'check-jsonschema'], wired: false, buildCheck: 'yamllint -f parsable <file>',
    projectFiles: ['.yamllint', '.yamllint.yml', '.yamllint.yaml'],
    install: {
      darwin: 'npm install -g yaml-language-server   (or: brew install yaml-language-server)',
      linux: 'npm install -g yaml-language-server',
      win32: 'npm install -g yaml-language-server',
    } },
  { language: 'terraform', serverId: 'terraform', command: ['terraform-ls', 'serve'], extensions: ['.tf', '.tfvars'],
    checkers: ['terraform', 'tflint'], wired: false, buildCheck: 'terraform validate -json   (after terraform init)',
    projectFiles: ['.terraform.lock.hcl', 'versions.tf', '.tflint.hcl'],
    install: {
      darwin: 'brew install hashicorp/tap/terraform-ls',
      linux: 'add the HashiCorp package repository, then sudo apt install terraform-ls (or sudo dnf install terraform-ls); release zips are at https://releases.hashicorp.com/terraform-ls/',
      win32: 'choco install terraform-ls',
    } },
  { language: 'dockerfile', serverId: 'dockerfile', command: ['docker-langserver', '--stdio'], extensions: ['.dockerfile'],
    checkers: ['hadolint'], wired: false, buildCheck: 'hadolint <file>', projectFiles: ['.hadolint.yaml'],
    install: {
      darwin: 'npm install -g dockerfile-language-server-nodejs   and   brew install hadolint',
      linux: 'npm install -g dockerfile-language-server-nodejs   and a hadolint release from https://github.com/hadolint/hadolint/releases',
      win32: 'npm install -g dockerfile-language-server-nodejs   and   scoop install hadolint',
    } },
  { language: 'haskell', serverId: 'haskell-language-server', command: ['haskell-language-server-wrapper', '--lsp'], extensions: ['.hs', '.lhs'],
    checkers: ['ghc', 'cabal', 'stack'], wired: false, buildCheck: 'cabal build all   or   stack build',
    projectFiles: ['cabal.project', 'stack.yaml', 'hie.yaml', '*.cabal'],
    install: {
      darwin: 'ghcup install hls   (ghcup itself: brew install ghcup, or https://www.haskell.org/ghcup/)',
      linux: 'ghcup install hls   (ghcup itself: https://www.haskell.org/ghcup/)',
      win32: 'ghcup install hls   (ghcup for Windows: https://www.haskell.org/ghcup/)',
    } },
  { language: 'julia', serverId: 'julials', command: ['julia', '--startup-file=no', '--history-file=no', '--project=@lsp', '-e', 'using LanguageServer; runserver()'],
    extensions: ['.jl'], checkers: ['julia'], wired: false,
    buildCheck: "julia --project -e 'using Pkg; Pkg.test()'", projectFiles: ['Project.toml', 'Manifest.toml'],
    install: {
      darwin: `brew install juliaup, then julia -e 'using Pkg; Pkg.activate("lsp"; shared=true); Pkg.add("LanguageServer")' (see references/julia/README.md)`,
      linux: `curl -fsSL https://install.julialang.org | sh, then julia -e 'using Pkg; Pkg.activate("lsp"; shared=true); Pkg.add("LanguageServer")' (see references/julia/README.md)`,
      win32: `winget install --name Julia --id 9NJNWW8PVKMN -e -s msstore, then julia -e 'using Pkg; Pkg.activate("lsp"; shared=true); Pkg.add("LanguageServer")'`,
    } },
];

export const PLATFORM = process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux';
