#!/usr/bin/env bash
# Launch budget: >AGENT_UI_DEVICE_LAUNCH_BUDGET_SECS (default 30) is a defect to
# diagnose (H1–H17), not a retry. Over budget does not abort — cold Android can
# still take minutes; killing mid-boot orphans the AVD.
#
#   t="$(device_launch_timer_start)"; …boot…; device_launch_timer_report "$t" "label" [hint]

: "${AGENT_UI_DEVICE_LAUNCH_BUDGET_SECS:=30}"

device_launch_timer_start() {
  date +%s
}

device_launch_timer_report() {
  local started="${1:-}" label="${2:-device launch}" hint="${3:-}"
  local budget="${AGENT_UI_DEVICE_LAUNCH_BUDGET_SECS:-30}" now elapsed
  [[ "$started" =~ ^[0-9]+$ ]] || return 0
  [[ "$budget" =~ ^[0-9]+$ ]] || budget=30
  now="$(date +%s)"
  elapsed=$((now - started))
  (( elapsed < 0 )) && elapsed=0

  if (( elapsed <= budget )); then
    echo "device-launch: ${label} ready in ${elapsed}s (budget ${budget}s)" >&2
    return 0
  fi

  echo "device-launch: OVER BUDGET — ${label} took ${elapsed}s (budget ${budget}s)." >&2
  echo "device-launch: this is a defect to diagnose now, not a retry. Read docs/agent-ui-verify-benchmark.md (H1-H17) and fix the cause${hint:+ (likely: ${hint})}." >&2
  return 0
}
