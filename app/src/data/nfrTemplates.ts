export interface NfrTemplateItem {
  id: string
  category: string
  requirement: string
  rationale: string
}

export interface NfrTemplate {
  id: string
  name: string
  standard: string
  industry: string
  description: string
  items: NfrTemplateItem[]
}

function pack(
  id: string,
  name: string,
  standard: string,
  industry: string,
  description: string,
  items: Array<[string, string, string, string]>,
): NfrTemplate {
  return {
    id,
    name,
    standard,
    industry,
    description,
    items: items.map(([itemId, category, requirement, rationale]) => ({
      id: itemId,
      category,
      requirement,
      rationale,
    })),
  }
}

export const NFR_TEMPLATES: NfrTemplate[] = [
  pack(
    'iso-25010',
    'ISO/IEC 25010 quality model',
    'ISO/IEC 25010',
    'General',
    'Baseline product quality: performance, reliability, security, maintainability, and compatibility.',
    [
      ['iso-perf-p95', 'Performance', 'Interactive APIs shall respond within a documented p95 latency budget under expected peak load.', 'ISO/IEC 25010 performance efficiency'],
      ['iso-perf-cap', 'Performance', 'The system shall sustain the agreed peak throughput without unattended degradation for 30 minutes.', 'ISO/IEC 25010 capacity'],
      ['iso-rel-avail', 'Reliability', 'The service shall meet the published monthly availability SLO, excluding planned maintenance windows.', 'ISO/IEC 25010 reliability / availability'],
      ['iso-rel-fault', 'Reliability', 'A single instance or zone failure shall not cause unrecoverable data loss; in-flight work shall retry or dead-letter.', 'ISO/IEC 25010 fault tolerance'],
      ['iso-sec-auth', 'Security', 'All non-public interfaces shall authenticate callers and authorize actions against least-privilege roles.', 'ISO/IEC 25010 security / authenticity'],
      ['iso-sec-transit', 'Security', 'Data in transit shall be encrypted with current TLS; secrets shall not appear in logs or client storage.', 'ISO/IEC 25010 confidentiality'],
      ['iso-ops-obs', 'Operability', 'Traces, metrics, and logs shall be correlated by request id so failures can be diagnosed within the MTTD target.', 'ISO/IEC 25010 maintainability'],
      ['iso-int-compat', 'Compatibility', 'Published contracts shall remain backward compatible for one supported version, or provide a documented deprecation window.', 'ISO/IEC 25010 compatibility'],
    ],
  ),
  pack(
    'iso-27001',
    'ISO/IEC 27001 information security',
    'ISO/IEC 27001',
    'Security',
    'Access control, asset protection, and incident handling for information security management.',
    [
      ['iso27-access', 'Security', 'Privileged access shall use MFA and be time-bound; standing admin rights are prohibited on production.', 'ISO/IEC 27001 A.5 / A.8 access control'],
      ['iso27-asset', 'Security', 'Information assets and processing components shall be inventoried with an owner and classification.', 'ISO/IEC 27001 A.5 asset management'],
      ['iso27-crypto', 'Security', 'Data at rest classified Confidential or higher shall be encrypted with managed keys and rotation.', 'ISO/IEC 27001 cryptography'],
      ['iso27-logging', 'Security', 'Security-relevant events (authn, authz failures, admin actions) shall be logged, immutable for 90 days, and alerted.', 'ISO/IEC 27001 logging'],
      ['iso27-incident', 'Reliability', 'Security incidents shall be triaged within the documented severity SLA and have a named owner.', 'ISO/IEC 27001 incident management'],
      ['iso27-supplier', 'Security', 'Third-party processors shall be covered by a contract that states security and data-handling obligations.', 'ISO/IEC 27001 supplier relationships'],
    ],
  ),
  pack(
    'owasp-asvs',
    'OWASP application security',
    'OWASP ASVS',
    'Security',
    'Web and API security controls from the OWASP Application Security Verification Standard.',
    [
      ['owasp-authn', 'Security', 'Authentication shall resist credential stuffing (lockout or bot detection) and never echo passwords or tokens.', 'OWASP ASVS V2 authentication'],
      ['owasp-session', 'Security', 'Session tokens shall be random, HttpOnly/Secure, and invalidated on logout and privilege change.', 'OWASP ASVS V3 session'],
      ['owasp-access', 'Security', 'Every request shall be authorized server-side; object-level access shall not rely on hidden fields or client filters.', 'OWASP ASVS V4 access control'],
      ['owasp-valid', 'Security', 'All untrusted input shall be validated on the server against an allow-list; output shall be encoded for context.', 'OWASP ASVS V5 validation'],
      ['owasp-api', 'Security', 'APIs shall enforce schema, rate limits, and authenticated identity; mass assignment of privileged fields is forbidden.', 'OWASP ASVS V13 API'],
      ['owasp-deps', 'Security', 'Third-party dependencies shall be scanned for known CVEs and blocked from production above the agreed severity.', 'OWASP ASVS V14 configuration'],
    ],
  ),
  pack(
    'nist-csf',
    'NIST Cybersecurity Framework',
    'NIST CSF 2.0',
    'Security',
    'Identify, protect, detect, respond, and recover controls for the component.',
    [
      ['nist-id', 'Security', 'The component shall have a named owner, data classification, and diagrammed trust boundary.', 'NIST CSF Identify'],
      ['nist-pr', 'Security', 'Production access shall use MFA, network restriction, and least privilege; default credentials are prohibited.', 'NIST CSF Protect'],
      ['nist-de', 'Security', 'Anomalous auth, privilege use, and traffic patterns shall generate alerts with a defined MTTD.', 'NIST CSF Detect'],
      ['nist-rs', 'Reliability', 'A documented response runbook shall exist for Sev-1 failures, including comms and rollback.', 'NIST CSF Respond'],
      ['nist-rc', 'Reliability', 'Recovery shall meet the agreed RTO/RPO; restore shall be tested at least annually.', 'NIST CSF Recover'],
      ['nist-gv', 'Governance', 'Exceptions to these controls shall be time-boxed, risk-accepted, and reviewed.', 'NIST CSF Govern'],
    ],
  ),
  pack(
    'pci-dss',
    'PCI DSS (payments)',
    'PCI DSS v4',
    'Banking & payments',
    'Cardholder data environment: network, access, logging, and encryption.',
    [
      ['pci-scope', 'Compliance', 'Cardholder data shall not be stored outside the documented CDE; PAN shall be truncated or tokenized at rest.', 'PCI DSS Req. 3'],
      ['pci-encrypt', 'Security', 'PAN in transit shall use strong cryptography; keys shall not reside with the encrypted data.', 'PCI DSS Req. 3–4'],
      ['pci-access', 'Security', 'CDE access shall be unique, MFA-protected, and reviewed at least quarterly.', 'PCI DSS Req. 7–8'],
      ['pci-network', 'Security', 'The CDE shall be segmented; inbound traffic shall be limited to required protocols only.', 'PCI DSS Req. 1'],
      ['pci-log', 'Security', 'All CDE access and payment operations shall be logged and retained per PCI DSS.', 'PCI DSS Req. 10'],
      ['pci-vuln', 'Security', 'Payment applications shall be scanned and penetration-tested on the agreed cadence before release.', 'PCI DSS Req. 6 / 11'],
    ],
  ),
  pack(
    'hipaa',
    'HIPAA (ePHI)',
    'HIPAA Security Rule',
    'Healthcare',
    'Administrative, physical, and technical safeguards for electronic protected health information.',
    [
      ['hipaa-access', 'Security', 'ePHI access shall be role-based, unique, and logged; emergency access shall be documented.', 'HIPAA §164.312(a)'],
      ['hipaa-audit', 'Security', 'Access, create, update, and disclose events for ePHI shall be auditable for the retention period.', 'HIPAA §164.312(b)'],
      ['hipaa-integrity', 'Security', 'ePHI shall be protected against improper alteration; backups shall be integrity-checked.', 'HIPAA §164.312(c)'],
      ['hipaa-transit', 'Security', 'ePHI in transit shall be encrypted; unencrypted email or chat of ePHI is prohibited.', 'HIPAA §164.312(e)'],
      ['hipaa-baa', 'Compliance', 'Any vendor processing ePHI shall have a signed BAA before data is shared.', 'HIPAA §164.308(b)'],
      ['hipaa-min', 'Privacy', 'The system shall collect and display only the minimum ePHI necessary for the task.', 'HIPAA minimum necessary'],
    ],
  ),
  pack(
    'gdpr',
    'GDPR / privacy',
    'GDPR',
    'Privacy',
    'Lawful processing, data subject rights, and privacy by design for personal data.',
    [
      ['gdpr-lawful', 'Privacy', 'Each personal-data processing purpose shall have a recorded lawful basis and retention period.', 'GDPR Art. 5–6'],
      ['gdpr-rights', 'Privacy', 'The system shall support access, rectification, and erasure (or restriction) within the statutory time limit.', 'GDPR Art. 15–17'],
      ['gdpr-min', 'Privacy', 'Personal data collected shall be limited to what is necessary for the stated purpose.', 'GDPR Art. 5(1)(c)'],
      ['gdpr-breach', 'Security', 'Personal-data breaches shall be detectable and reportable within 72 hours where required.', 'GDPR Art. 33'],
      ['gdpr-transfer', 'Privacy', 'Transfers outside the agreed region shall use an approved transfer mechanism.', 'GDPR Art. 44–46'],
      ['gdpr-dpia', 'Governance', 'High-risk processing shall have a DPIA before go-live, with residual risks accepted.', 'GDPR Art. 35'],
    ],
  ),
  pack(
    'soc2',
    'SOC 2 Trust Services',
    'SOC 2',
    'SaaS / enterprise',
    'Security, availability, processing integrity, confidentiality, and privacy for service organizations.',
    [
      ['soc2-sec', 'Security', 'Logical access to production shall be reviewed at least quarterly; joiner/mover/leaver shall complete within SLA.', 'SOC 2 Security'],
      ['soc2-avail', 'Reliability', 'Availability shall be measured against a published SLO with customer-visible status for Sev-1 incidents.', 'SOC 2 Availability'],
      ['soc2-change', 'Operability', 'Production changes shall be reviewed, logged, and roll-backable; emergency changes shall be recorded after the fact.', 'SOC 2 Security / change'],
      ['soc2-conf', 'Security', 'Confidential data shall be encrypted at rest and in transit; access shall be need-to-know.', 'SOC 2 Confidentiality'],
      ['soc2-vendor', 'Governance', 'Subservice organizations shall be inventoried with a review of their SOC report or equivalent.', 'SOC 2 vendor management'],
      ['soc2-backup', 'Reliability', 'Backups shall be encrypted, stored off-primary, and restore-tested on the agreed cadence.', 'SOC 2 Availability'],
    ],
  ),
  pack(
    'wcag-22',
    'WCAG 2.2 accessibility',
    'WCAG 2.2 AA',
    'Experience',
    'Perceivable, operable, understandable, robust UI and content for public or employee-facing surfaces.',
    [
      ['wcag-text', 'Accessibility', 'Text and essential graphics shall meet WCAG 2.2 AA contrast; text shall remain readable at 200% zoom.', 'WCAG 1.4'],
      ['wcag-kbd', 'Accessibility', 'All interactive functions shall be operable by keyboard with a visible focus indicator.', 'WCAG 2.1'],
      ['wcag-name', 'Accessibility', 'Controls shall have an accessible name and role; errors shall be identified in text.', 'WCAG 4.1 / 3.3'],
      ['wcag-time', 'Accessibility', 'Timed sessions shall warn before expiry and allow extension; motion shall be pausable.', 'WCAG 2.2'],
      ['wcag-media', 'Accessibility', 'Pre-recorded video with speech shall provide captions; essential images shall have text alternatives.', 'WCAG 1.1 / 1.2'],
    ],
  ),
  pack(
    'well-architected',
    'Cloud Well-Architected',
    'AWS / Azure Well-Architected',
    'Cloud',
    'Operational excellence, security, reliability, performance efficiency, and cost optimization.',
    [
      ['wa-rel-az', 'Reliability', 'Production workloads shall span at least two availability zones unless an exception is recorded.', 'Well-Architected Reliability'],
      ['wa-rel-limit', 'Reliability', 'Retry, timeout, and circuit-breaking shall be defined for every synchronous dependency.', 'Well-Architected Reliability'],
      ['wa-perf', 'Performance', 'SKU and autoscaling shall be based on measured load; no single-instance bottleneck in the critical path.', 'Well-Architected Performance'],
      ['wa-cost', 'Cost', 'Idle non-production resources shall shut down on a schedule; SKUs shall be reviewed against utilization monthly.', 'Well-Architected Cost'],
      ['wa-ops', 'Operability', 'Releases shall be automated with health checks; configuration shall be in source control.', 'Well-Architected Operational excellence'],
      ['wa-sec', 'Security', 'Secrets shall live in a managed vault; public endpoints shall sit behind identity-aware ingress.', 'Well-Architected Security'],
    ],
  ),
  pack(
    'sla-slo',
    'SLA / SLO / DR',
    'ITIL / SRE',
    'Operations',
    'Availability, latency, capacity, RPO, and RTO targets for the service.',
    [
      ['slo-avail', 'Reliability', 'Monthly availability SLO shall be published (for example 99.9%) with error-budget policy.', 'SRE SLO'],
      ['slo-lat', 'Performance', 'User-facing p95 latency SLO shall be published for the primary transaction.', 'SRE SLO'],
      ['slo-rto', 'Reliability', 'RTO for a regional outage shall be documented and tested; failover shall not require unique tribal knowledge.', 'IT disaster recovery'],
      ['slo-rpo', 'Reliability', 'RPO shall be documented; backup frequency shall meet that RPO including transactional stores.', 'IT disaster recovery'],
      ['slo-cap', 'Performance', 'Capacity headroom of at least 30% above last peak shall be maintained or autoscaled.', 'Capacity management'],
      ['slo-support', 'Operability', 'Sev-1 acknowledgement and customer comms SLAs shall be defined with an on-call rota.', 'ITIL incident'],
    ],
  ),
  pack(
    'observability',
    'Observability & SRE',
    'OpenTelemetry / SRE',
    'Operations',
    'Metrics, logs, traces, and alerting so the component is operable in production.',
    [
      ['obs-trace', 'Observability', 'Inbound requests shall emit a distributed trace with parent/child spans across integrations.', 'OpenTelemetry traces'],
      ['obs-metric', 'Observability', 'RED or USE metrics (rate, errors, duration) shall be exported for every public interface.', 'SRE golden signals'],
      ['obs-log', 'Observability', 'Logs shall be structured JSON with correlation ids; PII/secrets shall be redacted.', 'Observability logging'],
      ['obs-alert', 'Operability', 'Alerts shall fire on SLO burn or error-rate, not on raw host CPU, and include a runbook link.', 'SRE alerting'],
      ['obs-dep', 'Observability', 'Dependency health (downstream APIs, queues, databases) shall be visible on the service dashboard.', 'SRE telemetry'],
    ],
  ),
]

export const NFR_INDUSTRIES = [...new Set(NFR_TEMPLATES.map((item) => item.industry))]

export function getNfrTemplate(id: string): NfrTemplate | undefined {
  return NFR_TEMPLATES.find((item) => item.id === id)
}
