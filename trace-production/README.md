# Trace Production

Produces traces of concrete program executions.
 
## Setup
 
```bash
$ cd trace-production
$ npm install 
$ # npm run install-tests # optional 
$ npm test
```
 
The optional `npm run install-tests` installs dependencies for individual tests in ./tests/exercisedApps/. 
 
The directory traces and instrumented are emitted to can be configured by creating an ./config.js -- with some inspiration from ./config.default.js and ./config.example.js.

 
## Usage
 
The node-main file of the project is ./src/Tracing_runner.js. It exposes the following interface (TypeScript notation):

```typescript
interface Runner{
    run(target:Target, exportFileOrFunction:string|ExportFunction, debug:boolean): void
}

interface Target {
    dir?: string
    main: string
}

interface ExportFunction {
    (trace:any[], smap: any):void
}
```

That is, given a `main` file and optionally a containing `directory`, files will be instrumented with Jalangi followed by a run of the instrumented main file.
  
The run of the instrumented main file will produce a trace. At the end of the run, the trace will either be in a file with the string name of `exportFileNameOrFunction`, or the trace will be provided as an array to the supplied callback in `exportFileNameOrFunction`. 
The second argument to that callback is the Jalangi sourcemap information.

The debug parameter will enable consistency checks of the trace (described later).


For parsing and using the produced traces, see the trace-typing project.

## Developing

The project is a large Jalangi analysis that streams a trace to disk during execution.
   
The main parts of the project are described below: 


The setup for the analysis can be found in ./Tracing.js, while the Jalangi analysis object can be (mainly) found in ./src/TraceBuildingAnalysis.js.

./src/TraceBuilder.js builds up a trace of primitive operations and should be invoked when appropriate.

./src/TemporaryManager.js maintains data flow. It maintains a stack to keep track of expressions, so pushing and popping should be done carefully.

./src/NativeSynthesisManager synthesises the native environment in two ways:

 1. Some (Array) native calls mutate objects, these calls must be modeled to maintain the correct data flow.
 
 2. Allocation of new/yet-unseen objects are done recursively for all properties and properties of the object.
    The (recursive) allocation of the global object is one of the first things ./src/TraceBuildingAnalysis.js does. 
    This has the consequence that all traces start out with an initialization of the global environment. 

./src/ContextAnalysis.js is a Jalangi analaysis object that maintains various context information, such as the call stack and variable scopes. 

./src/JalangiASTQueries.js produces extra syntactic information that is not provided by Jalangi. 
It depends on ./src/astUtilForTracing.js which inspects the Jalangi-instrumented AST.


## Debugging / Testing

The project has a few unit tests. Most of the tests are smoke-tests which are run by ./node_tests/tracingTests.js. 
All tests can be run with `$ npm test`.
The smoke-tests perform two major consistency checks:

 1. Consistent intermediary variable usage: when ./src/TemporaryManager.js produces an intermediary variable for an expression, it is enforced that the usage of that variable is done in a location where the value of the expression is also present. 
    This check usually fails when pushing/popping with ./src/TemporaryManager.js is done in the wrong order.
 2. Trace consistency: all variables in a trace are defined before they are used. 
    This check usually fails when read/write calls to ./src/TraceBuilder.js are done in the wrong order.
      
(TODO Currently, ./node_tests/tracingTests.js defines the benchmarks that are used in the OOPSLA submission for this work, that dependency should be moved)
 
(The traces produced by running ./node_tests/tracingTests.js can be reused by the trace typing project as smoke tests, if ./config.js:tracesDirectories are coordinated)
 
## Misc

### Jalangi version

This project depends on a slightly modified fork of Jalangi2, thus ./package.json uses a Jalangi2-github repository in favor of the npm-version of Jalangi2. 

### Environments

This project has only been tested on nodejs, and it contains some assumptions about being in a nodejs environment: e.g. top-level variable declarations are file-local rather than global.
These assumptions are all guarded by a hardcoded NODEJS_ENVIRONMENT-flag.
  
### Jalangi interaction

The interaction with Jalangi is non-standard, and does not use Jalangi's api.js interface. The reason is historical: this project was started before api.js was developed.

### Asynchronous execution

The trace collection stops as soon as the call stack becomes empty (counting main as a call). 
This means that asynchronous execution will *not* be part of a produced trace. 
In order to support asynchronous execution, some kind of "wait" must be inserted in ./src/TraceCollectionController.

### Node version

The project depends on nodejs v0.12 due to .forEach usage of Set and Map. This means that the node flag `--prof` is not available due to https://github.com/joyent/node/issues/14576

### Limitations

- eval is not supported currently, but it could be with proper Jalangi usage

- user-defined getters and setter are unsupported
