const Parser = require('web-tree-sitter');

async function run() {
    await Parser.init();
    const parser = new Parser();
    const Lang = await Parser.Language.load('./public/tree-sitter-rust.wasm');
    parser.setLanguage(Lang);

    const code = `
    loop {
        gpio_set(13, 1);
        delay.delay_ms(1000u32);
    }
    `;

    const tree = parser.parse(code);
    console.log(tree.rootNode.toString());
}

run().catch(console.error);
