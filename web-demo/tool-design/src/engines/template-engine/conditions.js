/** Declarative conditional visibility — evaluated against the flat variable context. */
import { VARIABLE_KEYS } from './constants.js';

export const CONDITION_OPERATORS = {
  notEmpty: 'có giá trị',
  empty: 'để trống',
  equals: 'bằng',
  notEquals: 'khác',
  contains: 'chứa',
};

export function evaluateCondition(condition, ctx) {
  if (!condition) return true;
  const { variable, operator, value = '' } = condition;
  if (!VARIABLE_KEYS.has(variable)) return true; // unknown variable → do not hide content silently
  const actual = String(ctx?.[variable] ?? '');
  switch (operator) {
    case 'notEmpty':
      return actual.trim() !== '';
    case 'empty':
      return actual.trim() === '';
    case 'equals':
      return actual === value;
    case 'notEquals':
      return actual !== value;
    case 'contains':
      return actual.toLowerCase().includes(String(value).toLowerCase());
    default:
      return true;
  }
}
