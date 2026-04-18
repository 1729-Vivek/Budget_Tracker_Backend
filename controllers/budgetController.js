const Budget = require('../models/budgetModel');

// Get all budget entries
const getBudgets = async (req, res) => {
  try {
    const budgets = await Budget.find({ user: req.user._id }).sort({ date: -1 });
    res.status(200).json(budgets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a budget entry
const addBudget = async (req, res) => {
  const description = req.body.description ? req.body.description.trim() : '';
  const parsedAmount = Number(req.body.amount);
  const category = req.body.category || 'other';
  const date = req.body.date;

  if (!description || !Number.isFinite(parsedAmount)) {
    return res.status(400).json({ message: 'Description and a valid amount are required.' });
  }

  const newBudget = new Budget({
    user: req.user._id,
    description,
    amount: parsedAmount,
    category,
    date,
  });

  try {
    const savedBudget = await newBudget.save();
    res.status(201).json(savedBudget);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Delete a budget entry
const deleteBudget = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedBudget = await Budget.findOneAndDelete({ _id: id, user: req.user._id });

    if (!deletedBudget) {
      return res.status(404).json({ message: 'Budget entry not found.' });
    }

    res.status(200).json({ message: 'Budget entry deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getBudgets, addBudget, deleteBudget };
