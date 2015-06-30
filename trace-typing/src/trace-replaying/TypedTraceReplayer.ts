///<reference path="../types.d.ts"/>
import State = require("./State");
import TypeImpls = require("../typing/TypeImpls");
import TypeInferencer = require("../typing/TypeInferencer");
import AST = require("../TraceLanguageAST");
import Misc = require("../Misc");
import VariableManager = require("../VariableManager");

interface SimpleTypes {
    Number: TupleType
    String: TupleType
    Boolean: TupleType
    Undefined: TupleType
    Null: TupleType
    None: TupleType
    Top: TupleType
    TopFunction: FunctionType
    NoneFunction: FunctionType
}

interface CallMonitor {
    enter(scopeID:ScopeID):void
    call(iid:string):void
    return():void
}

interface CallAbstractor {
    abstract(scopeID:ScopeID): ScopeID
    getMonitor(): CallMonitor
}

interface RecoverPropertyTypeFunc {
    ():TupleType
}
/**
 * Returns the type or *undefined* of an expression. An undefined return value indicates that some initial type environment should be used for the value instead.
 */
class ExpressionDataflowVisitor implements TraceExpressionVisitor<TupleType> {
    constructor(private variables:Variables<TupleType>, private inferredEnv:Variables<TupleType>) {
    }

    visitRead(e:Read):TupleType {
        return this.variables.read(e.source);
    }

    visitFieldRead(e:FieldRead):TupleType {

        var base:ObjectType;
        var potentialObjectBaseTuple = this.variables.read(e.base);
        if (TypeImpls.TupleAccess.isObject(potentialObjectBaseTuple)) {
            base = TypeImpls.TupleAccess.getObject(potentialObjectBaseTuple);
        } else {
            // precision lost: an object must be present at this location, so read it from the inferred environment
            base = TypeImpls.TupleAccess.getObject(this.inferredEnv.read(e.base));
        }

        var property:TupleType;
        switch (base.objectKind) {
            case TypeImpls.ObjectKinds.Some:
                var baseObject = <ObjectType> base;
                var n = Misc.fieldNameAbstraction(e.fieldName, base.objectClassification);
                if (Misc.HOP(baseObject.properties, n)) {
                    property = baseObject.properties[n];
                    if (property !== undefined && TypeImpls.constants.Top !== property && TypeImpls.TupleAccess.isRecursiveReference(property)) {
                        throw new Error("." + n + " has a recursive reference: " + TypeImpls.toPrettyString(property));
                    }
                    return property;
                } else {
                    return undefined;
                }
            case TypeImpls.ObjectKinds.Top:
            case TypeImpls.ObjectKinds.Bottom:
                return undefined;
            default:
                throw new Error("Unhandled case: " + base.objectKind);
        }
    }

    visitNew(e:New):TupleType {
        return undefined;
    }

    visitPrimitiveExpression(e:PrimitiveExpression):TupleType {
        return undefined;
    }
}

class StatementDataflowVisitor implements TraceStatementVisitor<void> {
    private fixedVariables = new Set<Variable>();

    constructor(private expressionVisitor:TraceExpressionVisitor<TupleType>,
                private variables:Variables<TupleType>,
                private inferredEnv:Variables<TupleType>,
                private callMonitor:CallMonitor) {

    }

    visitWrite(e:Write):void {
        var rhs = e.rhs.applyExpressionVisitor(this.expressionVisitor);
        if (rhs === undefined// value-expressions return 'undefined', materialize the type from the inferred environment
            || this.fixedVariables.has(e.sink) // fixed variables receive the inferred type
        ) {
            rhs = this.inferredEnv.read(e.sink);
        }
        this.variables.write(e.sink, rhs);
    }

    visitFieldWrite(e:FieldWrite):void {
        // ignore!
    }

    visitDelete(e:Delete):void {
        // ignore!
    }

