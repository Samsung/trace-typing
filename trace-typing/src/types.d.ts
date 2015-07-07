/* 
 * Copyright 2015 Samsung Research America, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
//
// Importing
//
interface TraceImport {
    date: string
    trace: Trace
}
interface ParsedTraceFile {
    date: string
    statementsFile: string
    format: string
    smap: Object
}
//
// Language
//
interface Trace {
    statements: TraceStatement[]
    iidMap: IIDMap
    sources: string[]
}
interface Variable {
    // umbrella type for now
    named: boolean
    forceMerge?: boolean
    iid?: string
    name?: string
    functionIID?: string
    // TODO `callCount` is a misleading name, together with functionIID it is a scopeID, rename and avoid back/forth translation
    callCount?: string
}

interface TraceElementMetaInformation {
    iid?: string
}

interface TraceElement {
    applyVisitor<T>(v:TraceElementVisitor<T>): T
    toString(): string
    meta: TraceElementMetaInformation
}
interface TraceStatement extends TraceElement {
    applyStatementVisitor<T>(v:TraceStatementVisitor<T>): T
}
interface TraceExpression extends TraceElement {
    applyExpressionVisitor<T>(v:TraceExpressionVisitor<T>): T
}
interface Write extends TraceStatement {
    sink: Variable
    rhs: TraceExpression
}
interface FieldWrite extends TraceStatement {
    base: Variable
    fieldName: string
    rhs: Variable
    isInitializer: boolean
}
interface Delete extends TraceStatement {
    base:Variable
    fieldName: string
}

declare type ScopeID = string
// Umbrella for all kinds of Infos, specialize when needed
interface InfoProperties {
    sourceTmp?: Variable
    resultTmp?: Variable
    functionTmp?: Variable
    baseTmp?: Variable
    argsTmps?: Variable[]
    isConstructorCall?: boolean,
    scopeID?: ScopeID
}

interface Info extends TraceStatement {
    kind: number // enum: TraceLanguageAST#InfoKinds
    properties: InfoProperties
}
interface NextInfo {
    nextFieldAccessIsDynamic: boolean
    nextNewIsArray: boolean
    nextNewIsArguments: boolean
    nextNewIsFunction: boolean
    nextNewIsDotPrototype: boolean
}


interface Read extends TraceExpression {
    source: Variable
}
interface FieldRead extends TraceExpression {
    base:Variable
    fieldName: string
    modelingHack: ModelingHack
}
interface ModelingHack {
    fieldReadPrimitiveResultTmp?: Variable
    returnFromExternalPrimitiveResultTmp?: Variable
    moduleRequireExportsTmp?: Variable
}
interface New extends TraceExpression {
    proto: Variable
}

interface PrimitiveExpression extends TraceExpression {
    value: number // enum: HeapHistoryImpls#PrimitiveKind
}

interface TraceElementVisitor<T> {
    visitWrite(e:Write): T;
    visitFieldWrite(e:FieldWrite): T;
    visitDelete(e:Delete): T;
    visitInfo(e:Info): T;
    visitRead(e:Read): T;
    visitFieldRead(e:FieldRead): T;
    visitNew(e:New): T;
    visitPrimitiveExpression(e:PrimitiveExpression): T;
}

interface TraceStatementVisitor<T> {
    visitWrite(e:Write): T;
    visitFieldWrite(e:FieldWrite): T;
    visitDelete(e:Delete): T;
    visitInfo(e:Info): T;
}
interface TraceExpressionVisitor<T> {
    visitRead(e:Read): T;
    visitFieldRead(e:FieldRead): T;
    visitNew(e:New): T;
    visitPrimitiveExpression(e:PrimitiveExpression): T;
}

interface Variables<T> {
    read(variable:Variable, allowUndefined?:boolean):T
    write(variable:Variable, value:T):void
}

//
// Type Checking
//
interface IsSubtypeRequiringFunction {
    (subtype:Value, supertype:Value, requireSubtypeRelationship:SubtypeRequirementMakerFunction):boolean
}
interface SubtypeRequirementMakerFunction {
    (subtype:Value, supertype:Value):boolean
}
interface SubtypeRelationship {
    subtype: Shape
    supertype: Shape
}
interface TypeCheckReport {
    failures:SourceLocationSubtypeRelationshipPair[]
}

//
// Trace replay values and state
//
interface Value {
    valueKind: number // enum: TraceLanguageAST#ValueKinds
}
/**
 * A concrete object in a trace
 */
