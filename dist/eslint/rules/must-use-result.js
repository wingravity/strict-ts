import { AST_NODE_TYPES } from "@typescript-eslint/types";
import ts from "typescript";
const RESULT_DECLARATION = /strict-ts[\\/](?:dist|src)[\\/]result\.(?:d\.)?ts$/u;
const RESULT_PARTS = new Set(["Ok", "Err"]);
function isResultPart(type) {
    const symbol = type.getSymbol();
    if (symbol === undefined || !RESULT_PARTS.has(symbol.getName())) {
        return false;
    }
    return (symbol.getDeclarations() ?? []).some((declaration) => RESULT_DECLARATION.test(declaration.getSourceFile().fileName));
}
function isResult(type) {
    const parts = (type.isUnion() ? type.types : [type]).filter((part) => (part.getFlags() & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)) === 0);
    return parts.length > 0 && parts.every(isResultPart);
}
function returnsVoid(checker, contextual) {
    const signatures = contextual.getCallSignatures();
    return (signatures.length > 0 &&
        signatures.every((signature) => (checker.getReturnTypeOfSignature(signature).getFlags() & ts.TypeFlags.Void) !== 0));
}
export const mustUseResult = {
    meta: {
        type: "problem",
        docs: { description: "Disallow ignoring a Result or a Promise of a Result" },
        messages: {
            ignored: "This Result is ignored, so its error is lost. Check `.ok`, return it, or pass it on.",
        },
        schema: [],
        defaultOptions: [],
    },
    create(context) {
        const services = context.sourceCode.parserServices;
        const program = services?.program;
        const nodeMap = services?.esTreeNodeToTSNodeMap;
        if (program === undefined || program === null || nodeMap === undefined) {
            return {};
        }
        const checker = program.getTypeChecker();
        const isResultOrPromiseOfResult = (node) => {
            const type = checker.getTypeAtLocation(nodeMap.get(node));
            if (isResult(type)) {
                return true;
            }
            const awaited = checker.getAwaitedType(type);
            return awaited !== undefined && awaited !== type && isResult(awaited);
        };
        const check = (node) => {
            if (isResultOrPromiseOfResult(node)) {
                context.report({ node, messageId: "ignored" });
            }
        };
        return {
            ExpressionStatement(node) {
                if (node.directive !== undefined) {
                    return;
                }
                const { expression } = node;
                if (expression.type === AST_NODE_TYPES.SequenceExpression) {
                    const last = expression.expressions.at(-1);
                    if (last !== undefined) {
                        check(last);
                    }
                    return;
                }
                if (expression.type === AST_NODE_TYPES.UnaryExpression && expression.operator === "void") {
                    return;
                }
                check(expression);
            },
            "UnaryExpression[operator='void']"(node) {
                check(node.argument);
            },
            SequenceExpression(node) {
                node.expressions.slice(0, -1).forEach(check);
            },
            "ArrowFunctionExpression[expression=true]"(node) {
                const contextual = checker.getContextualType(nodeMap.get(node));
                if (contextual !== undefined && returnsVoid(checker, contextual)) {
                    check(node.body);
                }
            },
        };
    },
};
//# sourceMappingURL=must-use-result.js.map