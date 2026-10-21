# CLI Stack: cobra, slog, caarlos0/env, signal-aware context

`spf13/cobra` is the standard Go command framework (kubectl, Docker CLI, Helm, GitHub CLI and Hugo build on it). It supplies subcommands, typed flags, generated help and shell completion. This page shows the skeleton, the wiring for logging, configuration and shutdown, and the testing pattern.

---

## Scaffolding

```bash
go install github.com/spf13/cobra-cli@latest
cobra-cli init mytool
cobra-cli add server
cobra-cli add migrate
```

`cobra-cli` writes the first version of the `cmd/` package. Treat the output as a starting point and edit it by hand afterwards; rerunning the generator overwrites changes. The same layout is easy to type directly, which is often quicker for a small tool.

---

## Layout

```text
mytool/
├── go.mod
├── main.go                  # at most 30 lines; calls cmd.Execute
├── cmd/
│   ├── root.go              # root command, persistent flags, logger setup
│   ├── server.go            # `mytool server`
│   ├── migrate.go           # `mytool migrate`
│   └── version.go           # `mytool version`
├── internal/
│   ├── config/
│   └── server/
└── Taskfile.yml
```

Command files stay thin: declare flags, build dependencies, call into `internal/`. Behaviour that fills more than a screen belongs in `internal/` where it can be tested without cobra.

---

## `main.go`

```go
package main

import (
    "context"
    "errors"
    "log/slog"
    "os"
    "os/signal"
    "syscall"

    "github.com/your-org/mytool/cmd"
)

func main() {
    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    err := cmd.Execute(ctx)
    switch {
    case err == nil:
    case errors.Is(err, cmd.ErrCancelled):
        os.Exit(130) // 128 + SIGINT
    default:
        slog.Error("fatal", slog.Any("err", err))
        os.Exit(1)
    }
}
```

`signal.NotifyContext` gives every subcommand a context that is cancelled by Ctrl-C or SIGTERM. A second signal restores default behaviour once `stop()` runs, so a stuck shutdown can still be interrupted. `os.Exit` appears here and nowhere else, so every command stays testable.

---

## `cmd/root.go`

```go
package cmd

import (
    "context"
    "errors"
    "fmt"
    "io"
    "log/slog"

    "github.com/spf13/cobra"
)

var ErrCancelled = errors.New("cancelled by user")

type rootFlags struct {
    verbose   bool
    logFormat string
    output    string
}

func newRootCmd() *cobra.Command {
    var f rootFlags
    root := &cobra.Command{
        Use:           "mytool",
        Short:         "One-line description of mytool",
        Long:          "A longer description. Cobra wraps it for --help.",
        SilenceUsage:  true, // an error does not reprint the whole help text
        SilenceErrors: true, // main logs the error exactly once
        PersistentPreRunE: func(c *cobra.Command, _ []string) error {
            return setupLogger(c.ErrOrStderr(), f)
        },
    }
    root.PersistentFlags().BoolVarP(&f.verbose, "verbose", "v", false, "enable debug logging")
    root.PersistentFlags().StringVar(&f.logFormat, "log-format", "text", "log format: text or json")
    root.PersistentFlags().StringVar(&f.output, "output", "text", "output format: text or json")

    root.AddCommand(newServerCmd(), newMigrateCmd(), newVersionCmd(), newCompletionCmd())
    return root
}

func Execute(ctx context.Context) error {
    return newRootCmd().ExecuteContext(ctx)
}

func setupLogger(w io.Writer, f rootFlags) error {
    level := slog.LevelInfo
    if f.verbose {
        level = slog.LevelDebug
    }
    opts := &slog.HandlerOptions{Level: level}

    var h slog.Handler
    switch f.logFormat {
    case "json":
        h = slog.NewJSONHandler(w, opts)
    case "text":
        h = slog.NewTextHandler(w, opts)
    default:
        return fmt.Errorf("invalid --log-format %q (want text or json)", f.logFormat)
    }
    slog.SetDefault(slog.New(h))
    return nil
}
```

Design points:

- **A constructor builds the command tree** (`newRootCmd`). Package-level `var rootCmd` plus `init()` registration shares state between tests; a constructor returns a fresh tree each time.
- **Use the `E` variants** (`RunE`, `PersistentPreRunE`). They return errors, which keeps `log.Fatal` out of command bodies.
- **`SilenceUsage` and `SilenceErrors`** stop cobra from dumping help on every failure. Usage errors (wrong flags) still deserve the hint, so set `c.SilenceUsage = false` inside argument validators when you want it, or let cobra's own flag errors print.
- **`ExecuteContext`** makes the context available as `cmd.Context()` in every subcommand.
- Logs go to stderr and command results go to stdout, so pipes carry only data.

---

## `cmd/server.go`

