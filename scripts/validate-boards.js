const fs = require('fs');
const path = require('path');

const BOARDS_DIR = path.join(__dirname, '../apps/shared/static/boards');
const SCHEMA_PATH = path.join(BOARDS_DIR, 'board-schema.json');
const INDEX_PATH = path.join(BOARDS_DIR, 'boards-index.json');

function validate() {
  console.log('🚀 Starting Board Registry Validation...');

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error('❌ Schema not found at:', SCHEMA_PATH);
    process.exit(1);
  }

  if (!fs.existsSync(INDEX_PATH)) {
    console.error('❌ Index not found at:', INDEX_PATH);
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  console.log(`\n📋 Validating ${index.boards.length} boards from index...`);

  let errors = 0;

  index.boards.forEach(entry => {
    const boardPath = path.join(BOARDS_DIR, entry.path.replace('/boards/', ''));
    
    if (!fs.existsSync(boardPath)) {
      console.error(`❌ Board file missing: ${entry.id} -> ${boardPath}`);
      errors++;
      return;
    }

    const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));

    // Check required NeuroForge fields (Manual Validation for v3.0)
    if (!board.neuroforge) {
      console.error(`❌ Board ${entry.id} missing "neuroforge" integration block.`);
      errors++;
    } else {
      if (!board.neuroforge.boardProfileId) {
        console.error(`❌ Board ${entry.id} missing "neuroforge.boardProfileId".`);
        errors++;
      }
      if (!board.neuroforge.boardFamilySkillId) {
        console.error(`❌ Board ${entry.id} missing "neuroforge.boardFamilySkillId".`);
        errors++;
      }
    }

    // Check ID consistency
    if (board.id !== entry.id) {
      console.warn(`⚠️ ID Mismatch: Index has "${entry.id}", File has "${board.id}". Should be identical.`);
    }

    // Check boardProfileId consistency with index (for quick lookups)
    if (board.neuroforge?.boardProfileId !== entry.boardProfileId) {
       console.warn(`⚠️ ProfileID Mismatch: Index has "${entry.boardProfileId}", File has "${board.neuroforge?.boardProfileId}".`);
    }

    console.log(`✅ ${entry.id}: OK`);
  });

  if (errors > 0) {
    console.error(`\n❌ Validation failed with ${errors} errors.`);
    process.exit(1);
  } else {
    console.log('\n✨ All boards are valid and synchronized!');
  }
}

validate();