    visitInfo(e:Info):void {
        switch (e.kind) {
            case AST.InfoKinds.FunctionResult:
                this.fixedVariables.add(e.properties.resultTmp);
                break;
            case AST.InfoKinds.FunctionEnter:
                this.fixedVariables.add(e.properties.functionTmp);
                this.fixedVariables.add(e.properties.baseTmp);
                e.properties.argsTmps.forEach(argTmp => this.fixedVariables.add(argTmp));
                if (this.callMonitor) {
                    this.callMonitor.enter(e.properties.scopeID);
                }
                break;
            case AST.InfoKinds.FunctionInvocation:
                if (this.callMonitor) {
                    this.callMonitor.call(e.meta.iid);
                }
                break;
            case AST.InfoKinds.FunctionReturn:
                if (this.callMonitor) {
                    this.callMonitor.return();
                }
                break;
            case AST.InfoKinds.Coerce:
            case AST.InfoKinds.ForInObject:
            case AST.InfoKinds.NextNewIsArray:
            case AST.InfoKinds.NextNewIsArguments:
            case AST.InfoKinds.NextNewIsFunction:
            case AST.InfoKinds.NextFieldAccessIsDynamic:
            case AST.InfoKinds.NextNewIsDotPrototype:
                // ignore
                break;
            default:
                throw new Error("Unhandled info kind: " + e.kind);
        }
    }
}

/**
 * Implementation of flow & context insensitivity.
 *
 * - Flow insensitivity means that named local variables are updated weakly (should not be surprising)
 * - Context insensitivity means that unnamed variables are weakly updated across calls (a bit counter intuitive, see below).
 *
 * As the rhs of every named lhs/rhs of named local variables reads/writes always are unnamed variables, the context insensitivity is effectively achieved for the values of the named local variables!
 * If context insensitivity was implemented by sharing named local variables across contexts, then recursive calls would misbehave.
 * (see examples in /test/TypedTraceReplayerTests)
 */
class AbstractedVariables implements Variables<TupleType> {
    public dirty = false;

    private variables = new State.VariablesImpl<TupleType>();
    private abstractionCache = new Map<Variable, Variable>();

    constructor(private lattice:CompleteLattice<TupleType>, private flowConfig:PrecisionConfig, private callAbstractor:CallAbstractor) {
    }

    private abstract(variable:Variable):Variable {
        if (this.abstractionCache.has(variable)) {
            return this.abstractionCache.get(variable);
        }
        var abstractVariable:Variable = {named: variable.named};

        var killCallContext = this.flowConfig.contextInsensitiveVariables && !variable.named;

        if (variable.iid) {
            abstractVariable.iid = variable.iid;
        }
        if (variable.name) {
            abstractVariable.name = variable.name;
        }
        if (variable.functionIID) {
            abstractVariable.functionIID = variable.functionIID;
        }
        if (variable.callCount && !killCallContext) {
            var scopeID = variable.functionIID + ":" + variable.callCount /* TODO avoid this manual mapping that requires knowledge of encodings.. */;
            var abstractScopeID = this.callAbstractor.abstract(scopeID);
            if (abstractScopeID !== undefined) {
                abstractVariable.callCount = abstractScopeID;
            } else {
                abstractVariable.callCount = variable.callCount;
            }
        }
        var canonicalized = VariableManager.canonicalize(abstractVariable);
        this.abstractionCache.set(variable, canonicalized);
        return canonicalized;
    }

    read(variable:Variable) {
        return this.variables.read(this.abstract(variable));
    }

    write(variable:Variable, typeToWrite:TupleType) {
        var resultType = typeToWrite;
        if (resultType === undefined /* TODO rethink/document the need for this guard */) {
            return;
        }
        var abstractVariable = this.abstract(variable);
        var oldType = this.variables.read(abstractVariable, true);
        var doWeakUpdateToNamedVariable = this.flowConfig.flowInsensitiveVariables && variable.named;
        var doWeakUpdateToUnnamedVariable = (this.flowConfig.contextInsensitiveVariables || this.flowConfig.callstackSensitiveVariables) && !variable.named;
        var doWeakUpdate = doWeakUpdateToNamedVariable || doWeakUpdateToUnnamedVariable || variable.forceMerge;
        if (oldType !== undefined && doWeakUpdate) {
            resultType = this.lattice.lub(resultType, oldType);
        }

        if (oldType === undefined || !TypeImpls.isTupleTypeEqual(resultType, oldType)) {
            if (!this.dirty && doWeakUpdate) {
                var BUGHUNT = false;
                if (BUGHUNT) {
                    console.log("First type change at: %s: \n\t%s \n\t\t-> \n\t%s", JSON.stringify(abstractVariable), oldType === undefined ? "-" : TypeImpls.toPrettyString(oldType), TypeImpls.toPrettyString(resultType));
                    if (oldType !== undefined)
                        TypeImpls.isTupleTypeEqual(resultType, oldType, true)
                }
                this.dirty = true;
            }
            this.variables.write(abstractVariable, resultType);
        }
    }
}

class NoCallAbstraction implements CallAbstractor {
    public abstract(scopeID:ScopeID):ScopeID {
        return scopeID;
    }

