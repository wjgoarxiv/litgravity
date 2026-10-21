# PydanticAI Reference (1.x, 2026)

Patterns for wiring PydanticAI agents in production code. The framework documentation lives at [ai.pydantic.dev](https://ai.pydantic.dev) and the source at [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai). Model identifiers change often, so confirm the exact strings against the provider catalog and the installed version (`uv pip show pydantic-ai`) before copying one into code.

---

## 1. Agent constructor

```python
from pydantic_ai import Agent

agent = Agent(
    "openai:gpt-5",                  # model: str | Model | None
    output_type=MyOutputModel,       # structured output type; default is str
    instructions="You are a ...",    # static text or a callable
    system_prompt="Be concise.",     # static system prompt(s)
    deps_type=MyDeps,                # dependency type, used for type checking
    name="my-agent",                 # optional; inferred from the variable name
    retries=1,                       # default retries for tools and output validation
    output_retries=None,             # override retries for output validation only
    tools=[my_tool],                 # Tool objects or plain functions
    defer_model_check=False,         # True skips the environment check at construction
    end_strategy="early",            # "early" | "graceful" | "exhaustive"
)
```

Older releases named the output parameter `result_type` and the result attribute `.data`. Current releases use `output_type` and `result.output`, so rewrite any code or sample that still uses the old names.

`instructions` suits text that applies to this agent only, and `system_prompt` persists in message history across agents. Pick `instructions` for new code.

---

## 2. Model strings

The format is `provider:model-name`, and the framework infers the provider from the prefix.

| Provider prefix | Example form |
|---|---|
| `openai:` | `'openai:gpt-5'`, `'openai:gpt-4o'` |
| `anthropic:` | `'anthropic:<model-name>'` |
| `google-gla:` | `'google-gla:gemini-<version>'` |
| `google-vertex:` | `'google-vertex:gemini-<version>'` |
| `bedrock:` | `'bedrock:<vendor>.<model-name>'` |
| `xai:` | `'xai:<model-name>'` |
| `deepseek:` | `'deepseek:deepseek-chat'` |
| `cohere:` | `'cohere:command-r-08-2024'` |
| `gateway/...` | `'gateway/openai:gpt-5'` (PydanticAI Gateway) |

Take model names from configuration (`Settings.model_name`) instead of scattering literals, so an upgrade changes one value. A model may also be omitted at construction and passed per run: `agent.run(prompt, model="openai:gpt-5")`.

Provider API keys come from the environment (`OPENAI_API_KEY` and its siblings). Keep them out of the repository, out of logs, and out of any file a test snapshot might capture.

---

## 3. Tools

### Decorators

```python
from pydantic_ai import Agent, RunContext

agent = Agent("openai:gpt-5", deps_type=str)


@agent.tool                     # receives RunContext as the first argument
async def greet(ctx: RunContext[str], name: str) -> str:
    return f"Hello {ctx.deps}, {name}!"


@agent.tool_plain               # no context needed
async def roll_dice(sides: int) -> int:
    return random.randint(1, sides)
```

### `RunContext[Deps]`

The first parameter of `@agent.tool` functions, carrying:

- `ctx.deps`: the dependency instance,
- `ctx.model`: the model in use,
- `ctx.usage`: token usage so far,
- `ctx.messages`: the conversation history,
- `ctx.retry` and `ctx.max_retries`: the retry counters,
- `ctx.agent`: the running agent.

Use `@agent.tool_plain` when a tool needs none of those. Tool docstrings and parameter descriptions become the schema the model reads, so write them as instructions to the model: what the tool does, when to call it, what each argument means. Type every parameter, and use `Annotated[str, Field(description="...")]` or Pydantic models for structured arguments.

Tools perform real side effects, so give each one the narrowest capability it needs. A tool that can run shell commands or write files deserves an allow-list and a dry-run mode.

---

## 4. Structured output

Pass a Pydantic `BaseModel`, or `bool`, `int`, `list[str]`, a union and similar types, as `output_type`. Read the result from `.output`.

```python
from pydantic import BaseModel
from pydantic_ai import Agent


class City(BaseModel):
    name: str
    country: str
    population_millions: float


agent = Agent("openai:gpt-5", output_type=City)
result = agent.run_sync("Tell me about Tokyo")
print(result.output)        # City(name='Tokyo', country='Japan', ...)
print(result.output.name)   # 'Tokyo'
```

A union such as `output_type=[City, Failure]` lets the model choose between a success shape and an explicit failure shape, which is how this stack expresses "expected failures as values" (see `error-handling.md`). Add an output validator for rules the schema cannot express:

```python
@agent.output_validator
async def check_population(ctx: RunContext[Deps], output: City) -> City:
    if output.population_millions <= 0:
        raise ModelRetry("population_millions must be positive")
    return output
```

---

## 5. Async and sync

| Call | Mode | Returns |
|---|---|---|
| `await agent.run(prompt, ...)` | async | `AgentRunResult[OutputDataT]` |
| `agent.run_sync(prompt, ...)` | sync | `AgentRunResult[OutputDataT]` |
| `async with agent.run_stream(prompt, ...) as response:` | async streaming | `StreamedRunResult` |

```python
# sync
result = agent.run_sync("What is the capital of Italy?")
print(result.output)

# async
result = await agent.run("What is the capital of France?")
print(result.output)

# streaming
async with agent.run_stream("What is the capital of the UK?") as response:
    async for text in response.stream_text():
        print(text, end="")
    print(response.output)   # final value after the stream ends
```

`run_sync()` wraps the event loop call, so avoid it inside running async code. Inside the async stack use `await agent.run(...)`, and call blocking agent code from threads through `anyio.to_thread.run_sync`. Bound every run with `with anyio.fail_after(60):` and pass `usage_limits=UsageLimits(request_limit=10, total_tokens_limit=50_000)` so a looping agent stops at a budget.

---

## 6. Dependencies

A dataclass holds the dependencies. Pass the type to `deps_type` and an instance to `deps` at run time.

```python
from dataclasses import dataclass

import httpx2
from pydantic_ai import Agent, RunContext


@dataclass(frozen=True, slots=True)
class Deps:
    api_key: str
    http_client: httpx2.AsyncClient


agent = Agent("openai:gpt-5", deps_type=Deps)


@agent.tool
async def fetch_data(ctx: RunContext[Deps], endpoint: str) -> str:
    response = await ctx.deps.http_client.get(
        endpoint,
        headers={"Authorization": f"Bearer {ctx.deps.api_key}"},
    )
    response.raise_for_status()
    return response.text


async def main() -> None:
    async with create_async_client() as client:   # factory from httpx2-optimization.md
        deps = Deps(api_key=settings.api_key.get_secret_value(), http_client=client)
        result = await agent.run("Get /users", deps=deps)
        print(result.output)
```

The `http_client` comes from the shared factory, so agent tools inherit HTTP/2, timeouts and retries. Tool results are text the model reads, so truncate large bodies and strip secrets before returning.

---

## 7. Errors and retries from tools

```python
from pydantic_ai import Agent, ModelRetry, UnexpectedModelBehavior, capture_run_messages

agent = Agent("openai:gpt-5", retries=3)


@agent.tool_plain
def calc_volume(size: int) -> int:
    if size == 42:
        return size**3
    raise ModelRetry("Please try again with size 42.")


with capture_run_messages() as messages:
    try:
        result = agent.run_sync("Get the volume of a box with size 6.")
    except UnexpectedModelBehavior as e:
        print("Error:", e)             # "Tool 'calc_volume' exceeded max retries count of 3"
        print("Cause:", e.__cause__)   # ModelRetry('Please try again ...')
        print("Messages:", messages)
```

- `ModelRetry` is raised from a tool, an output validator or a hook to ask the model to try again with the message as feedback.
- `UnexpectedModelBehavior` signals an exceeded retry limit or an unrecoverable model API error.
- `capture_run_messages()` records every message exchanged during a run for debugging.

Wrap provider failures (rate limits, timeouts, auth errors) into typed domain errors at the module that owns the agent, and retry transient ones with backoff outside the agent loop.

---

## 8. Testing without a live model

```python
from pydantic_ai.models.test import TestModel


async def test_agent_returns_city() -> None:
    with agent.override(model=TestModel()):
        result = await agent.run("Tell me about Paris")
    assert isinstance(result.output, City)
```

`TestModel` produces valid structured data from the schema, and `FunctionModel` (in `pydantic_ai.models.function`) lets a test script the model's replies and tool calls. Set `pydantic_ai.models.ALLOW_MODEL_REQUESTS = False` in `conftest.py` so an unmocked test cannot spend tokens by accident. Reserve a small, marked suite (`@pytest.mark.live`) for real-model checks, skipped by default in CI because it costs quota.

For prompt or behaviour regressions use `pydantic-evals`: a dataset of cases, an evaluator per property, and a report you compare across changes.

---

## 9. Observability with Logfire

```python
import logfire

logfire.configure()                # reads the token from the project's .logfire directory
logfire.instrument_pydantic_ai()   # traces all agent runs
```

Or set `instrument=True` on a single agent. Traces include prompts and tool arguments, which can hold personal data, so check the retention settings before enabling it on production traffic.

---

## 10. Complete snippets

### Basic agent with structured output

```python
from pydantic import BaseModel
from pydantic_ai import Agent


class City(BaseModel):
    name: str
    country: str


agent = Agent("openai:gpt-5", output_type=City)
result = agent.run_sync("Tell me about Paris")
print(result.output)   # City(name='Paris', country='France')
```

### Tools and dependencies

```python
from dataclasses import dataclass

from pydantic_ai import Agent, RunContext


@dataclass(frozen=True, slots=True)
class Deps:
    api_key: str


agent = Agent("openai:gpt-5", deps_type=Deps)


@agent.tool
async def get_secret(ctx: RunContext[Deps], code: str) -> str:
    if code == "1234":
        return f"secret-for-{ctx.deps.api_key}"
    return "wrong code"


result = agent.run_sync("My code is 1234", deps=Deps(api_key="sk-abc"))
print(result.output)
```

The key above is a placeholder for the example. Real keys are read from the environment.

### Async streaming

```python
import anyio
from pydantic_ai import Agent

agent = Agent("openai:gpt-5")


async def main() -> None:
    async with agent.run_stream("Write a haiku about Python") as response:
        async for text in response.stream_text():
            print(text, end="")
        print("\n---")
        print("Final:", response.output)


anyio.run(main)
```

---

## Prompt-injection hygiene

Text fetched by tools (web pages, issue bodies, files, emails) is data. Keep it inside tool results, never concatenate it into `instructions`, and give agents that read untrusted text no tools with irreversible effects unless a human confirms them. Validate every tool argument with types, and log tool calls with their arguments for audit.

## Version notes

- PydanticAI 1.x declared API stability in September 2025. Breaking changes are reserved for 2.0.
- `output_type` replaced `result_type`, and `result.output` replaced `result.data`.
- Model identifiers, provider prefixes and optional extras change between minor releases. Read the changelog of the installed version before upgrading.
