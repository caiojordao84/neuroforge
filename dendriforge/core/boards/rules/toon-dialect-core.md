# TOON Dialect Core Rules
**Spec reference:** toon-format/spec v3.0 (2025-11-24)
**File:** `toon-dialect-core.rules`
**Scope:** Universal — applies to ALL `.toon` documents regardless of domain (MCU, PLC, sensor, gateway, etc.)
**Precedence:** TOON spec v3.0 (normative) > dialect extensions (informative where spec is silent)

---

## §1 — Whitespace & Indentation

- Indentation: exactly **2 spaces** per hierarchy level.
- Tabs **MUST NOT** be used for indentation anywhere in the document.
  - Exception: tabs are allowed inside quoted strings and as a declared `HTAB` delimiter in array headers.
- Trailing whitespace on any line is **forbidden**.
- Blank lines are **allowed** between top-level blocks.
  - Inside a list or tabular array block, blank lines **MUST** produce an error.
- Line endings: LF (`U+000A`) or CRLF (`U+000D` `U+000A`) are both allowed.
- Encoders **MUST** emit no trailing newline at the end of the document.

---

## §2 — Comments

- TOON v3.0 does **not** support comments natively; `#` is not a reserved character in the base spec.
- In this dialect, lines where the first non-whitespace character is `#` are treated as **documentation annotations** and **MUST** be ignored by the parser.
- Inline comments (`#` appearing after a value on the same line) are **forbidden**.
- A `#` symbol directly attached to a string value (e.g., `color: #FFFFFF`) is treated as part of the string value, **not** a comment.
- Section headings are **NOT** comments; they use the `##` prefix (see §3).
- `# METADATA:` is the sole structural exception where a single `#` introduces a block header (see §13).

---

## §3 — Section Headings

- Section headings use the `##` (double hash) prefix.
- Format: `## <index>. <SECTION NAME IN UPPERCASE>:`

  ```
  ## 1. DEVICE IDENTIFICATION:
  ```

- Section index **MUST** be a positive integer, incremental, with no gaps or repetitions.
- Section name **MUST** be uppercase; words separated by spaces are allowed.
- The trailing colon (`:`) is **mandatory**.
- An inline format annotation **MAY** follow the colon as a `#` comment on the same heading line.

  ```
  ## 4. GPIO MAP: # Format: pin | type | pwm | int | label | roles
  ```

---

## §4 — Keys & Key Folding

- Unquoted keys **MUST** match: `^[A-Za-z_][A-Za-z0-9_.]*$`
  - Valid: `id`, `flash_total`, `boardFamilySkillId`, `ASLversion`
  - Invalid (must be quoted): `order-id`, `user name`, `123key`
- Keys containing hyphens, spaces, or starting with a digit **MUST** be enclosed in double quotes.
- Key-value pairs use **exactly one colon followed by exactly one space**: `key: value`
- Duplicate keys at the same indentation level are **forbidden**.
- Key folding (dotted-path notation) is supported when `keyFolding="safe"`:
  - Segments must match `^[A-Za-z_][A-Za-z0-9_]*$` (no dots, no hyphens within a segment).
  - Example: `metadata.version: 1` → decoded as `{ metadata: { version: 1 } }` when `expandPaths="safe"`.

---

## §5 — Scalar Value Types

- **String (unquoted):** plain text not matching any reserved literal or quoting trigger.
  - Example: `arduino-uno`, `maker`, `ATmega328P`
- **String (quoted):** double-quoted when the value contains: the active delimiter, a colon (`:`), a double quote, a backslash, leading/trailing whitespace, brackets/braces (`[]{}`) or when it would be mistaken for a boolean, null, or number.
  - Example: `"Arduino Uno R3"`, `"D0 / RX"`, `"adc:t"`, `"spi-sck;status-led"`
- **Integer:** decimal digits only, no separators, no leading zeros (except lone `0`).
  - Example: `32768`, `20`, `1`
- **Float:** decimal notation; no scientific notation; no trailing zeros.
  - Example: `68.6`, `3.14`
- **Hexadecimal:** prefix `0x` followed by hex digits; **MUST** be quoted when used as object field values to avoid ambiguity (spec §7.2 — starts with `0` followed by non-digit).
  - Example: `"0x2341"`, `"0x0043"`
- **Boolean (TOON spec, normative):** full literals `true` or `false`.
- **Null:** literal `null` (lowercase).
- **URLs:** plain URLs (`http://` or `https://`) or Markdown links `[text](url)`; both forms are valid. The URL string **MUST** be quoted if it contains the active delimiter or a colon outside the scheme.

> **Note:** Domain-specific scalar extensions (unit suffixes, boolean shorthands, address strings) are defined per-dialect in §5 of each domain rules file.

---

## §6 — Nested Object Blocks

- A key ending in `:` with no value on the same line introduces a **nested block**.
- All children **MUST** be indented exactly 2 spaces more than the parent key.
- All sibling keys within a block **MUST** share the same indentation level.
- Empty objects are represented as `key:` with no children.

---

## §7 — Inline Record Delimiter

- The delimiter for **inline multi-field key-value records** (multiple `key: value` pairs on one line) is: **Space Pipe Space** (` | `).

  ```
  type: USB-B | chip: ATmega16U2 | vid: "0x2341" | pid: "0x0043"
  ```

