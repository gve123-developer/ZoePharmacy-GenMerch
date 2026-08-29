# Project Rules & Instructions

## Project Deployment Workflow

This project is the live production system for Zoe Pharmacy and General Merchandise.

*   **Repository:** `https://github.com/gve123-developer/ZoePharmacy-GenMerch`
*   **Production Branch:** `main`
*   **Deployment:** GitHub `main` is connected to Heroku automatic deployment.

For every requested code or UI change:

1.  Modify only the files directly related to the request.
2.  Do not make unrelated changes.
3.  Preserve the existing design, functionality, database behavior, and business logic unless the user explicitly requests a change.
4.  Before committing, review all modified files using `git status` and `git diff`.
5.  Run:
    ```bash
    npm run build
    ```
6.  Only continue if the build succeeds.
7.  Do not commit generated `dist` files unless they are intentionally required.
8.  Commit the completed changes with a clear and descriptive commit message.
9.  Push the commit to:
    ```bash
    origin main
    ```
10. Since `main` is connected to Heroku automatic deployment, do not run a separate Heroku deployment command.
11. Never force-push.
12. Never reset, delete, or overwrite unrelated work.
13. If the requested change could affect the database schema, production data, authentication, deployment configuration, or other critical functionality, do not push automatically. Explain the risk first and wait for approval.