interface Instance extends Value, Concrete {
    shapes: Shape[]
    functionUsages: DynamicFunctionSignature[]
}
/**
 * The shape of an object at a specific point in time in a trace
 */
interface Shape {
    addInitialProperty(propertyName:string, propertyValue:Value): void
    getPrototypeObject():Value
    getPropertyNames():string[]
    getPropertyValue(name:string):Value
    hasProperty(name:string):boolean
    getObjectClassification():number // SJS#ObjectClassification
    hasObjectClassification():boolean
    getIsDotPrototype():boolean
    meta: TraceElementMetaInformation
    traceIndex: number // the point in the trace where this shape occurs
}

interface Primitive extends Value {
    primitiveKind: number // enum: TraceLanguageAST#PrimitiveKind
}
/**
 * A concrete function call in a trace
 */
interface DynamicFunctionSignature extends Concrete {
    function: Instance
    base: Instance
    args: Value[]
    result: Value
    meta: TraceElementMetaInformation
    callTraceIndex: number
    returnTraceIndex: number
    isConstructorCall: boolean
}
/**
 * A property access in a trace
 */
interface PropertyAccess {
    iid: string
    baseVar: Variable
    base: Instance
    name: string
    result: Value
    traceIndex:number
}
/**
 * The result of replaying a trace.
 * Misc. information is recorded for later usage.
 */
interface TraceReplayResults {
    instances: Instance[]
    propertyAccesses: PropertyAccess[]
    statements: TraceStatement[]
    variableList: Variable[]
    variableValues: Map<Variable, Value[]>
}
interface Concrete {

}
interface ReplayState {
    currentTraceIndex: number
    variables: Variables<Type>
    trace: TraceStatement[]
}
interface TypeMaterializer {
    materializeNew(): Type
    materializeReturnFromExternal(): Type
    materializeCallFromExternal: {
        materializeBase(): Type
        materializeFunction(): Type
        materializeArgument(i:number): Type
    }
}

//
// Types
//
interface Type {
    typeKind: number// enum:TypeKinds
}
interface FunctionType {
    functionKind: number// enum:FunctionKinds
}
interface SingleFunctionType extends FunctionType {
    base:TupleType
    args:TupleType[]
    result:TupleType
    callKinds: Set<number> // enum:CallKinds
}
interface IntersectionFunctionType extends FunctionType {
    members: SingleFunctionType[]
}
interface ObjectType extends Type {
    objectKind: number // enum:ObjectKind
    properties:PropertyTypes
//    prototypeType:Type
    functionType: FunctionType
    objectClassification: ObjectClassificationType
    readOnlyPropertyNames: Set<string>
    MRO?: Map<string, TupleType>
    MRW?: Map<string, TupleType>

    // optimization: no need to check MRW/MRO and props all the time..
    isAbstract?: boolean
}
interface ObjectClassificationType {
    classifications: Set<number> // enum:SJS.ObjectClassification
}
interface TupleType {
    elements:Type[]
}
interface RecursiveReferenceType extends Type {
    id?: number
    recursiveReferenceKind: number // enum: RecursiveReferenceKind
}
interface MergeOperator<T> {
    (t1:T, t2:T): T
}
interface AscribeOperator<C extends Concrete,T extends Type> {
    (concrete:C):T
}
interface UnionType extends Type {
    types: Type[]
}
interface OptionType extends Type {
    type: Type
}

interface PropertyTypes {
    [s:string]:TupleType
}
interface Option<T> {
    isSome: boolean
}

