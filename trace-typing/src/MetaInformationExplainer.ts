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
///<reference path="../typings/node/node.d.ts"/>
///<reference path="./types.d.ts"/>
import ConfigLoader = require("./ConfigLoader");
import SourceLocationImpl = require("./SourceLocationImpl");
import AST = require("./TraceLanguageAST");

import fs = require("fs");
import path = require("path");
var ncp = require('ncp');
var temp = require('temp');
var open = require('open');

// TODO clean up in this class, it is much more than just meta information now.

var ValueKind = AST.ValueKinds;
var primitiveValueKind = ValueKind.Primitive;
var objectValueKind = ValueKind.Object;

class SourceRelatedMessageImpl implements SourceRelatedMessage {
    constructor(public message:string, public sourceLocation:SourceLocation, public type:string) {
    }
}

class BrowserTableDisplayer {
    private static GUI_TABLE_LOCATION:string = __dirname + "/../../src/gui/gui-table.html";

    constructor(private table:Table) {
    }

    display(callback:Function) {
        var table = this.table;
        var dir = temp.path();
        ncp(path.dirname(BrowserTableDisplayer.GUI_TABLE_LOCATION), dir, function () {
            var initFile = dir + '/init-table.js';
            var tableDataObject = JSON.stringify(table);
            var initSource = '$(function () { var table = ' + tableDataObject + ';' + '$("body").prepend($("<h1>' + table.title + '</h1>"));showTable(table);});';
            fs.writeFile(initFile, initSource, function (err) {
                if (err) {
                    callback(err);
                }
                open(dir + "/" + path.basename(BrowserTableDisplayer.GUI_TABLE_LOCATION), callback);
            });
        });
    }
}

class BrowserStackedGroupedBarChartDisplayer {
    private static GUI_CHARTS_LOCATION:string = __dirname + "/../../src/gui/gui-charts.html";

    constructor(private charts:StackedGroupedBarCharts) {
    }

    display(callback:Function) {
        var charts = this.charts;
        var dir = temp.path();
        ncp(path.dirname(BrowserStackedGroupedBarChartDisplayer.GUI_CHARTS_LOCATION), dir, function () {
            var initFile = dir + '/init-charts.js';
            var chartsString = JSON.stringify(charts);
            var initSource = [
                'var charts = ' + chartsString + ';',
                'setupCharts(charts.barchartData, charts.columnDescriptions, charts.columnGroupings);'
            ].join("\n");
            fs.writeFile(initFile, initSource, function (err) {
                if (err) {
                    callback(err);
                }
                open(dir + "/" + path.basename(BrowserStackedGroupedBarChartDisplayer.GUI_CHARTS_LOCATION), callback);
            });
        });
    }
}
class BrowserSourceDisplayer {
    private static GUI_LOCATION:string = __dirname + "/../../src/gui/gui.html";

    constructor(private file:string, private description:string, private source:string, private messages:SourceRelatedMessage[]) {
    }

    display(callback:Function) {
        var description = this.description;
        var file = this.file;
        var source = this.source;
        var messages = this.messages;
        var dir = temp.path();
        ncp(path.dirname(BrowserSourceDisplayer.GUI_LOCATION), dir, function (e:any) {
            if(e){
                callback(e);
                return;
            }
            function makeGuiData() {
                return {
                    source: source,
                    messages: messages.map(function (message:SourceRelatedMessage, count:number) {
                        var messageData = {
                            type: message.type,
                            id: count,
                            from: {
                                line: message.sourceLocation.beginLine - 1,
                                ch: message.sourceLocation.beginColumn - 1
                            },
                            to: {
                                line: message.sourceLocation.endLine - 1,
                                ch: message.sourceLocation.endColumn - 1
                            },
                            description: message.message
                        };
                        return messageData;
                    }).sort(function (m1, m2) {
                        var lineCmp = m1.from.line - m2.from.line;
                        if (lineCmp !== 0) {
                            return lineCmp;
                        }
                        if (m1.type !== m2.type) {
                            return m1.type === 'warning' ? -1 : 0
                        }
                        return m1.from.ch - m2.from.ch;
                    })
                };
            }

            var initFile = dir + '/init.js';
            var guiDataObject = JSON.stringify(makeGuiData());
            var initSource = '$(function () { var data = ' + guiDataObject + ';' + '$("body").prepend($("<h1>' + description + '</h1><h2>' + file + '</h2>"));setupCodeMirror(data.source, data.messages);});';
            fs.writeFile(initFile, initSource, function (err) {
                if (err) {
                    callback(err);
                }
                open(dir + "/" + path.basename(BrowserSourceDisplayer.GUI_LOCATION), callback);
            });
        });
    }
}

class MetaInformationExplainerImpl implements MetaInformationExplainer {
    constructor(private iidMap:IIDMap) {
    }

    private describePrimitive(primitive:Primitive):string {
        return AST.PrimitiveKind[primitive.primitiveKind];
    }

    private describeShape(shape:Shape):string {
        var description = "";
        description += "{" + shape.getPropertyNames().join(", ") + "}";
        description += " at " + this.getIIDSourceLocation(shape.meta.iid).toString(true);
        return description;
    }

    private describeValue(value:Value):string {
        if (value.valueKind === primitiveValueKind) {
            return this.describePrimitive(<Primitive>value);
        } else {
            return this.describeShape((<Instance>value).shapes[0]);
        }
    }

    getIIDSourceLocation(iid:string):SourceLocation {
        if (this.iidMap.has(iid)) {
            return this.iidMap.get(iid);
        } else {
            return SourceLocationImpl.makeMissingIIDSourceLocation();
        }
    }

    displaySourceRelatedExplanations(explanations:SourceRelatedMessage[]) {
        explanations.forEach(function (e) {
            console.log("%s: %s", e.sourceLocation.toString(true, false), e.message);
        });
    }

    displayMessagesInBrowser(description:string, messages:SourceRelatedMessage[], callback:Function) {
        if (messages.length === 0) {
            console.log("No messages to display: NOT opening a browser...");
            callback();
        }
        var byFileMessages:String2MessageMap = {};
        var filesCount = 0;
        messages.forEach(function (message:SourceRelatedMessage) {
            if (!message.sourceLocation.isPseudo) {
                byFileMessages[message.sourceLocation.file] = byFileMessages[message.sourceLocation.file] || (filesCount++, []);
                byFileMessages[message.sourceLocation.file].push(message);
            }
        });
        var displayed = 0;
        for (var file in byFileMessages) {
            (function (file:string, messages:SourceRelatedMessage[]) {
                if (!fs.existsSync(file)) {
                    callback(new Error("No such file: '" + file + "' (resolve path: " + path.resolve(file) + ")"));
                    return;
                }
                fs.readFile(file, 'utf8', function (err, source) {
                    new BrowserSourceDisplayer(file, description, source, messages).display(function () {
                        displayed++;
                        if (displayed === filesCount) {
                            callback();
                        }
                    });
                });
            })(file, byFileMessages[file]);
        }
    }

    static displayTableInBrowser(table:Table, callback:Function) {
        new BrowserTableDisplayer(table).display(callback);
    }

    static displayStackedGroupedBarChartsInBrowser(charts:StackedGroupedBarCharts, callback:Function) {
        new BrowserStackedGroupedBarChartDisplayer(charts).display(callback);
    }
}

interface String2MessageMap {
    [key:string]: SourceRelatedMessage[]
}

export = MetaInformationExplainerImpl;
