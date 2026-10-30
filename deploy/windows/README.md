# deploy/windows

Windows Server deployment. Not started; built by `docs/build/phase-0.md`.

Expected files: `web.config` (IIS static files + `/api` reverse proxy + Windows Authentication + `X-Remote-User`), `Install-IIS.ps1`, `Register-Api.ps1`, `Register-Worker.ps1`, `Backup-Db.ps1`. SSO steps are in spec section 7.