interface TypeAscriber {
    ascribeType(v:Value, path:string[]):TupleType
    ascribeFunctionType(sig:DynamicFunctionSignature, path:string[]):SingleFunctionType
}
interface AllocationSiteTypeInferencer {
    infer(iid:string): Type
}
interface TypeInferencer {
    inferType:(values:Value[], path:string[])=> TupleType
    inferObjectType:(instances:Instance[], path:string[])=> ObjectType
    inferFunctionType:(signatures:DynamicFunctionSignature[], path:string[])=> FunctionType
    getAscriber:() => TypeAscriber
}
interface CompleteLattice<T> {
    top: T
    lub: (t1:T, t2:T) => T
    bot: T
}
interface ValueTypeConfig {
    types: CompleteLattice<TupleType>
    initialFunctionTypeMaker:MergeOperator<FunctionType>
    useSJSAscription?: boolean
}
interface InferencerConfig {
    (): ValueTypeConfig
}
//
// Informational
//
interface SourceLocation {
    file:string
    beginLine:number
    endLine:number
    beginColumn:number
    endColumn:number
    isPseudo:boolean
    toString(omitFile?:boolean, asRegion?:boolean):string;
}
interface MetaInformationExplainer {
    getIIDSourceLocation(iid:string): SourceLocation
}
interface SourceRelatedMessage {
    sourceLocation: SourceLocation
    type: string
    message: string
}
interface IIDRelatedMessage {
    iid: string
    type: string
    message: string
}
interface SourceLocationSubtypeRelationshipPair {
    sourceLocation: SourceLocation
    subtypeRelationShip: SubtypeRelationship
}
interface IIDMap {
    get(iid:string):SourceLocation
    has(iid:string):boolean
}

interface Table {
    title: string
    headers: string[]
    rows: string[][]
}
interface BarChartData {
    title: string
    rows: any[][]
}
interface ColumnDescription {
    type: string
    description: string
}
interface StackedGroupedBarCharts {
    barchartData: BarChartData[]
    columnDescriptions: ColumnDescription[]
    columnGroupings: number[]
}
//
// Configuration
//
interface Config {
    experimentResultDirectory: string
    tracesDirectory:string
    makeTrace:MakeTraceFunction
}
interface ExperimentConfig {
    typeLatticeMaker:() =>  ValueTypeConfig
    precisionConfig: PrecisionConfig
}

interface PrecisionConfig {
    flowInsensitiveVariables?: boolean
    // TODO merge these two options...
    contextInsensitiveVariables?: boolean
    callstackSensitiveVariables?: boolean
    callstackSensitiveVariablesHeight?: number
}
interface Target {
    dir?: string
    main: string
}
interface MakeTraceFunction {
    (target:Target, callback:(err:any, externalTrace:any[], iidFile:string) => void, debug:boolean): void
}

//
// Experiments
//
interface AnnotatedExperimentResults<T extends ExperimentResult> {
    sinceEpoch: number
    description: string
    sources: string[]
    results: T[]
}
interface EventMergeStrategy {
    <T>(events:SourceRelatedValue<T>[]): SourceRelatedValue<T>[][]
}

interface InstanceMergeStrategy {
    (instance:Instance, inferencer:TypeInferencer): ObjectType
}
/**
 * Something which can be associated to a source location
 */
interface SourceRelatedValue<T> {
    iid: string
    value: T
}

/**
 * The ultimate output of an experiment
 */
interface ExperimentResult {
    kind: number // enum: ExperimentResultKinds
}
interface TypeComparisonQueryResult extends ExperimentResult {
    iid: string // the source location of the comparison
    result:boolean // whether the query succeeded
    abstract: TupleType // the computed type
    concrete: TupleType[] // the actual types
}
interface InferredTypeResult extends ExperimentResult {
    iid: string
    type: TupleType
}
interface StaticDynamicNumberPair {
    Static: number
    Dynamic: number
}
interface TypeChecksResult extends ExperimentResult {
    data: {[n:number /* enum ConstraintKind */]: StaticDynamicNumberPair}
}

/**
 * A comparison a a computed type and actual types
 */
interface TypeComparison {
    iid: string
    abstract: TupleType
    concrete: TupleType[]
}
