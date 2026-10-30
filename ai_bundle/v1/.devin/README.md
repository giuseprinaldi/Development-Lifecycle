# ai_bundle/v1/.devin

Copy the team's Devin skill bundle here, keeping its layout:

```
skills/generate-proposal/{SKILL.md,prompt.md}
skills/review-proposal/{SKILL.md,prompt.md}
skills/alignment-review/{SKILL.md,prompt.md}
skills/adjudicate-review/{SKILL.md,prompt.md}
skills/carry-forward-baseline/{SKILL.md,prompt.md}
workflow/templates/proposal-template.md
workflow/templates/proposal-review-checklist.md
workflow/templates/carry-forward-baseline.md
```

The worker copies this folder into each job directory so the skills resolve their templates by relative path. Bump the version folder (`v2/`) when the bundle changes; the active version is set in `app_config` and stamped on every AI result.

Strip anything environment-specific (server addresses, field IDs) before committing. Those belong in `app_config`, not in the repository.
