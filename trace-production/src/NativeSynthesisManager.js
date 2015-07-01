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
function isPrimitive(val) {
    var type = typeof val;
    return type === "string" || type === "number" || type === "boolean" || type === "undefined" || val === null;
}
var nativeConstructors = (function () {
    var typedArrays = new Set();
    [Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray, ArrayBuffer, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array].forEach(function (constructor) {
        typedArrays.add(constructor);
    });

    return {
        typedArrays: typedArrays
    }
})();

var specialGetterProperties = (function () {
    var NUMBER = 0;
    var IGNORE = undefined;

    function add(obj, prop, value) {
        if (!instanceMap.has(obj)) {
            instanceMap.set(obj, new Map());
        }
        instanceMap.get(obj).set(prop, value);
    }

    var instanceMap = new Map();
    /* constructor -> property name -> primitive value */
    var buffers = [];
    nativeConstructors.typedArrays.forEach(function (a) {
        buffers.push(a);
    });
    buffers.push(DataView);
    buffers.forEach(function (a) {
        add(a.prototype, 'buffer', IGNORE);
        add(a.prototype, 'byteOffset', NUMBER);
        add(a.prototype, 'byteLength', NUMBER);
        add(a.prototype, 'length', NUMBER);
    });

    add(Symbol, 'iterator', IGNORE);
    add(Symbol, 'unscopables', IGNORE);

    [Set, WeakSet, Map, WeakMap].forEach(function (v) {
        add(v, 'size', NUMBER)
    });

    add(require('stream').Writable.WritableState, 'buffer', IGNORE);
    add(require('net').Socket, 'bytesWritten', NUMBER);

    return instanceMap;
})();
var DEBUG_INITIALIZERS = false;
var initializerDebugStack = [];
var isSpecialObjectGetter = function (obj, propertyName) {
    return specialGetterProperties.has(obj) && specialGetterProperties.get(obj).has(propertyName);
};
var isSpecialConstructorGetter = function (obj, propertyName) {
    var cns = obj.constructor;
    return specialGetterProperties.has(cns) && specialGetterProperties.get(cns).has(propertyName);
};
function isSpecialGetter(obj, propertyName) {
    return isSpecialObjectGetter(obj, propertyName) || isSpecialConstructorGetter(obj, propertyName);
}
function getSpecialGetterValue(obj, propertyName) {
    if (isSpecialObjectGetter(obj, propertyName)) {
        return specialGetterProperties.get(obj).get(propertyName);
    }
    return specialGetterProperties.get(obj.constructor).get(propertyName);
}

function isTypedArray(obj) {
    // (not optimal speed, but not a bottleneck)
    var is = false;
    nativeConstructors.typedArrays.forEach(function (k) {
        if (obj instanceof k) {
            is = true;
        }
    });
    return is;
};

function isArray(obj) {
    return Array.isArray(obj) || (isTypedArray(obj));
}

/**
 * Synthesises the native environment
 */
