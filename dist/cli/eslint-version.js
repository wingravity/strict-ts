export const SUPPRESSIONS_API_VERSION = "10.1.0";
export function supportsSuppressionsApi(version) {
    const match = /(\d+)\.(\d+)/u.exec(version);
    if (match?.[1] === undefined || match[2] === undefined) {
        return false;
    }
    const major = Number(match[1]);
    const minor = Number(match[2]);
    return major > 10 || (major === 10 && minor >= 1);
}
//# sourceMappingURL=eslint-version.js.map