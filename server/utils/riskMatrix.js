// Likelihood x Impact -> Risk Rating, matching the OWASP-style matrix used in the reference report.
const MATRIX = {
  High: { High: 'High', Medium: 'High', Low: 'Medium' },
  Medium: { High: 'High', Medium: 'Medium', Low: 'Low' },
  Low: { High: 'Medium', Medium: 'Low', Low: 'Low' },
};

function riskFromLikelihoodImpact(likelihood, impact) {
  return (MATRIX[likelihood] && MATRIX[likelihood][impact]) || 'Medium';
}

const SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Info'];

function severityRank(sev) {
  const idx = SEVERITY_ORDER.indexOf(sev);
  return idx === -1 ? SEVERITY_ORDER.length : idx;
}

module.exports = { riskFromLikelihoodImpact, SEVERITY_ORDER, severityRank, MATRIX };
