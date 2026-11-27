# Data collection charter

> Provisional document — the principles below are the ones agreed in the
> socle v0 plan; they apply to every lot. They will be enforced by automated
> tests as each lot lands: the rights matrix in lot 5, encryption in lot 6,
> the GDPR lifecycle in lot 8.

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
manager, protected by an installation-specific master key. They are unreadable
in the clear in the database and visible only to their owner, under the
sharing conditions the organisation has chosen. Each manager will get their
own recovery key to get their notes back if they lose their key, and that
key will give no one else access to them. This is not the case yet: today,
recovery goes through an installation-level recovery key, and whoever holds
it can read every manager's private notes (see
[envelope encryption](crypto-envelope.en.md)). When a person changes
manager, their one-on-one notes are archived: neither handed to the new
manager nor left active.

## 4. Traceability of every number

Every displayed number traces back to its **source**: the integration
(Lucca, directory, module) and the collection instant that produced it. A
metric without a verifiable provenance must not exist in the interface.

## 5. One organisation per installation

A bosco instance serves **one single organisation**. This assumption shapes
the rights model, OIDC (restricted to the company domain) and the scope of
the GDPR export; no data leaves the organisation's scope.

## What bosco never collects

A management tool can turn into surveillance, and its metrics can be
gamed. This public list is our answer: bosco never collects:

- per-person activity metrics or rankings: no commits, pull requests or
  lines of code per individual, no "top performers", no individual
  leaderboards;
- the content of chat messages (Slack) or emails;
- keystrokes, screenshots, presence or time tracking;
- detection or volume counting of AI-generated code per person: the impact
  of AI is measured on team-level dimensions only;
- individual survey answers: answers are shown only aggregated, and below 5
  responses nothing is shown, to keep them anonymous;
- anything from a disabled module: a disabled module collects nothing;
- anything for the project itself: no data leaves the installation, there
  is no telemetry.

Any change to this list goes through a public pull request.
