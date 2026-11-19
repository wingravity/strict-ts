import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";
import ts from "typescript";

type MessageId = "widened";

function isMutableArray(checker: ts.TypeChecker, type: ts.Type): boolean {
  return (checker.isArrayType(type) || checker.isTupleType(type)) && checker.getPropertyOfType(type, "push") !== undefined;
}

function elementType(checker: ts.TypeChecker, type: ts.Type): ts.Type | undefined {
  return checker.getIndexTypeOfType(type, ts.IndexKind.Number);
}

function sharedArrays(expression: TSESTree.Expression): TSESTree.Expression[] {
  if (expression.type === AST_NODE_TYPES.Identifier || expression.type === AST_NODE_TYPES.MemberExpression) {
    return [expression];
  }
  if (expression.type === AST_NODE_TYPES.ChainExpression) {
    return [expression.expression];
  }
  if (expression.type === AST_NODE_TYPES.ConditionalExpression) {
    return [...sharedArrays(expression.consequent), ...sharedArrays(expression.alternate)];
  }
  if (expression.type === AST_NODE_TYPES.LogicalExpression) {
    return [...sharedArrays(expression.left), ...sharedArrays(expression.right)];
  }
  return [];
}

export const noMutableArrayWidening: TSESLint.RuleModule<MessageId> = {
  meta: {
    type: "problem",
    docs: { description: "Disallow using an existing mutable array where a mutable array of a wider element type is expected" },
    messages: {
      widened:
        "This {{source}} is used as a mutable {{target}}, so code holding it can add any {{targetElement}} to the original array. Type the target as `readonly {{target}}`, or pass a copy.",
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

    const isWidenedArray = (sourceArray: ts.Type, target: ts.Type): boolean => {
      const sourceElement = elementType(checker, sourceArray);
      const targetElement = elementType(checker, target);
      return (
        sourceElement !== undefined &&
        targetElement !== undefined &&
        !checker.isTypeAssignableTo(targetElement, sourceElement)
      );
    };

    const check = (slot: TSESTree.Expression | null | undefined): void => {
      if (slot === null || slot === undefined) {
        return;
      }
      const tsSlot = nodeMap.get(slot);
      const contextual = ts.isExpression(tsSlot) ? checker.getContextualType(tsSlot) : undefined;
      if (contextual === undefined) {
        return;
      }
      const targets = contextual.isUnion() ? contextual.types : [contextual];
      const arrayTargets = targets.filter((target) => checker.isArrayType(target) || checker.isTupleType(target));
      for (const node of sharedArrays(slot)) {
        const source = checker.getNonNullableType(checker.getTypeAtLocation(nodeMap.get(node)));
        if (!isMutableArray(checker, source) || arrayTargets.length === 0) {
          continue;
        }
        const unsafe = arrayTargets.every(
          (target) => isMutableArray(checker, target) && isWidenedArray(source, target),
        );
        const target = arrayTargets[0];
        const targetElement = target === undefined ? undefined : elementType(checker, target);
        if (unsafe && target !== undefined && targetElement !== undefined) {
          context.report({
            node,
            messageId: "widened",
            data: {
              source: checker.typeToString(source),
              target: checker.typeToString(target),
              targetElement: checker.typeToString(targetElement),
            },
          });
        }
      }
    };

    return {
      VariableDeclarator(node) {
        check(node.init);
      },
      AssignmentExpression(node) {
        check(node.right);
      },
      "CallExpression, NewExpression"(node: TSESTree.CallExpression | TSESTree.NewExpression) {
        for (const argument of node.arguments) {
          if (argument.type !== AST_NODE_TYPES.SpreadElement) {
            check(argument);
          }
        }
      },
      ReturnStatement(node) {
        check(node.argument);
      },
      "ArrowFunctionExpression[expression=true]"(node: TSESTree.ArrowFunctionExpression) {
        if (node.body.type !== AST_NODE_TYPES.BlockStatement) {
          check(node.body);
        }
      },
      Property(node) {
        if (node.parent.type === AST_NODE_TYPES.ObjectExpression && node.value.type !== AST_NODE_TYPES.AssignmentPattern) {
          const { value } = node;
          if (
            value.type !== AST_NODE_TYPES.ArrayPattern &&
            value.type !== AST_NODE_TYPES.ObjectPattern &&
            value.type !== AST_NODE_TYPES.TSEmptyBodyFunctionExpression
          ) {
            check(value);
          }
        }
      },
      ArrayExpression(node) {
        for (const element of node.elements) {
          if (element !== null && element.type !== AST_NODE_TYPES.SpreadElement) {
            check(element);
          }
        }
      },
    };
  },
};
