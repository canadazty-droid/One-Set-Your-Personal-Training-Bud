# ONE SET V238 — Manual QA

## Core loop

- Open `/` and confirm the brand reads `练一下 · ONE SET` once.
- Expand `想自己选择？`, open `手动输入完整需求`, enter `30 分钟，练胸和背`, then generate.
- Confirm the plan shows chest and back, 30 minutes, intensity, exercises, sets, reps, rest, and a visible `完成训练` action near the top.
- Open `完成训练`; confirm the five fields are completion, difficulty, energy, soreness, and optional notes.
- Save once, reopen the form, change the values, and save again. Confirm Progress still contains one log for today.
- Reload the page, open Progress, and confirm `本周复盘`, `最近 7 天`, completion rate, all three averages, risk alert, tomorrow suggestion, and the saved record remain.
- Generate another workout and confirm a threshold-triggered prior log produces a visible `根据上次记录自动调整` reason.

## Rule checks

- Energy `4/10` or lower: next workout is light, no longer than 30 minutes, with fewer movements/sets.
- Soreness `8/10` or higher: next workout is light and avoids the prior focus when possible.
- Difficulty `9/10` or higher: next workout removes one movement and one set.
- Three completed sessions with soreness `6/10` or lower: main movements gain one set.
- Two consecutive missed workouts: next workout becomes shorter and recommends a lower weekly frequency.
- No logs: Progress shows `需要更多训练记录` without an error.

## Persistence and responsive UI

- Complete onboarding, reload, and confirm profile/plan choices remain.
- Confirm one-tap generation and manual text generation both end on the same recordable Plan screen.
- Check 320 px, 390 px, and 430 px widths: no horizontal overflow; all five bottom-nav labels remain readable; buttons remain at least 44 px tall.
- Switch Chinese → English → Chinese at mobile width; confirm the header and bottom navigation do not overlap.
