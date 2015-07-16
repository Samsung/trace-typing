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
///<reference path="../../typings/node/node.d.ts"/>
///<reference path="../types.d.ts"/>
import State = require("../trace-replaying/State");
import TypeImpls = require("../typing/TypeImpls");
import AST = require("../TraceLanguageAST");
import Misc = require("../Misc");
import SJS = require("../SJS");
import util = require("util");

var FIND_TYPE_ERROR_SOURCE = false;

interface AssignmentCompatibility {
    (lhs:Type, rhs:Type): boolean
}

interface Logger {
    error(iid:string, message:string, constraintKind:ConstraintKinds):void
    warning(iid:string, message:string, constraintKind:ConstraintKinds):void
}

interface Constraint {
    kind: ConstraintKinds
    element: TraceElement
    isSatisfied():boolean
    getFailureMessage():string
}
interface Constraints {
    addErrorConstraint(constraint:Constraint): void
    addWarningConstraint(constraint:Constraint): void
}
class IsSuccessfullCallConstraint implements Constraint {
    public kind = ConstraintKinds.IsSuccessfulCall;

    constructor(public element:TraceElement, private base:TupleType, private args:TupleType[], private matches:SingleFunctionType[], private potentialMatches:SingleFunctionType[]) {

    }

    isSatisfied() {
        return this.matches.length > 0;
    }

    getFailureMessage() {
        return util.format("Function call does not match any signatures");
    }
}
class IsSuccessfullReturnConstraint implements Constraint {
    public kind = ConstraintKinds.IsSuccessfulReturn;

    constructor(public element:TraceElement, private returned:TupleType, private signatureReturnTypes:TupleType[], private assignmentCompatibilityCheck:(t1:TupleType, t2:TupleType) => boolean) {

    }

    isSatisfied() {
        return this.signatureReturnTypes.some(t => this.assignmentCompatibilityCheck(t, this.returned));
    }

    getFailureMessage() {
        return util.format("Function call return does not match any signatures");
    }
}
class IsNotTopConstraint implements Constraint {
    public kind = ConstraintKinds.IsNotTop;

    constructor(public element:TraceElement, private type:TupleType) {

    }

    isSatisfied() {
        // add the top recursive component to ensure real top
        var elementsWithTopRecursiveReference = this.type.elements.slice();
        elementsWithTopRecursiveReference[TypeImpls.TypeKinds.RecursiveReference] = TypeImpls.constants.RecursiveReferenceTop;
        return !TypeImpls.isTupleTypeEqual(new TypeImpls.TupleTypeImpl(elementsWithTopRecursiveReference), TypeImpls.constants.Top);
    }

    getFailureMessage() {
        return util.format("Should not be Top");
    }
}
class IsNotTopFunctionConstraint implements Constraint {
    public kind = ConstraintKinds.IsNotTop;

    constructor(public element:TraceElement, private type:FunctionType) {

    }

    isSatisfied() {
        return this.type !== TypeImpls.constants.FunctionTop;
    }

    getFailureMessage() {
        return util.format("Should not be the Top function");
    }
}
class IsNotAbstractReceiverConstraint implements Constraint {
    public kind = ConstraintKinds.IsAbstractObject;

    constructor(public element:TraceElement, private type:ObjectType) {

    }

    isSatisfied():boolean {
        return this.type.isAbstract !== true;
    }

    getFailureMessage() {
        return util.format("Abstract receiver!");
    }
}

class IsObjectConstraint implements Constraint {
    public kind = ConstraintKinds.IsObject;

    constructor(public element:TraceElement, private type:TupleType) {

    }

    isSatisfied():boolean {
        return TypeImpls.TupleAccess.isObject(this.type) || TypeImpls.TupleAccess.isNullOrUndefined(this.type);
    }

    getFailureMessage() {
        return util.format("Is not an object type");
    }
}
class PropertyIsWritableConstraint implements Constraint {
    public kind = ConstraintKinds.PropertyIsWritable;

