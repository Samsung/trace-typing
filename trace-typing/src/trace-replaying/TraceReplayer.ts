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
///<reference path="../types.d.ts"/>

import State = require("./State");
import Impls = require("./HeapHistoryImpls");
import AST = require('../TraceLanguageAST');
import Extras = require('./TraceReplayerExtras');
import VariableManager = require('../VariableManager');

import MetaInformationExplainer = require("../MetaInformationExplainer");


var DEBUG = false;
function log(...any:any[]) {
    if(DEBUG) {
        console.log.apply(console, arguments);
    }
}
/**
 * How a function was invoked
 */
interface InfoFunctionInvocationProperties {
    function: Instance
    base: Instance
    args: Value[]
    traceIndex: number
    isConstructorCall: boolean
}

interface InfoFunctionInvocationPropertiesMetaPair {
    properties: InfoFunctionInvocationProperties
    meta: TraceElementMetaInformation
}

/**
 * Handles Info statements, collecting relevant information.
 */
class InfoVisitor {
    /**
     * The current call stack, used for reconstructing calls
     */
    private callstack:InfoFunctionInvocationPropertiesMetaPair[] = [];

    public nextInfo:NextInfo = {nextFieldAccessIsDynamic: false, nextNewIsArray: false, nextNewIsArguments: false, nextNewIsDotPrototype: false, nextNewIsFunction: false, nextNewIsInternalConstructorThis: false};

    constructor(private variables:Variables<Value>, private currentTraceIndex:{value: number}, private scopeIDStack:ScopeID[]) {
    }

    public visit(info:Info) {
        switch (info.kind) {
            case AST.InfoKinds.FunctionInvocation:
                var properties:InfoFunctionInvocationProperties = {
                    function: <Instance>this.variables.read(info.properties.functionTmp),
                    base: <Instance>this.variables.read(info.properties.baseTmp),
                    args: info.properties.argsTmps.map(arg => this.variables.read(arg)),
                    traceIndex: this.currentTraceIndex.value,
                    isConstructorCall: info.properties.isConstructorCall
                };
                this.callstack.push({properties: properties, meta: info.meta});
                if(properties.isConstructorCall && !info.properties.isExternalCall) {
                    this.nextInfo.nextNewIsInternalConstructorThis = true;
                }
                break;
            case AST.InfoKinds.FunctionReturn:
                this.scopeIDStack.pop();
                var invocation = this.callstack.pop();
                var signature:DynamicFunctionSignature = {
                    function: invocation.properties.function,
                    base: invocation.properties.base,
                    args: invocation.properties.args,
                    result: this.variables.read(info.properties.resultTmp),
                    meta: invocation.meta,
                    callTraceIndex: invocation.properties.traceIndex,
                    returnTraceIndex: this.currentTraceIndex.value,
                    isConstructorCall: invocation.properties.isConstructorCall
                };
                invocation.properties.function.functionUsages.push(signature)
                break;
            case AST.InfoKinds.NextFieldAccessIsDynamic:
                this.nextInfo.nextFieldAccessIsDynamic = true;
                break;
            case AST.InfoKinds.NextNewIsDotPrototype:
                this.nextInfo.nextNewIsDotPrototype = true;
                break;
            case AST.InfoKinds.NextNewIsArray:
                this.nextInfo.nextNewIsArray = true;
                break;
            case AST.InfoKinds.NextNewIsArguments:
                this.nextInfo.nextNewIsArguments = true;
                break;
            case AST.InfoKinds.NextNewIsFunction:
                this.nextInfo.nextNewIsFunction = true;
                break;
            case AST.InfoKinds.FunctionEnter:
                this.scopeIDStack.push(info.properties.scopeID);
                break;
            case AST.InfoKinds.FunctionResult:
            case AST.InfoKinds.Coerce:
            case AST.InfoKinds.ForInObject:
                // ignore
                break;
            default:
                throw new Error("Unhandled info kind: " + info.kind);
        }
    }
}

class AllVariableValues implements Variables<Value> {
    public values = new Map<Variable,Value[]>();
    public list:Variable[] = [];

    constructor(private origVariables:Variables<Value>) {

    }

    read(variable:Variable, allowUndefined?:boolean) {
        return this.origVariables.read(variable, allowUndefined);
    }

    write(variable:Variable, value:Value) {
        if (!this.values.has(variable)) {
            this.list.push(variable);
            this.values.set(variable, []);
        }
        this.values.get(variable).push(value);
        this.origVariables.write(variable, value);
    }

}
/**
 * Main function for the replaying of a trace.
 * An interpreter for the trace language.
 *
 * Replays trace statements in order while managing the program state.
 * Collects desired information during the replaying.
 */
