import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import ts from "typescript";

const RESULT_DECLARATION = /strict-ts[\\/](?:dist|src)[\\/]result\.(?:d\.)?ts$/u;
const RESULT_PARTS = new Set(["Ok", "Err"]);

type MessageId = "ignored";

function isResultPart(type: ts.Type): boolean {
  const symbol = type.getSymbol();
  if (symbol === undefined || !RESULT_PARTS.has(symbol.getName())) {
    return false;
  }
  return (symbol.getDeclarations() ?? []).some((declaration) =>
    RESULT_DECLARATION.test(declaration.getSourceFile().fileName),
  );
}

function isResult(type: ts.Type): boolean {
  const parts = (type.isUnion() ? type.types : [type]).filter(
    (part) => (part.getFlags() & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)) === 0,
  );
  return parts.length > 0 && parts.every(isResultPart);
}

function returnsVoid(checker: ts.TypeChecker, contextual: ts.Type): boolean {
  const signatures = contextual.getCallSignatures();
  return (
    signatures.length > 0 &&
    signatures.every((signature) => (checker.getReturnTypeOfSignature(signature).getFlags() & ts.TypeFlags.Void) !== 0)
  );
}

export const mustUseResult: TSESLint.RuleModule<MessageId> = {
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

    const isResultOrPromiseOfResult = (node: TSESTree.Node): boolean => {
      const type = checker.getTypeAtLocation(nodeMap.get(node));
      if (isResult(type)) {
        return true;
      }
      const awaited = checker.getAwaitedType(type);
      return awaited !== undefined && awaited !== type && isResult(awaited);
    };

    const check = (node: TSESTree.Node): void => {
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
      "UnaryExpression[operator='void']"(node: TSESTree.UnaryExpression) {
        check(node.argument);
      },
      SequenceExpression(node) {
        node.expressions.slice(0, -1).forEach(check);
      },
      "ArrowFunctionExpression[expression=true]"(node: TSESTree.ArrowFunctionExpression) {
        const contextual = checker.getContextualType(nodeMap.get(node));
        if (contextual !== undefined && returnsVoid(checker, contextual)) {
          check(node.body);
        }
      },
    };
  },
};