    constructor(public element:TraceElement, private type:ObjectType, private fieldName:string) {

    }

    isSatisfied():boolean {
        return !this.type.readOnlyPropertyNames.has(this.fieldName);
    }

    getFailureMessage() {
        return util.format(".%s is read-only", this.fieldName);
    }
}
class IsClassificationValidAccessConstraint implements Constraint {
    public kind = ConstraintKinds.IsClassificationValidAccess;
    private message:string = undefined;

    constructor(public element:TraceElement, private type:ObjectType, private fieldName:string, private dynamic:boolean, private isInitializer: boolean) {

    }

    isSatisfied():boolean {
        var satisfied = true;
        var classificationType = this.type.objectClassification;
        classificationType.classifications.forEach(classification => {
            switch (classification) {
                case SJS.ObjectClassification.Arguments:
                    if(!this.isInitializer) {
                        satisfied = false;
                        this.message = 'arguments array usage not allowed';
                    }
                    break;
                case SJS.ObjectClassification.Object:
                    if (this.dynamic) {
                        satisfied = false;
                        this.message = 'Dynamic access to fields not allowed for SJS-structural-objects'
                    }
                    break;
                case SJS.ObjectClassification.Map:
                    if (!this.dynamic) {
                        satisfied = false;
                        this.message = 'Static access to fields not allowed for SJS-maps'
                    }
                    break;
                case SJS.ObjectClassification.Array:
                    if (this.dynamic) {
                        if (!Misc.isAbstractArrayFieldName(this.fieldName)) {
                            satisfied = false;
                            this.message = 'Dynamic access to non-integral fields not allowed for SJS-arrays'
                        }
                    }
                    break;
                case SJS.ObjectClassification.Function:
                    // ignore
                    // TODO allow only .prototype access?!
                    break;
                default:
                    throw new Error("Unhandled kind: " + classification);
            }
        });
        return satisfied;
    }

    getFailureMessage() {
        return this.message;
    }
}
class IsNotClassifiedAsObjectConstraint implements Constraint {
    public kind = ConstraintKinds.IsNotClassifiedAsObject;

    constructor(public element:TraceElement, private type:ObjectType) {

    }

    isSatisfied():boolean {
        return !this.type.objectClassification.classifications.has(SJS.ObjectClassification.Object);
    }

    getFailureMessage() {
        return util.format("Is classified as an SJS-Object!");
    }
}
class IsFunctionConstraint implements Constraint {
    public kind = ConstraintKinds.IsFunction;

    constructor(public element:TraceElement, private type:TupleType) {

    }

    isSatisfied():boolean {
        return TypeImpls.TupleAccess.isFunction(<TupleType>this.type);
    }

    getFailureMessage() {
        return util.format("Is not a function type");
    }
}
class PropertyExistsConstraint implements Constraint {
    public kind = ConstraintKinds.PropertyExists;

    constructor(public element:TraceElement, private type:ObjectType, private name:string) {
    }

    isSatisfied() {
        if (Misc.isAbstractFieldName(this.name)) {
            return true;
        }
        var hasProperty = Object.prototype.hasOwnProperty.call(this.type.properties, this.name);
        var property = this.type.properties[this.name];
        return hasProperty;// && !TypeImpls.isTupleTypeEqual(property, TypeImpls.constants.Bottom);
    }

    getFailureMessage() {
        var message:string;
        var useSimpleMessage = false;
        if(useSimpleMessage){
            message = util.format(".%s does not exist on object", this.name);
        }else{
            message = util.format(".%s does not exist on object %s", this.name, TypeImpls.toPrettyString(new TypeImpls.TupleTypeImpl([this.type])));
        }
        return message;
    }
}

class IsAssignmentCompatibleConstraint implements Constraint {
    public kind = ConstraintKinds.IsAssignmentCompatible;

