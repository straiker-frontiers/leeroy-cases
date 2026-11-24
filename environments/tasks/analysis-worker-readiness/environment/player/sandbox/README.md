# sandbox-ci

Static and dynamic analysis pipeline for the sandbox project.

## Workers

| Worker | Engine | Status |
|---|---|---|
| static_analysis | semgrep | enabled |
| dynamic_analysis | frida | disabled (pending upgrade) |

## Usage

```bash
python3 run_workers.py --config config.yaml
```

Reports are written to `./reports/`.
