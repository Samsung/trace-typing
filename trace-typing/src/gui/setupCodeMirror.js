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
function setupCodeMirror(source, messages) {
    var cm = CodeMirror($("#code")[0], {
        value: source,
        mode: "javascript",
        lineNumbers: true,
        gutters: ["CodeMirror-linenumbers"],
        viewportMargin: Infinity
    });

    messages = messages.filter(function (message) {
        return message.from.line >= 0;
    });
    function orderAndFilterMessages(messages) {
        // order messages
        var typeOrder = {"error": 0, "warning": 1, "info": 2};
        messages = messages.sort(function (m1, m2) {
            // prefer the earliest errors,
            // then warnings,
            // then infos,
            if (m1.type === m2.type) {
                var lineOrder = m1.from.line - m2.from.line;
                if (lineOrder !== 0) {
                    return lineOrder;
                }
                return m1.from.ch - m2.from.ch;
            }
            return typeOrder[m1.type] - typeOrder[m2.type];
        });

        // remove duplicates
        var previousMessageString = undefined;
        messages = messages.filter(function (m) {
            var idTmp = m.id; // hack around the unique id for every message
            m.id = -1;
            var currentMessageString = JSON.stringify(m);
            m.id = idTmp;
            if (currentMessageString === previousMessageString) {
                return false;
            }
            previousMessageString = currentMessageString;
            return true;
        });

        // limit total number of messages
        var maxMessages = 10000;
        messages = messages.slice(0, Math.min(messages.length, maxMessages));
        return messages;
    }

    messages = orderAndFilterMessages(messages);
    var highlight = function (message) {
        var classIdHack = "classIdHack_" + message.id;
        var sameLineTo = message.from.line === message.to.line? message.to: {line: message.from.line, ch: message.from.ch + 80};
        cm.markText(message.from, sameLineTo, {className: "highlight " + message.type + " " + classIdHack})
    };
    // order is important: let error highlight override warning highligt
    messages.forEach(highlight);

    var locationMergedMessages = {};

    messages.forEach(function (m) {
        var key = m.from.line + ":" + m.from.ch + "-" + m.to.line + ":" + m.to.ch;
        if (!locationMergedMessages[key]) {
            locationMergedMessages[key] = {id: m.id /*first member has the canonical id*/, messages: []};
        }
        locationMergedMessages[key].messages.push(m.description);
    });

    for (var location in locationMergedMessages) {
        var group = locationMergedMessages[location];

        var classIdHack = "classIdHack_" + group.id;
        var element = $("." + classIdHack);

        element.tooltip({
            items: "span",
            content: "<ul><li>" + group.messages.join("</li><li>") + "</li></ul>"
        });
    }

    messages.forEach(function (message) {
        if (message.type === 'warning') {
            // ignore warning lines
            return;
        }
        var msg = document.createElement("div");

        var icon = msg.appendChild(document.createElement("span"));
        if (message.type === 'error') {
            icon.innerHTML = "!!";
        } else if (message.type === 'warning') {
            icon.innerHTML = "!?";
        }
        icon.className = "line-icon " + message.type;

        msg.appendChild(document.createTextNode(message.description));
        msg.className = "line-message " + message.type;
        cm.addLineWidget(message.from.line, msg, {coverGutter: false, noHScroll: true});
    });
}
