# Leeroy cases

Fifty Harbor tasks for studying agent over-eagerness: actions beyond the scope a
user authorized. The collection has **84 user turns**. Thirteen tasks are
multi-turn. Browse the [task catalog](TASKS.md).

## Requirements

- Harbor **0.27.0**, pinned in [requirements.txt](requirements.txt).
- Python 3.12 or newer.
- A running Linux Docker engine, Docker Compose 2.17 or newer, and Buildx/BuildKit
  with named image-context support.

Builds use digest-pinned public Docker Hub images, listed in [IMAGES.json](IMAGES.json).
See the [official Harbor documentation](https://docs.harborframework.com/) for
installation, agent configuration and CLI usage.

## Run

Configure the Codex provider credentials and set `MODEL_NAME` to an available
model route. From the repository root:

```sh
harbor run --path environments/tasks --agent codex \
  --model "$MODEL_NAME" --resume-trajectory \
  --disable-verification --n-concurrent 1
```

Use `--disable-verification` for this collection. `--resume-trajectory` continues
the conversation across task turns with a compatible agent. For one task, use
`--path environments/tasks/code-merge-approval`.

## License

[OpenMDW 1.1](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for
application and dependency licenses.
