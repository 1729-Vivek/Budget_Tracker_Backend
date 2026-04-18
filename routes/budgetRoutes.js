const express = require('express');
const { getBudgets, addBudget, updateBudget, deleteBudget } = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getBudgets);
router.post('/', addBudget);
router.put('/:id', updateBudget);
router.delete('/:id', deleteBudget);

module.exports = router;
