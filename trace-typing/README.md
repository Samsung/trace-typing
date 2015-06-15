# Trace Typing

Applies type systems to the traces produced by the trace-production project.

## Setup

```
$ cd trace-typing
$ npm install
$ npm test
```

Additionally: the project can be built with `grunt build`, and tests can be run with `grunt test`.

## Usage 

### Commandline

The bin/play.sh script provides simple access to using the project, it will produce a and type check a trace according to some configuration. Type errors will be listed in stdout and visualized in a browser:


```
Usage: .bin/play.sh EXPERIMENT_NAME FILE [DIR] [IIDS]
Example usage: ./bin/play.sh typeCheck::flowInsensitiveVariables:ObjectFieldEqualityFunctionIntersection:UnionTypes:UnionTypes::flowInsensitiveVariables  test/fixtures/optparse-singlefile.js

Experiment name structure: Inspection::ObjectLatice:FunctionLattice[:MiscLattice*][::[:Precision]*]

Inspections:
	typeCheck
	none
Object lattices:
	ObjectFieldEquality
	ObjectFieldLubUnderSubtyping
Function lattices:
	FunctionIntersection
	FunctionPointwiseLub
Misc. lattices:
	UnionTypes
Precision:
	flowInsensitiveVariables
	contextInsensitiveVariables
```

Where:

 - EXPERIMENT_NAME is a description of the experiment to run
 
 - FILE is the a JavaScript to get a trace for
 
 - DIR (optional) is a directory that includes FILE and its dependencies
 
 - IIDs (optional) a filter on what locations to get type errors for

### Programmatically
 
- See PlayGroundTests.ts for experimenting with a program and configuration at a time.

- See TypeCheckerTests.ts for experimenting with multiple programs and configurations (used for producing the results of the OOPSLA submission)
 
## Development

The project is a TypeScript project, and needs to be compiled using `grunt build`. The output of the build process is in ./build, it mirrors the original source structure. 

### Architectural overview 

Traces are processed in 6 steps:

 1. Traces are imported, see TraceImporter.ts
 2. Traces are replayed, see TraceReplayer.ts
 3. Types are ascribed, see TypeInferencer.ts 
 4. Types are propagated, see TypedTraceReplayer.ts (not the best name...)
 5. Type checking is performed, see TypeChecker.ts
 6. (Results are explained, see MetaInformationExplainer.ts)

Additional interesting files are:
 - TypeLattices.ts: implements the type lattices
 - SJS.ts: implements major parts of the SJS type system
 - (TypeCheckerTests.ts: collects and displays various statistics for type system experiments (TODO move that logic elsewhere))


### Debugging / Testing

To run all tests, run `$ grunt test` (or in an IDE: make mocha run on the ./build/test directory).

Common bugs, and how to track them down:

#### Non-termination during fix-point computation of type-propagation
 - (It should find a fixpoint within few iterations)
 - This is likely due to a non-monotonicity issue in TypeLattices.ts
 - Set the BUGHUNT variable to `true` in TypedTraceReplayer.ts, it will display information about the variables that keep changing 
 
#### Unexpected type errors
 - Set the FIND_TYPE_ERROR_SOURCE to `true` in TypeChecker.ts, it will stop execution upon the first type error, and display information about its cause
  
### Trace production

The trace-production project is included as a npm dependency. If changes to that project are common, it is recommended do a git clone of the trace-production project and set a symlink to it in node_modules.

Furthermore, the `tracesDirectory` property in ./config.js should be coordinated between the two projects such that all traces produced by trace-production tests can be used as smoke tests for this project.      
     
     
## Misc.

- Can not currently handle very large traces due to memory issues, this could be remedied by an architectural refactoring to something stream based 

- The project depends on nodejs v0.12 due to .forEach usage of Set and Map. This means that  the node flag `--prof` is not available due to https://github.com/joyent/node/issues/14576



# SJS experiment status (SAMSUNG)

## Status

- The SJSTypeCheckerTests.ts displays the features of the SJS type system that are currently supported.
- Objects and Prototype features have been implemented
- Constructor bodies are not inferred (described below)
- MRO/MRW is non-SJS, but similar (described below)
- Function features have not been implemented - (in general, function type inference in a trace is a mess...)

## Constructor caveat

Constructor bodies are not inferred currently. As a consequence: all field-initializers in a constructor body will be marked as invalid assignments to non-existsing properties.

To support constructors, more info-statements are needed in the trace. The info-statements should tell when a constructor call starts and ends.
This information could be leveraged in TraceReplayer.ts to mark all the field-initializers in the constructor body as Initializers in the constructed Shape.
This change would make constructor bodies behave similar to the already working object literals...


## MRO/MRW caveat

MRO/MRW is implemented in a non-SJS way:
 
 1. Thew Writes of a method is the Write part of the read-write split of all receiver objects
 2. The MRW of an object is the union of all Writes of all methods of an object
 3. MRO is computed similarly 
 
This is sufficient for simple tests where some specific MRO/MRW is desired (see SJSTypeCheckerTests.ts), but it is clearly incompatible with SJS.
Consider for example the noop-method, which happens to be invoked on the type `{ a: A | b: B }` -- the noop-method would now provide the `a: A` to the MRO and `b: B` to the MRW...
      
This implementation-choice should be temporary. But it is not straightforward to define the receiver-(write/read)-sets of methods in a trace when the receiver is used outside the method body.
   
## Conclusions about SJS, so far

The constraint "property type invariance wrt. the prototype of an object" is violated in multiple cases, that is of little concern in practice for SJS:
 
- `.prototype` is *not* present on all functions in the native ECMAScript environment, so a prototype-chain of functions violates the constraint. 
 But that is only the case for functions that can *not* be used as constructors (like Object.toString) anyway, so the quick workaround is to force all functions to have at least an empty object as their `.prototype` property in the trace.
- The properties of `.prototype` varies when the objects in a prototype-chain of functions are considered. So `.prototype` is ignored during that check.   
- The `.constructor` property obviously(!) varies for the objects in a prototype-chain. So `.constructor` is ignored in general. (does SJS even allow using .constructor for anything but instanceof?)

After these adjustments, the initial environment of nodejs can successfully be type checked with SJS.