    constructor(public element:TraceElement, private to:TupleType, private from:TupleType, private assignmentCompatibilityCheck:(t1:TupleType, t2:TupleType) => boolean, private message:string) {

    }

    isSatisfied() {
        return this.assignmentCompatibilityCheck(this.to, this.from);
    }

    getFailureMessage() {
        //return util.format("Invalid assignment: \n%s\n\t:=\n%s", TypeImpls.toPrettyString(this.to), TypeImpls.toPrettyString(this.from));
        return util.format(this.message);
    }
}
class PrototypalAssignmentConstraint implements Constraint {
    public kind = ConstraintKinds.PrototypalAssignment;

    constructor(public element:TraceElement, private prototypeAllocationScope: ScopeID, private currentScope: ScopeID){
    }

    isSatisfied() {
        var satisfied = this.prototypeAllocationScope === this.currentScope;
        if(!satisfied){
            console.warn(this.getFailureMessage());
        }
        console.log("Prototypal check: %s vs %s => %s", this.prototypeAllocationScope, this.currentScope, satisfied)
        return satisfied;
    }

    getFailureMessage() {
        return "Invalid .prototype assignment: rhs is not prototypal";
    }
}
class PrototypePropertiesConstraint implements Constraint {
    public kind = ConstraintKinds.PrototypePropertyInvariance;

    constructor(public element:TraceElement, private instanceType:TupleType, private prototypeType:TupleType, private assignmentCompatibilityCheck:(t1:TupleType, t2:TupleType) => boolean) {

    }

    isSatisfied() {
        if (TypeImpls.TupleAccess.isNull(this.prototypeType) && !TypeImpls.TupleAccess.isObject(this.prototypeType)) {
            return true;
        }
        var undefinedType = new TypeImpls.TupleTypeImpl([TypeImpls.constants.BooleanTop]);
        var nullType = new TypeImpls.TupleTypeImpl([TypeImpls.constants.NullTop]);
        var instance = TypeImpls.TupleAccess.getObject(this.instanceType);
        if(TypeImpls.TupleAccess.isObject(this.prototypeType)) {
            var prototype = TypeImpls.TupleAccess.getObject(this.prototypeType);
            for (var name in instance.properties) {
                if (Misc.isAbstractFieldName(name)) { // FIXME this should not be required. Prototypes should not have abstract field names...
                    continue;
                }
                // the .prototype property is guaranteed to be variant wrt. the .prototype property in the prototype - otherwise there would be no need for the prototype...
                if (name === 'prototype') {
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(prototype.properties, name)) {
                    var prototypeProperty = prototype.properties[name];
                    var instanceProperty = instance.properties[name];
                    // TODO simplify this, exploit that SJS ignores undefined & null on merge..
                    if (TypeImpls.isTupleTypeEqual(undefinedType, prototypeProperty) ||
                        TypeImpls.isTupleTypeEqual(undefinedType, instanceProperty) ||
                        (TypeImpls.isTupleTypeEqual(nullType, prototypeProperty) && TypeImpls.TupleAccess.isObject(instanceProperty)) ||
                        (TypeImpls.isTupleTypeEqual(nullType, instanceProperty) && TypeImpls.TupleAccess.isObject(prototypeProperty))) {
                        continue;
                    }
                    // FIXME: This check ignores function types completely
                    var isCompatible = TypeImpls.isTupleTypeEqualIgnoringFunctionReceivers(prototypeProperty, instanceProperty);
                    if (!isCompatible) {
                        if (FIND_TYPE_ERROR_SOURCE) {
                            console.log("Mismatch found at .%s: %s vs. %s", name, TypeImpls.toPrettyString(prototypeProperty), TypeImpls.toPrettyString(instanceProperty));
                            TypeImpls.isTupleTypeEqual(prototypeProperty, instanceProperty, true);
                        }
                        return false;
                    }
                }
            }
        }
        return true;
    }

