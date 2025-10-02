# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in AfetNet, please follow these steps:

1. **DO NOT** create a public GitHub issue
2. **DO NOT** discuss the vulnerability publicly
3. Send an email to: security@afetnet.org
4. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Measures

### Code Security
- All dependencies are regularly audited
- Security updates are applied automatically via Dependabot
- Code is scanned for hardcoded secrets
- Regular security reviews are conducted

### Data Security
- All data is encrypted in transit and at rest
- No sensitive data is logged
- User data is anonymized when possible
- 30-day data retention policy is enforced

### Infrastructure Security
- All secrets are managed via GitHub Secrets
- Environment variables are properly configured
- Regular security audits are performed
- Access controls are implemented

## Security Updates

Security updates are released as soon as possible. Critical vulnerabilities are patched within 24 hours.

## Contact

For security-related questions, contact: security@afetnet.org

## Acknowledgments

We thank the security researchers who help keep AfetNet secure by responsibly disclosing vulnerabilities.
