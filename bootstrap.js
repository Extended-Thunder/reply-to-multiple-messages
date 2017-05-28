// https://developer.mozilla.org/en-US/docs/Extensions/bootstrap.js
// Also, lots of code here cribbed from
// https://developer.mozilla.org/en-US/Add-ons/How_to_convert_an_overlay_extension_to_restartless

Components.utils.import("resource:///modules/gloda/log4moz.js");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

prefBranch = Services.prefs;
prefPrefix = "extensions.reply-to-multiple-messages";
bccPref = prefPrefix + ".use_bcc";
refsPref = prefPrefix + ".hide_references";

defaultPreferencesLoaderLink =
     "chrome://reply-to-multiple-messages/content/defaultPreferencesLoader.jsm";

function startup(data, reason) {
    /// Bootstrap data structure @see https://developer.mozilla.org/en-US/docs/Extensions/Bootstrapped_extensions#Bootstrap_data
    ///   string id
    ///   string version
    ///   nsIFile installPath
    ///   nsIURI resourceURI
    /// 
    /// Reason types:
    ///   APP_STARTUP
    ///   ADDON_ENABLE
    ///   ADDON_INSTALL
    ///   ADDON_UPGRADE
    ///   ADDON_DOWNGRADE
    loadDefaultPreferences(data.installPath);
    initLogging();
    forEachOpenWindow(loadIntoWindow);
    Services.wm.addListener(WindowListener);
}

function shutdown(data, reason) {
    /// Bootstrap data structure @see https://developer.mozilla.org/en-US/docs/Extensions/Bootstrapped_extensions#Bootstrap_data
    ///   string id
    ///   string version
    ///   nsIFile installPath
    ///   nsIURI resourceURI
    /// 
    /// Reason types:
    ///   APP_SHUTDOWN
    ///   ADDON_DISABLE
    ///   ADDON_UNINSTALL
    ///   ADDON_UPGRADE
    ///   ADDON_DOWNGRADE
    if (reason == APP_SHUTDOWN)
        return;

    forEachOpenWindow(unloadFromWindow);
    Services.wm.removeListener(WindowListener);
    unloadDefaultPreferences();

    // HACK WARNING: The Addon Manager does not properly clear all addon
    //               related caches on update; in order to fully update images
    //               and locales, their caches need clearing here
    Services.obs.notifyObservers(null, "chrome-flush-caches", null);
}

function install(data, reason) {
    /// Bootstrap data structure @see https://developer.mozilla.org/en-US/docs/Extensions/Bootstrapped_extensions#Bootstrap_data
    ///   string id
    ///   string version
    ///   nsIFile installPath
    ///   nsIURI resourceURI
    /// 
    /// Reason types:
    ///   ADDON_INSTALL
    ///   ADDON_UPGRADE
    ///   ADDON_DOWNGRADE
}

function uninstall(data, reason) {
    /// Bootstrap data structure @see https://developer.mozilla.org/en-US/docs/Extensions/Bootstrapped_extensions#Bootstrap_data
    ///   string id
    ///   string version
    ///   nsIFile installPath
    ///   nsIURI resourceURI
    /// 
    /// Reason types:
    ///   ADDON_UNINSTALL
    ///   ADDON_UPGRADE
    ///   ADDON_DOWNGRADE
}

function loadIntoWindow(window) {
    var document = window.document;
    var menu = document.getElementById("messageMenuPopup");
    if (! menu) {
        return;
    }

    var old_menuitem = document.getElementById("menu_forwardMsg");

    var new_menuitem = document.createElement("menuitem");
    new_menuitem.setAttribute("id", "rtmm_menu_reply");
    new_menuitem.setAttribute("label", "Reply to Selected");
    // Closure so we have access to window.
    var replyToSelectedClosure = function(event) { replyToSelected(window); };
    new_menuitem.addEventListener("command", replyToSelectedClosure);
    menu.insertBefore(new_menuitem, old_menuitem);

    new_menuitem = document.createElement("menuitem");
    new_menuitem.setAttribute("id", "rtmm_menu_replyAll");
    new_menuitem.setAttribute("label", "Reply All to Selected");
    // Closure so we have access to window.
    replyToSelectedClosure = function(event) {
        replyAllToSelected(window); };
    new_menuitem.addEventListener("command", replyToSelectedClosure);
    menu.insertBefore(new_menuitem, old_menuitem);

    // So, the object here is for the menu command to be greyed out when no
    // messages are selected. For other command in this menu, that's
    // implemented by the mailMessageMenuItems commandset, which has
    // commandupdater set to true and oncommandupdate set to
    // goUpdateMailMenuItems(this). I can't horn in on that action since my
    // menu command isn't part of that controller, so I need to create a
    // different commandset with my own handler.
    //
    // I think the "right" way to do this is to create a command object inside
    // the the commandset and then associate that command object with the
    // menuitem by setting its "command" attribute, but when I try that the
    // command never gets executed, and I can't figure out what I'm doing
    // wrong, and it's not like it's documented properly anywhere, so I'm
    // throwing up my hands and doing it in a hacky way.
    var mailCommands = document.getElementById("mailCommands");
    var rtmmCommands = document.createElement("commandset");
    rtmmCommands.setAttribute("id", "rtmmCommands");
    rtmmCommands.setAttribute("commandupdater", "true");
    rtmmCommands.setAttribute("events", "create-menu-message");
    // Closure so we have access to window in the event listener.
    var updateMenuItemsClosure = function(event) { updateMenuItems(window); };
    rtmmCommands.addEventListener("commandupdate", updateMenuItemsClosure);

    mailCommands.appendChild(rtmmCommands);
}

