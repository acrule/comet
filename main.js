/*
Comet:  NBextension paired with server extension to track notebook use
*/

define([
    'jquery',
    'base/js/namespace',
    'base/js/utils',
    'base/js/events'
],function(
    $,
    Jupyter,
    utils,
    events
){

    var ActionHandler = Jupyter.actions;
    // List of notebook actions to track. For all available actions see:
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
        // split and merge cells
        'split-cell-at-cursor',
        'merge-cell-with-previous-cell',
        'merge-cell-with-next-cell',
        'merge-selected-cells',
        'merge-cells',
        // cut and paste
        'cut-cell',
        'paste-cell-above',
        'paste-cell-below',
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
        'clear-cell-output',
        'restart-kernel-and-clear-output',
        'toggle-cell-output-collapsed',
        'toggle-cell-output-scrolled',
        // 'confirm-restart-kernel-and-clear-output',

    ];

    events.on('file_renamed.Editor', function(evt){
        console.log("The filename changed")
        console.log(evt)
    });

    function monitorNotebookOpenClose(){
        // track notebook open event
        trackAction(Jupyter.notebook, Date.now(), "notebook-opened", 0, [0]);

        // listen for notebook close (i.e., browser tab closes)
        window.onbeforeunload = function (event) {
            trackAction(Jupyter.notebook, Date.now(), "notebook-closed", 0, [0]);
        }
    }

    function renderCometMenu(){
        /* place menu in toolbar for managing Comet settings */

        var menu = $("#help_menu").parent().parent();
        menu.append($('<li> ')
            .addClass("dropdown")
            .attr('id','comet_header')
            .append($('<a>')
                .addClass('dropdown-toggle')
                .attr('href','#')
                .attr('data-toggle','dropdown')
                .text('Comet')
                )
            );

        var comet_header = $("#comet_header")
        comet_header.append($('<ul>')
            .addClass('dropdown-menu')
            .attr('id', 'comet-menu')
            .append($('<li>')
                .attr('id', 'comet_settings')
                .append($('<a>')
                    .attr('href','#')
                    .text('Comet Settings')
                )
            )
        );
    }

    function trackAction(nb, t, actionName, selectedIndex, selectedIndices){
        /* Send data about the action to the Comet server extension */

        var mod = nb.toJSON();
        var notebookUrl =  nb.notebook_path;
        var baseUrl = nb.base_url;
        var url = utils.url_path_join(baseUrl, 'api/comet', notebookUrl);

        var d = JSON.stringify({
            time: t,
            name: actionName,
            index: selectedIndex,
            indices: selectedIndices,
            model: mod
        });

        var settings = {
            processData : false,
            type : "POST",
            dataType: "json",
            data: d,
            contentType: 'application/json',
        };

        var response = utils.promising_ajax(url, settings);
    }

    function patchActionHandlerCall(){
        /* Inject code into the actionhandler to track desired actions */

        console.log('[Comet] patching ActionHandler.prototype.call');
        var old_call = ActionHandler.__proto__.call;

        ActionHandler.__proto__.call = function (){

            var actionName = arguments[0].split(":")[1]; // remove 'jupter-notebook:' prefix

            if(actions_to_intercept.indexOf(actionName)>-1){

                // get time, action name, and selected cell(s) before applying action
                var nb = this.env.notebook
                var t = Date.now();
                var selectedIndex = nb.get_selected_index();
                var selectedIndices = nb.get_selected_cells_indices();

                // if executing a Code cell, wait for the execution to finish
                // before tracking the action since we want to see the changes
                // notebook v. 5.0.0 added the `finished_execute.CodeCell` event
                // that we may want to listen for instead of the kernel idleing
                function trackActionAfterExecution(evt){
                    trackAction(nb, t, actionName, selectedIndex, selectedIndices);
                    events.off('kernel_idle.Kernel', trackActionAfterExecution)
                }

                if(actionName.substring(0,3) == "run" && nb.get_cell(selectedIndex).cell_type == "code"){
                    events.on('kernel_idle.Kernel', trackActionAfterExecution);
                    old_call.apply(this, arguments);
                }
                // if not executing a code cell just track the action immediately
                else{
                    old_call.apply(this, arguments);
                    trackAction(nb, t, actionName, selectedIndex, selectedIndices);

                }
            }
            else{
                old_call.apply(this, arguments);
            }
        }
    };

    function load_extension(){
        monitorNotebookOpenClose();
        patchActionHandlerCall();
        renderCometMenu();
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
