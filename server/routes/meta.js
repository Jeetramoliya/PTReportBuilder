const express = require('express');
const { TEMPLATES } = require('../data/findingTemplates');
const { OWASP_TOP10_2021 } = require('../data/owaspCategories');

const router = express.Router();

router.get('/finding-templates', (req, res) => {
  res.json(TEMPLATES);
});

router.get('/owasp-categories', (req, res) => {
  res.json(OWASP_TOP10_2021);
});

module.exports = router;