function unloadFromWindow(window) {
    /* call/move your UI tear down function here */
    document = window.document;

    // Delete nodes in the opposite order that they were added.
    var mailCommands = document.getElementById("mailCommands");
    var rtmmCommands = document.getElementById("rtmmCommands");
    mailCommands.removeChild(rtmmCommands);

    var menu = document.getElementById("messageMenuPopup");
    var menuitem = document.getElementById("rtmm_menu_replyAll");
    menu.removeChild(menuitem);
    menuitem = document.getElementById("rtmm_menu_reply");
    menu.removeChild(menuitem);
}

function forEachOpenWindow(todo) { // Apply a function to all open windows
    var windows = Services.wm.getEnumerator("mail:3pane");
    while (windows.hasMoreElements()) {
        todo(windows.getNext().QueryInterface(
            Components.interfaces.nsIDOMWindow));
    }
}

var WindowListener = {
    onOpenWindow: function(xulWindow) {
        var window = xulWindow.QueryInterface(
            Components.interfaces.nsIInterfaceRequestor).
            getInterface(Components.interfaces.nsIDOMWindow);
        function onWindowLoad() {
            window.removeEventListener("load",onWindowLoad);
            var document = window.document;
            if (document.documentElement.getAttribute("windowtype") ==
                "mail:3pane") {
                loadIntoWindow(window);
            }
        }
        window.addEventListener("load",onWindowLoad);
    },
};

// Class for building address lists.
function AddressList() {
    this.addresses = "";
}
AddressList.prototype.add = function(newAddresses) {
    if (this.addresses) {
        if (newAddresses) {
            this.addresses += ", " + newAddresses;
        }
        return;
    }
    this.addresses = newAddresses;
}
AddressList.prototype.stringify = function(otherAddresses) {
    // XXX Remove aliases to me at some point, maybe?
    return MailServices.headerParser.removeDuplicateAddresses(
        this.addresses, otherAddresses);
}

// Class for building ID lists.
function IdList() {
    this.strIds = "";
}
IdList.prototype.add = function(strNewIds) {
    var newIds = strNewIds.split(/\s+/);
    for (var i in newIds) {
        if (this.strIds.indexOf(newIds[i]) == -1) {
            if (this.strIds) {
                this.strIds += " " + newIds[i];
            }
            else {
                this.strIds = newIds[i];
            }
        }
    }
}
IdList.prototype.stringify = function() {
    return this.strIds;
}

// Class for generating a smart reply subject from a bunch of subjects.
function SmartReplySubject() {
    this.commonSuffix = "";
    this.maxLength = 0;
    this.averageLength = 0;
    this.subjectCount = 0;
}
SmartReplySubject.prototype.add = function(newSubject) {
    newSubject = newSubject.trim();
    if (! newSubject) {
        return;
    }

    if (! this.commonSuffix) {
        this.commonSuffix = newSubject;
        this.maxLength = this.averageLength = newSubject.length;
        this.subjectCount = 1;
        return;
    }

    var i = this.commonSuffix.length;
    var j = newSubject.length;
    
    while (i && j) {
        if (this.commonSuffix[i - 1] != newSubject[j - 1]) {
            break;
        }
        i--; j--;
    }

    this.commonSuffix = newSubject.substring(j);
    if (newSubject.length > this.maxLength) {
        this.maxLength = newSubject.length;
    }
    this.averageLength = (this.subjectCount * this.averageLength +
                          newSubject.length) / (this.subjectCount + 1);
    this.subjectCount++;
}
SmartReplySubject.prototype.stringify = function() {
    // I'm not sure yet what I want to use use as the logic here. I'm tracking
    // both the maximum and average subject lengths above, but I'm not sure I
    // really want to be so smart as to use them. For the time being, I'm just
    // going to return it if it's anything at all.
    var stripped = this.commonSuffix.replace(/^re:\s*/i, "");
    return "Re: " + stripped;
}

