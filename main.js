/*
Adam Rule
March 29, 2017
Comet:  NBextension paired with server extension to track notebook use
*/

define([
    'base/js/namespace',
    'base/js/utils'

],function(
    Jupyter,
    utils
){

    var ActionHandler = Jupyter.actions;

    // Lists of actions to track. For all available actions see
    // https://github.com/jupyter/notebook/blob/master/notebook/static/notebook/js/actions.js
    var actions_to_intercept = [
        // execute cells
        'run-cell',
        'run-cell-and-select-next',
        'run-cell-and-insert-below',
        'run-all-cells',
        'run-all-cells-above',
        'run-all-cells-below',
        // delete cells
        'delete-cell',
        'undo-cell-deletion',
        // split cells
        'split-cell-at-cursor',
        'merge-cell-with-previous-cell',
        'merge-cell-with-next-cell',
        'merge-selected-cells',
        'merge-cells',
        // cut and paste
        'cut-cell',
        'paste-cell-above',
        'paste-cell-below',
        //'copy-cell',
        // insert cells
        'insert-cell-above',
        'insert-cell-below',
        // move cells
        'move-cell-down',
        'move-cell-up',
        // change cell type
        'change-cell-to-markdown',
        'change-cell-to-code',
        'change-cell-to-raw',
        // change display of cell output
        //'toggle-cell-output-collapsed',
        //'toggle-cell-output-scrolled',
        //'clear-cell-output',
        //'restart-kernel-and-clear-output',
        //'confirm-restart-kernel-and-clear-output',
    ];

    // TODO implement tracking when multiple cells are selected
    // in save function on the notebook
    function send_data(t, eventName, selectedIndex, selectedIndicies, mod, url){
        /* Send data about the action to the Comet server */

        var d = JSON.stringify({
            time: t,
            name: eventName,
            index: selectedIndex,
            indices: selectedIndicies,
            model: mod
        });

        var settings = {
            processData : false,
            type : "POST",
            dataType: "json",
            data: d,
            contentType: 'application/json',
        };

        utils.promising_ajax(url, settings);
    }

    function patch_actionHandler_call(){
        /* Inject code into the actionhandler to track certain events */

        console.log('[Comet] patching ActionHandler.prototype.call');
        var old_call = ActionHandler.__proto__.call;

        // whether we do the action or the tracking first depends on the action
        ActionHandler.__proto__.call = function (){

            var actionName = arguments[0].split(":")[1]; // remove 'jupter-notebook:' prefix

            if(actions_to_intercept.indexOf(actionName)>-1){
                // get time, event name, and selected cell(s) before execution
                var t = Date.now();
                var selectedIndex = this.env.notebook.get_selected_index();
                var selectedIndicies = this.env.notebook.get_selected_cells_indices();

                // let the notebook apply the action
                old_call.apply(this, arguments);

                // now get the modified notebook and its url
                var mod = this.env.notebook.toJSON();
                var notebookUrl =  this.env.notebook.notebook_path;
                var baseUrl = this.env.notebook.base_url;
                var url = utils.url_path_join(baseUrl, 'api/comet', notebookUrl);

                // and send the data to the server extension for processing
                send_data(t, actionName, selectedIndex, selectedIndices, mod, url);
            }
            else{
                old_call.apply(this, arguments);
            }
        }
    };

    function load_extension(){
        patch_actionHandler_call();
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
