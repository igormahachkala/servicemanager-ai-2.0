#!/usr/bin/env python3
"""
Parallel Ollama benchmark — run multiple models simultaneously.
Usage: python3 scripts/benchmark-ollama-parallel.py deepseek-coder-v2:16b qwen2.5-coder:7b
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

API_URL = "http://localhost:11434/api/generate"
PROMPT = "Write a function that checks if a number is prime. Explain briefly."
WARMUP_PROMPT = "Say OK."
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
RESULTS_JSON = OUTPUT_DIR / "ollama-benchmark-parallel-results.json"


@dataclass
class ParallelResult:
    model: str
    size_label: str | None
    tok_s: float | None
    ttft_s: float | None
    total_s: float | None
    wall_s: float | None
    eval_count: int
    eval_duration_s: float | None
    prompt_eval_duration_s: float | None
    load_duration_s: float | None
    response_preview: str | None = None
    error: str | None = None


def run_cmd(args: list[str], timeout: int | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)


def parse_size_label(name: str) -> str | None:
    proc = run_cmd(["ollama", "list"])
    if proc.returncode != 0:
        return None
    for line in proc.stdout.splitlines()[1:]:
        match = re.match(rf"^{re.escape(name)}\s+\S+\s+([\d.]+\s+[KMGT]?B)", line, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def stop_all() -> None:
    proc = run_cmd(["ollama", "ps"])
    if proc.returncode != 0:
        return
    for line in proc.stdout.splitlines()[1:]:
        parts = line.split()
        if parts:
            run_cmd(["ollama", "stop", parts[0]], timeout=120)
    time.sleep(1)


def parse_ollama_ps_size_gb() -> float | None:
    proc = run_cmd(["ollama", "ps"])
    if proc.returncode != 0:
        return None
    total_bytes = 0
    matched = False
    for line in proc.stdout.splitlines()[1:]:
        parts = line.split()
        if len(parts) < 3:
            continue
        matched = True
        m = re.match(r"^([\d.]+)\s*([KMGT]?B)$", parts[2], re.IGNORECASE)
        if m:
            value = float(m.group(1))
            unit = m.group(2).upper()
            mult = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}
            total_bytes += int(value * mult.get(unit, 1))
    return total_bytes / (1024**3) if matched else None


def parse_ollama_process_rss_gb() -> float | None:
    proc = run_cmd(["ps", "-axo", "rss=,comm="])
    if proc.returncode != 0:
        return None
    total_kb = 0
    for line in proc.stdout.splitlines():
        m = re.match(r"^(\d+)\s+(.+)$", line.strip())
        if m and "ollama" in m.group(2).lower():
            total_kb += int(m.group(1))
    return total_kb / (1024**2) if total_kb else None


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
            time.sleep(0.1)

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


def ns_to_s(value: int | float | None) -> float | None:
    if value is None:
        return None
    return float(value) / 1_000_000_000


def api_generate(model: str, prompt: str, timeout_s: int = 1800) -> dict:
    body = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_s) as response:
        return json.loads(response.read().decode("utf-8"))


def run_one_sync(model: str, prompt: str, barrier: threading.Barrier) -> tuple[str, dict | None, float, str | None]:
    barrier.wait()
    started = time.perf_counter()
    try:
        payload = api_generate(model, prompt)
        return model, payload, time.perf_counter() - started, None
    except Exception as exc:
        return model, None, time.perf_counter() - started, str(exc)


def run_one(model: str, prompt: str) -> tuple[str, dict | None, float, str | None]:
    started = time.perf_counter()
    try:
        payload = api_generate(model, prompt)
        return model, payload, time.perf_counter() - started, None
    except Exception as exc:
        return model, None, time.perf_counter() - started, str(exc)


def parse_result(model: str, payload: dict | None, wall_s: float, error: str | None) -> ParallelResult:
    if error or payload is None:
        return ParallelResult(
            model=model,
            size_label=parse_size_label(model),
            tok_s=None,
            ttft_s=None,
            total_s=None,
            wall_s=wall_s,
            eval_count=0,
            eval_duration_s=None,
            prompt_eval_duration_s=None,
            load_duration_s=None,
            error=error or "empty response",
        )

    eval_count = int(payload.get("eval_count") or 0)
    eval_duration_s = ns_to_s(payload.get("eval_duration"))
    prompt_eval_duration_s = ns_to_s(payload.get("prompt_eval_duration"))
    load_duration_s = ns_to_s(payload.get("load_duration"))
    total_s = ns_to_s(payload.get("total_duration"))
    tok_s = eval_count / eval_duration_s if eval_count and eval_duration_s else None

    return ParallelResult(
        model=model,
        size_label=parse_size_label(model),
        tok_s=tok_s,
        ttft_s=prompt_eval_duration_s,
        total_s=total_s,
        wall_s=wall_s,
        eval_count=eval_count,
        eval_duration_s=eval_duration_s,
        prompt_eval_duration_s=prompt_eval_duration_s,
        load_duration_s=load_duration_s,
        response_preview=(payload.get("response") or "")[:400] or None,
    )


def parallel_round(models: list[str], prompt: str, label: str, synchronized: bool = False) -> tuple[list[ParallelResult], float | None, str | None]:
    print(f"\n--- {label} ---", flush=True)
    print(f"  task: {prompt}", flush=True)
    sampler = MemorySampler()
    sampler.start()
    started = time.perf_counter()

    raw: list[tuple[str, dict | None, float, str | None]] = []
    with ThreadPoolExecutor(max_workers=len(models)) as pool:
        if synchronized:
            barrier = threading.Barrier(len(models))
            futures = [pool.submit(run_one_sync, model, prompt, barrier) for model in models]
        else:
            futures = [pool.submit(run_one, model, prompt) for model in models]
        for future in as_completed(futures):
            raw.append(future.result())

    wall_total = time.perf_counter() - started
    peak_gb, peak_source = sampler.stop()

    results = [parse_result(model, payload, wall, err) for model, payload, wall, err in raw]
    results.sort(key=lambda item: item.model)

    for row in results:
        if row.error:
            print(f"  {row.model}: ERROR {row.error}", flush=True)
        else:
            tok = f"{row.tok_s:.2f}" if row.tok_s is not None else "n/a"
            print(
                f"  {row.model}: tok/s={tok}, ttft={row.ttft_s:.2f}s, "
                f"wall={row.wall_s:.2f}s, total={row.total_s:.2f}s",
                flush=True,
            )

    if peak_gb is not None:
        print(f"  peak memory: {peak_gb:.2f} GB ({peak_source})", flush=True)
    print(f"  parallel wall time: {wall_total:.2f}s", flush=True)

    return results, peak_gb, peak_source


def main() -> int:
    models = sys.argv[1:] or ["deepseek-coder-v2:16b", "qwen2.5-coder:7b"]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Parallel benchmark: {', '.join(models)}")
    print(f"Prompt: {PROMPT}")

    stop_all()

    print("\nWarmup (parallel)...", flush=True)
    with ThreadPoolExecutor(max_workers=len(models)) as pool:
        list(pool.map(lambda m: run_one(m, WARMUP_PROMPT), models))

    measured, peak_gb, peak_source = parallel_round(
        models, PROMPT, "Same task, synchronized start", synchronized=True
    )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "parallel",
        "models": models,
        "prompt": PROMPT,
        "peak_memory_gb": peak_gb,
        "peak_memory_source": peak_source,
        "results": [asdict(item) for item in measured],
    }
    RESULTS_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"\nSaved: {RESULTS_JSON}")

    print("\n| Model | Size | tok/s | TTFT (s) | Wall (s) |")
    print("| --- | --- | ---: | ---: | ---: |")
    for row in sorted(measured, key=lambda item: item.tok_s or 0, reverse=True):
        tok = f"{row.tok_s:.2f}" if row.tok_s is not None else "n/a"
        ttft = f"{row.ttft_s:.2f}" if row.ttft_s is not None else "n/a"
        wall = f"{row.wall_s:.2f}" if row.wall_s is not None else "n/a"
        print(f"| {row.model} | {row.size_label or 'n/a'} | {tok} | {ttft} | {wall} |")
    if peak_gb is not None:
        print(f"\nPeak memory (both running): **{peak_gb:.2f} GB** ({peak_source})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
