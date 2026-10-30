# worker

Job runner. Not started; built by `docs/build/phase-0.md`.

Claims rows from the `jobs` table (`FOR UPDATE SKIP LOCKED`), runs handlers by type (`run_stage`, later `create_jira_items`, `clone_mr`, `sync_jira_status`), and invokes Devin CLI non-interactively per spec section 3. Runs as a Windows Scheduled Task under the app's service account.
