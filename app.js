'use strict';

/* ==========================================================================
   Calculator Application
   ========================================================================== */

/** Maximum number of digits the user can enter */
const MAX_INPUT_LENGTH = 15;

/** Precision used to avoid floating-point artifacts */
const CALCULATION_PRECISION = 12;

/** Display length thresholds for font-size scaling */
const SHRINK_THRESHOLDS = Object.freeze({ LEVEL_1: 8, LEVEL_2: 11, LEVEL_3: 14 });

/** CSS class names */
const CSS = Object.freeze({
  SHRINK_1:  'display__value--shrink-1',
  SHRINK_2:  'display__value--shrink-2',
  SHRINK_3:  'display__value--shrink-3',
  ACTIVE:    'is-active',
  RIPPLE:    'ripple',
  OPERATOR:  'btn--operator',
});

/** Operator symbols displayed in the UI */
const OPERATORS = Object.freeze({
  ADD:      '+',
  SUBTRACT: '−',
  MULTIPLY: '×',
  DIVIDE:   '÷',
});

/** Maps keyboard keys to calculator operator symbols */
const KEY_TO_OPERATOR = Object.freeze({
  '+': OPERATORS.ADD,
  '-': OPERATORS.SUBTRACT,
  '*': OPERATORS.MULTIPLY,
  '/': OPERATORS.DIVIDE,
});

const ERROR_VALUE = 'Error';
const COMMA_REGEX = /,/g;
const THOUSANDS_REGEX = /\B(?=(\d{3})+(?!\d))/g;

/* --------------------------------------------------------------------------
   Calculator Class
   -------------------------------------------------------------------------- */

class Calculator {
  /** @type {HTMLElement} */
  #displayEl;

  /** @type {HTMLElement} */
  #expressionEl;

  /** @type {string} */
  #currentInput = '0';

  /** @type {string} */
  #previousInput = '';

  /** @type {string|null} */
  #operator = null;

  /** @type {boolean} */
  #shouldReset = false;

  /**
   * @param {HTMLElement} displayEl    - Element showing the current value.
   * @param {HTMLElement} expressionEl - Element showing the pending expression.
   */
  constructor(displayEl, expressionEl) {
    this.#displayEl = displayEl;
    this.#expressionEl = expressionEl;
    this.#render();
  }

  /* --- Public API ------------------------------------------------------- */

  /** Append a digit (0-9) to the current input. */
  inputDigit(digit) {
    this.#clearOperatorHighlight();

    if (this.#currentInput === ERROR_VALUE) {
      this.#currentInput = '0';
    }

    if (this.#shouldReset) {
      this.#currentInput = digit;
      this.#shouldReset = false;
    } else {
      if (this.#rawInput.length >= MAX_INPUT_LENGTH) return;
      this.#currentInput = this.#currentInput === '0' ? digit : this.#currentInput + digit;
    }

    this.#render();
  }

  /** Append a decimal point if one is not already present. */
  inputDecimal() {
    this.#clearOperatorHighlight();

    if (this.#shouldReset) {
      this.#currentInput = '0.';
      this.#shouldReset = false;
      this.#render();
      return;
    }

    if (!this.#currentInput.includes('.')) {
      this.#currentInput += '.';
      this.#render();
    }
  }

  /**
   * Set the pending operator and chain calculations if needed.
   * @param {string} nextOperator - One of the OPERATORS values.
   */
  setOperator(nextOperator) {
    const current = this.#parseInput();

    if (this.#operator && !this.#shouldReset) {
      const result = this.#calculate(parseFloat(this.#previousInput), current, this.#operator);
      this.#currentInput = String(result);
      this.#previousInput = String(result);
      this.#render();
    } else {
      this.#previousInput = String(current);
    }

    this.#operator = nextOperator;
    this.#shouldReset = true;
    this.#highlightOperator(nextOperator);
    this.#renderExpression();
  }

  /** Evaluate the pending expression and display the result. */
  evaluate() {
    this.#clearOperatorHighlight();
    if (!this.#operator) return;

    const current = this.#parseInput();
    const prev = parseFloat(this.#previousInput);
    const result = this.#calculate(prev, current, this.#operator);

    this.#expressionEl.textContent =
      `${formatNumber(this.#previousInput)} ${this.#operator} ${formatNumber(String(current))} =`;

    this.#currentInput = String(result);
    this.#previousInput = '';
    this.#operator = null;
    this.#shouldReset = true;
    this.#render();
  }

  /** Reset the calculator to its initial state. */
  clear() {
    this.#currentInput = '0';
    this.#previousInput = '';
    this.#operator = null;
    this.#shouldReset = false;
    this.#clearOperatorHighlight();
    this.#render();
    this.#renderExpression();
  }

  /** Toggle the sign of the current value. */
  toggleSign() {
    if (this.#currentInput === '0' || this.#currentInput === ERROR_VALUE) return;

    this.#currentInput = this.#currentInput.startsWith('-')
      ? this.#currentInput.slice(1)
      : '-' + this.#currentInput;

    this.#render();
  }

  /** Convert the current value to a percentage. */
  percent() {
    const value = this.#parseInput() / 100;
    this.#currentInput = String(parseFloat(value.toPrecision(CALCULATION_PRECISION)));
    this.#render();
  }

  /** Remove the last character from the current input. */
  backspace() {
    if (this.#shouldReset || this.#currentInput === ERROR_VALUE) return;

    const isLastDigit =
      this.#currentInput.length === 1 ||
      (this.#currentInput.length === 2 && this.#currentInput.startsWith('-'));

    this.#currentInput = isLastDigit ? '0' : this.#currentInput.slice(0, -1);
    this.#render();
  }

  /* --- Private helpers -------------------------------------------------- */

  /** @returns {string} Current input without commas. */
  get #rawInput() {
    return this.#currentInput.replace(COMMA_REGEX, '');
  }

  /** @returns {number} Current input parsed as a float. */
  #parseInput() {
    return parseFloat(this.#rawInput);
  }

  /**
   * Perform an arithmetic operation.
   * @param {number} a  - Left operand.
   * @param {number} b  - Right operand.
   * @param {string} op - Operator symbol.
   * @returns {number|string} Computed result or 'Error'.
   */
  #calculate(a, b, op) {
    const operations = {
      [OPERATORS.ADD]:      () => a + b,
      [OPERATORS.SUBTRACT]: () => a - b,
      [OPERATORS.MULTIPLY]: () => a * b,
      [OPERATORS.DIVIDE]:   () => (b === 0 ? ERROR_VALUE : a / b),
    };

    const result = (operations[op] || (() => b))();
    if (result === ERROR_VALUE) return result;
    return parseFloat(result.toPrecision(CALCULATION_PRECISION));
  }

  /** Update the main display with the formatted current value. */
  #render() {
    const formatted = formatNumber(this.#currentInput);
    this.#displayEl.textContent = formatted;
    this.#applyFontScaling(formatted.length);
  }

  /** Update the expression line above the main display. */
  #renderExpression() {
    this.#expressionEl.textContent =
      this.#operator && this.#previousInput
        ? `${formatNumber(this.#previousInput)} ${this.#operator}`
        : '';
  }

  /**
   * Add shrink classes based on display text length.
   * @param {number} length - Character count of the formatted value.
   */
  #applyFontScaling(length) {
    this.#displayEl.classList.remove(CSS.SHRINK_1, CSS.SHRINK_2, CSS.SHRINK_3);

    if (length > SHRINK_THRESHOLDS.LEVEL_3) {
      this.#displayEl.classList.add(CSS.SHRINK_3);
    } else if (length > SHRINK_THRESHOLDS.LEVEL_2) {
      this.#displayEl.classList.add(CSS.SHRINK_2);
    } else if (length > SHRINK_THRESHOLDS.LEVEL_1) {
      this.#displayEl.classList.add(CSS.SHRINK_1);
    }
  }

  /** Remove the active highlight from all operator buttons. */
  #clearOperatorHighlight() {
    document.querySelectorAll(`.${CSS.OPERATOR}`).forEach(btn => {
      btn.classList.remove(CSS.ACTIVE);
    });
  }

  /**
   * Highlight the currently active operator button.
   * @param {string} op - Operator symbol to highlight.
   */
  #highlightOperator(op) {
    this.#clearOperatorHighlight();
    document.querySelectorAll(`.${CSS.OPERATOR}[data-value]`).forEach(btn => {
      if (btn.dataset.value === op) btn.classList.add(CSS.ACTIVE);
    });
  }
}

