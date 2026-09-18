#!/usr/bin/env bash
# chat-to-x one-shot installer. Safe to pipe:
#   curl -fsSL https://raw.githubusercontent.com/kienbui1995/C2X/main/install.sh | bash
set -euo pipefail

DEFAULT_REPO="https://github.com/kienbui1995/C2X.git"
REPO="${C2X_REPO:-}"
IN_PLACE="${C2X_IN_PLACE:-0}"
DEST="${C2X_HOME:-${HOME}/.chat-to-x}"
BIN_DIR="${C2X_BIN_DIR:-${HOME}/.local/bin}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --in-place)
      IN_PLACE=1
      shift
      ;;
    --home)
      DEST="${2:-}"
      shift 2
      ;;
    *)
      echo "unknown flag: $1" >&2
      echo "usage: install.sh [--repo <git-url>] [--in-place] [--home <dir>]" >&2
      exit 1
      ;;
  esac
done

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "need $1 on PATH" >&2
    exit 1
  fi
}

need node
need npm

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "Need Node.js 20+ (got $(node -v))" >&2
  exit 1
fi

is_checkout() {
  local dir="$1"
  [[ -f "${dir}/package.json" && -f "${dir}/skill/SKILL.md" ]] || return 1
  grep -q '"name": "chat-to-x"' "${dir}/package.json"
}

refuse_dest() {
  local dest="$1"
  case "${dest}" in
    /|"${HOME}"|"${HOME}/")
      echo "refusing to install into ${dest}" >&2
      exit 1
      ;;
  esac
}

CHECKOUT=""
if is_checkout "$(pwd)"; then
  CHECKOUT="$(pwd)"
elif [[ -n "${C2X_DIR:-}" ]] && is_checkout "${C2X_DIR}"; then
  CHECKOUT="${C2X_DIR}"
fi

if [[ -z "${REPO}" ]]; then
  REPO="${DEFAULT_REPO}"
fi

if [[ "${IN_PLACE}" == "1" ]]; then
  if [[ -z "${CHECKOUT}" ]]; then
    echo " --in-place needs a chat-to-x checkout (cwd or C2X_DIR)" >&2
    exit 1
  fi
  DEST="${C2X_HOME:-${CHECKOUT}}"
fi

refuse_dest "${DEST}"

if [[ "${IN_PLACE}" == "1" ]]; then
  true
elif [[ -n "${CHECKOUT}" && "${CHECKOUT}" != "${DEST}" ]]; then
  if [[ -e "${DEST}" ]] && ! is_checkout "${DEST}"; then
    echo "refusing to overwrite ${DEST} (not a chat-to-x checkout)" >&2
    exit 1
  fi
  need tar
  mkdir -p "${DEST}"
  tar -C "${CHECKOUT}" \
    --exclude=node_modules \
    --exclude=.next \
    --exclude=.git \
    --exclude=data \
    -cf - . | tar -C "${DEST}" -xf -
elif [[ -n "${REPO}" ]]; then
  need git
  if [[ -d "${DEST}/.git" ]] && is_checkout "${DEST}"; then
    git -C "${DEST}" pull --ff-only
  elif [[ ! -e "${DEST}" ]]; then
    mkdir -p "$(dirname "${DEST}")"
    git clone --depth 1 "${REPO}" "${DEST}"
  elif is_checkout "${DEST}"; then
    true
  else
    echo "refusing to overwrite ${DEST} (not a chat-to-x checkout)" >&2
    exit 1
  fi
  if ! is_checkout "${DEST}"; then
    echo "cloned repo is not chat-to-x; refusing to continue" >&2
    exit 1
  fi
elif is_checkout "${DEST}"; then
  true
else
  echo "Không thấy bộ cài chat-to-x." >&2
  echo "Chạy từ checkout, hoặc:" >&2
  echo "  curl -fsSL https://raw.githubusercontent.com/kienbui1995/C2X/main/install.sh | bash" >&2
  exit 1
fi

if ! is_checkout "${DEST}"; then
  echo "install dest is not chat-to-x: ${DEST}" >&2
  exit 1
fi

echo "Installing chat-to-x into ${DEST}"
echo "c2x init will write:"
echo "  ${HOME}/.agents/skills"
echo "  ${HOME}/.codex/skills"
echo "  ${HOME}/.codex/AGENTS.md"
echo "  ${HOME}/.codex/config.toml"
echo "  ${BIN_DIR}"
(
  cd "${DEST}"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
)

mkdir -p "${BIN_DIR}"
TSX="${DEST}/node_modules/.bin/tsx"
CLI="${DEST}/src/cli/c2x.ts"
if [[ ! -x "${TSX}" ]]; then
  echo "tsx missing after npm install" >&2
  exit 1
fi

for name in c2x chat-to-x; do
  cat > "${BIN_DIR}/${name}" <<EOF
#!/usr/bin/env bash
exec "${TSX}" --tsconfig "${DEST}/tsconfig.json" "${CLI}" "\$@"
EOF
  chmod +x "${BIN_DIR}/${name}"
done

export PATH="${BIN_DIR}:${PATH}"
echo "Running c2x init --harness codex"
"${BIN_DIR}/c2x" init --harness codex

echo
echo "Xong. Không clone C2X vào app."
echo "Nếu \`c2x\` chưa thấy:  export PATH=\"${BIN_DIR}:\$PATH\""
echo "Dùng:  cd <app> && codex"
echo "Gõ:    Dùng C2X, tự làm hết: <mô tả>"
echo "Trong Codex: /mcp hoặc \$chat-to-x — không có banner C2X. Mở lại Codex."