    public getMonitor():CallMonitor {
        return undefined;
    }
}

class CallstackAbstraction implements CallAbstractor {
    private monitor:CallMonitor;
    private scopeIDAbstraction = new Map<ScopeID, string>();
    private stackIDMap = new Map<string, number>();

    constructor() {
        var stack:string[] = [];
        var scopeIDAbstraction = this.scopeIDAbstraction;
        var stackIDMap = this.stackIDMap;
        this.monitor = {
            call(iid:string) {
                //console.log('call(%s)', iid);
                stack.push(iid);
            },
            enter(scopeID:ScopeID) {
                //console.log('enter(%s)', scopeID);
                var stackString = stack.join("->");
                if(!stackIDMap.has(stackString)){
                    stackIDMap.set(stackString, stackIDMap.size);
                }
                scopeIDAbstraction.set(scopeID, '' + stackIDMap.get(stackString))
            },
            return(){
                //console.log('return');
                stack.pop();
            }
        };
    }

    public abstract(scopeID:ScopeID):ScopeID {
        return this.scopeIDAbstraction.get(scopeID);
    }

    public getMonitor():CallMonitor {
        return this.monitor;
    }

}

function replayStatements(inferredEnv:Variables<TupleType>, varibleList:Variable[], statements:TraceStatement[], flowConfig:PrecisionConfig, lattice:CompleteLattice<TupleType>):{
    propagatedEnv: Variables<TupleType>
    inferredEnv: Variables<TupleType>
} {
    var callAbstraction = flowConfig.callstackSensitiveVariables ? new CallstackAbstraction() : new NoCallAbstraction();
    var variablesDecorator = new AbstractedVariables(lattice, flowConfig, callAbstraction);
    var iterationCount = 0;
    var start = new Date();
    do {
        iterationCount++;
        if (iterationCount > 10000) {
            throw new Error("Not likely to terminate - probably a non-monotoniticy issue, set BUGHUN = true in TypedTraceReplayer.ts...");
        }
        var roundStart = new Date();
        // console.log("Type propagation round #%d", iterationCount);
        variablesDecorator.dirty = false;
        var replayState = {
            currentTraceIndex: 0,
            variables: variablesDecorator,
            trace: statements
        };

        var expressionVisitor = new ExpressionDataflowVisitor(replayState.variables, inferredEnv);
        var statementDataflowVisitor = new StatementDataflowVisitor(expressionVisitor, replayState.variables, inferredEnv, callAbstraction.getMonitor());

        statements.forEach(function (statement) {
            // console.log(statement.toString());
            statement.applyStatementVisitor(statementDataflowVisitor);
            replayState.currentTraceIndex++;
        });
        var roundEnd = new Date();
        // console.log("Variable type fix point iteration #%d took %d ms", iterationCount, roundEnd.getTime() - roundStart.getTime());
    } while ((flowConfig.flowInsensitiveVariables || flowConfig.contextInsensitiveVariables) && variablesDecorator.dirty);
    var end = new Date();
    // console.log("Variable type fix point found after %d iterations and %d ms", iterationCount, end.getTime() - start.getTime());
    return {propagatedEnv: variablesDecorator, inferredEnv: inferredEnv};
}

export function replayTrace(variableValues:Map<Variable, Value[]>, variableList:Variable[], statements:TraceStatement[], flowConfig:PrecisionConfig, valueTypeConfig:ValueTypeConfig):{
    propagatedEnv: Variables<TupleType>
    inferredEnv: Variables<TupleType>
} {
    // console.log("Flow-less type inference...");
    var inferencer:TypeInferencer = new TypeInferencer.TypeInferencerImpl(valueTypeConfig.types, valueTypeConfig.initialFunctionTypeMaker, !!valueTypeConfig.useSJSAscription);
    var inferredEnv = new State.VariablesImpl<TupleType>();
    variableList.filter(v => !v.named).forEach(variable => {
            var type = variableValues.get(variable).reduce((t:TupleType, v:Value) =>
                valueTypeConfig.types.lub(t, inferencer.getAscriber().ascribeType(v, [])), valueTypeConfig.types.bot);

            if (TypeImpls.TupleAccess.isRecursiveReference(type) && type !== TypeImpls.constants.Top) {
                throw new Error("Recursive references should have been resolved by now: " + TypeImpls.toPrettyString(type));
            }
            inferredEnv.write(variable, type)
        }
    );

    // console.log("Type propagation...");
    return replayStatements(inferredEnv, variableList, statements, flowConfig, valueTypeConfig.types);
}