import React from 'react';

const BudgetList = ({ budgets, onDeleteBudget }) => {
  return (
    <ul>
      {budgets.map((budget) => (
        <li key={budget._id}>
          {budget.description} - ₹{budget.amount} 
          <button onClick={() => onDeleteBudget(budget._id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
};

export default BudgetList;
