# syntax=docker/dockerfile:1

# The agent image: node + npm + python + git + Claude Code, run by
# scripts/run-agent. Nothing of the project is baked in — the working copy is
# bind-mounted at run time, so the image only changes when the toolchain does.
#
# Build context is scripts/agent/ itself (see run-agent), so COPY paths below
# are relative to that directory.

FROM node:22-bookworm

ARG USER_NAME=agent
ARG USER_UID=1000
ARG USER_GID=1000

# python + the small tools Claude reaches for. No openssh-client and no gh on
# purpose: with no way to authenticate against GitHub, `git push` cannot work
# even if the hook were bypassed.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      git jq ripgrep curl ca-certificates less procps tzdata \
 && rm -rf /var/lib/apt/lists/*

# Recreate the container user with the caller's UID/GID so files written into
# the mounted project come out owned by you, not root. The base image ships a
# `node` user on 1000 that would collide, so it goes first.
RUN userdel -r node 2>/dev/null || true \
 && groupadd --gid "${USER_GID}" "${USER_NAME}" \
 && useradd --uid "${USER_UID}" --gid "${USER_GID}" --create-home --shell /bin/bash "${USER_NAME}"

# The hook and its settings live outside the mounted project, root-owned, so
# the agent cannot edit its own guard rails. Rebuild the image after changing
# them (run-agent does that on its own when these files are newer than the image).
COPY --chmod=0755 guard.py /opt/agent/guard.py
COPY --chmod=0644 settings.json /opt/agent/settings.json

# --dangerously-skip-permissions refuses to run as root, so Claude Code is
# installed as the user via the native installer (~/.local/bin/claude).
USER ${USER_NAME}
ENV HOME=/home/${USER_NAME} \
    PATH=/home/${USER_NAME}/.local/bin:${PATH} \
    DISABLE_AUTOUPDATER=1 \
    CLAUDE_CODE_DISABLE_MOUSE_CLICKS=1
RUN curl -fsSL https://claude.ai/install.sh | bash \
 && claude --version

CMD ["claude"]
