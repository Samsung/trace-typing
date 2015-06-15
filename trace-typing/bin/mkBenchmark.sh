#!/usr/bin/env bash

BENCHMARK_ROOT="$1";

if [ ! -d "$BENCHMARK_ROOT" ]; then
    echo "$BENCHMARK_ROOT does not exists!"
    exit 1;
fi

PKG="$2";
DIR="$BENCHMARK_ROOT/$PKG";
MAIN="main.js";

if [ -d "$DIR" ]; then
    echo "$DIR already exists!"
    exit 1;
fi

mkdir $DIR;
echo "{\"name\": \"trace-typing-benchmark_$PKG\"}">> "$DIR/package.json";
echo "require('$PKG');" >> $DIR/$MAIN;
mkdir "$DIR/node_modules";

pushd $DIR;
npm install --save-dev $PKG && node main.js && echo "$PKG installed at $DIR";