function replayStatements(statements:TraceStatement[], origVariables:Variables<Value>):TraceReplayResults {
    var variables = new AllVariableValues(origVariables);

    /**
     * Misc. information to be used by subsequent analysises.
     */
    var collections = {
        propertyAccesses: new Array<PropertyAccess>()
    };

    /**
     * All concrete objects in the trace will be recorded here.
     */
    var instances:Instance[] = [];

    var nextDebugID = 0;

    var currentTraceIndex = {value: 0};

    function addInitialProperty(base:Instance, propertyName:string, value:Value) {
        base.shapes[0].addInitialProperty(propertyName, value);
    }

    /**
     * Deletes a property of an object
     */
    function deleteProperty(base:Instance, propertyName:string, meta:TraceElementMetaInformation) {
        var shape = new Impls.ShapeImpl(base, meta, currentTraceIndex.value, propertyName);
        debugTag(shape);
    }

    function checkBaseForPropertyAccess(base:Value, baseVar:Variable) {
        if (base.valueKind === AST.ValueKinds.Primitive) {
            // about to fail.. show the history of the base
            if (baseVar !== undefined) {
                Extras.showDefinitionChain(baseVar, statements, explainer);
            }
            throw new Error("Odd trace: Trying to access a property of an uncoerced primitive (" + AST.PrimitiveKind[(<Primitive>base).primitiveKind] + ")?!");
        }
    }

    /**
     * Writes a property to an object, also updates the object history of the object and any objects referencing it (recursively)
     */
    function writeProperty(base:Instance, propertyName:string, value:Value, isInitializer:boolean, meta:TraceElementMetaInformation, isDynamic:boolean) {
        checkBaseForPropertyAccess(base, undefined);
        var currentShape = Impls.getMostRecentShape(base);
        if (isInitializer || currentShape.getIsDotPrototype()) {
            if (base.shapes.length !== 1) {
                throw new Error("Initializer after non-initializer for ." + propertyName + "?!");
            }
            base.shapes[0].addInitialProperty(propertyName, value);
            return;
        }
        if (currentShape.hasProperty(propertyName) && currentShape.getPropertyValue(propertyName) === value) {
            return; // optimization - the write has no effect for us...
        }
        var shape = new Impls.ShapeImpl(base, meta, currentTraceIndex.value, propertyName, value, isDynamic);
        debugTag(shape);
    }

    /**
     * Reads a property on an object, respecting the prototype chain.
     */
    function readProperty(base:Value, propertyName:string, readingElement:FieldRead) {
        checkBaseForPropertyAccess(base, readingElement.base);
        var origBase = base;
        while (base.valueKind !== AST.ValueKinds.Primitive /* i.e.: a undefinedness check */) {
            var mostRecentShape = Impls.getMostRecentShape(<Instance>base);
            if (mostRecentShape.hasProperty(propertyName)) {
                return mostRecentShape.getPropertyValue(propertyName);
            }
            base = mostRecentShape.getPrototypeObject();
        }

        // not found...
        if ((<FieldRead>readingElement).modelingHack && (<FieldRead>readingElement).modelingHack.fieldReadPrimitiveResultTmp) {
            // Handles two cases:
            // 1) property was not found concretely, the return value should be undefined,
            // 2) property was found concretely, but an insufficient model does not provide the property value
            return variables.read((<FieldRead>readingElement).modelingHack.fieldReadPrimitiveResultTmp);
        }

        // we are reading a property with an unknown object value - model should be improved!
        var msg = getSourceLocation(readingElement) + ":\n Warning: property not found for FieldRead: ." + propertyName + " (of " + JSON.stringify(readingElement.base) + ")";
        throw new Error(msg);
    }

    var getCanonicalPrimitive = (function () {
        var map = new Map<AST.PrimitiveKind, Primitive>();
        [AST.PrimitiveKind.Number,
            AST.PrimitiveKind.String,
            AST.PrimitiveKind.Boolean,
            AST.PrimitiveKind.Undefined,
            AST.PrimitiveKind.Null].forEach(kind =>
                map.set(kind, new Impls.PrimitiveImpl(kind))
        );
        return function (kind:AST.PrimitiveKind) {
            return map.get(kind);
        }
    })();

    function debugTag(object:Object) {
        (<any>object).DEBUG_ID = nextDebugID++;
    }

    /**
     * Book keeping for newly allocated objects.
     */
    function setupNewObject(instance:Instance):void {
        debugTag(instance);
        instances.push(instance);
    }

    function getCurrentScopeID(){
        return scopeIDStack.length === 0? 'global': scopeIDStack[scopeIDStack.length - 1];
    }
    function getEnclosingScopeID(){
        // pop temporarily
        var currentScopeID = scopeIDStack.pop();
        var enclosingScopeID = getCurrentScopeID();
        scopeIDStack.push(currentScopeID);
        return enclosingScopeID;
    }

    function makeObjectWithoutPrototype(isDotPrototype: boolean, allocationScopeID: ScopeID, meta:TraceElementMetaInformation):Instance {
        var shape = new Impls.ShapeImpl(getCanonicalPrimitive(AST.PrimitiveKind.Null), meta, currentTraceIndex.value, isDotPrototype);
        var instance = new Impls.InstanceImpl(shape, allocationScopeID);
        setupNewObject(instance);
        return instance;
    }

    function makeNewObject(prototypeObject:Instance, isArray:boolean, isFunction: boolean, isDotPrototype: boolean, isArguments: boolean, allocationScopeID: ScopeID, meta:TraceElementMetaInformation):Instance {
        var shape = new Impls.ShapeImpl(prototypeObject, meta, currentTraceIndex.value, isArray, isFunction, isDotPrototype, isArguments);

        var instance = new Impls.InstanceImpl(shape, allocationScopeID);
        setupNewObject(instance);
        return instance;
    }

    function getSourceLocation(e:TraceElement) {
        return explainer.getIIDSourceLocation(e.meta.iid).toString();
    }

    var scopeIDStack: ScopeID[] = [];
    var infoVisitor = new InfoVisitor(variables, currentTraceIndex, scopeIDStack);

    /**
     * Visitor for trace expressions.
     */
    var expressionVisitor:TraceExpressionVisitor<Value> = {
        visitRead: function (e:Read):Value {
            return variables.read(e.source);
        },
        visitFieldRead: function (e:FieldRead):Value {
            var result = readProperty(variables.read(e.base), e.fieldName, e);
            var base = <Instance>variables.read(e.base);
            collections.propertyAccesses.push({
                iid: e.meta.iid,
                baseVar: e.base,
                base: base,
                name: e.fieldName,
                result: result,
                traceIndex: currentTraceIndex.value
            });
            return result;
        },
        visitNew: function (e:New):Value {
            var prototypeValue:Value = variables.read(e.proto);
            var object:Instance;

            var isArray = infoVisitor.nextInfo.nextNewIsArray;
            infoVisitor.nextInfo.nextNewIsArray = false;
            var isArguments = infoVisitor.nextInfo.nextNewIsArguments;
            infoVisitor.nextInfo.nextNewIsArguments = false;
            var isFunction = infoVisitor.nextInfo.nextNewIsFunction;
            infoVisitor.nextInfo.nextNewIsFunction = false;
            var isDotPrototype = infoVisitor.nextInfo.nextNewIsDotPrototype;
            infoVisitor.nextInfo.nextNewIsDotPrototype = false;
            var isConstructorThis = infoVisitor.nextInfo.nextNewIsInternalConstructorThis;
            infoVisitor.nextInfo.nextNewIsInternalConstructorThis = false;
            var allocationScopeID = isConstructorThis? getEnclosingScopeID(): getCurrentScopeID();
            if (prototypeValue.valueKind === AST.ValueKinds.Object) {
                object = makeNewObject(<Instance>prototypeValue, isArray, isFunction, isDotPrototype, isArguments, allocationScopeID, e.meta);
            } else {
                object = makeObjectWithoutPrototype(isDotPrototype, allocationScopeID, e.meta);
            }
            return object;
        },
        visitPrimitiveExpression: function (e:PrimitiveExpression):Value {
            return getCanonicalPrimitive(e.value);
        }
    };


    /**
     * Visitor for trace statements.
     */
    var statementVisitor:TraceStatementVisitor<void> = {
        visitWrite: function (e:Write):void {
            var value = e.rhs.applyExpressionVisitor(expressionVisitor);
            if (value === undefined) {
                throw new Error("No value produced by expression: " + JSON.stringify(e.rhs));
            }
            variables.write(e.sink, value);
        },
        visitFieldWrite: function (e:FieldWrite):void {
            var isDynamic = infoVisitor.nextInfo.nextFieldAccessIsDynamic;
            infoVisitor.nextInfo.nextFieldAccessIsDynamic = false;
            writeProperty(<Instance>variables.read(e.base), e.fieldName, variables.read(e.rhs), e.isInitializer, e.meta, isDynamic);
        },
        visitDelete: function (e:Delete):void {
            deleteProperty(<Instance>variables.read(e.base), e.fieldName, e.meta);
        },
        visitInfo: function (e:Info):void {
            infoVisitor.visit(e);
        }
    };

    statements.forEach(function (statement) {
        log(statement.toString());
        statement.applyStatementVisitor(statementVisitor);
        currentTraceIndex.value++;
    });
    return {
        instances: instances,
        propertyAccesses: collections.propertyAccesses,
        statements: statements,
        variableList: variables.list,
        variableValues: variables.values
    };
}

var explainer:MetaInformationExplainer;

export function replayTrace(trace:Trace):TraceReplayResults {
    explainer = new MetaInformationExplainer(trace.iidMap);
    return replayStatements(trace.statements, new State.VariablesImpl<Value>());
}