/* --------------------------------------------------------------------------
   Utility Functions
   -------------------------------------------------------------------------- */

/**
 * Format a numeric string with thousands separators.
 * @param {string} value - The raw numeric string to format.
 * @returns {string} The formatted string.
 */
function formatNumber(value) {
  if (value === ERROR_VALUE) return ERROR_VALUE;

  const str = String(value);
  const sign = str.startsWith('-') ? '-' : '';
  const abs = str.replace('-', '');

  if (str.includes('.')) {
    const [intPart, decPart] = abs.split('.');
    return sign + intPart.replace(THOUSANDS_REGEX, ',') + '.' + decPart;
  }

  return sign + abs.replace(THOUSANDS_REGEX, ',');
}

/**
 * Spawn a ripple animation on a button from a pointer event.
 * @param {HTMLElement} button - The button element.
 * @param {PointerEvent|MouseEvent} event - The triggering event.
 */
function createRipple(button, event) {
  const ripple = document.createElement('span');
  ripple.classList.add(CSS.RIPPLE);

  const rect = button.getBoundingClientRect();
  const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ripple-size')) / 2 || 25;
  const x = (event.clientX || rect.left + rect.width / 2) - rect.left - offset;
  const y = (event.clientY || rect.top + rect.height / 2) - rect.top - offset;

  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  button.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

/* --------------------------------------------------------------------------
   Initialization
   -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  const displayEl = document.getElementById('display');
  const expressionEl = document.getElementById('expression');
  const calc = new Calculator(displayEl, expressionEl);

  /* -- Button click delegation ------------------------------------------ */
  document.querySelector('.btn-grid').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    createRipple(button, e);

    const action = button.dataset.action;
    const value = button.dataset.value;

    if (!action && value) {
      value === '.' ? calc.inputDecimal() : calc.inputDigit(value);
      return;
    }

    const actions = {
      'clear':       () => calc.clear(),
      'toggle-sign': () => calc.toggleSign(),
      'percent':     () => calc.percent(),
      'operator':    () => calc.setOperator(value),
      'equals':      () => calc.evaluate(),
    };

    if (actions[action]) actions[action]();
  });

  /* -- Keyboard support ------------------------------------------------- */
  document.addEventListener('keydown', (e) => {
    const { key } = e;

    if (key >= '0' && key <= '9') { calc.inputDigit(key); return; }
    if (key === '.')              { calc.inputDecimal(); return; }
    if (key === '%')             { calc.percent(); return; }
    if (key === 'Enter' || key === '=') { calc.evaluate(); return; }
    if (key === 'Backspace')     { calc.backspace(); return; }
    if (key === 'Escape')        { calc.clear(); return; }

    if (KEY_TO_OPERATOR[key]) {
      if (key === '/') e.preventDefault();
      calc.setOperator(KEY_TO_OPERATOR[key]);
    }
  });
});