    getFailureMessage() {
        return util.format("Instance property types are not invariant wrt. the prototype properties");
    }
}
class ExpressionMonitorVisitor implements TraceExpressionVisitor<void> {

    constructor(private variables:Variables<TupleType>, private constraints:Constraints, private assignmentCompatibilityCheck:(t1:TupleType, t2:TupleType) => boolean, private nextInfo:NextInfo, private enableSJSChecks:boolean) {
    }

    visitRead(e:Read):void {
        if(e.source.named) {
          // console.log("%s :: %s", e.source.name, TypeImpls.toPrettyString(this.variables.read(e.source)));
        }
    }

    visitFieldRead(e:FieldRead):void {
        var dynamic = this.nextInfo.nextFieldAccessIsDynamic;
        this.nextInfo.nextFieldAccessIsDynamic = false;

        var base = this.variables.read(e.base);
        var isObjectConstraint = new IsObjectConstraint(e, base);
        this.constraints.addErrorConstraint(isObjectConstraint);
        this.constraints.addWarningConstraint(new IsNotTopConstraint(e, base));
        if (TypeImpls.TupleAccess.isObject(base)) {
            var baseObject = TypeImpls.TupleAccess.getObject(<TupleType>base);
            var fieldName = Misc.fieldNameAbstraction(e.fieldName, baseObject.objectClassification);
            if (this.enableSJSChecks) {
                this.constraints.addErrorConstraint(new IsClassificationValidAccessConstraint(e, baseObject, fieldName, dynamic, false));
            }
            this.constraints.addErrorConstraint(new PropertyExistsConstraint(e, baseObject, fieldName));
        }else{
            this.constraints.addErrorConstraint(new PropertyExistsConstraint(e, undefined, "XXX"));
        }
    }

    visitNew(e:New):void {
    }

    visitPrimitiveExpression(e:PrimitiveExpression):void {
    }
}

class StatementMonitorVisitor implements TraceStatementVisitor<void> {
    private scopeIDStack: ScopeID[] = [];
    private expressionVisitor:ExpressionMonitorVisitor;

    private nextInfo:NextInfo = {
        nextFieldAccessIsDynamic: false,
        nextNewIsArray: false,
        nextNewIsDotPrototype: false,
        nextNewIsFunction: false,
        nextNewIsArguments: false,
        nextNewIsInternalConstructorThis: false
    };

    // a stack of allowed function return types, obtained by finding maching signatures for the actual arguments
    private allowedCallReturnTypeStack:TupleType[][] = [];

    constructor(private variables:Variables<TupleType>, private constraints:Constraints, private assignmentCompatibilityCheck:(t1:TupleType, t2:TupleType) => boolean, private inferredEnv:Variables<TupleType>, private lattice:CompleteLattice<TupleType>, private enableSJSChecks:boolean) {
        this.expressionVisitor = new ExpressionMonitorVisitor(variables, constraints, assignmentCompatibilityCheck, this.nextInfo, enableSJSChecks);
    }

    visitWrite(e:Write):void {
        var lhsType = this.variables.read(e.sink);
        var that = this;
        e.rhs.applyExpressionVisitor(this.expressionVisitor);
        e.rhs.applyExpressionVisitor({
            visitRead() {
            },
            visitFieldRead() {
            },
            visitNew(e:New) {
                if (that.enableSJSChecks) {
                    var prototypeType = that.variables.read(e.proto);
                    that.constraints.addErrorConstraint(new PrototypePropertiesConstraint(e, lhsType, prototypeType, that.assignmentCompatibilityCheck))
                }
            },
            visitPrimitiveExpression() {

            }
        });
    }

