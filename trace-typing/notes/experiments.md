# Experiments for trace-typing

## How representative is the type abstraction of the concrete behavior?

For each property access `o.p`, measure the agreement on the resulting
value between the concrete and abstract world.

### Measures

Queries:

- presence measure: agreement on undefined/not-undefinedness
- ...

Aggregation:

- (0A) global number of agreements/disagreements (not that interesting as hot code will be overrepresented!)
- (0B) global number of 100% agreements/disagreements for a single syntactic location

### What to merge

The type of `o` can be decided in multiple ways:

(1) `o.p` can be viewed fully context-sensitively (1A), in which case
there will be a comparison with a single concrete state, and there
will be no merges with other dynamic occurrences of that property
access. Conversely, context-insensitivity (1B) would mean a comparison
with multiple concrete states, and merges with dynamic occurrences of
that property access. An actual context-sensitivity can also be
applied, but that is not done for now.

(2) Regardless of the chosen context-sensitivity, a type will have to
be inferred for the concrete `o` instance. This can done in (at least)
three ways: the history of the object can be considered not-at-all
(2A), flow-sensitively (2B), and flow-insensitively (2C). The
not-at-all approach simply ascribes a type to the object as it looks
at the time of the property access. The flow-sensitive history
approach does a merge of all historic versions of the object until the
time of the property access. Lastly, the flow-insensitive approach
considers the entire history of the object instance.

((2x) can be further abstracted by considering merging `o` by
allocation-site/context)

(1x) and (2y) provides us with a cartesian product of interesting
configurations to do measurements for.

The most notable configuration is (1A, 2A) as this has optimal
precision - no merges should be required in this configuration. This
provides us with a sanity check, as this configuration always should
agree with the concrete state!

### How to merge

Any merge strategies of interest

