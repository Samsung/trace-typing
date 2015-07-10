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
import AST = require('../TraceLanguageAST');
import SJS = require('../SJS');

export function getMostRecentShape(instance:Instance) {
    if (instance.shapes === undefined) {
        console.log(instance);
        throw new Error();
    }
    if (instance.shapes.length === 0) {
        throw new Error("No shapes in this instance!?")
    }
    return instance.shapes[instance.shapes.length - 1];
}
/**
 * Immutable* representation of the shape of a JavaScript Object instance at a point in time.
 *
 * *: initial properties of an object can be added as mutations...
 */
export class ShapeImpl implements Shape {
    public meta:TraceElementMetaInformation;

    private prototypeValue:Value;

    private objectClassification:SJS.ObjectClassification = undefined;

    private isDotPrototype:boolean = undefined;

    // no iterator for map entries...
    private propertyNames:string[] = [];
    private propertyValues:Map<string, Value> = new Map<String, Value>();

    // an object can have a single deleted property at a time, the rest are found in the parent
    private deletedPropertyName:string = undefined;


    /**
     * Implementation is delta based. A shape is a delta on some predecessor/parent.
     */
    private parent:Shape = undefined;

    constructor(prototypeObject:Primitive, meta:TraceElementMetaInformation, traceIndex:number, isDotPrototype:boolean); // the Object without a prototype
    constructor(prototypeObject:Instance, meta:TraceElementMetaInformation, traceIndex:number, isArray:boolean, isFunction:boolean, isDotPrototype:boolean, isArguments?: boolean); // fresh object with prototype
    constructor(parent:Instance, meta:TraceElementMetaInformation, traceIndex:number, propertyName:string); // delete property of object
    constructor(parent:Instance, meta:TraceElementMetaInformation, traceIndex:number, propertyName:string, value:Value, dynamicPropertyName:boolean); // assign property on object
    constructor(parentOrPrototype:Value, meta:TraceElementMetaInformation, public traceIndex:number, propertyNameOrIsArray?:string|boolean, valueOrIsFunction?:Value|boolean, dynamicPropertyNameOrIsDotPrototype?:boolean, isArguments?: boolean) {
        var isArray:boolean;
        var propertyName:string;
        if (typeof propertyNameOrIsArray === 'boolean') {
            isArray = propertyNameOrIsArray;
        } else {
            propertyName = propertyNameOrIsArray;
        }
        var value:Value;
        var isFunction: boolean;
        if(typeof valueOrIsFunction === 'boolean'){
            isFunction = valueOrIsFunction;
        }else{
            value = valueOrIsFunction;
        }
        var isDotPrototype = dynamicPropertyNameOrIsDotPrototype
        var dynamicPropertyName = dynamicPropertyNameOrIsDotPrototype;
        this.meta = meta;
        if (parentOrPrototype !== undefined && propertyName !== undefined && value !== undefined) { // mutated object
            var instance = <Instance>parentOrPrototype;
            var parent = getMostRecentShape(instance);
            this.parent = parent;
            if (!parent.hasProperty(propertyName)) {
                this.propertyNames.push(propertyName);
            }
            this.propertyValues.set(propertyName, value);
            if (dynamicPropertyName) {
                this.objectClassification = SJS.ObjectClassification.Map;
            } else {
                this.objectClassification = SJS.ObjectClassification.Object;
            }
            instance.shapes.push(this);
        } else if (parentOrPrototype !== undefined && propertyName !== undefined) { // delete
            var instance = <Instance>parentOrPrototype;
            var parent = getMostRecentShape(instance);
            this.parent = parent;
            this.deletedPropertyName = propertyName;
            instance.shapes.push(this);
        } else { // new object
            this.prototypeValue = parentOrPrototype;
            if (isArray) {
                this.objectClassification = SJS.ObjectClassification.Array;
            }
            if (isArguments) {
                this.objectClassification = SJS.ObjectClassification.Arguments;
            }
            if(isFunction){
                this.objectClassification = SJS.ObjectClassification.Function;
            }
            this.isDotPrototype = isDotPrototype;
        }
    }

    // TODO remove this functionality
    public addInitialProperty(propertyName:string, propertyValue:Value) {
        this.propertyNames.push(propertyName);
        this.propertyValues.set(propertyName, propertyValue);
    }

    public getPrototypeObject():Value {
        return this.parent !== undefined ? this.parent.getPrototypeObject() : this.prototypeValue;
    }

    public hasObjectClassification():boolean {
        return this.objectClassification !== undefined || (this.parent !== undefined && this.parent.hasObjectClassification())
    }

    public getObjectClassification():SJS.ObjectClassification {
        var classification = this.objectClassification;
        if (classification === undefined && this.parent === undefined) {
            throw new Error("No object classification (query with has)!?");
        }
        return (classification === undefined) ? this.parent.getObjectClassification() : classification;
    }

    public getPropertyNames():string[] {
        return this.propertyNames.concat(this.parent !== undefined ? this.parent.getPropertyNames() : []);
    }

    public hasProperty(name:string):boolean {
        if (name == this.deletedPropertyName) {
            return false;
        }
        return this.propertyValues.has(name) || (this.parent !== undefined ? this.parent.hasProperty(name) : false);
    }

    public getPropertyValue(name:string):Value {
        if (this.parent === undefined && !this.propertyValues.has(name)) {
            throw new Error("No such property: " + name);
        }
        return this.propertyValues.has(name) ? this.propertyValues.get(name) : this.parent.getPropertyValue(name);
    }

    public getIsDotPrototype() {
        return this.isDotPrototype === true || (this.parent !== undefined && this.parent.getIsDotPrototype())
    }
}

export class InstanceImpl implements Instance {
    public valueKind = AST.ValueKinds.Object;
    public shapes:Shape[];
    public functionUsages:DynamicFunctionSignature[] = [];

    constructor(initialShape:Shape, public allocationContext: ScopeID) {
        this.shapes = [initialShape];
    }
}

export class PrimitiveImpl implements Primitive {
    public valueKind = AST.ValueKinds.Primitive;

    constructor(public primitiveKind:AST.PrimitiveKind) {
    }
}