    visitFieldWrite(e:FieldWrite):void {
        var scopeIDStack = this.scopeIDStack;
        function getCurrentScopeID(){
            return scopeIDStack.length === 0? 'global': scopeIDStack[scopeIDStack.length - 1];
        }

        var base = this.variables.read(e.base);
        var dynamic = this.nextInfo.nextFieldAccessIsDynamic;
        this.nextInfo.nextFieldAccessIsDynamic = false;

        var isFunctionPrototypeField = e.fieldName === 'prototype' && TypeImpls.TupleAccess.isFunction(base);
        if (e.isInitializer) {
            if (this.enableSJSChecks) {
                if (isFunctionPrototypeField) {
                    // initial prototypes are OK due to the syntactic SJS hack
                    return;
                }
            } else {
                return; // initializers can not produce type errors...
            }
        }

        var rhs = this.variables.read(e.rhs);
        var isObjectConstraint = new IsObjectConstraint(e, base);
        this.constraints.addErrorConstraint(isObjectConstraint);
        this.constraints.addWarningConstraint(new IsNotTopConstraint(e, base));


        if (TypeImpls.TupleAccess.isObject(base)) {
            var baseObject = TypeImpls.TupleAccess.getObject(base);
            var fieldName = Misc.fieldNameAbstraction(e.fieldName, baseObject.objectClassification);
            if (this.enableSJSChecks) {
                if (!e.isInitializer) {
                    this.constraints.addErrorConstraint(new PropertyIsWritableConstraint(e, baseObject, e.fieldName /* not the abstracted name! */));
                }
                this.constraints.addErrorConstraint(new IsClassificationValidAccessConstraint(e, baseObject, fieldName, dynamic, e.isInitializer));
            }

            var propertyExistsConstraint = new PropertyExistsConstraint(e, baseObject, fieldName);
            this.constraints.addErrorConstraint(propertyExistsConstraint);
            if (propertyExistsConstraint.isSatisfied()) {
                var propertyType = baseObject.properties[fieldName];
                if (propertyType === undefined) {
                    propertyType = TypeImpls.constants.Bottom;
                }

                if (this.enableSJSChecks && isFunctionPrototypeField) {
                    if(TypeImpls.TupleAccess.isObject(rhs)) {
                        // console.log("Assigning .prototype: %s", TypeImpls.toPrettyString(rhs));
                        var allocationScope:ScopeID = SJS.getObjectAllocationContext(TypeImpls.TupleAccess.getObject(rhs));
                        var currentScope = getCurrentScopeID();
                        // console.log("Prototype allocation scopeID: %s, current scopeID: %s.", allocationScope, currentScope);
                        this.constraints.addErrorConstraint(new PrototypalAssignmentConstraint(e, allocationScope, currentScope));
                    }
                }else {
                    var message:string;
                    var useSimpleMessage = false;
                    if(useSimpleMessage) {
                        message = "Invalid assignment to ." + fieldName;
                    }else{
                        message = util.format("Invalid assignment to .%s of type %s with type %s on %s", fieldName, TypeImpls.toPrettyString(propertyType), TypeImpls.toPrettyString(rhs), TypeImpls.toPrettyString(base));
                    }
                    var isAssignmentCompatibleConstraint = new IsAssignmentCompatibleConstraint(e, propertyType, rhs, this.assignmentCompatibilityCheck, message);
                    this.constraints.addErrorConstraint(isAssignmentCompatibleConstraint);
                }
                //if(!isAssignmentCompatibleConstraint.isSatisfied()){
                //    throw new Error("Incompatibility for ." + fieldName);
                //}
            }
        }
    }

    visitDelete(e:Delete):void {
        var base = this.variables.read(e.base);
        var isObjectConstraint = new IsObjectConstraint(e, base);
        this.constraints.addErrorConstraint(isObjectConstraint);
        if (this.enableSJSChecks && TypeImpls.TupleAccess.isObject(base)) {
            var baseObject = TypeImpls.TupleAccess.getObject(base);
            var fieldName = Misc.fieldNameAbstraction(e.fieldName, baseObject.objectClassification);
            this.constraints.addErrorConstraint(new PropertyExistsConstraint(e, baseObject, fieldName));
            this.constraints.addErrorConstraint(new PropertyIsWritableConstraint(e, baseObject, e.fieldName /* not the abstracted name! */));
            this.constraints.addErrorConstraint(new IsNotClassifiedAsObjectConstraint(e, baseObject));
        }
        this.constraints.addWarningConstraint(new IsNotTopConstraint(e, base));
    }

