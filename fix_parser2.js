const fs = require('fs');

const path = './src/engine/asl/plugins/python/PythonParser.ts';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `                    }],
                    if(callee === 'time.sleep_us' || callee === 'sleep_us' || callee === 'utime.sleep_us') {
                    return {
                        nodeType: 'ExpressionStatement',
                        id: \`stmtus-\${node.id}\`,
                        attributes: {},
                        children: [{
                            nodeType: 'CallExpression',
                            id: \`delayus-\${node.id}\`,
                            attributes: { callee: 'delayMicroseconds' },
                            children: args
                        }],
                        metadata: meta
                    };
                }
            }`;

const correctStr = `                    }],
                    metadata: meta
                };
            }
            if (callee === 'time.sleep_us' || callee === 'sleep_us' || callee === 'utime.sleep_us') {
                return {
                    nodeType: 'ExpressionStatement',
                    id: \`stmtus-\${node.id}\`,
                    attributes: {},
                    children: [{
                        nodeType: 'CallExpression',
                        id: \`delayus-\${node.id}\`,
                        attributes: { callee: 'delayMicroseconds' },
                        children: args
                    }],
                    metadata: meta
                };
            }`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, correctStr);
    fs.writeFileSync(path, code);
    console.log("Successfully fixed PythonParser.ts syntax");
} else {
    console.log("Could not find the exact target string to replace in PythonParser.ts");
}
