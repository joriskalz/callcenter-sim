# Security PR verification

The PR workflow repeats strict TypeScript, lint and all 23 local tests, then builds the Linux production image.

Checks use isolated test data. The Docker job builds without publishing or deploying. Live provider and production configuration checks remain an approved staging step before rollout.
