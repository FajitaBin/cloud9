/**
 * Version history browser extension for Cloud9 IDE
 * 
 * @author Matt Pardee
 * 
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
 
define(function(require, exports, module) {

var ext = require("core/ext");
var ide = require("core/ide");
var editors = require("ext/editors/editors");
var BlameJS = require("ext/versions/blamejs");
var GitLogParser = require("ext/versions/gitlogparser");
var markup = require("text!ext/versions/versions.xml");

module.exports = ext.register("ext/versions/versions", {
    name     : "Version History",
    dev      : "Cloud9 IDE, Inc.",
    alone    : true,
    type     : ext.GENERAL,
    markup   : markup,
    command  : "gittools",
    gitLogs  : {},

    nodes : [],

    init : function(amlNode) {
        var _self = this;
        vbMain.parentNode.appendChild(new apf.vbox({
            anchors: "0 0 0 0",
            id: "vbVersions",
            "class": "vbZen",
            visible: false,
            childNodes : [
                new apf.hbox({
                    flex : "1",
                    childNodes : [
                        new apf.vbox({
                            flex : "1",
                            margin : "20 50 40 50",
                            childNodes : [
                                new apf.vbox({
                                    height : "104", // 80 + 24 (24 == height of right-side zoom effect)
                                    align: "center",
                                    childNodes : [
                                        new apf.text({
                                            "class" : "versions_label",
                                            height : "30",
                                            value : "Current Document"
                                        }),
                                        new apf.hbox({
                                            childNodes : [
                                                new apf.text({
                                                    margin : "10 0 10 0",
                                                    padding : "12 15 12 15",
                                                    value : "Details about the commit: author<br />time, message, etc",
                                                    style : "background: none; color: #fff; font-size: 13px"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new apf.codeeditor({
                                    id                : "currentVersionEditor",
                                    flex : "1",
                                    visible           : "true",
                                    syntax            : "javascript",
                                    theme             : "[{require('ext/settings/settings').model}::editors/code/@theme]",
                                    overwrite         : "[{require('ext/settings/settings').model}::editors/code/@overwrite]",
                                    behaviors         : "[{require('ext/settings/settings').model}::editors/code/@behaviors]",
                                    selectstyle       : "[{require('ext/settings/settings').model}::editors/code/@selectstyle]",
                                    activeline        : "[{require('ext/settings/settings').model}::editors/code/@activeline]",
                                    showinvisibles    : "[{require('ext/settings/settings').model}::editors/code/@showinvisibles]",
                                    showprintmargin   : "false",
                                    printmargincolumn : "[{require('ext/settings/settings').model}::editors/code/@printmargincolumn]",
                                    softtabs          : "[{require('ext/settings/settings').model}::editors/code/@softtabs]",
                                    tabsize           : "[{require('ext/settings/settings').model}::editors/code/@tabsize]",
                                    scrollspeed       : "[{require('ext/settings/settings').model}::editors/code/@scrollspeed]",
        
                                    fontsize          : "[{require('ext/settings/settings').model}::editors/code/@fontsize]",
                                    wrapmode          : "false",
                                    wraplimitmin      : "80",
                                    wraplimitmax      : "80",
                                    gutter            : "[{require('ext/settings/settings').model}::editors/code/@gutter]",
                                    highlightselectedword : "[{require('ext/settings/settings').model}::editors/code/@highlightselectedword]",
                                    autohidehorscrollbar  : "[{require('ext/settings/settings').model}::editors/code/@autohidehorscrollbar]",
        
                                    "debugger"        : "null",
                                    readonly          : "true",
                                    style : "-webkit-box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.75); -moz-box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.75)"
                                })
                            ]
                        }),
                        new apf.vbox({
                            flex : "1",
                            margin : "20 50 40 50",
                            childNodes : [
                                new apf.vbox({
                                    height : "80",
                                    align : "center",
                                    id : "vbHistoricalHeader",
                                    childNodes : [
                                        new apf.hbox({
                                            childNodes : [
                                                new apf.button({
                                                    id : "versions_nav_back",
                                                    "class" : "versions_navigate nav_backward",
                                                    onclick : function() {
                                                        _self.loadPreviousRevision();
                                                    }
                                                }),
                                                new apf.text({
                                                    id : "versions_label",
                                                    "class" : "versions_label",
                                                    value : ""
                                                }),
                                                new apf.button({
                                                    id : "versions_nav_fwd",
                                                    "class" : "versions_navigate nav_forward",
                                                    onclick : function() {
                                                        _self.loadNextRevision();
                                                    }
                                                }),
                                                new apf.textbox({
                                                    width : "150",
                                                    skin : "searchbox_textbox",
                                                    "initial-message" : "Filter Revisions",
                                                    "class" : "versions_search",
                                                    style : "position: absolute; top: 22px; right: 40px",
                                                    onkeyup : function() {
                                                        _self.applyFilter(this.getValue());
                                                    }
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new apf.vbox({
                                    align : "center",
                                    childNodes : [
                                        new apf.bar({
                                            width : "75%",
                                            height : "6",
                                            "class" : "historical_pages"
                                        }),
                                        new apf.bar({
                                            width : "85%",
                                            height : "8",
                                            "class" : "historical_pages"
                                        }),
                                        new apf.bar({
                                            width : "95%",
                                            height : "10",
                                            "class" : "historical_pages"
                                        })
                                    ]
                                }),
                                new apf.codeeditor({
                                    id                : "historicalVersionEditor",
                                    flex : "1",
                                    visible           : "true",
                                    syntax            : "{require('ext/code/code').getSyntax(%[.])}",
                                    theme             : "[{require('ext/settings/settings').model}::editors/code/@theme]",
                                    overwrite         : "[{require('ext/settings/settings').model}::editors/code/@overwrite]",
                                    behaviors         : "[{require('ext/settings/settings').model}::editors/code/@behaviors]",
                                    selectstyle       : "[{require('ext/settings/settings').model}::editors/code/@selectstyle]",
                                    activeline        : "[{require('ext/settings/settings').model}::editors/code/@activeline]",
                                    showinvisibles    : "[{require('ext/settings/settings').model}::editors/code/@showinvisibles]",
                                    showprintmargin   : "false",
                                    printmargincolumn : "[{require('ext/settings/settings').model}::editors/code/@printmargincolumn]",
                                    softtabs          : "[{require('ext/settings/settings').model}::editors/code/@softtabs]",
                                    tabsize           : "[{require('ext/settings/settings').model}::editors/code/@tabsize]",
                                    scrollspeed       : "[{require('ext/settings/settings').model}::editors/code/@scrollspeed]",

                                    fontsize          : "[{require('ext/settings/settings').model}::editors/code/@fontsize]",
                                    wrapmode          : "false",
                                    wraplimitmin      : "80",
                                    wraplimitmax      : "80",
                                    gutter            : "[{require('ext/settings/settings').model}::editors/code/@gutter]",
                                    highlightselectedword : "[{require('ext/settings/settings').model}::editors/code/@highlightselectedword]",
                                    autohidehorscrollbar  : "[{require('ext/settings/settings').model}::editors/code/@autohidehorscrollbar]",

                                    "debugger"        : "null",
                                    readonly          : "true",
                                    style : "-webkit-box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.75); -moz-box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.75)"
                                })
                            ]
                        })
                    ]
                })
            ]
        }));

        setTimeout(function() {
            _self.sliderEl = document.createElement("div");
            _self.sliderEl.setAttribute("id", "versionsHistoricalSlider");
            vbHistoricalHeader.$ext.appendChild(_self.sliderEl);

            _self.currentScrollbar = currentVersionEditor.$editor.renderer.scrollBar;
            _self.currentScrollbar.addEventListener("scroll", function(e) {
                historicalVersionEditor.$editor.renderer.scrollBar.setScrollTop(e.data);
            });

            _self.historicalScrollbar = historicalVersionEditor.$editor.renderer.scrollBar;
            _self.historicalScrollbar.addEventListener("scroll", function(e) {
                //console.log("scrollin!", e);
                currentVersionEditor.$editor.renderer.scrollBar.setScrollTop(e.data);
            });
        });
    },

    hook : function(){
        var _self = this;
        editors.addBarButton(
            new apf.button({
                skin : "editor-bar-btn",
                style : "background-image: url(static/style/images/editor_revisions.png); background-position: 6px 3px",
                width : "21",
                onclick : function() {
                    _self.enterVersionMode();
                }
            }), 2
        );

        this.blamejs = new BlameJS();
        this.gitLogParser = new GitLogParser();

        ide.addEventListener("socketMessage", this.onMessage.bind(this));

        ext.initExtension(this);
    },

    loadPreviousRevision : function() {
        var fileData = this.gitLogs[this.getFilePath()];
        var lastLog = fileData.lastLoadedGitLog;
        this.loadRevision(lastLog-1);
    },

    loadNextRevision : function() {
        var fileData = this.gitLogs[this.getFilePath()];
        var lastLog = fileData.lastLoadedGitLog;
        this.loadRevision(lastLog+1);
    },

    loadRevision : function(num) {
        var fileData = this.gitLogs[this.getFilePath()];
        var hash = fileData.logData[num].commit;

        if (fileData.logData[fileData.lastLoadedGitLog])
            fileData.logData[fileData.lastLoadedGitLog].dotEl.setAttribute("class", "");
        fileData.logData[num].dotEl.setAttribute("class", "current");
        fileData.lastLoadedGitLog = num;
        fileData.lastTimeString = this.formulateVersionsLabelDate(fileData.logData[num].author.timestamp);

        versions_label.setValue(fileData.lastTimeString);

        if (num == 0) {
            versions_nav_back.disable();
            versions_nav_fwd.enable();
        } else if (num == (fileData.logData.length-1)) {
            versions_nav_fwd.disable();
            versions_nav_back.enable();
        } else {
            versions_nav_back.enable();
            versions_nav_fwd.enable();
        }

        this.requestGitShow(hash);
    },
    
    animatePage : function() {
        
    },

    /**
     * Transforms the interface into a side-by-side comparison
     * of the current document and its historical revisions
     */
    enterVersionMode : function() {
        this.requestGitLog();

        var currentSession = ceEditor.$editor.getSession();
        var cveSession = currentVersionEditor.$editor.getSession();
        var hveSession = historicalVersionEditor.$editor.getSession();

        // Copy the current document to the new ones
        var currentDocText = currentSession.getValue();
        hveSession.setValue(currentDocText);
        cveSession.setValue(currentDocText);

        // Set the document mode for syntax highlighting
        cveSession.setMode(currentSession.getMode());
        hveSession.setMode(currentSession.getMode());

        vbVersions.show();
        Firmin.animate(vbVersions.$ext, {
            opacity: "1"
        }, 0.5, function() {
            
        });
    },

    /**
     * Requests git show data from the server, based on the current file + hash
     * 
     * @param {string} hash The commit hash
     */
    requestGitShow : function(hash) {
        var data = {
            command : this.command,
            subcommand : "show",
            file : this.getFilePath(),
            hash : hash
        };

        ide.dispatchEvent("track_action", {type: "gittools", cmd: this.command, subcommand: data.subcommand});
        if (ext.execCommand(this.command, data) !== false) {
            if (ide.dispatchEvent("consolecommand." + this.command, {
              data: data
            }) !== false) {
                if (!ide.onLine) {
                    util.alert(
                        "Currently Offline",
                        "Currently Offline",
                        "This operation could not be completed because you are offline."
                    );
                } else {
                    ide.socket.send(JSON.stringify(data));
                }
            }
        }
    },

    /**
     * Requests git log data from the server, about the current file
     */
    requestGitLog : function() {
        var data = {
            command : this.command,
            subcommand : "log",
            file : this.getFilePath()
        };

        ide.dispatchEvent("track_action", {type: "gittools", cmd: this.command, subcommand: data.subcommand});
        if (ext.execCommand(this.command, data) !== false) {
            if (ide.dispatchEvent("consolecommand." + this.command, {
              data: data
            }) !== false) {
                if (!ide.onLine) {
                    util.alert(
                        "Currently Offline",
                        "Currently Offline",
                        "This operation could not be completed because you are offline."
                    );
                }
                else {
                    if (!this.gitLogs[data.file]) {
                        this.gitLogs[data.file] = {
                            logData : [],
                            lastLoadedGitLog : 0,
                            lastSliderValue : 0,
                            currentRevision : editors.currentEditor ? editors.currentEditor.ceEditor.getSession().getValue() : "",
                            revisions : {}
                        };
                    }
                    ide.socket.send(JSON.stringify(data));
                }
            }
        }
    },

    /**
     * Catches incoming messages from the server
     * 
     * @param {JSON} e Incoming data
     */
    onMessage: function(e) {
        var message = e.message;
        //console.log(message);

        if (message.type != "result" && message.subtype != "gittools")
            return;

        if (message.body.err) {
            util.alert(
                "Error", 
                "There was an error returned from the server:",
                message.body.err
            );

            return;
        }

        switch(message.body.gitcommand) {
            case "blame":
                this.onGitBlameMessage(message);
                break;
            case "log":
                this.onGitLogMessage(message);
                break;
            case "show":
                this.onGitShowMessage(message);
                break;
            default:
                return;
        }
    },

    /**
     * The server has sent back the results of a "git log" request
     * 
     * @param {JSON} message Details about the message & output from git log
     */
    onGitLogMessage: function(message) {
        this.gitLogParser.parseLog(message.body.out);

        var logData = this.gitLogParser.getLogData();

        var logDataLength = logData.length;
        for (var gi = 0; gi < logDataLength; gi++) {
            logData[gi].commitLower = logData[gi].commit.toLowerCase();
            logData[gi].parentLower = logData[gi].parent.toLowerCase();
            logData[gi].treeLower = logData[gi].tree.toLowerCase();
            logData[gi].messageJoinedLower = logData[gi].message.join("\n").toLowerCase();
            logData[gi].author.emailLower = logData[gi].author.email.toLowerCase();
            logData[gi].author.fullNameLower = logData[gi].author.fullName.toLowerCase();
            logData[gi].committer.emailLower = logData[gi].committer.email.toLowerCase();
            logData[gi].committer.fullNameLower = logData[gi].committer.fullName.toLowerCase();
        }

        this.gitLogs[message.body.file].logData = logData;

        this.gitLogs[message.body.file].lastLoadedGitLog = logDataLength -1;
            //this.gitLogs[message.body.file].lastSliderValue = logDataLength;

        this.gitLogs[message.body.file].lastTimeString =
            this.formulateVersionsLabelDate(logData[logDataLength-1].author.timestamp);
        versions_label.setValue(this.gitLogs[message.body.file].lastTimeString);

        this.setupSliderEl(this.gitLogs[message.body.file].logData);

        this.gitLogs[message.body.file].logData[logDataLength-1].dotEl.setAttribute("class", "current");
    },

    /**
     * The server has sent back the results of a "git show" request
     * 
     * @param {JSON} message Details about the message & output from git show
     */
    onGitShowMessage : function(message) {
        this.gitLogs[message.body.file].revisions[message.body.hash] =
            message.body.out;

        var hveSession = historicalVersionEditor.$editor.getSession();
        hveSession.setValue(message.body.out);
    },
    
    formulateVersionsLabelDate : function(ts) {
        var date = new Date(ts*1000);
        var ds = date.toString().split(" ");
        return ds[1] + " " + ds[2] + " " + ds[3] + " " + ds[4];
    },

    setupSliderEl : function(logData) {
        if (!logData.length)
            return;

        var _self = this;

        var len = logData.length;
        var tsBegin = logData[0].author.timestamp;
        var timeSpan = logData[len-1].author.timestamp - tsBegin;

        // Create all the child elements along the timeline
        for (var i = 0; i < len; i++) {
            var ts = logData[i].author.timestamp;
            var tsDiff = ts - tsBegin;
            var percentage = (tsDiff / timeSpan) * 100;
            var dotEl = document.createElement("u");
            dotEl.setAttribute("style", "left: " + percentage + "%");
            dotEl.setAttribute("rel", i);
            dotEl.setAttribute("hash", logData[i].commit);
            dotEl.addEventListener("mouseover", function() {
                var it = this.getAttribute("rel");
                var ts = logData[it].author.timestamp;
                var dateStr = _self.formulateVersionsLabelDate(ts);
                versions_label.setValue(dateStr);
            });
            dotEl.addEventListener("mouseout", function() {
                versions_label.setValue(_self.gitLogs[_self.getFilePath()].lastTimeString);
            });
            dotEl.addEventListener("click", function() {
                _self.loadRevision(this.getAttribute("rel"));
            });
            this.sliderEl.appendChild(dotEl);
            logData[i].dotEl = dotEl;
        }
    },

    /**
     * Retrieves the file path for the currently selected file tab
     * 
     * @param {string} filePath If we already have it and want to normalize it
     */
    getFilePath : function(filePath) {
        if (typeof filePath === "undefined")
            filePath = tabEditors.getPage().$model.data.getAttribute("path");
        if (filePath.indexOf("/workspace/") === 0)
            filePath = filePath.substr(11);

        return filePath;
    },

    applyFilter : function(filter) {
        var currentFile = this.getFilePath();

        var logs = this.gitLogs[currentFile].logData;
        if (!logs)
            return;

        filter = filter.toLowerCase();

        this.gitLogs[currentFile].currentLogData = [];
        this.gitLogs[currentFile].explodedPoints = {};
        for (var gi = 0; gi < logs.length; gi++) {
            if (logs[gi].commitLower.indexOf(filter) >= 0) {
                this.gitLogs[currentFile].currentLogData.push(logs[gi]);
                continue;
            }
            if (logs[gi].parentLower.indexOf(filter) >= 0) {
                this.gitLogs[currentFile].currentLogData.push(logs[gi]);
                continue;
            }
            if (logs[gi].treeLower.indexOf(filter) >= 0) {
                this.gitLogs[currentFile].currentLogData.push(logs[gi]);
                continue;
            }
            if (logs[gi].messageJoinedLower.indexOf(filter) >= 0) {
                this.gitLogs[currentFile].currentLogData.push(logs[gi]);
                continue;
            }
            if (logs[gi].author.emailLower.indexOf(filter) >= 0) {
                this.gitLogs[currentFile].currentLogData.push(logs[gi]);
                continue;
            }
            if (logs[gi].author.fullNameLower.indexOf(filter) >= 0) {
                this.gitLogs[currentFile].currentLogData.push(logs[gi]);
                continue;
            }
            if (logs[gi].committer.emailLower.indexOf(filter) >= 0) {
                this.gitLogs[currentFile].currentLogData.push(logs[gi]);
                continue;
            }
            if (logs[gi].committer.fullNameLower.indexOf(filter) >= 0) {
                this.gitLogs[currentFile].currentLogData.push(logs[gi]);
                continue;
            }

            this.gitLogs[currentFile].explodedPoints[gi] = true;
        }

        var isCurrent = false;
        for(var i = 0; i < logs.length; i++) {
            var currClass = logs[i].dotEl.getAttribute("class");
            if (currClass && currClass.length && currClass.indexOf("current") != -1)
                isCurrent = true;
            else
                isCurrent = false;

            if (this.gitLogs[currentFile].explodedPoints[i]) {
                if (isCurrent)
                    logs[i].dotEl.setAttribute("class", "current pop");
                else
                    logs[i].dotEl.setAttribute("class", "pop");
            } else {
                if (isCurrent)
                    logs[i].dotEl.setAttribute("class", "current");
                else
                    logs[i].dotEl.setAttribute("class", "");
            }
        }

        //console.log(this.gitLogs[currentFile].currentLogData);

        //this.setGitLogState(currentFile);
        //this.gitLogSliderChange(this.gitLogs[currentFile].currentLogData.length);
    },

    enable : function(){
        this.nodes.each(function(item){
            item.enable();
        });
    },

    disable : function(){
        this.nodes.each(function(item){
            item.disable();
        });
    },

    destroy : function(){
        this.nodes.each(function(item){
            item.destroy(true, true);
        });
        this.nodes = [];
    }
});

});