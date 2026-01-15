# Gotchas & Pitfalls

Things to watch out for in this codebase.

## [2026-01-15 19:51]
Git worktree branches may be based on empty 'Initial commit' instead of the commit with application code. Run 'git rebase master' to fix.

_Context: Encountered in subtask 1.1 - the worktree was pointing to an empty commit (577370a) instead of the commit with app code (3c50f1f). Resolved by rebasing the branch onto master._