```go
package cmd

import (
    "fmt"
    "log/slog"
    "time"

    "github.com/caarlos0/env/v11"
    "github.com/spf13/cobra"

    "github.com/your-org/mytool/internal/server"
)

type serverOpts struct {
    Addr    string        `env:"ADDR"    envDefault:":8080"`
    Timeout time.Duration `env:"TIMEOUT" envDefault:"30s"`
}

func newServerCmd() *cobra.Command {
    var opts serverOpts
    c := &cobra.Command{
        Use:   "server",
        Short: "Run the HTTP server",
        RunE: func(c *cobra.Command, _ []string) error {
            // 1. environment, 2. explicitly set flags override it.
            if err := env.Parse(&opts); err != nil {
                return fmt.Errorf("parse env: %w", err)
            }
            if c.Flags().Changed("addr") {
                opts.Addr, _ = c.Flags().GetString("addr")
            }
            if c.Flags().Changed("timeout") {
                opts.Timeout, _ = c.Flags().GetDuration("timeout")
            }
            slog.InfoContext(c.Context(), "starting", slog.String("addr", opts.Addr))
            return server.Run(c.Context(), opts.Addr, opts.Timeout)
        },
    }
    c.Flags().String("addr", "", "listen address (env: ADDR, default :8080)")
    c.Flags().Duration("timeout", 0, "request timeout (env: TIMEOUT, default 30s)")
    return c
}
```

Precedence is **explicit flag, then environment, then default**. State the environment variable in each flag's usage text so `--help` documents it. `viper` earns its place only when a config file, environment and flags must merge into one tree; for most tools the snippet above is enough.

---

## Arguments and validators

```go
func newMigrateUpCmd() *cobra.Command {
    return &cobra.Command{
        Use:   "up [N]",
        Short: "Apply N migrations (default: all)",
        Args:  cobra.MaximumNArgs(1),
        RunE: func(c *cobra.Command, args []string) error {
            n := -1
            if len(args) == 1 {
                var err error
                if n, err = strconv.Atoi(args[0]); err != nil {
                    return fmt.Errorf("argument N: %w", err)
                }
            }
            return migrate.Up(c.Context(), n)
        },
    }
}
```

Cobra ships validators (`cobra.ExactArgs`, `cobra.MinimumNArgs`, `cobra.RangeArgs`, `cobra.OnlyValidArgs`, `cobra.MatchAll(...)`) whose failures read cleanly. `cobra.ExactValidArgs` is deprecated; combine `cobra.MatchAll(cobra.ExactArgs(1), cobra.OnlyValidArgs)`. Parse arguments into domain types at this boundary (see `data-modeling.md`) and hand typed values to `internal/`.

---

## Typed flags

```go
c.Flags().DurationVar(&timeout, "timeout", 30*time.Second, "request timeout")
c.Flags().IntVar(&port, "port", 8080, "port")
c.Flags().StringSliceVar(&hosts, "host", nil, "allowed host (repeatable)")
```

`pflag` offers typed variants for durations, integers, IP addresses, string maps and slices. Typed flags validate on parse and produce consistent error messages. Mark required flags with `c.MarkFlagRequired("name")`, relationships with `c.MarkFlagsMutuallyExclusive("a", "b")` and `c.MarkFlagsRequiredTogether("user", "password")`.

---

## `version` from build info

```go
package cmd

import (
    "fmt"
    "runtime/debug"

    "github.com/spf13/cobra"
)

// Set with -ldflags at release time; build info fills the gaps for `go install`.
var (
    version = ""
    commit  = ""
    date    = ""
)

func newVersionCmd() *cobra.Command {
    return &cobra.Command{
        Use:   "version",
        Short: "Print version information",
        Run: func(c *cobra.Command, _ []string) {
            v, rev, built := resolveVersion()
            fmt.Fprintf(c.OutOrStdout(), "mytool %s (commit %s, built %s)\n", v, rev, built)
        },
    }
}

func resolveVersion() (v, rev, built string) {
    if version != "" {
        return version, commit, date
    }
    info, ok := debug.ReadBuildInfo()
    if !ok {
        return "dev", "unknown", "unknown"
    }
    v, rev, built = info.Main.Version, "unknown", "unknown"
    for _, s := range info.Settings {
        switch s.Key {
        case "vcs.revision":
            rev = s.Value
        case "vcs.time":
            built = s.Value
        }
    }
    return v, rev, built
}
```

Build with injected values:

```bash
go build -trimpath \
  -ldflags="-X 'github.com/your-org/mytool/cmd.version=v1.2.3' -X 'github.com/your-org/mytool/cmd.commit=$(git rev-parse --short HEAD)' -X 'github.com/your-org/mytool/cmd.date=$(date -u +%Y-%m-%dT%H:%M:%SZ)'" \
  -o bin/mytool .
```

A binary installed with `go install module@v1.2.3` carries `info.Main.Version` automatically, so the fallback needs no flags. Using `c.OutOrStdout()` rather than `fmt.Println` sends output where tests can capture it.

---

## Shell completion

