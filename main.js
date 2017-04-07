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

    // track when the notebook opens and closes
    sendData(Jupyter.notebook, Date.now(), "notebook-opened", 0, [0]);

    window.onbeforeunload = function (event) {
        sendData(Jupyter.notebook, Date.now(), "notebook-closed", 0, [0]);
    }

    function append_orbit_menu(){
        var menu = $("#help_menu").parent().parent();

        menu.append($('<li> ')
            .addClass("dropdown")
            .attr('id','orbit_header')
            .append($('<a>')
                .addClass('dropdown-toggle')
                .attr('href','#')
                .attr('data-toggle','dropdown')
                .text('Orbit')
                )
            );

        var orbit_header = $("#orbit_header")

        orbit_header.append($('<ul>')
            .addClass('dropdown-menu')
            .attr('id', 'orbit-menu')
            .append($('<li>')
                .attr('id', 'orbit_settings')
                .append($('<a>')
                    .attr('href','#')
                    .text('Orbit Settings')
                )
            )
        );
    }

    append_orbit_menu();

    // get the help_menu item on the page
    // get the parent of that item



    // MenuBar.prototype.add_kernel_help_links = function(help_links) {
    //     /** add links from kernel_info to the help menu */
    //     var divider = $("#kernel-help-links");
    //     if (divider.length === 0) {
    //         // insert kernel help section above about link
    //         var about = $("#notebook_about").parent();
    //         divider = $("<li>")
    //             .attr('id', "kernel-help-links")
    //             .addClass('divider');
    //         about.prev().before(divider);
    //     }
    //     // remove previous entries
    //     while (!divider.next().hasClass('divider')) {
    //         divider.next().remove();
    //     }
    //     if (help_links.length === 0) {
    //         // no help links, remove the divider
    //         divider.remove();
    //         return;
    //     }
    //     var cursor = divider;
    //     help_links.map(function (link) {
    //         cursor.after($("<li>")
    //             .append($("<a>")
    //                 .attr('target', '_blank')
    //                 .attr('title', 'Opens in a new window')
    //                 .attr('href', requirejs.toUrl(link.url))
    //                 .append($("<i>")
    //                     .addClass("fa fa-external-link menu-icon pull-right")
    //                 )
    //                 .append($("<span>")
    //                     .text(link.text)
    //                 )
    //             )
    //         );
    //         cursor = cursor.next();
    //     });
    //
    // };






    // Throws console warning:
    // "accessing "actions" on the global IPython/Jupyter is not recommended.
    // Pass it to your objects contructors at creation time"
    var ActionHandler = Jupyter.actions;

    // List of actions to track. For all available actions see:
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

    function sendData(nb, t, actionName, selectedIndex, selectedIndices){
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

                // get time, action name, and selected cell(s) before action applied
                var nb = this.env.notebook
                var t = Date.now();
                var selectedIndex = nb.get_selected_index();
                var selectedIndices = nb.get_selected_cells_indices();

                // if executing a Code cell, wait for it to execute before scraping the notebook
                // notebook v. 5.0.0 added the finished_execute.CodeCell event
                // that we may want to listen for instead of the kernel idleing
                function sendDataAfterExecution(evt){
                    sendData(nb, t, actionName, selectedIndex, selectedIndices);
                    events.off('kernel_idle.Kernel', sendDataAfterExecution)
                }

                if(actionName.substring(0,3) == "run" && nb.get_cell(selectedIndex).cell_type == "code"){
                    events.on('kernel_idle.Kernel', sendDataAfterExecution);
                    old_call.apply(this, arguments);
                }
                // otherwise just scrape the notebook right away
                else{
                    old_call.apply(this, arguments);
                    sendData(nb, t, actionName, selectedIndex, selectedIndices);

                }
            }
            else{
                old_call.apply(this, arguments);
            }
        }
    };

    function load_extension(){
        patchActionHandlerCall();
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
