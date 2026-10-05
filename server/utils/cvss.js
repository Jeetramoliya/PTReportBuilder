// CVSS v3.1 Base Score calculator (https://www.first.org/cvss/v3-1/specification-document)

const WEIGHTS = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  PR: {
    N: { U: 0.85, C: 0.85 },
    L: { U: 0.62, C: 0.68 },
    H: { U: 0.27, C: 0.5 },
  },
  UI: { N: 0.85, R: 0.62 },
  CIA: { N: 0, L: 0.22, H: 0.56 },
};

function roundUp1(value) {
  const int = Math.round(value * 100000);
  if (int % 10000 === 0) return int / 100000;
  return (Math.floor(int / 10000) + 1) / 10;
}

function severityFromScore(score) {
  if (score <= 0) return 'None';
  if (score < 4.0) return 'Low';
  if (score < 7.0) return 'Medium';
  if (score < 9.0) return 'High';
  return 'Critical';
}

function parseVector(vector) {
  const parts = {};
  String(vector || '')
    .replace(/^CVSS:3\.[01]\//, '')
    .split('/')
    .forEach((p) => {
      const [k, v] = p.split(':');
      if (k && v) parts[k] = v;
    });
  return parts;
}

function calculate(vectorOrMetrics) {
  const m = typeof vectorOrMetrics === 'string' ? parseVector(vectorOrMetrics) : vectorOrMetrics || {};
  const AV = m.AV || 'N';
  const AC = m.AC || 'L';
  const PR = m.PR || 'N';
  const UI = m.UI || 'N';
  const S = m.S || 'U';
  const C = m.C || 'N';
  const I = m.I || 'N';
  const A = m.A || 'N';

  const iss = 1 - (1 - WEIGHTS.CIA[C]) * (1 - WEIGHTS.CIA[I]) * (1 - WEIGHTS.CIA[A]);
  let impact;
  if (S === 'U') {
    impact = 6.42 * iss;
  } else {
    impact = 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  }

  const exploitability = 8.22 * WEIGHTS.AV[AV] * WEIGHTS.AC[AC] * WEIGHTS.PR[PR][S] * WEIGHTS.UI[UI];

  let base;
  if (impact <= 0) {
    base = 0;
  } else if (S === 'U') {
    base = roundUp1(Math.min(impact + exploitability, 10));
  } else {
    base = roundUp1(Math.min(1.08 * (impact + exploitability), 10));
  }

  const vectorString = `CVSS:3.1/AV:${AV}/AC:${AC}/PR:${PR}/UI:${UI}/S:${S}/C:${C}/I:${I}/A:${A}`;

  return {
    score: base,
    severity: severityFromScore(base),
    vector: vectorString,
  };
}

module.exports = { calculate, parseVector, severityFromScore };
