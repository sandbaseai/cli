#!/bin/sh
set -e

REPO="sandbaseai/cli"
INSTALL_DIR="${SANDBASE_INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="sandbase"

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required to install sandbase" >&2
  exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "Error: tar is required to install sandbase" >&2
  exit 1
fi

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin) OS="darwin" ;;
  Linux)  OS="linux" ;;
  *)
    echo "Error: Unsupported operating system: $OS" >&2
    exit 1
    ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    echo "Error: Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

if [ -n "${SANDBASE_VERSION:-}" ]; then
  VERSION="${SANDBASE_VERSION#v}"
else
  # Get latest version from GitHub
  VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')"
fi

if [ -z "$VERSION" ]; then
  echo "Error: Failed to determine latest version" >&2
  exit 1
fi

ARCHIVE="sandbase_${VERSION}_${OS}_${ARCH}.tar.gz"
URL="https://github.com/${REPO}/releases/download/v${VERSION}/${ARCHIVE}"

echo "Downloading sandbase v${VERSION} for ${OS}/${ARCH}..."

# Create temp directory
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Download and extract
curl -fsSL "$URL" -o "${TMP_DIR}/${ARCHIVE}"
tar -xzf "${TMP_DIR}/${ARCHIVE}" -C "$TMP_DIR"

# Install binary
if [ -w "$INSTALL_DIR" ]; then
  mv "${TMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
else
  if ! command -v sudo >/dev/null 2>&1; then
    echo "Error: ${INSTALL_DIR} is not writable and sudo is not available" >&2
    echo "Set SANDBASE_INSTALL_DIR to a writable directory and retry." >&2
    exit 1
  fi
  sudo mv "${TMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
fi
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

echo "Installed sandbase v${VERSION} to ${INSTALL_DIR}/${BINARY_NAME}"

# Verify
if command -v sandbase >/dev/null 2>&1; then
  sandbase --version
else
  echo "Warning: ${INSTALL_DIR} may not be in your PATH" >&2
  "${INSTALL_DIR}/${BINARY_NAME}" --version
fi
