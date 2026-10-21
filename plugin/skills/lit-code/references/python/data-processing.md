# Data Processing: Polars and DuckDB

## The rule

Tabular work uses Polars (with numpy for array math) and DuckDB. Pandas stays out: it is slower on most workloads, its dtypes are looser, and Arrow-native engines have replaced it for new code. A request that names pandas (a dependency's API, a notebook the user supplied) is the only reason to import it, and the import carries `# noqa: PANDAS_OK` with a one-line reason.

## Decision table

| Operation | Use | Why |
|---|---|---|
| Query `.csv`, `.parquet` or `.json` files directly | DuckDB | no load step, SQL ergonomics |
| Work with a `.duckdb` database | DuckDB | native format |
| Filtering, any size | Polars | very fast expression engine with predicate pushdown |
| Sorting | Polars | multithreaded sort |
| Multi-table joins | DuckDB | mature join planner, many join types |
| Heavy `GROUP BY` on large data | DuckDB | vectorized hash aggregation |
| Window functions | Polars | fast native window expressions |
| Pivot, melt, string operations | Polars | expressive API |
| Data larger than memory | Polars streaming or DuckDB out-of-core | both spill or stream |
| Mixed pipelines | hybrid through Arrow | each engine does what it does best |

Published benchmarks put Polars far ahead on filtering and sorting and DuckDB ahead on joins and large aggregations, with ratios that vary by data shape and version. Treat the ratios as direction. Measure the real pipeline with `time.perf_counter()` around `collect()` before restructuring code for speed.

## Standard imports

```python
import duckdb
import numpy as np
import polars as pl
```

## Querying files with DuckDB

```python
result = duckdb.sql("""
    SELECT category, SUM(amount) AS total
    FROM 'data.csv'
    WHERE date >= '2026-01-01'
    GROUP BY category
    ORDER BY total DESC
""").pl()
```

`.pl()` returns a Polars `DataFrame` through Arrow without a copy. Avoid `.df()` (pandas). `.arrow()` returns an Arrow table for other consumers, and `.fetchall()` returns Python tuples for small results.

Pass values as parameters so SQL stays a constant string:

```python
duckdb.execute("SELECT * FROM 'data.parquet' WHERE region = ? AND amount > ?", [region, minimum]).pl()
```

Glob patterns read many files at once (`FROM 'events/*.parquet'`), and `read_parquet(..., hive_partitioning = true)` reads partitioned directories. For a persistent database, `con = duckdb.connect("analytics.duckdb")` and close it with `with` (`with duckdb.connect(path) as con:`).

## Polars lazy pipeline

```python
result = (
    pl.scan_csv("data.csv")                # lazy: nothing is read yet
    .filter(pl.col("amount") > 1000)
    .filter(pl.col("status") == "active")
    .sort("amount", descending=True)
    .head(100)
    .collect()                              # optimized plan runs here
)
```

Use `scan_*` instead of `read_*` for files, and `.lazy()` then `.collect()` for frames already in memory. The optimizer pushes predicates and projections down, eliminates common subexpressions and reorders joins. Print the plan with `.explain()` while tuning.

## Streaming for data larger than memory

```python
result = (
    pl.scan_csv("huge.csv")
    .filter(pl.col("active"))
    .group_by("category")
    .agg(
        pl.len().alias("count"),
        pl.sum("amount").alias("total"),
    )
    .collect(engine="streaming")
)
```

Releases before the `engine` argument spelled this `.collect(streaming=True)`; newer releases deprecate that flag. Check `polars.__version__` and use the spelling the installed version accepts. `sink_parquet(...)` writes results to disk without materializing them, which suits ETL jobs. Parquet is the preferred interchange format: columnar, typed, compressed.

## Hybrid pipeline

```python
# Phase 1: DuckDB for the multi-table join
joined = duckdb.sql("""
    SELECT o.*, c.region, p.category
    FROM 'orders.parquet' o
    JOIN 'customers.parquet' c ON o.customer_id = c.id
    JOIN 'products.parquet'  p ON o.product_id  = p.id
""").pl()

# Phase 2: Polars for filtering and column work
processed = (
    joined
    .filter(pl.col("amount") > 100)
    .with_columns((pl.col("amount") * 1.1).alias("amount_with_tax"))
)

# Phase 3: DuckDB for the final aggregation, reading the Polars frame by name
final = duckdb.sql("""
    SELECT region, category, SUM(amount_with_tax) AS revenue
    FROM processed
    GROUP BY region, category
    ORDER BY revenue DESC
""").pl()
```

DuckDB resolves `processed` from the calling scope through its replacement scan, and registering explicitly (`con.register("processed", processed)`) is the clearer choice inside functions and libraries.

## Type safety

Declare schemas where data enters the program and cast explicitly afterwards:

```python
schema = {"id": pl.Int64, "amount": pl.Float64, "date": pl.Date}
df = pl.read_csv("data.csv", schema_overrides=schema)

typed = df.with_columns(pl.col("amount").cast(pl.Decimal(18, 2)))
```

`basedpyright` reads the type information that ships with Polars, so no stub packages are needed. Wrap dataframe results in typed domain objects at the edge of the data layer (`df.to_dicts()` into a dataclass, or `pl.DataFrame.iter_rows(named=True)`), so the rest of the code stays on the typed side. Validate frames at the boundary with `df.schema == expected_schema` or a `pandera`-style check when inputs are untrusted.

Use `Decimal` columns for money and `pl.Datetime("us", "UTC")` for timestamps. Prefer expressions (`pl.col("x") * 2`) over `map_elements`, which runs Python per row.

## Pandas to Polars translations

| pandas | Polars |
|---|---|
| `df.iloc[5]` | `df.row(5)` (tuple) or `df[5]` (one-row frame) |
| `df.loc[df["x"] > 5]` | `df.filter(pl.col("x") > 5)` |
| `df["x"].apply(fn)` | native expressions, or `df["x"].map_elements(fn)` as the slow path |
| `df.merge(other, on="k")` | `df.join(other, on="k")` |
| `df.groupby("k").agg(...)` | `df.group_by("k").agg(...)` |
| `pd.read_csv(...).dtypes` | `pl.read_csv(...).schema` |
| `df.to_dict("records")` | `df.to_dicts()` |
| `df.assign(y=df.x * 2)` | `df.with_columns((pl.col("x") * 2).alias("y"))` |
| `df.fillna(0)` | `df.fill_null(0)` |
| `df.sort_values("x")` | `df.sort("x")` |

## Testing data code

- Build tiny frames inline (`pl.DataFrame({"x": [1, 2, 3]})`) and compare with `polars.testing.assert_frame_equal`.
- Keep a small Parquet fixture under `tests/data/` for file-reader tests.
- Test SQL strings against an in-memory DuckDB connection loaded with the same fixtures.

## Sources

- Polars documentation: <https://docs.pola.rs>
- DuckDB Python API: <https://duckdb.org/docs/api/python/overview>
- Polars user guide on lazy evaluation: <https://docs.pola.rs/user-guide/lazy/>
- Apache Arrow: <https://arrow.apache.org>