function NativeSynthesisManager(traceBuilder) {
    // TODO should use var naming scheme like non-native functions do! ==> treated in the same way during replay/propagation, including the precise-flow-variables usage

    var tmpManager = undefined; // set explicitly through a setter.
    var merges = new WeakMap/*<Object, MergeTemporary>*/();
    var allocations = new WeakMap/*<Object, AllocationTemporary>*/();
    var initialized = new WeakMap/*<Object, DUMMY>*//*used as a set*/();
    var allocationCount = 0;
    var mergeVarCount = 0;
    var callStackReflectionProperties = new Set();
    var maxAllocationDepth = 5;

    ['arguments', 'caller', 'callee'].forEach(function (n) {
        callStackReflectionProperties.add(n);
    });
    /**
     * Synthesises flow for Array operations that move values without creating new values.
     * Extend as needed.
     */
    var models = (function () {
        var modeledFunctions = new Set();
        var arrayMutatorFunctions = new Set();
        [Array.prototype.pop, Array.prototype.push, Array.prototype.reverse, Array.prototype.shift, Array.prototype.sort, Array.prototype.splice, Array.prototype.unshift].forEach(function (f) {
            arrayMutatorFunctions.add(f);
            modeledFunctions.add(f);

        });
        var arrayCreatorFunctions = new Set();
        [Array.prototype.concat, Array.prototype.filter, Array.prototype.slice].forEach(function (f) {
            arrayCreatorFunctions.add(f);
            modeledFunctions.add(f);

        });
        var otherFunctions = new Set();
        [Object.defineProperty].forEach(function (f) {
            otherFunctions.add(f);
            modeledFunctions.add(f);

        });

        var operationCount = 0;
        var arrrayOpCounter = 0;

        // 1-1 correspondance between original value index and temporary index
        var origArrayStack = [];
        var origTmpsStack = [];

        function isArrayMutator(operationFun) {
            return arrayMutatorFunctions.has(operationFun);
        }

        function isArrayCreator(operationFun) {
            return arrayCreatorFunctions.has(operationFun);
        }

        function isArrayOperation(operationFun) {
            return isArrayMutator(operationFun) || isArrayCreator(operationFun);
        }

        return {
            requiresModel: function (operationFun) {
                return modeledFunctions.has(operationFun);
            },
            beginOperation: function (operationFun, baseTmp, base, iid) {
                if (isArrayOperation(operationFun) && typeof base !== 'string' /* array operations work on everything with a .length property..., but we do not want to model the indexable string here... */) {
                    // record the original array
                    origArrayStack.push(Array.prototype.slice.call(base));
                    var tmpCount = 0;
                    var tmps = [];
                    for (var i = 0; i < base.length; i++) {
                        var tmp = tmpManager.getIntermediaryTmp('array-operation-' + operationCount + '-' + tmpCount++);
                        traceBuilder.makeFieldReadStatement(baseTmp, i + '', tmp, iid);
                        tmps.push(tmp);
                    }
                    origTmpsStack.push(tmps);
                }
                operationCount++;
            },
            endOperation: function (operationFun, baseTmp, base, operationResultTmp, operationResult, argsTmps, args, iid) {
                if (isArrayOperation(operationFun)) {
                    if (typeof base === 'string') {
                        /* do nothing, the string is immutable, and the result has already been allocated elsewhere */
                    } else {
                        modelArrayOperation();
                    }
                } else if (operationFun === Object.defineProperty) {
                    var objectTmp = argsTmps[0];
                    var name = args[1];
                    var descriptor = args[2];
                    var descriptorTmp = argsTmps[2];
                    if (descriptor.get || descriptor.set) {
                        // console.warn("Defining getter/setter for .%s", name);
                        throw new Error("Getters & setter definitions are not supported!")
                    }
                    var valueTmp = tmpManager.getIntermediaryTmp('defineProperty-' + operationCount);
                    var primitiveResultTmp;
                    if (isPrimitive(descriptor.value)) {
                        primitiveResultTmp = tmpManager.getIntermediaryTmp("primitiveResult");
                        traceBuilder.makePrimitiveStatement(descriptor.value, primitiveResultTmp, iid)
                    }
                    traceBuilder.makeFieldReadStatement(descriptorTmp, 'value', valueTmp, primitiveResultTmp ? {fieldReadPrimitiveResultTmp: primitiveResultTmp} : undefined, iid);
                    traceBuilder.makeFieldWriteStatement(objectTmp, name, valueTmp, false, iid);
                }

                /**
                 * Array operations share most of their implementation, stash them away in their own function...
                 */
                function modelArrayOperation() {
                    var isMutator = isArrayMutator(operationFun);

                    var targetArrayTmp = isMutator ? baseTmp : operationResultTmp;
                    var targetArray = isMutator ? base : operationResult;

                    var argsCopy = Array.prototype.slice.call(args);
                    if (origArrayStack.length === 0 || origTmpsStack.length === 0) {
                        throw new Error("Popping of empty stack");
                    }
                    var origArray = origArrayStack.pop();
                    var tmps = origTmpsStack.pop();
                    var originalLength = origArray.length;

                    // special cases:
                    if (operationFun === Array.prototype.push) {
                        for (var i = 0; i < argsTmps.length; i++) {
                            traceBuilder.makeFieldWriteStatement(targetArrayTmp, originalLength + i, argsTmps[i], false, iid);
                        }
                        // done
                        return;
                    }
                    if (operationFun === Array.prototype.unshift) {
                        // move the existing elements
                        var numberOfNewElements = argsCopy.length;
                        for (var i = originalLength - 1; i >= 0; i--) {
                            var existingValueTmp = tmpManager.getIntermediaryTmp('array-unshift-' + i + '-' + arrrayOpCounter++);
                            traceBuilder.makeFieldReadStatement(targetArrayTmp, i, existingValueTmp, iid);
                            traceBuilder.makeFieldWriteStatement(targetArrayTmp, i + numberOfNewElements, existingValueTmp, false, iid);
                        }
                        // insert the new elements
                        for (var i = 0; i < numberOfNewElements; i++) {
                            traceBuilder.makeFieldWriteStatement(targetArrayTmp, i, argsTmps[i], false, iid);
                        }// done
                        return;
                    } else if (operationFun === Array.prototype.concat) {
                        var concatArgs = [base].concat(argsCopy);
                        var currentLength = 0;
                        var concatArgsTmps = [baseTmp].concat(argsTmps);
                        for (var i = 0; i < concatArgs.length; i++) {
                            var arg = concatArgs[i];
                            var argTmp = concatArgsTmps[i];
                            if (isArray(arg)) {
                                for (var arrayArgIndex = 0; arrayArgIndex < arg.length; arrayArgIndex++) {
                                    var arrayArgIndexValueTmp = tmpManager.getIntermediaryTmp('array-concat-' + i + '-' + arrrayOpCounter++);
                                    traceBuilder.makeFieldReadStatement(argTmp, arrayArgIndex, arrayArgIndexValueTmp, iid);
                                    traceBuilder.makeFieldWriteStatement(targetArrayTmp, currentLength, arrayArgIndexValueTmp, true, iid);
                                    currentLength++;
                                }
                            } else {
                                traceBuilder.makeFieldWriteStatement(targetArrayTmp, currentLength, argTmp, true, iid);
                                currentLength++;
                            }
                        }
                        // done
                        return;
                    } else if (operationFun === Array.prototype.splice) {
                        // add some more values/tmps to the relocation array
                        for (var i = 2 /* skip the first two arguments of the splice call! */; i < argsTmps.length; i++) {
                            tmps.push(argsTmps[i]);
                            origArray.push(args[i]);
                        }
                    }

                    // approximate array function behaviour by moving property values around according to the pre/post state
                    for (var newIndex = 0; newIndex < targetArray.length; newIndex++) {
                        if (targetArray.hasOwnProperty(newIndex)) {
                            var value = targetArray[newIndex];
                            var valueTmp;
                            if (isPrimitive(value)) {
                                valueTmp = tmpManager.getIntermediaryTmp("primitive-move-" + operationCount + '-' + newIndex);
                                traceBuilder.makePrimitiveStatement(value, valueTmp, iid);
                            } else {
                                var oldIndex = origArray.indexOf(value);
                                delete origArray[oldIndex]; // avoid re-using indices for duplicate values
                                if (oldIndex === -1) {
                                    throw new Error("Value at index " + newIndex + " not in original array! (" + value + ")" + "(operation: " + operationFun + ")");
                                }
                                valueTmp = tmps[oldIndex];
                            }
                            // console.log("\tMoving from index %d to index %d", oldIndex, newIndex);
                            traceBuilder.makeFieldWriteStatement(targetArrayTmp, newIndex, valueTmp, !isMutator, iid);
                        }
                    }
                    if (isMutator) {
                        for (var i = 0; i < originalLength; i++) {
                            if (!targetArray.hasOwnProperty(i)) {
                                // console.log("\tDeleting index %d", i)
                                traceBuilder.makeDeleteStatement(targetArrayTmp, i + '', iid);
                            }
                        }
                    }
                }
            }
        }
    })();

    function allocateObject_direct(object, prototypeTmp, iid, isDotPrototype) {
        var allocationTmp = getNextAllocationTmp();
        if (Object.prototype.toString.call(object) === '[object Arguments]') {
            traceBuilder.infoBuilder.makeNextNewIsArguments(iid);
        }
        if (isArray(object)) {
            traceBuilder.infoBuilder.makeNextNewIsArray(iid);
        }
        if (typeof object === 'function') {
            traceBuilder.infoBuilder.makeNextNewIsFunction(iid);
        }
        if (isDotPrototype) {
            traceBuilder.infoBuilder.makeNextNewIsDotPrototype(iid);
        }
        traceBuilder.makeNewStatement(prototypeTmp, allocationTmp, iid);
        allocations.set(object, allocationTmp);
        return {object: object, objectTmp: allocationTmp}
    }

    function allocateObjectAndPrototypeChainWithoutInitialization(object, iid, isDotPrototype) {
        if (allocations.has(object)) {
            return [{object: object, objectTmp: allocations.get(object)}];
        }

        var proto = object.__proto__;

        var protochain;
        var prototypeTmp;
        if (isPrimitive(proto)) {
            protochain = [];
            prototypeTmp = allocatePrimitive(proto, iid);
        } else {
            protochain = allocateObjectAndPrototypeChainWithoutInitialization(proto, iid, false);
            prototypeTmp = protochain[0].objectTmp;
        }
        return [allocateObject_direct(object, prototypeTmp, iid, isDotPrototype)].concat(protochain);
    }

    function allocatePrimitive(primitive, iid) {
        var temporary = tmpManager.getIntermediaryTmp("primitive-" + allocationCount++);
        traceBuilder.makePrimitiveStatement(primitive, temporary, iid);
        return temporary;
    }

    function getNextAllocationTmp() {
        return tmpManager.getIntermediaryTmp("allocation-" + allocationCount++);
    }

    function allocateObject(object, allocationDepth, propertyNamesToAvoidInitializing, forcedPrototypeTmp, iid, isDotPrototype) {
        var allocationTmp;
        if (allocations.has(object)) {
            allocationTmp = allocations.get(object);
        } else {
            var objectsToInitialize;
            if (forcedPrototypeTmp) {
                objectsToInitialize = [allocateObject_direct(object, forcedPrototypeTmp, iid, isDotPrototype)];
            } else {
                objectsToInitialize = allocateObjectAndPrototypeChainWithoutInitialization(object, iid, isDotPrototype);
            }
            objectsToInitialize.forEach(function (toInitializePair, index) {
                initializeFields(toInitializePair.object, toInitializePair.objectTmp, index === 0 ? propertyNamesToAvoidInitializing : []/* avoid some properties on the first object */, iid, allocationDepth + 1);
            });
            allocationTmp = objectsToInitialize[0].objectTmp;
        }
        // console.log("allocationCount: %d:", allocationCount);
        return allocationTmp;
    }

    function allocateValue(val, allocationDepth, propertyNamesToAvoidInitializing, prototypeTmp, iid, isDotPrototype) {
        allocationDepth = allocationDepth + 1;
        if (isPrimitive(val)) {
            return allocatePrimitive(val, iid);
        }
        return allocateObject(val, allocationDepth, propertyNamesToAvoidInitializing, prototypeTmp, iid, isDotPrototype);
    }

    function initializeFields(obj, objTmp, propertyNamesToAvoidInitializing, iid, allocationDepth) {
        if (!initialized.has(obj)) {
            initialized.set(obj, undefined);

            var propertyNames = Object.getOwnPropertyNames(obj);
            if (typeof obj === 'function' && propertyNames.indexOf('prototype') === -1) {
                traceBuilder.makeFieldWriteStatement(objTmp, 'prototype', allocateValue({constructor: Object}, allocationDepth, undefined, undefined, iid, true), true, iid);
            }
            propertyNames.forEach(function (name) {
                if (name[0] === '_') {
                    // ignore "hidden" properties
                    return;
                }
                if (name === 'J$' || name === '*J$IID*' || name === '*J$SID*' || name === 'acorn' || name === 'esotope') {
                    // ignore Jalangi & the acorn/esotope included by it
                    return;
                }
                if (propertyNamesToAvoidInitializing && propertyNamesToAvoidInitializing.indexOf(name) !== -1) {
                    // Ignore known initializers
                    return;
                }
                if (callStackReflectionProperties.has(name)) {
                    // ignore arguments & co.
                    if (typeof obj === 'function' || (typeof obj === 'object' && Object.prototype.toString.call(obj) === "[object Arguments]")) {
                        return;
                    }
                }

                if (DEBUG_INITIALIZERS) {
                    initializerDebugStack.push(name);
                }
                if (DEBUG_INITIALIZERS) {
                    console.log(initializerDebugStack)
                }
                if (isSpecialGetter(obj, name)) {
                    fieldValue = getSpecialGetterValue(obj, name);
                } else {
                    fieldValue = obj[name];
                }
                var isDotPrototype = typeof obj === 'function' && name === 'prototype';
                traceBuilder.makeFieldWriteStatement(objTmp, name, allocateValue(fieldValue, allocationDepth, undefined, undefined, iid, isDotPrototype), true, iid);
                if (DEBUG_INITIALIZERS) {
                    initializerDebugStack.pop(name);
                }
            });
        }
    }

    return {
        /**
         * Sends a value into the native environment
         */
        toNative: function (val, fromTemporary, iid) {
            if (isPrimitive(val)) {
                return;
            }
            if (!merges.has(val)) {
                // first time sending the value to the native environment
                merges.set(val, tmpManager.getMergeTmp("toNativeMergeVar" + mergeVarCount++));
                //        console.log("mergeVarCount: %d", mergeVarCount);
            }
            traceBuilder.makeMoveStatement(merges.get(val), fromTemporary, iid);
        },
        /**
         * Recovers a value from the native environment
         */
        fromNative: function (val, iid) {
            if (isPrimitive(val)) {
                var temporary = tmpManager.getIntermediaryTmp("primitive-" + (val === null ? "null" : typeof val));
                traceBuilder.makePrimitiveStatement(val, temporary, iid);
                return temporary;
            }
            if (!merges.has(val)) {
                // value has never been sent to the native environment
                return allocateValue(val, 0, undefined, undefined, iid);
            } else {
                // value has been sent to the native environment earlier
                return merges.get(val);
            }
        },
        allocate: function (val, propertyNamesToAvoidInitializing, prototypeTmp, iid) {
            var allocationTmp = allocateValue(val, 0, propertyNamesToAvoidInitializing, prototypeTmp, iid);

            if (!initialized.has(val)) {
                // if the object was allocated shallowly earlier, initialize it fully now
                initializeFields(val, allocationTmp, propertyNamesToAvoidInitializing, iid, 0);
            }
            return allocationTmp;
        },
        initializeFields: function (obj, objTmp, iid) {
            initializeFields(obj, objTmp, undefined, iid);
        },
        init: function (temporaryManager) {
            tmpManager = temporaryManager;
        },
        models: models
    }
}

module.exports = NativeSynthesisManager;