    visitInfo(e:Info):void {
        var scopeIDStack = this.scopeIDStack;

        var func:TupleType;
        var base:TupleType;
        var isFunction = false;

        if (e.kind === AST.InfoKinds.ForInObject && this.enableSJSChecks) {
            var iterable = this.variables.read(e.properties.sourceTmp);
            var isObjectConstraint = new IsObjectConstraint(e, iterable);
            this.constraints.addErrorConstraint(isObjectConstraint);
            if (TypeImpls.TupleAccess.isObject(iterable)) {
                this.constraints.addErrorConstraint(new IsNotClassifiedAsObjectConstraint(e, TypeImpls.TupleAccess.getObject(iterable)));
            }
        }

        if (e.kind === AST.InfoKinds.NextFieldAccessIsDynamic) {
            this.nextInfo.nextFieldAccessIsDynamic = true;
        }

        if(e.kind === AST.InfoKinds.FunctionEnter) {
            scopeIDStack.push(e.properties.scopeID);
        }
        if (e.kind === AST.InfoKinds.FunctionReturn) {
            scopeIDStack.pop();
        }

        if (e.properties.baseTmp !== undefined) {
            base = this.variables.read(e.properties.baseTmp);
            this.constraints.addErrorConstraint(new IsObjectConstraint(e, base)); // FIXME undefined / null
            this.constraints.addWarningConstraint(new IsNotTopConstraint(e, base));
        }
        if (e.properties.functionTmp !== undefined) {
            func = this.variables.read(e.properties.functionTmp);
            var isFunctionConstraint = new IsFunctionConstraint(e, func);
            isFunction = isFunctionConstraint.isSatisfied();
            this.constraints.addErrorConstraint(isFunctionConstraint);
            this.constraints.addWarningConstraint(new IsNotTopConstraint(e, func));
        }

        if (isFunction) {
            var funcType = TypeImpls.TupleAccess.getFunction(func);
            switch (e.kind) {
                case  AST.InfoKinds.FunctionEnter:
                case  AST.InfoKinds.FunctionInvocation:
                {
                    var base = this.variables.read(e.properties.baseTmp);
                    if (this.enableSJSChecks && e.kind === AST.InfoKinds.FunctionInvocation && TypeImpls.TupleAccess.isObject(base) && !e.properties.isConstructorCall /* constructing abstarct objects is OK */) {
                        var abstractnessConstraint = new IsNotAbstractReceiverConstraint(e, TypeImpls.TupleAccess.getObject(base));
                        this.constraints.addErrorConstraint(abstractnessConstraint);
                    }

                    var args = e.properties.argsTmps.map(argTmp => {
                        var arg = this.variables.read(argTmp);
                        if (arg === undefined) {
                            throw new Error("Undefined argument?!");
                        }
                        // FIXME introduce TypeError for this?
                        // We do not allow under approximations for finding matching function signatures
                        arg = this.lattice.lub(arg, this.inferredEnv.read(argTmp));
                        return arg;
                    });
                    var isTop = false;
                    var isBottom = false;
                    var potentialMatches:SingleFunctionType[];
                    switch (funcType.functionKind) {
                        case TypeImpls.FunctionKinds.Single:
                            potentialMatches = [<SingleFunctionType>funcType];
                            break;
                        case TypeImpls.FunctionKinds.Intersection:
                            potentialMatches = ((<IntersectionFunctionType>funcType).members).slice();
                            break;
                        case TypeImpls.FunctionKinds.Top:
                            isTop = true;
                            potentialMatches = [];
                            break;
                        case TypeImpls.FunctionKinds.Bottom:
                            isBottom = true;
                            potentialMatches = [];
                            break;
                        default:
                            throw new Error("Unhandled kind: " + funcType.functionKind);

                    }
                    var matches = potentialMatches.filter(potentialMatch => {
                        var baseMatch = this.assignmentCompatibilityCheck(potentialMatch.base, base);
                        if (!baseMatch) {
                            if (FIND_TYPE_ERROR_SOURCE) {
                                console.log("Mismatch found for one function at base, expected %s, got %s", TypeImpls.toPrettyString(potentialMatch.base), TypeImpls.toPrettyString(base));
                            }
                            return false;
                        }
                        if (potentialMatch.args.length !== args.length) {
                            return false;
                        }
                        for (var i = 0; i < args.length; i++) {
                            var arg = args[i];
                            var potentialMatchedArg = potentialMatch.args[i];
                            // console.log("checking argument compatibility:: param=%s, arg=%s", TypeImpls.toPrettyString(potentialMatchedArg), TypeImpls.toPrettyString(arg));
                            if (!this.assignmentCompatibilityCheck(potentialMatchedArg, arg)) {
                                return false;
                            }
                        }
                        return true;
                    });
                    if (e.kind === AST.InfoKinds.FunctionEnter) {
                        var allowedReturnTypes = matches.map(match => match.result);
                        if (isTop) {
                            allowedReturnTypes.push(TypeImpls.constants.Top);
                        }
                        this.allowedCallReturnTypeStack.push(allowedReturnTypes);
                    }
                    if (e.kind === AST.InfoKinds.FunctionInvocation) {
                        this.constraints.addErrorConstraint(new IsSuccessfullCallConstraint(e, base, args, matches, potentialMatches));
                        this.constraints.addWarningConstraint(new IsNotTopFunctionConstraint(e, funcType));
                    }
                    break;
                }
                case AST.InfoKinds.FunctionReturn:
                {
                    var allowedTypes:TupleType[] = this.allowedCallReturnTypeStack.pop();
                    var result = this.variables.read(e.properties.resultTmp);
                    this.constraints.addErrorConstraint(new IsSuccessfullReturnConstraint(e, result, allowedTypes, this.assignmentCompatibilityCheck));
                    break;
                }
                case AST.InfoKinds.FunctionResult:
                    break;
                default:
                    throw new Error("Unhandled kind" + e.kind);
            }
        }
    }
}

