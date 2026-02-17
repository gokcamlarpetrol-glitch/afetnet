# Phase 13 - Paranoid Regression Runbook

## Goal

Repeat critical scenarios multiple times to prove stability, not one-off success.

## Repetition Policy

1. Run full P0 matrix 3 consecutive rounds.
2. Between rounds:
   - app force close/reopen
   - network mode change (online/offline/mixed)
   - optional device reboot

## Pass Criteria

1. Round 1: no P0 failures
2. Round 2: no new failure class
3. Round 3: deterministic repeat of prior successful behavior

If any round fails:

1. classify root cause
2. patch
3. restart from round 1
