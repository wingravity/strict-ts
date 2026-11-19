import { AST_NODE_TYPES } from "@typescript-eslint/types";
const ZOD_SOURCE = /^zod(?:\/.*)?$/u;
const UNBOUNDED_FACTORIES = new Set([
    "string",
    "array",
    "email",
    "url",
    "httpUrl",
    "base64",
    "base64url",
    "hex",
    "jwt",
    "hostname",
    "emoji",
]);
const BOUNDING_METHODS = new Set(["max", "length"]);
const BOUNDING_CHECKS = new Set(["maxLength", "length", "maxSize", "size"]);
function propertyName(node) {
    return !node.computed && node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : undefined;
}
function chainRoot(node) {
    if (node.type === AST_NODE_TYPES.Identifier) {
        return node;
    }
    if (node.type === AST_NODE_TYPES.CallExpression && node.callee.type === AST_NODE_TYPES.MemberExpression) {
        return chainRoot(node.callee.object);
    }
    if (node.type === AST_NODE_TYPES.MemberExpression) {
        return chainRoot(node.object);
    }
    return undefined;
}
export const boundedSchemas = {
    meta: {
        type: "problem",
        docs: { description: "Require Zod string and array schemas to declare a maximum size" },
        messages: {
            unbounded: "Unbounded {{name}} schema. Add .max(n) or .length(n) so oversized input is rejected.",
        },
        schema: [],
        defaultOptions: [],
    },
    create(context) {
        const namespaces = new Set();
        const factories = new Map();
        const isZodCheck = (argument) => {
            if (argument.type !== AST_NODE_TYPES.CallExpression) {
                return false;
            }
            const { callee } = argument;
            if (callee.type === AST_NODE_TYPES.Identifier) {
                return BOUNDING_CHECKS.has(factories.get(callee.name) ?? callee.name);
            }
            return (callee.type === AST_NODE_TYPES.MemberExpression &&
                callee.object.type === AST_NODE_TYPES.Identifier &&
                namespaces.has(callee.object.name) &&
                BOUNDING_CHECKS.has(propertyName(callee) ?? ""));
        };
        const isBounded = (start) => {
            let current = start;
            for (let depth = 0; depth < 100; depth++) {
                const member = current.parent;
                const call = member.parent;
                if (member.type !== AST_NODE_TYPES.MemberExpression || member.object !== current || call?.type !== AST_NODE_TYPES.CallExpression) {
                    return false;
                }
                const method = propertyName(member);
                if (method === undefined || method === "array") {
                    return false;
                }
                if (BOUNDING_METHODS.has(method)) {
                    return true;
                }
                if (method === "check" && call.arguments.some(isZodCheck)) {
                    return true;
                }
                current = call;
            }
            return false;
        };
        const factoryName = (node) => {
            const { callee } = node;
            if (callee.type === AST_NODE_TYPES.Identifier) {
                const imported = factories.get(callee.name);
                return imported !== undefined && UNBOUNDED_FACTORIES.has(imported) ? `z.${imported}()` : undefined;
            }
            if (callee.type !== AST_NODE_TYPES.MemberExpression) {
                return undefined;
            }
            const method = propertyName(callee);
            if (method === undefined) {
                return undefined;
            }
            if (callee.object.type === AST_NODE_TYPES.Identifier && namespaces.has(callee.object.name)) {
                return UNBOUNDED_FACTORIES.has(method) ? `z.${method}()` : undefined;
            }
            const root = chainRoot(callee.object);
            const fromZod = root !== undefined && (namespaces.has(root.name) || factories.has(root.name));
            return fromZod && method === "array" ? ".array()" : undefined;
        };
        return {
            ImportDeclaration(node) {
                if (!ZOD_SOURCE.test(node.source.value) || node.importKind === "type") {
                    return;
                }
                for (const specifier of node.specifiers) {
                    if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier || specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
                        namespaces.add(specifier.local.name);
                    }
                    else if (specifier.importKind !== "type") {
                        const imported = specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value;
                        if (imported === "z") {
                            namespaces.add(specifier.local.name);
                        }
                        else {
                            factories.set(specifier.local.name, imported);
                        }
                    }
                }
            },
            CallExpression(node) {
                const name = factoryName(node);
                if (name !== undefined && !isBounded(node)) {
                    context.report({ node, messageId: "unbounded", data: { name } });
                }
            },
        };
    },
};
//# sourceMappingURL=bounded-schemas.js.map