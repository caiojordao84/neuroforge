const fs = require('fs');
let c = fs.readFileSync('./src/engine/asl/plugins/python/PythonParser.ts', 'utf8');

const badStr = `                    }],
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

const goodStr = `                    }],
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

c = c.replace(badStr, goodStr);
fs.writeFileSync('./src/engine/asl/plugins/python/PythonParser.ts', c);
console.log("Fixed syntax");
