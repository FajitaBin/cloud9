define(function(require, exports, module) {

"use strict";

var canon = require('pilot/canon');
var types = require('ext/vim/params');

// Absolute type mess inherited from crappy pilot abstraction. JFC.
var SelectionType = require('pilot/types/basic').SelectionType;
require('pilot/types').registerTypes({
    '!': new SelectionType({
        name: '!',
        description: 'Whether or not value must be inverted',
        data: [ '!', '' ]
    })
});

require('pilot/types/basic').startup();


var util = exports.util = {
    insertMode: function(env) {
        // Switch editor to insert mode
        var cursor = document.getElementsByClassName("ace_cursor")[0];

        env.editor.unsetStyle('normal-mode');
        cursor.style.backgroundColor = null;
        cursor.style.opacity = null;
        cursor.style.border = null;
        cursor.style.borderLeft = "2px solid black";

        env.editor.setOverwrite(false);
    },
    normalMode: function(env) {
        // Switch editor to normal mode
        var cursor = document.getElementsByClassName("ace_cursor")[0];

        env.editor.setStyle('normal-mode');
        env.editor.clearSelection();
        cursor.style.backgroundColor = "red";
        cursor.style.opacity = ".5";
        cursor.style.border = "0";

        if (!env.editor.getOverwrite())
            env.editor.navigateLeft();

        env.editor.setOverwrite(true);
    },
    removeLines: function(env, count) {
        env.editor.removeLines();
    },
    rmPrevChars: function(env, count) {
        env.editor.removeLeft();
    },
    rmNextChars: function(env, count) {
        env.editor.removeRight();
    },
    gotoEndWordRight: function(env, count) {
        env.editor.navigateWordRight();
    },
    gotoEndWordLeft: function(env, count) {
        env.editor.navigateWordLeft();
    },
    removeWordRight: function(env, count) {
        env.editor.removeWordRight();
    },
    removeWordLeft: function(env, count) {
        env.editor.removeWordLeft();
    },
    getRightNthChar: function(env, cursor, char, n) {
        var ed = env.editor;
        var line = ed.getSession().getLine(cursor.row);
        var matches = line.substr(cursor.column + 1).split(char);

        return n < matches.length ? matches.slice(0, n).join(char).length : 0;
    },
    getLeftNthChar: function(env, cursor, char, n) {
        var ed = env.editor;
        var line = ed.getSession().getLine(cursor.row);
        var matches = line.substr(0, cursor.column + 1).split(char);

        return n < matches.length ? matches.slice(-1 * n).join(char).length + 1: 0;
    },
    gotoRightNthChar: function(env, char, n) {
        var ed = env.editor;
        var cursor = ed.getCursorPosition();
        var column = util.getRightNthChar(env, cursor, column, char, n);
        var row = cursor.row;

        if (column) {
            ed.moveCursorToPosition({
                row: row,
                column: column
            });
        }
    },
    gotoLeftNthChar: function(env, char, n) {
        var ed = env.editor;
        var cursor = ed.getCursorPosition();
        var column = util.getLeftNthChar(env, cursor, column, char, n);
        var row = cursor.row;

        if (column) {
            ed.moveCursorToPosition({
                row: row,
                column: column
            });
        }
    }
};

function isBang(params) {
    return "!" === params["!"];
}

var NUMBER    = 1;
var OPERATOR  = 2;
var MOTION    = 3;
var ACTION    = 4;
var SELECTION = 5;

var motions = {
    "w": {
        nav: function(env) {
            env.editor.navigateWordRight();
        },
        sel: function(env) {
            env.editor.selection.selectWordRight();
        }
    },
    "b": {
        nav: function(env) {
            env.editor.navigateWordLeft();
        },
        sel: function(env) {
            env.editor.selection.selectWordLeft();
        }
    },
    "l": {
        nav: function(env) {
            env.editor.navigateRight();
        },
        sel: function(env) {
            env.editor.selection.selectRight();
        }
    },
    "h": {
        nav: function(env) {
            env.editor.navigateLeft();
        },
        sel: function(env) {
            env.editor.selection.selectLeft();
        }
    },
    "k": {
        nav: function(env) {
            env.editor.navigateUp();
        },
        sel: function(env) {
            env.editor.selection.selectUp();
        }
    },
    "j": {
        nav: function(env) {
            env.editor.navigateDown();
        },
        sel: function(env) {
            env.editor.selection.selectDown();
        }
    },
    "f": {
        param: true,
        nav: function(env, param) {
            console.log("fnav", param);
        },
        sel: function(env, param) {
            console.log("fsel", param);
        }
    },
    "shift-6": {
        nav: function(env) {
            env.editor.navigateLineStart();
        }
    },
    "shift-4": {
        nav: function(env) {
            env.editor.navigateLineEnd();
        }
    },
    "0": {
        nav: function(env) {
            var ed = env.editor;
            ed.navigateTo(ed.selection.selectionLead.row, 0);
        }
    },
};

var operators = {
    "d": function(env, range, count, param) {
        count = parseInt(count || 1);
        switch (param) {
            case "d":
                for (var i=0; i<count; i++)
                    env.editor.removeLines();

                break;
            default:
                env.editor.session.remove(range);
        }
    }
};

var actions = {
    "g": function(env, range, count, param) {
        switch(param) {
            case "m":
                console.log("Middle line")
                break;
            case "e":
                console.log("End of prev word")
                break;
            case "g":
                env.editor.gotoLine(count || 0);
        }
    }
};

var repeat = function repeat(fn, count, args) {
    while (0 < count--)
        fn.apply(this, args);
};

var inputBuffer = exports.inputBuffer = {
    buffer: [],
    accepting: [NUMBER, OPERATOR, MOTION, ACTION],
    currentCmd: null,
    currentCount: "",

    // Types
    operator: null,
    motion: null,
    selection: null,

    push: function(env, char) {
        var isFirst = this.buffer.length === 0;

        var wObj = this.waitingForParam;
        if (wObj) {
            this.exec(env, wObj, char);
            this.waitingForParam = null;
        }
        // If it is a number (that doesn't start with 0)
        else if (!(char === "0" && isFirst) &&
            (char.match(/^\d+$/) && this.isAccepting(NUMBER))) {
            // Assuming that char is always of type String, and not Number
            this.currentCount += char;
            this.currentCmd = NUMBER;
            this.accepting = [NUMBER, OPERATOR, MOTION, ACTION];
        }
        else if (!this.operator && this.isAccepting(OPERATOR) && operators[char]) {
            this.operator = {
                char: char,
                count: this.getCount()
            };
            this.currentCmd = OPERATOR;
            this.accepting = [NUMBER, MOTION, ACTION];
        }
        else if (motions[char] && this.isAccepting(MOTION)) {
            this.currentCmd = MOTION;

            var ctx = {
                operator: this.operator,
                selection: this.selection,
                motion: {
                    char: char,
                    count: this.getCount()
                },
            };

            if (motions[char].param)
                this.waitingForParam = ctx;
            else
                this.exec(env, ctx);
        }
        else if (actions[char] && this.isAccepting(ACTION)) {
            this.waitingForParam = {
                action: {
                    fn: actions[char],
                    count: this.getCount(),
                }
            };
        }
        else if (this.operator) {
            console.log("this operator")
            this.exec(env, { operator: this.operator }, char);
        }
        else {
            this.reset();
        }
    },

    getCount: function() {
        var count = this.currentCount;
        this.currentCount = "";
        return count;
    },

    exec: function(env, action, param) {
        var m = action.motion;
        var o = action.operator;
        var a = action.action;

        // There is an operator, but no motion or action. We try to pass the
        // current char to the operator to see if it responds to it (an example
        // of this is the 'dd' operator).
        if (!m && !a && o) {
            operators[o.char](env, env.editor.getSelectionRange(), o.count, param);
        }
        else if (m) {
            var run = function(fn) {
                if (fn && typeof fn === "function") { // There should always be a motion
                    if (m.count)
                        repeat(fn, m.count, [env, param]);
                    else
                        fn(env, param);
                }
            };

            var motionObj = motions[m.char];
            if (!o) {
                run(motionObj.nav);
            }
            else {
                repeat(function() {
                    run(motionObj.sel);
                    operators[o.char](env, env.editor.getSelectionRange(), o.count, param);
                }, o.count);
            }
        }
        else if (a) {
            a.fn(env, env.editor.getSelectionRange(), a.count, param);
        }
        this.reset();
    },

    isAccepting: function(type) {
        return this.accepting.indexOf(type) !== -1;
    },

    reset: function() {
        this.opCount = null;
        this.operator = null;
        this.selection = null;
        this.motion = null;
        this.motionCount = null;

        this.current = null;
        this.accepting = [NUMBER, OPERATOR, MOTION, ACTION];
    }
}

var commands = exports.commands = {
    commandLine: {
        exec: function exec(env, params, request) {
            env.editor.blur();
            txtConsoleInput.focus();
            // Yeap it's an ugly hack to put focus back to the editor.
            //return exec.inited || (exec.inited = FocusEditor(env, txtConsoleInput));
        }
    },
    // Start **insert** mode just after executing this command
    // Works like typing "i" in Normal mode.  When the ! is
    // included it works like "A", append to the line.
    // Otherwise insertion starts at the cursor position.
    // Note that when using this command in a function or
    // script, the insertion only starts after the function
    // or script is finished.
    // This command does not work from |:normal
    start: {
        description: 'Start **insert** mode',
        params: [ types['!'] ],
        exec: function start(env, params, request) {
            if (isBang(params))
                env.editor.navigateLineStart();

            util.insertMode(env);
        }
    },
    // Stop Insert mode as soon as possible. Works like typing <Esc> in
    // **insert** mode.
    stop: {
        description: 'Start **normal** mode',
        exec: function stop(env, params, request) {
            util.normalMode(env);
        }
    },
    // Append text after the cursor / word (if !) word.
    append: {
        description: 'Append text and start **normal** mode',
        params: [ types.count, types['!'] ],
        exec: function append(env, params, request) {
            if (isBang(params))
                env.editor.navigateLineEnd();
            else
                env.editor.navigateRight(params.count);

            util.insertMode(env);
        }
    },
    // Begin a new line below / above (if !) the cursor and insert text,
    // repeat `count` times.
    openNewLines: {
        description: 'Begin new line and start **insert**',
        params: [ types.count, types['!'] ],
        exec: function openNewLines(env, params, request) {
            if (isBang(params))
                env.editor.navigateUp(count);

            env.editor.navigateLineEnd();
            open(env, params.count);
            util.insertMode(env);
        }
    },
    // Delete `count` characters / lines (if !) and start **insert**'
    // '(s stands for Substitute).
    substitute: {
        description: 'Substitute and start **insert**',
        params: [ types.count, types['!'] ],
        exec: function substitute(env, params, request) {
            if (isBang(params)) {
                var ed = env.editor;
                ed.navigateUp();
                ed.navigateLineStart();
                ed.insert("\n");
                util.removeLines(env, params.count);
                ed.navigateUp();
            } else {
                util.rmNextChars(env, params.count);
            }
            util.insertMode(env);
        }
    },
    deleteLines: {
        description: 'Delete [count] lines [into register x] |linewise|',
        params: [ types.count ],
        exec: function deleteLines(env, params, request) {
            util.removeLines(env, params.count);
        }
    },
    gotoLine: function(env, params, request) {
        env.editor.gotoLine(params.line);
    },

    //Basic movement
    moveUp: {
        params: [ types.count ],
        exec: function(env, params, request) {
            env.editor.navigateUp(params.count)
        }
    },
    moveDown: {
        params: [ types.count ],
        exec: function(env, params, request) {
            env.editor.navigateDown(params.count);
        }
    },
    moveLeft: {
        params: [ types.count ],
        exec: function(env, params, request) {
            env.editor.navigateLeft(params.count);
        }
    },
    moveRight: {
        params: [ types.count ],
        exec: function(env, params, request) {
            env.editor.navigateRight(params.count);
        }
    },

    // Word-based movement
    goToEndWord: function(env, params, request) {
        util.gotoEndWordRight(env, params.count);
    },
    goToBackWord: function(env, params, request) {
        util.gotoEndWordLeft(env, params.count);
    },
    deleteChar: function(env, params, request) {
        util.rmNextChars(env, params.count);
    },
    deleteCharBack: function(env, params, request) {
        util.rmPrevChars(env, params.count);
    },
    moveForwardTo: {
        params: [ types.count, types.char ],
        exec: function(env, params, request) {
            util.gotoRightNthChar(env, types.char.valueOf(params.char), params.count);
        }
    },
    moveForwardAt: {
        params: [ types.count, types.char ],
        exec: function(env, params, request) {
            //utils.moveForwardAt(env, types.char.valueOf(params.char), params.count);
        }
    },
    moveBackwardTo: {
        params: [ types.count, types.char ],
        exec: function(env, params, request) {
            util.gotoRightNthChar(env, types.char.valueOf(params.char), params.count);
        }
    },
    moveBackwardAt: {
        params: [ types.count, types.char ],
        exec: function(env, params, request) {
            //utils.moveBackwardAt(env, types.char.valueOf(params.char), params.count);
        }
    },
    moveToFirstChar: function(env, params, request) {
        env.editor.moveCursorToPosition({
            row: env.editor.getCursorPosition().row,
            column: 0
        });
    },
    searchForward: {
        exec: function(env, params, request) {
        }
    },
    searchBackword: {
        exec: function(env, params, request) {
        }
    },
    moveToMiddleWindow: function(env) {
        var ace = env.editor;
        var visibleLines = ace.$getVisibleRowCount();
        var topLine = ace.renderer.getFirstVisibleRow();
        var middleLine = (topLine + (visibleLines / 2)) -1;

        ace.moveCursorToPosition({
            row: middleLine,
            column: 0
        });
    },
    lineFromStart: function(env, params) {
        var ace = env.editor;
        var topLine = ace.renderer.getFirstVisibleRow();

        ace.moveCursorToPosition({
            row: topLine + parseInt(params.count) - 1,
            column: 0
        });

    },
    lineFromEnd: function(env, params) {
        var ace = env.editor;
        var topLine = ace.renderer.getFirstVisibleRow();
        var visibleLines = ace.$getVisibleRowCount();

        ace.moveCursorToPosition({
            row: topLine + visibleLines - parseInt(params.count) - 2,
            column: 0
        });
    },
    moveToColumn: function(env, params) {
        var ace = env.editor;
        ace.moveCursorToPosition({
            row: ace.getCursorPosition().row,
            column: parseInt(params.count)
        });
    }
};
});

