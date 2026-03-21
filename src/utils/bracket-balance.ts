/** Result of a bracket balance check. */
export interface BracketBalance {
  /** `{` count minus `}` count. */
  curly: number;

  /** `[` count minus `]` count. */
  square: number;

  /** `(` count minus `)` count. */
  round: number;

  /** `<` count minus `>` count. */
  angle: number;

  /** Maximum nesting depth reached across all bracket types. */
  maxDepth: number;
}

/**
 * Check bracket balance for all four bracket types.
 *
 * Counts opening and closing brackets, computes balance (opens minus closes)
 * for each type, and tracks the maximum nesting depth reached.
 */
export function checkBracketBalance(text: string): BracketBalance {
  let curlyOpen = 0;
  let curlyClose = 0;
  let squareOpen = 0;
  let squareClose = 0;
  let roundOpen = 0;
  let roundClose = 0;
  let angleOpen = 0;
  let angleClose = 0;

  let currentDepth = 0;
  let maxDepth = 0;

  for (const ch of text) {
    switch (ch) {
      case '{':
        curlyOpen++;
        currentDepth++;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
        break;
      case '}':
        curlyClose++;
        currentDepth = Math.max(0, currentDepth - 1);
        break;
      case '[':
        squareOpen++;
        currentDepth++;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
        break;
      case ']':
        squareClose++;
        currentDepth = Math.max(0, currentDepth - 1);
        break;
      case '(':
        roundOpen++;
        currentDepth++;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
        break;
      case ')':
        roundClose++;
        currentDepth = Math.max(0, currentDepth - 1);
        break;
      case '<':
        angleOpen++;
        currentDepth++;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
        break;
      case '>':
        angleClose++;
        currentDepth = Math.max(0, currentDepth - 1);
        break;
    }
  }

  return {
    curly: curlyOpen - curlyClose,
    square: squareOpen - squareClose,
    round: roundOpen - roundClose,
    angle: angleOpen - angleClose,
    maxDepth,
  };
}
