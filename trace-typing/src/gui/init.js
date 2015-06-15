/**
 * Example initialization file
 */
$(function () {
    var data = {
        "messages": [
            {
                "type": "error",
                "id": 42,
                "from": {
                    "line": 0,
                    "ch": 5
                },
                "to": {
                    "line": 0,
                    "ch": 10
                },
                "description": "Booh..."
            },
            {
                "type": "error",
                "id": 42,
                "from": {
                    "line": 0,
                    "ch": 5
                },
                "to": {
                    "line": 0,
                    "ch": 10
                },
                "description": "Booh 2..."
            },
            {
                "type": "warning",
                "id": 87,
                "from": {
                    "line": 0,
                    "ch": 12
                },
                "to": {
                    "line": 0,
                    "ch": 18
                },
                "description": "Baaaah..."
            }
        ],
        "source": "foo(); bar(); baz(); function foo(){}"
    };
    setupCodeMirror(data.source, data.messages);
});