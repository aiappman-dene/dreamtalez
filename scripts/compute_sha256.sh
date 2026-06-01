#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <keystore-path> <alias> [storepass]"
  echo "Example: $0 android/bedtalez-release.jks bedtalez"
  exit 2
fi

KEYSTORE="$1"
ALIAS="$2"
STOREPASS="${3:-}"

if [ ! -f "$KEYSTORE" ]; then
  echo "Keystore not found: $KEYSTORE" >&2
  exit 3
fi

if [ -z "$STOREPASS" ]; then
  echo -n "Enter keystore password: "
  read -s STOREPASS
  echo
fi

keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$STOREPASS" 2>/dev/null | awk -F": " '/SHA256:/{print $2}'
