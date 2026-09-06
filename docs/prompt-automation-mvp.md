# Hoshex Prompt Automation MVP

The GitHub repository is `Soltani1376/hoshex-mvp`. Its connected Vercel project is **hoshex-app**, not the separate unlinked project named hoshex-mvp.

## Runtime flow

Vercel Cron calls `GET /api/generate-prompts` once daily. The authenticated API reads today's WordPress batch, asks the existing AvalAI connection for three image prompts, then saves and verifies three `prompts` drafts using the WordPress bridge. It returns `status: success` only after all three posts and all five ACF fields have been verified.

No images, dashboard, subscription system, or new database service are created. `sample_output` is a Persian text description, not an image attachment.

## One-time connection

1. Install and activate `plugins/wordpress/hoshex-prompt-automation/hoshex-prompt-automation.php`. If Code Snippets is used instead, import this PHP code without the opening `<?php`, run globally, and **do not also activate the plugin**.
2. The existing ACF group assigned to `prompts` must contain `prompt_text`, `language`, `sample_output`, `version`, and `access_type`. The bridge uses ACF field keys directly, so Show in REST API is not required. Text-compatible fields are required; select values are resolved from their Persian labels. An image field cannot hold `sample_output` text.
3. Create a WordPress Application Password for a user with `edit_posts`. Use an Application Password, not the user's login password.
4. Configure these **Production** environment variables on Vercel:

| Variable | Value |
| --- | --- |
| `WORDPRESS_URL` | `https://hoshex.ir` (also the default) |
| `WORDPRESS_USERNAME` | WordPress automation username |
| `WORDPRESS_APPLICATION_PASSWORD` | Application Password from WordPress |
| `CRON_SECRET` | Random secret of at least 32 characters |
| `AVALAI_API_KEY` | Existing AvalAI key; reuse the project's configuration |
| `HOSHEX_PROMPT_MODEL` | Optional; falls back to `AVALAI_MODEL`, then `gpt-4o-mini` |

Never commit these secrets. Missing credentials fail closed before generation. Redeploy Production after configuring them.

## Schedule and replay behavior

`30 5 * * *` is daily at 05:30 UTC, nominally 09:00 Tehran time. Vercel Hobby can execute within its scheduling window rather than at an exact minute. Cron does not depend on WordPress page visits.

WordPress determines the batch date in `Asia/Tehran`. One persisted daily batch and a database advisory lock prevent concurrent/retried writes from inserting a second set. The original prompt payload is recorded before creating drafts, so a partial run can resume. After a lost response the API reads the saved state before retrying. Changed or published reserved drafts cause a conflict instead of being overwritten. A midnight date change fails safely rather than assigning old work to a new day.

AI calls have a 45-second timeout and at most two attempts. WordPress writes have a 30-second timeout with reconciliation and at most one retry. The function has a 300-second duration limit. A permanent provider or WordPress outage can still prevent that day's completion; inspect the Vercel invocation error and retry the same endpoint after recovery.

## Verification

Run `node tests/run-prompt-automation-tests.mjs`. These are simulated integration tests; they do not prove a live deployment works.

For a live test, invoke `/api/generate-prompts` with `Authorization: Bearer <CRON_SECRET>` from a secure HTTP client. Confirm the response contains three different `post_ids`, then read those drafts from WordPress and verify title, content, `prompt_text`, `language`, `sample_output`, `version`, and `access_type`. Invoke again the same day: the same IDs must return and no new drafts should appear. Confirm the Production deployment shows the cron schedule.

The selected model receives only the day, assigned image topics, and up to 60 recent prompt titles. API responses and logs never contain credentials or upstream error bodies.

## References

- [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel Hobby cron scheduling](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [ACF update_field and field keys](https://www.advancedcustomfields.com/resources/update_field/)
- [MySQL connection-scoped locks](https://dev.mysql.com/doc/refman/8.0/en/locking-functions.html)
