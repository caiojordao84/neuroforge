export type TokenType = 'KEYWORD' | 'IDENTIFIER' | 'NUMBER' | 'SYMBOL' | 'STRING' | 'EOF';

export interface Token { type: TokenType; value: string; line: number; }

export class Lexer {
  private src: string; private cursor: number = 0; private line: number = 1;
  constructor(src: string) { this.src = src; }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.cursor < this.src.length) {
      const char = this.src[this.cursor];

      // Whitespace
      if (/\s/.test(char)) {
        if (char === '\n') this.line++;
        this.cursor++;
        continue;
      }

      // Line comments
      if (char === '/' && this.src[this.cursor + 1] === '/') {
        while (this.src[this.cursor] !== '\n' && this.cursor < this.src.length) this.cursor++;
        continue;
      }

      // Block comments
      if (char === '/' && this.src[this.cursor + 1] === '*') {
        this.cursor += 2; // Skip /*
        while (this.cursor < this.src.length) {
          if (this.src[this.cursor] === '*' && this.src[this.cursor + 1] === '/') {
            this.cursor += 2; // Skip */
            break;
          }
          if (this.src[this.cursor] === '\n') this.line++;
          this.cursor++;
        }
        continue;
      }

      // Preprocessor directives (ignored)
      if (char === '#') {
        while (this.src[this.cursor] !== '\n' && this.cursor < this.src.length) this.cursor++;
        continue;
      }

      // Numbers
      if (/\d/.test(char)) {
        let num = '';
        while (/\d/.test(this.src[this.cursor])) num += this.src[this.cursor++];
        // Handle decimals
        if (this.src[this.cursor] === '.' && /\d/.test(this.src[this.cursor + 1])) {
          num += '.'; this.cursor++;
          while (/\d/.test(this.src[this.cursor])) num += this.src[this.cursor++];
        }
        tokens.push({ type: 'NUMBER', value: num, line: this.line });
        continue;
      }

      // Identifiers and Keywords
      if (/[a-zA-Z_]/.test(char)) {
        let word = '';
        while (/[a-zA-Z0-9_]/.test(this.src[this.cursor])) word += this.src[this.cursor++];
        const keywords = ['void', 'int', 'float', 'bool', 'boolean', 'unsigned', 'long', 'short', 'char', 'byte', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t', 'String', 'File', 'if', 'else', 'while', 'for', 'return', 'true', 'false', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'WL_CONNECTED', 'WL_IDLE_STATUS', 'FILE_WRITE', 'FILE_READ', 'FILE_APPEND', 'const', 'enum', 'static', 'volatile', 'PROGMEM', 'switch', 'case', 'default', 'auto', 'sizeof'];
        tokens.push({ type: keywords.includes(word) ? 'KEYWORD' : 'IDENTIFIER', value: word, line: this.line });
        continue;
      }

      // Strings
      if (char === '"') {
        this.cursor++;
        let str = '';
        while (this.src[this.cursor] !== '"' && this.cursor < this.src.length) {
          if (this.src[this.cursor] === '\\' && this.src[this.cursor + 1] === '"') {
            str += '"'; this.cursor += 2;
          } else {
            str += this.src[this.cursor++];
          }
        }
        this.cursor++;
        tokens.push({ type: 'STRING', value: str, line: this.line });
        continue;
      }

      // Multi-char Symbols
      const symbols = ['<=', '>=', '==', '!=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '<<=', '>>=', '<<', '>>', '&=', '|=', '^=', '->', '::'];
      let matchedSym = symbols.find(s => this.src.substr(this.cursor, s.length) === s);
      if (matchedSym) {
        tokens.push({ type: 'SYMBOL', value: matchedSym, line: this.line });
        this.cursor += matchedSym.length;
        continue;
      }

      // Single-char Symbols
      const singleSymbols = ['(', ')', '{', '}', '[', ']', ';', ',', '=', '<', '>', '+', '-', '*', '/', '!', '.', '&', '|', '^', '~', '%', '?', ':'];
      if (singleSymbols.includes(char)) {
        tokens.push({ type: 'SYMBOL', value: char, line: this.line });
        this.cursor++;
        continue;
      }

      // Unknown character
      this.cursor++;
    }
    tokens.push({ type: 'EOF', value: 'EOF', line: this.line });
    return tokens;
  }
}
