#!/usr/bin/env python3
"""
Benchmark all locally installed Ollama models sequentially.
Usage: python3 scripts/benchmark-ollama-models.py
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

API_URL = "http://localhost:11434/api/generate"
PROMPT = "Write a function that checks if a number is prime. Explain briefly."
WARMUP_PROMPT = "Say OK."
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
RESULTS_JSON = OUTPUT_DIR / "ollama-benchmark-results.json"
MODELS_MANIFEST = Path(__file__).resolve().parent / "ollama-benchmark-models.json"


@dataclass
class ModelInfo:
    name: str
    size_label: str
    size_bytes: int | None = None


@dataclass
class BenchmarkResult:
    model: str
    size_label: str
    size_bytes: int | None
    tok_s: float | None
    ttft_s: float | None
    total_s: float | None
    eval_count: int
    eval_duration_s: float | None
    prompt_eval_duration_s: float | None
    peak_memory_gb: float | None
    peak_memory_source: str | None
    error: str | None = None


def run_cmd(args: list[str], timeout: int | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def parse_size_label_to_bytes(label: str) -> int | None:
    match = re.match(r"^\s*([\d.]+)\s*([KMGT]?B)\s*$", label.strip(), re.IGNORECASE)
    if not match:
        return None
    value = float(match.group(1))
    unit = match.group(2).upper()
    multipliers = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}
    return int(value * multipliers.get(unit, 1))


def parse_ollama_list() -> list[ModelInfo]:
    proc = run_cmd(["ollama", "list"])
    if proc.returncode != 0:
        raise RuntimeError(f"ollama list failed: {proc.stderr.strip()}")

    models: list[ModelInfo] = []
    for line in proc.stdout.splitlines()[1:]:
        line = line.strip()
        if not line:
            continue
        match = re.match(r"^(\S+)\s+\S+\s+([\d.]+\s+[KMGT]?B)", line, re.IGNORECASE)
        if not match:
            continue
        models.append(ModelInfo(name=match.group(1), size_label=match.group(2)))
    return models


def enrich_sizes_from_api(models: list[ModelInfo]) -> None:
    try:
        with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return

    by_name = {item.get("name"): item for item in payload.get("models", [])}
    for model in models:
        tag = by_name.get(model.name)
        if not tag:
            continue
        model.size_bytes = tag.get("size")
        if model.size_bytes:
            model.size_label = format_bytes(model.size_bytes)


def format_bytes(num_bytes: int) -> str:
    gib = num_bytes / (1024**3)
    if gib >= 1:
        return f"{gib:.1f} GB"
    mib = num_bytes / (1024**2)
    return f"{mib:.0f} MB"


def is_model_pulling(name: str) -> bool:
    proc = run_cmd(["ollama", "show", name, "--modelfile"], timeout=20)
    if proc.returncode != 0:
        stderr = proc.stderr.lower()
        if "pulling" in stderr or "download" in stderr or "not found" in stderr:
            return True
    return False


def stop_model(name: str) -> None:
    run_cmd(["ollama", "stop", name], timeout=120)


def stop_all_running() -> None:
    proc = run_cmd(["ollama", "ps"])
    if proc.returncode != 0:
        return
    for line in proc.stdout.splitlines()[1:]:
        parts = line.split()
        if parts:
            stop_model(parts[0])
    time.sleep(1)


def parse_ollama_ps_size_gb() -> float | None:
    proc = run_cmd(["ollama", "ps"])
    if proc.returncode != 0:
        return None
    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    if len(lines) <= 1:
        return None
    total_bytes = 0
    matched = False
    for line in lines[1:]:
        parts = line.split()
        if len(parts) < 3:
            continue
        matched = True
        size_label = parts[2]
        parsed = parse_size_label_to_bytes(size_label)
        if parsed:
            total_bytes += parsed
    if not matched:
        return None
    return total_bytes / (1024**3)


def parse_ollama_process_rss_gb() -> float | None:
    proc = run_cmd(["ps", "-axo", "rss=,comm="])
    if proc.returncode != 0:
        return None
    total_kb = 0
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        match = re.match(r"^(\d+)\s+(.+)$", line)
        if not match:
            continue
        rss_kb = int(match.group(1))
        comm = match.group(2).lower()
        if "ollama" in comm:
            total_kb += rss_kb
    if total_kb == 0:
        return None
    return total_kb / (1024**2)


class MemorySampler:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.peak_gb = 0.0
        self.peak_source = "none"

    def _loop(self) -> None:
        while not self._stop.is_set():
            ps_gb = parse_ollama_ps_size_gb()
            rss_gb = parse_ollama_process_rss_gb()
            if ps_gb is not None and ps_gb >= self.peak_gb:
                self.peak_gb = ps_gb
                self.peak_source = "ollama ps SIZE"
            if rss_gb is not None and rss_gb > self.peak_gb:
                self.peak_gb = rss_gb
                self.peak_source = "ollama process RSS"
            time.sleep(0.15)

    def start(self) -> None:
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> tuple[float | None, str | None]:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        if self.peak_gb <= 0:
            return None, None
        return self.peak_gb, self.peak_source


def api_generate(model: str, prompt: str, timeout_s: int = 1800) -> dict:
    body = json.dumps(
        {
            "model": model,
            "prompt": prompt,
            "stream": False,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_s) as response:
        return json.loads(response.read().decode("utf-8"))


def ns_to_s(value: int | float | None) -> float | None:
    if value is None:
        return None
    return float(value) / 1_000_000_000


def benchmark_model(model: ModelInfo) -> BenchmarkResult:
    print(f"\n=== {model.name} ({model.size_label}) ===", flush=True)

    stop_all_running()
    time.sleep(1)

    print("  warmup...", flush=True)
    try:
        api_generate(model.name, WARMUP_PROMPT)
    except Exception as exc:
        return BenchmarkResult(
            model=model.name,
            size_label=model.size_label,
            size_bytes=model.size_bytes,
            tok_s=None,
            ttft_s=None,
            total_s=None,
            eval_count=0,
            eval_duration_s=None,
            prompt_eval_duration_s=None,
            peak_memory_gb=None,
            peak_memory_source=None,
            error=f"warmup failed: {exc}",
        )

    print("  measured run...", flush=True)
    sampler = MemorySampler()
    sampler.start()
    try:
        payload = api_generate(model.name, PROMPT)
    except Exception as exc:
        peak_gb, peak_source = sampler.stop()
        return BenchmarkResult(
            model=model.name,
            size_label=model.size_label,
            size_bytes=model.size_bytes,
            tok_s=None,
            ttft_s=None,
            total_s=None,
            eval_count=0,
            eval_duration_s=None,
            prompt_eval_duration_s=None,
            peak_memory_gb=peak_gb,
            peak_memory_source=peak_source,
            error=f"measure failed: {exc}",
        )
    finally:
        peak_gb, peak_source = sampler.stop()

    eval_count = int(payload.get("eval_count") or 0)
    eval_duration_s = ns_to_s(payload.get("eval_duration"))
    prompt_eval_duration_s = ns_to_s(payload.get("prompt_eval_duration"))
    total_s = ns_to_s(payload.get("total_duration"))

    tok_s = None
    if eval_count > 0 and eval_duration_s and eval_duration_s > 0:
        tok_s = eval_count / eval_duration_s

    tok_s_label = f"{tok_s:.2f}" if tok_s is not None else "n/a"
    ttft_label = f"{prompt_eval_duration_s:.2f}s" if prompt_eval_duration_s is not None else "n/a"
    if peak_gb is not None:
        print(f"  tok/s={tok_s_label}, ttft={ttft_label}, peak={peak_gb:.2f}GB", flush=True)
    else:
        print(f"  tok/s={tok_s_label}, ttft={ttft_label}", flush=True)

    stop_model(model.name)
    time.sleep(1)

    return BenchmarkResult(
        model=model.name,
        size_label=model.size_label,
        size_bytes=model.size_bytes,
        tok_s=tok_s,
        ttft_s=prompt_eval_duration_s,
        total_s=total_s,
        eval_count=eval_count,
        eval_duration_s=eval_duration_s,
        prompt_eval_duration_s=prompt_eval_duration_s,
        peak_memory_gb=peak_gb,
        peak_memory_source=peak_source,
    )


def print_table(results: list[BenchmarkResult]) -> None:
    ok = [r for r in results if r.error is None and r.tok_s is not None]
    ok.sort(key=lambda item: item.tok_s or 0, reverse=True)

    print("\n| Model | Size | tok/s | TTFT (s) | Peak memory |")
    print("| --- | --- | ---: | ---: | ---: |")
    for row in ok:
        peak = f"{row.peak_memory_gb:.2f} GB" if row.peak_memory_gb else "n/a"
        print(
            f"| {row.model} | {row.size_label} | {row.tok_s:.2f} | "
            f"{row.ttft_s:.2f} | {peak} |"
        )

    failed = [r for r in results if r.error]
    if failed:
        print("\nSkipped / failed:")
        for row in failed:
            print(f"- {row.model}: {row.error}")


def load_manifest_groups() -> dict[str, list[str]]:
    if not MODELS_MANIFEST.exists():
        return {}
    payload = json.loads(MODELS_MANIFEST.read_text(encoding="utf-8"))
    groups = payload.get("groups", {})
    return {key: list(value) for key, value in groups.items() if isinstance(value, list)}


def select_models(all_models: list[ModelInfo], group: str | None) -> list[ModelInfo]:
    if not group:
        return all_models

    groups = load_manifest_groups()
    allowed = set(groups.get(group, []))
    if not allowed:
        raise RuntimeError(f"Unknown benchmark group '{group}'. Available: {', '.join(sorted(groups))}")

    by_name = {model.name: model for model in all_models}
    selected: list[ModelInfo] = []
    missing: list[str] = []
    for name in groups[group]:
        model = by_name.get(name)
        if model:
            selected.append(model)
        else:
            missing.append(name)

    if missing:
        print(f"Not installed (skipped): {', '.join(missing)}", flush=True)

    return selected


def main() -> int:
    group = None
    args = sys.argv[1:]
    if args and args[0] in {"--coders", "--general", "--vision", "--all-installed"}:
        token = args[0]
        group = None if token == "--all-installed" else token.removeprefix("--")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        urllib.request.urlopen("http://localhost:11434/api/tags", timeout=5)
    except urllib.error.URLError as exc:
        print(f"Ollama API unavailable: {exc}", file=sys.stderr)
        return 1

    models = parse_ollama_list()
    enrich_sizes_from_api(models)
    if not models:
        print("No models found in `ollama list`.", file=sys.stderr)
        return 1

    selected: list[ModelInfo] = []
    try:
        candidates = select_models(models, group)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    for model in candidates:
        if is_model_pulling(model.name):
            print(f"Skipping {model.name}: still pulling or unavailable.", flush=True)
            continue
        selected.append(model)

    if not selected:
        print("No models available to benchmark.", file=sys.stderr)
        return 1

    label = group or "all installed"
    print(f"Benchmarking {len(selected)} model(s) sequentially ({label})...")
    results: list[BenchmarkResult] = []
    for model in selected:
        results.append(benchmark_model(model))

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "prompt": PROMPT,
        "results": [asdict(item) for item in results],
    }
    RESULTS_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"\nSaved: {RESULTS_JSON}")
    print_table(results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