Cobra provides a `completion` subcommand by default when a root command has subcommands. To customize it:

```go
func newCompletionCmd() *cobra.Command {
    return &cobra.Command{
        Use:                   "completion [bash|zsh|fish|powershell]",
        Short:                 "Generate a shell completion script",
        Args:                  cobra.MatchAll(cobra.ExactArgs(1), cobra.OnlyValidArgs),
        ValidArgs:             []string{"bash", "zsh", "fish", "powershell"},
        DisableFlagsInUseLine: true,
        RunE: func(c *cobra.Command, args []string) error {
            root, out := c.Root(), c.OutOrStdout()
            switch args[0] {
            case "bash":
                return root.GenBashCompletionV2(out, true)
            case "zsh":
                return root.GenZshCompletion(out)
            case "fish":
                return root.GenFishCompletion(out, true)
            default:
                return root.GenPowerShellCompletionWithDesc(out)
            }
        },
    }
}
```

Users install it with `mytool completion zsh > "${fpath[1]}/_mytool"`. Dynamic completions (`ValidArgsFunction`, `RegisterFlagCompletionFunc`) offer live values such as environment names.

---

## Interactive prompts and progress

Forms and confirmations come from `github.com/charmbracelet/huh`:

```go
var confirm bool
err := huh.NewConfirm().
    Title("Apply migrations to production?").
    Affirmative("Apply").
    Negative("Abort").
    Value(&confirm).
    Run()
if err != nil {
    return fmt.Errorf("prompt: %w", err)
}
if !confirm {
    return ErrCancelled
}
```

Prompts need a terminal. Check `term.IsTerminal(int(os.Stdin.Fd()))` (package `golang.org/x/term`) and fall back to a `--yes` flag when stdin is piped or the run is headless, so automation never waits on a question nobody can answer.

Spinners come from `github.com/charmbracelet/huh/spinner`:

```go
err := spinner.New().Title("Fetching").ActionWithErr(func(ctx context.Context) error {
    return fetch(ctx)
}).Run()
```

Determinate progress for downloads or batches fits `github.com/vbauerster/mpb/v8`. Write progress to stderr and skip it entirely when `--output json` is active.

For polished help output, `github.com/charmbracelet/fang` wraps a cobra root with styled help, errors and a version flag: `fang.Execute(ctx, newRootCmd())`. It is optional and replaces the `Execute` helper above; keep the error-handling contract in `main` identical.

---

## Output formats

```go
func render(w io.Writer, format string, v any) error {
    switch format {
    case "json":
        enc := json.NewEncoder(w)
        enc.SetIndent("", "  ")
        return enc.Encode(v)
    case "text":
        return renderText(w, v)
    default:
        return fmt.Errorf("invalid --output %q (want text or json)", format)
    }
}
```

Scripts parse the `json` form with `jq`; people read the `text` form, which can use `lipgloss` tables for alignment. Both write to the writer passed in (`c.OutOrStdout()`), never directly to `os.Stdout`.

---

## Exit codes and errors

- Return errors from `RunE`; `main` logs and exits non-zero.
- Reserve distinct codes for distinct outcomes when scripts depend on them: `1` for failure, `2` for usage errors, `130` for interruption. Document them in `--help` long text.
- A sentinel such as `ErrCancelled` lets `main` choose the exit code without string matching.
- Wrap errors with the command context (`fmt.Errorf("migrate up: %w", err)`), as described in `error-handling.md`.

---

## Testing commands

```go
func TestServerCmd_starts_with_ephemeral_port(t *testing.T) {
    // Given
    var out bytes.Buffer
    root := newRootCmd()
    root.SetOut(&out)
    root.SetErr(&out)
    root.SetArgs([]string{"server", "--addr", "127.0.0.1:0"})

    ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
    defer cancel()

    // When
    err := root.ExecuteContext(ctx)

    // Then
    require.NoError(t, err)
    require.Contains(t, out.String(), "starting")
}
```

`SetArgs` plus `ExecuteContext` is the standard pattern. A short context deadline stops commands that would otherwise run forever. Because each test builds a new tree through `newRootCmd`, flags never leak between tests. Table-driven tests suit argument validation: one row per argument vector with the expected error substring.

## Pitfalls

- `Run` instead of `RunE`, which pushes error handling into `log.Fatal`.
- Package-level flag variables shared across subcommands and tests.
- Printing results with `fmt.Println`, which bypasses `OutOrStdout` and defeats capture in tests.
- Logging to stdout in a tool whose stdout is parsed.
- Prompting without a terminal check.

## Sources

- cobra user guide: https://github.com/spf13/cobra/blob/main/site/content/user_guide.md
- pflag: https://github.com/spf13/pflag
- huh: https://github.com/charmbracelet/huh
- fang: https://github.com/charmbracelet/fang
- caarlos0/env: https://github.com/caarlos0/env
- signal.NotifyContext: https://pkg.go.dev/os/signal#NotifyContext
