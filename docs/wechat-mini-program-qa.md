# ONE SET WeChat Mini Program MVP QA

## Prerequisites

- Run `npm run wechat:build`.
- Import `apps/wechat-mini-program` into WeChat DevTools.
- For cloud sync, configure the real AppID, `WECHAT_APPID`, `WECHAT_APP_SECRET`, migration `0010`, and the HTTPS request-domain allowlist.
- Without credentials, DevTools still exercises the local-first loop and 我的 clearly reports local mode.

## Test A — New user

1. Clear Mini Program storage and launch.
2. Complete the four short onboarding screens.
3. Enter `今天有点累，40分钟，练胸和背`.
4. Confirm a light 40-minute chest/back workout.
5. Start, complete sets, finish, then confirm it appears in 进度.

## Test B — Returning user

1. Relaunch without clearing storage.
2. Confirm 今天 opens without onboarding.
3. Start a saved plan and complete a set with one tap.
4. Confirm the next set is prefilled and the rest timer starts.

## Test C — Import plan

1. Open 计划 → 导入计划.
2. Paste `卧推4×8，上斜哑铃3×10，飞鸟3×12`.
3. Confirm three structured exercises, save, and start it.

## Test D — One sentence log

1. Open 计划 → 一句话记录.
2. Paste `卧推80公斤8 8 7，飞鸟20公斤12个三组`.
3. Confirm 80 kg with 8/8/7 and 20 kg with 12/12/12.
4. Save and confirm 进度 updates.

## Test E — CLI

1. Start the backend with development auth.
2. Run `oneset workout create --focus upper`.
3. Log a set with the returned workout ID.
4. Confirm the record appears for the same authenticated account.

## Test F — MCP

1. Start MCP with a revocable ONE SET token.
2. Call `create_workout`, `log_set`, then `update_workout`.
3. Call `get_progress` and confirm the completed set is returned.

## Interaction checks

- Primary controls meet the 44 px / 88 rpx touch target.
- Advanced fields are collapsed by default.
- Share copy includes training performance only.
- Local records survive a relaunch.