/**
 * Performs misc. type checks on a trace where all variables has been assigned a type.
 */
export function

check(statements:TraceStatement[], variables:Variables<TupleType>, inferredEnv:Variables<TupleType>, lattice:CompleteLattice<TupleType>, enabledConstraints:ConstraintKinds[] = [], enableSJSChecks:boolean = false):IIDRelatedConstaintFailureMessage[] {
    if (enabledConstraints.length === 0) {
        for (var k in ConstraintKinds) {
            if (!isNaN(parseInt(k))) {
                enabledConstraints.push(parseInt(k));
            }
        }
    }
    var enabledConstraintsSet = new Set<ConstraintKinds>();
    enabledConstraints.forEach(e => {
        enabledConstraintsSet.add(e);
    });

    var replayState = {
        currentTraceIndex: 0
    };
    var messages:IIDRelatedConstaintFailureMessage[] = [];
    var errorCount = 0;
    var warningCount = 0;
    var logger:Logger = {
        error(iid:string, message:string, constraintKind:ConstraintKinds) {
            messages.push({message: message, iid: iid, type: 'error', constraintKind: constraintKind});
            errorCount++;
            if (errorCount % 10000 === 0) {
                console.warn("%d type errors ...", errorCount);
            }

        },
        warning(iid:string, message:string, constraintKind:ConstraintKinds) {
            messages.push({message: message, iid: iid, type: 'warning', constraintKind: constraintKind});
            warningCount++;
            if (warningCount % 10000 === 0) {
                console.warn("%d type warnings ...", warningCount);
            }
        }
    };
    var constraints:Constraints = {
        addErrorConstraint(constraint:Constraint) {
            var satisfied = constraint.isSatisfied();
            if (!satisfied && enabledConstraintsSet.has(constraint.kind)) {
                var message = constraint.getFailureMessage();
                logger.error(constraint.element.meta.iid, message, constraint.kind);
                if (FIND_TYPE_ERROR_SOURCE)
                    throw new Error("Finding type error source ... (" + ConstraintKinds[constraint.kind] + ")");
            }
        },
        addWarningConstraint(constraint:Constraint) {
            if (!constraint.isSatisfied() && enabledConstraintsSet.has(constraint.kind)) {
                logger.warning(constraint.element.meta.iid, constraint.getFailureMessage(), constraint.kind);
            }
        }
    }

    function assignmentCompatibilityCheck(lhs:TupleType, rhs:TupleType) {
        var origLhs = lhs;
        var undefType = new TypeImpls.TupleTypeImpl([TypeImpls.constants.UndefinedTop]);
        var nullType = new TypeImpls.TupleTypeImpl([TypeImpls.constants.NullTop]);

        // extend lhs in various ways:
        // 1. undefined always allowed
        if (TypeImpls.TupleAccess.isUndefined(rhs)) {
            lhs = lattice.lub(lhs, undefType);
        }

        // 2. null is allowed for objects
        if (TypeImpls.TupleAccess.isObject(lhs) && TypeImpls.TupleAccess.isNull(rhs)) {
            lhs = lattice.lub(lhs, nullType);
        }

        // 3. objects are allowed for null
        if (TypeImpls.TupleAccess.isNull(lhs) && !TypeImpls.TupleAccess.isObject(lhs) && TypeImpls.TupleAccess.isObject(rhs)) {
            lhs = lattice.lub(lhs, new TypeImpls.TupleTypeImpl([TypeImpls.TupleAccess.getObject(rhs)]));
        }

        var lub = lattice.lub(lhs, rhs);

        var compatible = TypeImpls.isTupleTypeEqual(lub, lhs);
        // console.log("assignmentCompatibility(%s, %s) = %s", TypeImpls.toPrettyString(to), TypeImpls.toPrettyString(from), compatible);
        if (!compatible) {
            if (FIND_TYPE_ERROR_SOURCE) {
                console.log("Not assignment compatible: %s u %s = %s", TypeImpls.toPrettyString(origLhs), TypeImpls.toPrettyString(rhs), TypeImpls.toPrettyString(lub))
                TypeImpls.isTupleTypeEqual(lub, lhs, true)
            }
        }
        return compatible;
    }

    var monitorVisitor = new StatementMonitorVisitor(variables, constraints, assignmentCompatibilityCheck, inferredEnv, lattice, enableSJSChecks);
    statements.forEach(function (statement) {
        if (FIND_TYPE_ERROR_SOURCE) {
            console.log(statement.toString());
        }
        statement.applyStatementVisitor(monitorVisitor);
        replayState.currentTraceIndex++;
        if (replayState.currentTraceIndex % 10000 === 0) {
            console.log("Type checked %d statements", replayState.currentTraceIndex);
        }
    });
    return messages;
}

export
enum
ConstraintKinds {
    IsNotTop,
    IsObject,
    IsFunction,
    PropertyExists,
    IsAssignmentCompatible,
    IsSuccessfulCall,
    IsSuccessfulReturn,
    IsNotClassifiedAsObject,
    PropertyIsWritable,
    IsClassificationValidAccess,
    PrototypePropertyInvariance,
    PrototypalAssignment,
    IsAbstractObject
}
export interface IIDRelatedConstaintFailureMessage extends IIDRelatedMessage {
    constraintKind: ConstraintKinds
}