- Each token **MUST** follow the form: `key: value`.
- No trailing delimiter is allowed at the end of a line.
- Applies to: `specs`, `dims`, `usb`, `compatibility`, `restrictions`, and any other key-value inline record outside a tabular array block.

> **Note:** Space Pipe Space (` | `) is the inline record delimiter. Inside tabular array rows, the active delimiter governs (no surrounding spaces — see §9).

---

## §8 — Collections with Size Annotation

- Syntax: `name[n]:` or `name[n]{field1|field2|...}:` (pipe dialect) or `name[n]{f1,f2}:` (comma).
- The key name **MUST** satisfy the unquoted key pattern: `^[A-Za-z_][A-Za-z0-9_.]*$`
- `n` must be a non-negative integer.
- The declared count `n` **MUST** match exactly the number of items in the subsequent block. Mismatch is a **fatal validation error** in strict mode.
- Optional length marker prefix: `name[#n]:` is equivalent to `name[n]:` (informative display only).

---

## §9 — Tabular Arrays (Uniform Object Arrays)

- Used when all elements share **identical fields** with primitive values.
- This dialect uses **Pipe** as the active delimiter for all tabular arrays to prevent comma-array AST collisions.
- Header syntax: `name[n|]{field1|field2|...}:`
- Rows **MUST** use the exact same delimiter declared in the header (pipe, **no surrounding spaces**).

  ```
  gpio[20|]{pin|type|pwm|int|label|roles}:
    0|digital|false|false|"D0 / RX"|uart-rx
  ```

- Rows **MUST** be indented exactly 2 spaces relative to the header.
- Number of values per row **MUST** equal the number of declared fields.
- Row values follow the scalar type rules in §5.
- A value containing the pipe delimiter **MUST** be quoted.
- Comma (`,`) **MUST NOT** be used as a tabular row delimiter in this dialect.

---

## §10 — List Arrays (Non-Uniform or Mixed Arrays)

- Each item is prefixed with: **hyphen space** (`- `).
- Items **MUST** be indented exactly 2 spaces relative to the parent key.
- Single-field items: `- value`
- Multi-field items: `- value1|value2|value3` (pipe delimiter, no surrounding spaces).
- A string value that equals `"-"` or starts with `"- "` **MUST** be quoted: `"- item"`.
- The number of items **MUST** match the declared count `[n]` in strict mode.

---

## §11 — Sub-Value Separator

- When a single field contains multiple sub-values, they **MUST** be separated by **Semicolon** (`;`) with **NO surrounding spaces**.

  ```
  spi-sck;status-led
  adc:t;i2c-sda
  ```

- In tabular rows, the entire multi-value field **MUST** be quoted if it contains `;` or `:`, because both characters trigger quoting per spec §7.2.
  - Example: `"adc:t;i2c-sda"`
- Comma is **strictly forbidden** as a sub-value separator.
- Sub-values **MUST NOT** contain a bare `;` unless escaped as `\;`.
- This is a domain-level extension not present in the base TOON spec; it is handled at the dialect layer before TOON parsing.

---

## §12 — Quoting and Escaping

- Strings are unquoted by default; quoting is required only when triggers in §5 apply.
- Quotes **MUST** be double quotes (`"`); single quotes are **forbidden** everywhere.
- Escape sequences inside quoted strings (exhaustive — no other escapes allowed):

  | Sequence | Meaning |
  |---|---|
  | `\\` | Literal backslash |
  | `\"` | Literal double quote |
  | `\n` | Newline (U+000A) |
  | `\r` | Carriage return (U+000D) |
  | `\t` | Tab character (U+0009) |

- Any other escape sequence **MUST** error in strict mode or be treated as a literal string in lenient mode.
- A quoted string **MUST** be closed on the same line; multi-line quoted strings are **forbidden**.

> **Note:** `\;` is a domain extension for sub-value escaping (§11); it is **not** part of the TOON spec and **MUST** be handled at the dialect layer before TOON parsing.

---

## §13 — Metadata Block

- The METADATA block **MUST** appear at the top of the document, before any `##` section heading.
- Introduced by the line: `# METADATA:` (sole exception where `#` introduces a structural element rather than a comment).
- All METADATA entries are simple `key: value` pairs at indentation level 0.
- **Required keys:** `project_name`, `version`, `editor`, `author`, `ASLversion`
- `version` **MUST** be a positive integer.
- `ASLversion` **MUST** follow semantic versioning: `MAJOR.MINOR.PATCH` (e.g., `0.1.0`).

  ```
  # METADATA:
  project_name: my-board-profile
  version: 1
  editor: dendriForge
  author: schemasmith
  ASLversion: 0.1.0
  ```

---

## §15 — Document-Level Rules

- The document **MUST** be UTF-8 encoded with **no BOM**.
- The file extension **MUST** be `.toon`.
- The root of the document is always an **implicit object** (no top-level `[` or `{` at depth 0).
- An empty document (zero non-comment, non-blank lines) decodes to an empty object `{}`.
- **Strict mode (default):** array length mismatches, delimiter conflicts, unknown escapes, and missing colons are **fatal validation errors**.
- **Lenient mode (optional):** best-effort parsing; mismatches produce warnings, not errors.
- No trailing newline at end of file (encoder **MUST NOT** emit one; validator **MAY** warn if present).
