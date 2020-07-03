var RTMMOptions = {
    prefBranch: null,
    mapping: [
        ["rtmm-use_bcc-checkbox", "extensions.reply-to-multiple-messages.use_bcc", "bool"],
        ["rtmm-hide_references-checkbox", "extensions.reply-to-multiple-messages.hide_references", "bool"],
        ["rtmm-dumplevel-menu", "extensions.reply-to-multiple-messages.logging.dump", "char"],
        ["rtmm-consolelevel-menu", "extensions.reply-to-multiple-messages.logging.console", "char"],
    ],

    LoadPrefs: async  function() {
        // When the add-on is first installed loading default preferences fails,
        // so we need to redo it here just in case.
      /*  var {DefaultPreferencesLoader} = ChromeUtils.import(
            "chrome://reply-to-multiple-messages/content/" +
            "defaultPreferencesLoader.jsm");
        var loader = new DefaultPreferencesLoader();
        loader.parseUri("chrome://reply-to-multiple-messages/content/prefs.js");

        if (! RTMMOptions.prefBranch) {
            RTMMOptions.prefBranch =
                Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefBranch);
        }
       */
        browser.rtmm_optAPI.LoadPrefs()

        RTMMOptions.mapping.forEach( async function(mapping) {
            var elt_id = mapping[0];
            var elt = document.getElementById(elt_id);
            var pref = mapping[1];
            var pref_type = mapping[2];
            var pref_func;
            switch (pref_type) {
            case "int":
                elt.value = await browser.rtmm_optAPI.getIntPref(pref);
                break;
            case "bool":
                elt.checked = await browser.rtmm_optAPI.getBoolPref(pref);
                break;
            case "string":
                elt.value = await browser.rtmm_optAPI.getStringPref(pref);
                break;
            case "char":
                elt.value = await browser.rtmm_optAPI.getCharPref(pref);
                break;
            default:
                throw new Error("Unrecognized pref type: " + pref_type);
            }
        });
    },

    ValidatePrefs: function(event) {
        RTMMOptions.mapping.forEach(function(mapping) {
            var elt_id = mapping[0];
            var elt = document.getElementById(elt_id);
            var pref = mapping[1];
            var pref_type = mapping[2];
            var pref_func;
            switch (pref_type) {
            case "int":
                browser.rtmm_optAPI.setIntPref(pref, elt.value);
                break;
            case "bool":
                browser.rtmm_optAPI.setBoolPref(pref, elt.checked);
                break;
            case "string":
                browser.rtmm_optAPI.setStringPref(pref, elt.value);
                break;
            case "char":
                browser.rtmm_optAPI.setCharPref(pref, elt.value);
                break;
            default:
                throw new Error("Unrecognized pref type: " + pref_type);
            }
        });
        return true;
    },

    SetOnLoad: function() {
        window.removeEventListener("load", RTMMOptions.SetOnLoad, false);
        var btn_save = document.getElementById("btn_Save");
        var btn_Cancel = document.getElementById("btn_Cancel");
        btn_Cancel.addEventListener("click", function(event) {
            RTMMOptions.LoadPrefs();
        });
        btn_save.addEventListener("click", function(event) {
            if (! RTMMOptions.ValidatePrefs())
                event.preventDefault();
        });
        RTMMOptions.LoadPrefs();
    },
};

window.addEventListener("load", RTMMOptions.SetOnLoad, false);