function replyToSelectedExtended(window, replyAll) {
    logger.debug("Entering replyToSelected");
    var tmp;
    var gFolderDisplay = window["gFolderDisplay"];
    var goDoCommand = window["goDoCommand"];
    if (gFolderDisplay.selectedCount < 1) {
        return;
    }
    if (gFolderDisplay.selectedCount == 1) {
        goDoCommand(replyAll ? "cmd_replyall" : "cmd_reply");
        return;
    }

    var collectedRecipients = new AddressList();
    var collectedCCs = new AddressList();
    var collectedReferences = new IdList();
    var collectedInReplyTo = new IdList();
    var collectedSubject = new SmartReplySubject();

    for (var i in gFolderDisplay.selectedMessages) {
        var msg = gFolderDisplay.selectedMessages[i];
        logger.debug("----------");
        var subject = msg.getStringProperty("subject");
        // Wrapping this and the subsequent ones in the if isn't actually
        // functionally necessary, but it reduces unnecessary logging.
        if (subject) {
            logger.debug("Adding subject " + subject);
            collectedSubject.add(subject);
        }

        var sender = msg.getStringProperty("replyTo") ||
            msg.getStringProperty("sender");
        if (sender) {
            logger.debug("Adding recipient " + sender);
            collectedRecipients.add(sender);
        }

        if (replyAll) {
            var recipients = msg.getStringProperty("recipients");
            if (recipients) {
                logger.debug("Adding recipients from to " + recipients);
                collectedRecipients.add(recipients);
            }
            var ccList = msg.getStringProperty("ccList");
            if (ccList) {
                logger.debug("Adding CCs " + ccList);
                collectedCCs.add(ccList);
            }
        }

        var references = msg.getStringProperty("references");
        if (references) {
            logger.debug("Adding references " + references);
            collectedReferences.add(references);
        }

        var message_id = msg.getStringProperty("message-id");
        if (message_id) {
            if (message_id[0] != '<') {
                message_id = '<' + message_id + '>';
            }
            logger.debug("Adding message-id " + message_id);
            collectedInReplyTo.add(message_id);
        }
        else {
            logger.error("No message ID!");
        }
    }

    var use_bcc = prefBranch.getBoolPref(bccPref);
    var hide_references = prefBranch.getBoolPref(refsPref);

    var inReplyTo = collectedInReplyTo.stringify();

    if (inReplyTo) {
        logger.debug("Appending in-reply-to to references");
        collectedReferences.add(inReplyTo);
    }

    var references = collectedReferences.stringify();

    var recipients = collectedRecipients.stringify("");
    var ccs = collectedCCs.stringify(recipients);
    var subject = collectedSubject.stringify();

    logger.debug("Final values:");
    logger.debug("Subject: " + subject);
    logger.debug("To: " + recipients);
    if (replyAll) {
        logger.debug("CC: " + ccs);
    }
    logger.debug("In-Reply-To: " + inReplyTo);
    logger.debug("References: " + references);

    var msgComposeService = MailServices.compose;
    var params = Components.
        classes["@mozilla.org/messengercompose/composeparams;1"].
        createInstance(Components.interfaces.nsIMsgComposeParams);
    var fields = Components.
        classes["@mozilla.org/messengercompose/composefields;1"].
        createInstance(Components.interfaces.nsIMsgCompFields);
    fields.subject = subject;
    if (use_bcc) {
        collectedRecipients.add(ccs);
        fields.bcc = collectedRecipients.stringify("");
        logger.debug("Using BCC field");
    }
    else {
        fields.to = recipients;
        if (replyAll && ccs) {
            fields.cc = ccs;
        }
    }
    if (hide_references) {
        logger.debug("Omitting references");
    }
    else {
        // N.B. I can't set In-Reply-To right now. See
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1368345 .
        if (references) {
            fields.references = references;
        }
    }
    params.type = Components.interfaces.nsIMsgCompType.New;
    params.format = Components.interfaces.nsIMsgCompFormat.Default;
    params.composeFields = fields;
    msgComposeService.OpenComposeWindowWithParams(null, params);
}

function replyToSelected(window) {
    return replyToSelectedExtended(window, false);
}

function replyAllToSelected(window) {
    return replyToSelectedExtended(window, true);
}

function updateMenuItems(window) {
    logger.debug("Entering updateMenuItems");
    var document = window.document;
    var gFolderDisplay = window["gFolderDisplay"];
    var disabled = gFolderDisplay.selectedCount < 2;
    var command = document.getElementById("rtmm_menu_reply");
    command.disabled = disabled;
    command = document.getElementById("rtmm_menu_replyAll");
    command.disabled = disabled;
}

function loadDefaultPreferences(installPath) {
    Components.utils.import(defaultPreferencesLoaderLink);

    this.defaultPreferencesLoader = new DefaultPreferencesLoader(installPath);
    this.defaultPreferencesLoader.parseDirectory();
}
function unloadDefaultPreferences() {
    this.defaultPreferencesLoader.clearDefaultPrefs();

    Components.utils.unload(defaultPreferencesLoaderLink);
}

function initLogging() {
    try {
        delete Log4Moz.repository._loggers[prefPrefix];
    }
    catch (ex) {}
    logger = Log4Moz.getConfiguredLogger(prefPrefix,
                                         Log4Moz.Level.Trace,
                                         Log4Moz.Level.Info,
                                         Log4Moz.Level.Debug);
    observer = { observe: initLogging }
    Services.prefs.addObserver(prefPrefix + ".logging.console", observer,
                               false);
    Services.prefs.addObserver(prefPrefix + ".logging.dump", observer, false);
    logger.debug("Initialized logging for Reply to Multiple Messages");
}

