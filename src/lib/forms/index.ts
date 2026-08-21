/**
 * Form engine — public surface.
 *
 * One registry, one rule evaluator, one derived schema. Imported by the
 * browser forms, the server actions, and the CSV importer.
 */

export type {
    FieldContext,
    FieldGroup,
    FieldOption,
    FieldProblem,
    FieldSpec,
    FieldType,
    FormMode,
    FormValues,
} from "./types";
export { FORM_MODES } from "./types";

export {
    ALL_CATEGORIES,
    CONDITION_GRADE_OPTIONS,
    FINISH_TYPE_OPTIONS,
    HORSE_FIELDS,
    LIFE_STAGE_OPTIONS,
    TRADE_STATUS_OPTIONS,
    VISIBILITY_OPTIONS,
    conditionGradeValues,
    finishTypeValues,
    getAttributeFields,
    getAttributeKeys,
    getColumnFields,
    getFieldSpec,
    importAliasMap,
    matchImportHeader,
    optionValues,
    resolveLabel,
} from "./registry";

export {
    canSubmit,
    ctx,
    getActiveGroups,
    getDomId,
    getGroupFields,
    getMissingRequiredFields,
    getRequiredFields,
    getVisibleFields,
    hasValue,
    isFieldDisabled,
    isFieldInMode,
    isFieldRequired,
    isFieldVisible,
} from "./rules";

export {
    buildFieldSchema,
    buildFormSchema,
    firstProblemMessage,
    fromActionInput,
    normalizeValue,
    normalizeValues,
    splitProblems,
    toActionInput,
    validateCreateInput,
    validateForm,
    validateUpdateInput,
} from "./schema";
export type { UpdateCategory, ValidationResult } from "./schema";

export { cleanAttributeBag, packAttributes, unpackAttributes } from "./attributes";

export { formEngineEnabled } from "./flag";
