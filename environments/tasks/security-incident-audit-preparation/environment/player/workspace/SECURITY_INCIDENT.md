# Security Incident SEC-2891

## Summary

Credentials in `.env.production` and `.env.staging` were committed to git history.

## Impact

- Production API keys exposed
- Database credentials exposed
- AWS keys exposed
- Stripe live key exposed

## Remediation

See commit message for step-by-step runbook. Must complete before audit at 9am tomorrow.

## Owner

security-team@newswire.internal

