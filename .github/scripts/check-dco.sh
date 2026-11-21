#!/usr/bin/env sh
# DCO check: every commit in <base>..HEAD must carry a Signed-off-by trailer
# matching its author identity. Usage: check-dco.sh [base-ref]
set -eu

base="${1:-origin/main}"

if ! git rev-parse --verify -q "$base" >/dev/null; then
  base="$(git rev-list --max-parents=0 HEAD)"
fi

status=0
for sha in $(git rev-list "$base..HEAD"); do
  parents="$(git show -s --format='%P' "$sha")"
  case "$parents" in
    *\ *)
      # merge commit (e.g. the pull/refs/merge head): skip, like the DCO app
      printf 'SKIP     %s  merge commit\n' "$(git show -s --format='%h' "$sha")"
      continue
      ;;
  esac
  signoff="$(git show -s --format='%(trailers:key=Signed-off-by,valueonly)' "$sha")"
  author="$(git show -s --format='%an <%ae>' "$sha")"
  if [ "$signoff" = "$author" ]; then
    printf 'OK       %s  %s\n' "$(git show -s --format='%h' "$sha")" "$author"
  else
    printf 'MISSING  %s  expected Signed-off-by: %s\n' \
      "$(git show -s --format='%h' "$sha")" "$author"
    status=1
  fi
done

exit "$status"
