# Data collection charter

> Provisional document — the principles below are the ones agreed in the
> socle v0 plan; they apply to every lot and are enforced by the test suite.

bosco is a self-hosted tool that gathers an engineering manager's daily
work. These data are sensitive: this charter sets the principles that every
module and every change to the core must respect.

## 1. Metrics aggregated per team

Activity metrics are computed and displayed **per team**, never per
individual. A dashboard never ranks people; no interaction may allow an
individual ranking to be reconstructed from the aggregated views.

## 2. Nothing that ranks an individual

No feature of bosco grades, evaluates or compares a person. Personal data
exists to steer the collective and to run good management moments (one-on-
ones, objectives), never for individual control or a score.

## 3. Encryption of private notes

Private notes taken during one-on-ones are **encrypted**, with one key per
manager, protected by a install-specific master key. They are unreadable
in the clear in the database and visible only to their owner, under the
sharing conditions the organisation has chosen.

## 4. Traceability of every number

Every displayed number traces back to its **source**: the integration
(Lucca, directory, module) and the collection instant that produced it. A
metric without a verifiable provenance must not exist in the interface.

## 5. One organisation per installation

A bosco instance serves **one single organisation**. This assumption shapes
the rights model, OIDC (restricted to the company domain) and the scope of
the GDPR export; no data leaves the organisation's scope.
