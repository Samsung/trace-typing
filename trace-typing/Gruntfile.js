module.exports = function (grunt) {

    var ts_options = {
        target: 'es5',
        module: 'commonjs',
        sourceMap: true,
        declaration: false,
        removeComments: true,
        noImplicitAny: true,
        compiler: './node_modules/typescript/bin/tsc'
    };
    grunt.initConfig({
        ts: {
            build: {
                src: ["src/**/*.ts"],
                outDir: 'build',
                options: ts_options
            },
            test: {
                src: ["test/**/*.ts"], // will magically include 'src' folder as well, and therefore make build/src & build/test folders!
                outDir: 'build',
                options: ts_options
            },
            play: {
                src: ["test/PlaygroundTests.ts"],
                outDir: 'build',
                options: ts_options
            }
        },
        mochacli: {
            all: {options: {harmony: true, files: ['build/test/*.js']}},
            play: {options: {harmony: true, files: ['build/test/PlaygroundTests.js']}}
        },
        clean: [
            "build"
        ],
        tsd: {
            refresh: {
                options: {
                    command: 'reinstall',
                    latest: true,
                    config: 'tsd.json'
                }
            }
        }

    });

    grunt.loadNpmTasks('grunt-tsd');
    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-mocha-cli');

    grunt.registerTask('default', ['test']);
    grunt.registerTask('build', ['ts:build', 'ts:test']);
    grunt.registerTask('test', ['clean', 'build', 'mochacli']);
    grunt.registerTask('play', ['ts:play','mochacli:play']);
    grunt.registerTask('deftyped', ['tsd']);
};
