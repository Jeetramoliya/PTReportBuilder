const express = require('express');
const { getUpload } = require('../uploads');

const router = express.Router();

// Serves an uploaded image from the database. ids are unguessable (nanoid) and the whole
// route is behind authentication.
router.get('/:id', async (req, res, next) => {
  try {
    const up = await getUpload(req.params.id);
    if (!up) return res.status(404).end();
    res.setHeader('Content-Type', up.mime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(up.data);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
