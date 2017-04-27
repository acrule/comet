/*
Comet:  NBextension paired with server extension to track notebook use
*/

define([
    'jquery',
    'base/js/namespace',
    'base/js/utils',
    'base/js/events',
    'notebook/js/cell',
    'notebook/js/clipboard'
],function(
    $,
    Jupyter,
    utils,
    events,
    Cell,
    clipboard
){

    // Get references to object constructors so we can patch functions
    var ActionHandler = Jupyter.actions;
    var Notebook = Jupyter.notebook;

    // Notebook actions we will track. For all available actions see:
    // https://github.com/jupyter/notebook/blob/master/notebook/static/notebook/js/actions.js
    var actions_to_intercept = [
        // execute cells
        'run-cell',
        'run-cell-and-select-next',
        'run-cell-and-insert-below',
        'run-all-cells',
        'run-all-cells-above',
        'run-all-cells-below',
        'confirm-restart-kernel-and-run-all-cells',
        // delete cells
        'delete-cell',
        'undo-cell-deletion',
        // split and merge cells
        'split-cell-at-cursor',
        'merge-cell-with-previous-cell',
        'merge-cell-with-next-cell',
        'merge-selected-cells',
        'merge-cells',
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
        'confirm-restart-kernel-and-clear-output'        
        // not tracking cut, copy, paste due to inconsistent calling of actions
        // in Notebok v 5.0.0 the paste menu items do not call these actions
        // also copy-paste shortcuts (e.g., CMD-C) are handled by the browser
        // cut and paste
        // 'cut-cell',
        // 'copy-cell',
        // 'paste-cell-above',
        // 'paste-cell-below',
        // 'paste-cell-replace',
    ];

    function checkCometSettings(){
        if (Notebook.metadata.comet_tracking === undefined){
            Notebook.metadata.comet_tracking = true;
        }
    }
    
    function toggleCometSettings(){
        Notebook.metadata.comet_tracking = !Notebook.metadata.comet_tracking;
        setCometMessage()
        if(Notebook.metadata.comet_tracking){
            trackAction(Notebook, Date.now(), "comet-tracking-on", 0, [0]);
        }
        else{
            trackAction(Notebook, Date.now(), "comet-tracking-off", 0, [0]);
        }        
    }
    
    function setCometMessage(){
        message = ''
        if(Notebook.metadata.comet_tracking){
            message = "Comet Tracking on"
            $("#help_menu")
            $("#comet_settings").find('a').text('Stop Tracking')
        }
        else{
            message = "Comet Tracking off"
            $("#comet_settings").find('a').text('Start Tracking')
        }
        Jupyter.notification_area.widget('notebook').set_message(message, 2000)
    }

    // TODO fix close events not being tracked if server is already shut down
    function trackNotebookOpenClose(){
        /* track notebook open and close events */
        trackAction(Notebook, Date.now(), "notebook-opened", 0, [0]);
        window.onbeforeunload = function(event) {
            trackAction(Notebook, Date.now(), "notebook-closed", 0, [0]);
        }
    }

    function renderCometMenu(){
        /* add menu after help menu for managing Comet recording */

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
        );
            
        var comet_menu = $("#comet-menu");
        
        comet_menu.append($('<li>')
            .attr('id', 'comet_settings')
            .append($('<a>')
                .attr('href','#')
                .text('Toggle Recording')
                .click(toggleCometSettings)
            )
        );
        
        comet_menu.append($('<li>')
            .attr('id', 'comet_settings')
            .append($('<a>')
                .attr('href','/api/comet/' + Notebook.notebook_name.split(".")[0])
                .text('See Comet Data')
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

    function patchCutCopyPaste(){
        /* Track when cells are cut, copied, and pasted */

        // the cut function calls the copy function, so for now cut actions
        // will be tracked twice, and data need to be cleaned later
        var oldCut = Notebook.__proto__.cut_cell;
        var oldCopy = Notebook.__proto__.copy_cell;
        var oldPasteReplace = Notebook.__proto__.paste_cell_replace;
        var oldPasteAbove = Notebook.__proto__.paste_cell_above;
        var oldPasteBelow = Notebook.__proto__.paste_cell_below;

        Notebook.__proto__.cut_cell = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();

            oldCut.apply(this, arguments);

            trackAction(this, t, 'cut-cell', selectedIndex, selectedIndices);
        }

        Notebook.__proto__.copy_cell = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();

            oldCopy.apply(this, arguments);

            trackAction(this, t, 'copy-cell', selectedIndex, selectedIndices);
        }

        Notebook.__proto__.paste_cell_replace = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();

            oldPasteReplace.apply(this, arguments);

            trackAction(this, t, 'paste-cell-replace', selectedIndex, selectedIndices);
        }

        Notebook.__proto__.paste_cell_above = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();

            oldPasteAbove.apply(this, arguments);

            trackAction(this, t, 'paste-cell-above', selectedIndex, selectedIndices);
        }

        Notebook.__proto__.paste_cell_below = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();

            oldPasteBelow.apply(this, arguments);

            trackAction(this, t, 'paste-cell-below', selectedIndex, selectedIndices);
        }

        // listen for system cut, copy, paste events (e.g., those called with
        // keyboard shortcuts that are handled by the browser
        document.addEventListener('cut', function(){
            if (Notebook.mode == 'command') {
                var t = Date.now();
                var selectedIndex = Notebook.get_selected_index();
                var selectedIndices = Notebook.get_selected_cells_indices();
                trackAction(Notebook, t, 'cut-cell', selectedIndex, selectedIndices);
            }
        });

        document.addEventListener('copy', function(){
            if (Notebook.mode == 'command') {
                var t = Date.now();
                var selectedIndex = Notebook.get_selected_index();
                var selectedIndices = Notebook.get_selected_cells_indices();
                trackAction(Notebook, t, 'copy-cell', selectedIndex, selectedIndices);
            }
        });

        document.addEventListener('paste', function(){
            if (Notebook.mode == 'command') {
                var t = Date.now();
                var selectedIndex = Notebook.get_selected_index();
                var selectedIndices = Notebook.get_selected_cells_indices();
                trackAction(Notebook, t, 'paste-cell-below', selectedIndex, selectedIndices);
            }
        });

    }

    function patchActionHandlerCall(){
        /* Inject code into the actionhandler to track desired actions */

        var oldCall = ActionHandler.__proto__.call;
        
        ActionHandler.__proto__.call = function (){            

            checkCometSettings();
            var tracking = Notebook.metadata.comet_tracking;
            if(!tracking){
                oldCall.apply(this, arguments);                        
            }
            else{
                var actionName = arguments[0].split(":")[1]; // remove 'jupter-notebook:' prefix
                if(actionName == 'restart-kernel-and-run-all-cells'){
                }

                var trackThisAction = actions_to_intercept.indexOf(actionName)>-1;
                if(trackThisAction){
                    // get time, action name, and selected cell(s) before applying action
                    var nb = this.env.notebook
                    var t = Date.now();
                    var selectedIndex = nb.get_selected_index();
                    var selectedIndices = nb.get_selected_cells_indices();

                    // if executing a Code cell, or running all cells
                    // wait for the execution to finish before tracking the action
                    // since we want to see the changes
                    // notebook v. 5.0.0 added the `finished_execute.CodeCell` event
                    // that we may want to listen for instead of the kernel idleing
                    function trackActionAfterExecution(evt){
                        trackAction(nb, t, actionName, selectedIndex, selectedIndices);
                        events.off('kernel_idle.Kernel', trackActionAfterExecution)
                    }

                    if((actionName.substring(0,3) == "run"
                        && nb.get_cell(selectedIndex).cell_type == "code")
                        || actionName == 'confirm-restart-kernel-and-run-all-cells' ){
                        events.on('kernel_idle.Kernel', trackActionAfterExecution);
                        oldCall.apply(this, arguments);
                    }
                    // if not executing a code cell just track the action immediately
                    else{
                        oldCall.apply(this, arguments);
                        trackAction(nb, t, actionName, selectedIndex, selectedIndices);
                    }
                }
                else{
                    oldCall.apply(this, arguments);
                }                
            }            
        }
    };

    // TODO find way to track unselection 
    // current issue is that cells are regularly unselected, even for things like
    // move events, which leads to a lot of false positives.
    function patchCellUnselect(){
        
        oldSelect = Notebook.__proto__.select;
        
        Notebook.__proto__.select = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();
            trackAction(this, t, 'unselect-cell', selectedIndex, selectedIndices);
            
            oldSelect.apply(this, arguments);
        }
        
        /* Track when cells are unselected so we can track if users change
           cell contents without re-executing the cell */
           
    //    oldCellOnClick = Cell.Cell.prototype._on_click
    //    
    //    Cell.Cell.prototype._on_click = function (){
    //        console.log(Notebook.get_selected_index())
    //        oldCellOnClick.apply(this);
    //    }
         
           
    //    events.on('select.Cell', function(evt){
    //        console.log(evt);
    //    });

        // oldCellUnselect = Cell.Cell.prototype.unselect;
        // Cell.Cell.prototype.unselect = function() {
        //     if(this.selected){  // only track unselection of selected cells                
        //         // if(Jupyter.notebook.mode == "edit"){
        //         var t = Date.now();
        //         var selectedIndex = this.notebook.get_selected_index();
        //         var selectedIndices = this.notebook.get_selected_cells_indices();
        //         trackAction(this.notebook, t, 'unselect-cell', selectedIndex, selectedIndices);
        //         // }
        //     }
        //     oldCellUnselect.apply(this);
        // }
    }

    function load_extension(){
        console.log('[Comet] tracking changes to notebook');
        trackNotebookOpenClose();
        patchActionHandlerCall();
        patchCutCopyPaste();
        patchCellUnselect();

        renderCometMenu();
        checkCometSettings();
        setCometMessage();
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
