var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("reply-to-multiple-messages@kamens.us");
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var prefBranch=null;
var prefService=null;

var rtmm_optAPI = class extends ExtensionCommon.ExtensionAPI
{
    getAPI(context)
        {
               return{
                        rtmm_optAPI:
                            {
                                LoadPrefs: function()
                                 {
                                    var {DefaultPreferencesLoader} = ChromeUtils.import(extension.rootURI.resolve("/content/defaultPreferencesLoader.js"));
                                    var loader = new DefaultPreferencesLoader();
                                    loader.parseUri(extension.rootURI.resolve("/content/prefs.js"));
                                    if (!prefBranch)
                                        {
                                            prefBranch =
                                            Components.classes["@mozilla.org/preferences-service;1"]
                                            .getService(Components.interfaces.nsIPrefBranch);
                                        }
                                },
                                //get
                                getIntPref:function(pref)
                                {
                                  return  prefBranch.getIntPref(pref);
                                },
                                getBoolPref:function(pref)
                                {
                                  return  prefBranch.getBoolPref(pref);
                                },
                                getStringPref:function(pref)
                                {
                                    return prefBranch.getStringPref(pref);
                                },
                                getCharPref:function(pref)
                                {
                                    return prefBranch.getCharPref(pref);
                                },
                                //set
                                setIntPref:function(pref,elt_value)
                                {
                                    	prefBranch.setIntPref(pref,elt_value);
                                },
                                setBoolPref:function(pref,elt_value)
                                {
                                        prefBranch.setBoolPref(pref,elt_value);
                                },
                                setStringPref:function(pref,elt_value)
                                {
                                        prefBranch.setStringPref(pref,elt_value);
                                },
                                setCharPref:function(pref,elt_value)
                                {
                                        prefBranch.setCharPref(pref,elt_value);
                                }


                            }
                    };
        }
};