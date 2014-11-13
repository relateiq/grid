(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

angular.module('riq-grid', []).
    factory('riqGrid', function () {
        return require('@grid/core');
    })
;


},{"@grid/core":10}],2:[function(require,module,exports){
var addDirtyProps = require('@grid/add-dirty-props');
var util = require('@grid/util');
var noop = require('@grid/no-op');

module.exports = function (_grid, name, lengthName, defaultLength) {
    var grid = _grid;

    var DEFAULT_LENGTH = defaultLength;
    var descriptors = [];
    var numFixed = 0;
    var numHeaders = 0;
    var makeDirtyClean = require('@grid/dirty-clean');
    var dirtyClean = makeDirtyClean(grid);
    var builderDirtyClean = makeDirtyClean(grid);
    var selected = [];

    function setDescriptorsDirty() {
        grid.eventLoop.fire('grid-' + name + '-change');
        dirtyClean.setDirty();
        builderDirtyClean.setDirty();
    }

    function fireSelectionChange() {
        grid.eventLoop.fire('grid-' + name + '-selection-change');
    }

    var api = {
        areBuildersDirty: builderDirtyClean.isDirty,
        isDirty: dirtyClean.isDirty,
        add: function (toAdd) {
            if (!util.isArray(toAdd)) {
                toAdd = [toAdd];
            }
            toAdd.forEach(function (descriptor) {
                if (descriptor.header) {
                    descriptors.splice(numHeaders, 0, descriptor);
                    numFixed++;
                    numHeaders++;
                }

                else {
                    //if the column is fixed and the last one added is fixed (we only allow fixed at the beginning for now)
                    if (descriptor.fixed) {
                        if (!descriptors.length || descriptors[descriptors.length - 1].fixed) {
                            numFixed++;
                        } else {
                            throw 'Cannot add a fixed column after an unfixed one';
                        }
                    }
                    descriptors.push(descriptor);
                }
            });

            setDescriptorsDirty();
        },
        addHeaders: function (toAdd) {
            if (!util.isArray(toAdd)) {
                toAdd = [toAdd];
            }
            toAdd.forEach(function (header) {
                header.header = true;
            });
            api.add(toAdd);
        },
        header: function (index) {
            return descriptors[index];
        },
        get: function (index) {
            return descriptors[index];
        },
        length: function (includeHeaders) {
            var subtract = includeHeaders ? 0 : numHeaders;
            return descriptors.length - subtract;
        },
        remove: function (descriptor) {
            var index = descriptors.indexOf(descriptor);
            if (index !== -1) {
                descriptors.splice(index, 1);
                if (descriptor.header) {
                    numFixed--;
                    numHeaders--;
                } else if (descriptor.fixed) {
                    numFixed--;
                }
            }
        },
        clear: function (includeHeaders) {
            descriptors.slice(0).forEach(function (descriptor) {
                if (includeHeaders || !descriptor.header) {
                    api.remove(descriptor);
                }
            });
        },
        move: function (start, target) {
            descriptors.splice(target, 0, descriptors.splice(start, 1)[0]);
            setDescriptorsDirty();
        },
        numHeaders: function () {
            return numHeaders;
        },
        numFixed: function () {
            return numFixed;
        },
        toVirtual: function (dataIndex) {
            return dataIndex + api.numHeaders();
        },
        toData: function (virtualIndex) {
            return virtualIndex - api.numHeaders();
        },

        select: function (index) {

            var descriptor = api[name](index);
            if (!descriptor.selected) {
                descriptor.selected = true;
                selected.push(index);
                fireSelectionChange();
            }
        },
        deselect: function (index, dontNotify) {
            var descriptor = api[name](index);
            if (descriptor.selected) {
                descriptor.selected = false;
                selected.splice(selected.indexOf(index), 1);
                if (!dontNotify) {
                    fireSelectionChange();
                }
            }
        },
        toggleSelect: function (index) {
            var descriptor = api[name](index);
            if (descriptor.selected) {
                api.deselect(index);
            } else {
                api.select(index);
            }
        },
        clearSelected: function () {
            var length = selected.length;
            selected.slice(0).forEach(function (index) {
                api.deselect(index, true);
            });
            if (length) {
                fireSelectionChange();
            }
        },
        getSelected: function () {
            return selected;
        },
        create: function (builder) {
            var descriptor = {};
            var fixed = false;
            Object.defineProperty(descriptor, 'fixed', {
                enumerable: true,
                get: function () {
                    return descriptor.header || fixed;
                },
                set: function (_fixed) {
                    fixed = _fixed;
                }
            });

            addDirtyProps(descriptor, ['builder'], [builderDirtyClean]);
            descriptor.builder = builder;

            return addDirtyProps(descriptor, [
                {
                    name: lengthName,
                    onDirty: function () {
                        grid.eventLoop.fire('grid-' + name + '-change');
                    }
                }
            ], [dirtyClean]);
        },
        createBuilder: function (render, update) {
            return {render: render || noop, update: update || noop};
        }
    };

    //basically height or width
    api[lengthName] = function (index) {
        if (!descriptors[index]) {
            return NaN;
        }

        return descriptors[index] && descriptors[index][lengthName] || DEFAULT_LENGTH;
    };

    //row or col get
    api[name] = function (index) {
        return descriptors[index + numHeaders];
    };

    return api;
};
},{"@grid/add-dirty-props":3,"@grid/dirty-clean":14,"@grid/no-op":20,"@grid/util":26}],3:[function(require,module,exports){
module.exports = function (obj, props, dirtyCleans) {
    props.forEach(function (prop) {
        var val;
        var name = prop.name || prop;
        Object.defineProperty(obj, name, {
            enumerable: true,
            get: function () {
                return val;
            }, set: function (_val) {
                if (_val !== val) {
                    dirtyCleans.forEach(function (dirtyClean) {
                        dirtyClean.setDirty();
                    });
                    if (prop.onDirty) {
                        prop.onDirty();
                    }
                }
                val = _val;
            }
        });
    });
    return obj;
};
},{}],4:[function(require,module,exports){
var positionRange = require('@grid/position-range');
var makeDirtyClean = require('@grid/dirty-clean');
var addDirtyProps = require('@grid/add-dirty-props');

module.exports = function (_grid) {
    var grid = _grid;

    var dirtyClean = makeDirtyClean(grid);
    var descriptors = [];

    var api = {
        add: function (descriptor) {
            descriptors.push(descriptor);
            dirtyClean.setDirty();
        },
        remove: function (descriptor) {
            descriptors.splice(descriptors.indexOf(descriptor), 1);
            dirtyClean.setDirty();
        },
        getAll: function () {
            return descriptors.slice(0);
        },
        create: function (top, left, className, height, width, space) {
            var thisDirtyClean = makeDirtyClean(grid);
            var descriptor = {};
            //mixins
            positionRange(descriptor, thisDirtyClean, dirtyClean);
            addDirtyProps(descriptor, ['class'], [thisDirtyClean, dirtyClean]);

            //all of these are optional
            descriptor.top = top;
            descriptor.left = left;
            //default to single cell ranges
            descriptor.height = height || 1;
            descriptor.width = width || 1;
            descriptor.class = className;
            descriptor.space = space || descriptor.space;
            return descriptor;
        },
        isDirty: dirtyClean.isDirty
    };


    return api;
};
},{"@grid/add-dirty-props":3,"@grid/dirty-clean":14,"@grid/position-range":22}],5:[function(require,module,exports){
var customEvent = require('@grid/custom-event');

var PROPS_TO_COPY_FROM_MOUSE_EVENTS = ['clientX', 'clientY', 'gridX', 'gridY', 'layerX', 'layerY', 'row', 'col', 'realRow', 'realCol'];


module.exports = function (_grid) {
    var grid = _grid;

    var model = {};

    var wasDragged = false;

    model._annotateEvent = function annotateEvent(e) {
        switch (e.type) {
            case 'click':
                e.wasDragged = wasDragged;
            /* jshint -W086 */
            case 'mousedown':
            /* jshint +W086 */
            case 'mousemove':
            case 'mouseup':
                model._annotateEventInternal(e);
                break;

        }
    };

    model._annotateEventInternal = function (e) {
        var y = grid.viewPort.toGridY(e.clientY);
        var x = grid.viewPort.toGridX(e.clientX);
        e.realRow = grid.viewPort.getRowByTop(y);
        e.realCol = grid.viewPort.getColByLeft(x);
        e.virtualRow = grid.viewPort.toVirtualRow(e.realRow);
        e.virtualCol = grid.viewPort.toVirtualCol(e.realCol);
        e.row = e.virtualRow - grid.rowModel.numHeaders();
        e.col = e.virtualCol - grid.colModel.numHeaders();
        e.gridX = x;
        e.gridY = y;
    };

    grid.eventLoop.addInterceptor(function (e) {
        model._annotateEvent(e);

        if (e.type === 'mousedown') {
            setupDragEventForMouseDown(e);
        }
    });

    function setupDragEventForMouseDown(downEvent) {
        wasDragged = false;
        var lastDragRow = downEvent.row;
        var lastDragCol = downEvent.col;
        var dragStarted = false;
        var unbindMove = grid.eventLoop.bind('mousemove', window, function (e) {
            if (dragStarted && !e.which) {
                //got a move event without mouse down which means we somehow missed the mouseup
                console.log('mousemove unbind, how on earth do these happen?');
                handleMouseUp(e);
                return;
            }

            if (!dragStarted) {
                wasDragged = true;
                createAndFireDragEvent('grid-drag-start', downEvent);
                dragStarted = true;
            }

            createAndFireDragEvent('grid-drag', e);

            if (e.row !== lastDragRow || e.col !== lastDragCol) {
                createAndFireDragEvent('grid-cell-drag', e);

                lastDragRow = e.row;
                lastDragCol = e.col;
            }

        });

        var unbindUp = grid.eventLoop.bind('mouseup', window, handleMouseUp);

        function handleMouseUp(e) {
            unbindMove();
            unbindUp();

            var dragEnd = createDragEventFromMouseEvent('grid-drag-end', e);

            //row, col, x, and y should inherit
            grid.eventLoop.fire(dragEnd);
        }
    }

    function createDragEventFromMouseEvent(type, e) {
        var event = customEvent(type, true, true);
        PROPS_TO_COPY_FROM_MOUSE_EVENTS.forEach(function (prop) {
            event[prop] = e[prop];
        });
        event.originalEvent = e;
        return event;
    }

    function createAndFireDragEvent(type, e) {
        var drag = createDragEventFromMouseEvent(type, e);
        if (e.target) {
            e.target.dispatchEvent(drag);
        } else {
            grid.eventLoop.fire(drag);
        }
        return drag;
    }

    return model;
};
},{"@grid/custom-event":11}],6:[function(require,module,exports){
var util = require('@grid/util');
var capitalize = require('capitalize');

module.exports = function (_grid) {
    var grid = _grid;
    var dirtyClean = require('@grid/dirty-clean')(grid);


    var row;
    var model = {col: 0};
    Object.defineProperty(model, 'row', {
        enumerable: true,
        get: function () {
            return row;
        },
        set: function (r) {
            if (r < 0 || isNaN(r)) {
                debugger;
            }
            row = r;
        }
    });
    model.row = 0;

    model.isDirty = dirtyClean.isDirty;

    model.scrollTo = function (r, c, dontFire) {
        if (isNaN(r) || isNaN(c)) {
            return;
        }
        var maxRow = (grid.rowModel.length() || 1) - 1;
        var maxCol = (grid.colModel.length() || 1) - 1;
        var lastRow = model.row;
        var lastCol = model.col;
        model.row = util.clamp(r, 0, maxRow);
        model.col = util.clamp(c, 0, maxCol);
        if (lastRow !== model.row || lastCol !== model.col) {
            dirtyClean.setDirty();
            if (!dontFire) {
                var top = grid.virtualPixelCellModel.height(0, model.row - 1);
                var left = grid.virtualPixelCellModel.width(0, model.col - 1);
                grid.pixelScrollModel.scrollTo(top, left, true);
            }
        }
    };

    function convertVirtualToScroll(virtualCoord, rowOrCol) {
        return virtualCoord - grid[rowOrCol + 'Model'].numFixed();
    }

    function getScrollToRowOrCol(virtualCoord, rowOrCol, heightWidth) {
        var currentScroll = model[rowOrCol];
        var scrollTo = currentScroll;
        if (grid.viewPort[rowOrCol + 'IsInView'](virtualCoord)) {
            return scrollTo;
        }

        var targetScroll = convertVirtualToScroll(virtualCoord, rowOrCol);
        if (targetScroll < currentScroll) {
            scrollTo = targetScroll;
        } else if (targetScroll > currentScroll) {

            var lengthToCell = grid.virtualPixelCellModel[heightWidth](0, virtualCoord);
            var numFixed = grid[rowOrCol + 'Model'].numFixed();
            scrollTo = 0;
            for (var i = numFixed; i < virtualCoord; i++) {
                lengthToCell -= grid.virtualPixelCellModel[heightWidth](i);
                scrollTo = i - (numFixed - 1);
                if (lengthToCell <= grid.viewPort[heightWidth]) {
                    break;
                }
            }
        }

        return scrollTo;
    }

    model.scrollIntoView = function (vr, vc) {
        vr = grid.virtualPixelCellModel.clampRow(vr);
        vc = grid.virtualPixelCellModel.clampCol(vc);
        var newRow = getScrollToRowOrCol(vr, 'row', 'height');
        var newCol = getScrollToRowOrCol(vc, 'col', 'width');
        model.scrollTo(newRow, newCol);
    };


    return model;
};
},{"@grid/dirty-clean":14,"@grid/util":26,"capitalize":30}],7:[function(require,module,exports){
module.exports = function (_grid) {
    var grid = _grid;

    var api = require('@grid/abstract-row-col-model')(grid, 'col', 'width', 100);

    return api;
};
},{"@grid/abstract-row-col-model":2}],8:[function(require,module,exports){
var elementClass = require('element-class');
var util = require('@grid/util');


module.exports = function (_grid) {
    var grid = _grid;

    var api = {annotateDecorator: makeReorderDecorator};

    function makeReorderDecorator(headerDecorator) {
        var col = headerDecorator.left;
        headerDecorator._dragRect = grid.decorators.create(0, undefined, Infinity, undefined, 'px', 'real');

        headerDecorator._dragRect.postRender = function (div) {
            div.setAttribute('class', 'grid-drag-rect');
        };

        headerDecorator._onDragStart = function (e) {
            if (e.realCol < grid.colModel.numFixed()) {
                return;
            }


            grid.decorators.add(headerDecorator._dragRect);

            headerDecorator._dragRect.width = grid.viewPort.getColWidth(col);
            var colOffset = e.gridX - headerDecorator.getDecoratorLeft();

            headerDecorator._dragRect._targetCol = grid.decorators.create(0, undefined, Infinity, 1, 'cell', 'real');
            headerDecorator._dragRect._targetCol.postRender = function (div) {
                div.setAttribute('class', 'grid-reorder-target');
                headerDecorator._dragRect._targetCol._renderedElem = div;
            };
            grid.decorators.add(headerDecorator._dragRect._targetCol);

            headerDecorator._unbindDrag = grid.eventLoop.bind('grid-drag', function (e) {
                headerDecorator._dragRect.left = util.clamp(e.gridX - colOffset, grid.viewPort.getColLeft(grid.colModel.numFixed()), Infinity);
                headerDecorator._dragRect._targetCol.left = util.clamp(e.realCol, grid.colModel.numFixed(), Infinity);
                if (e.realCol > col) {
                    elementClass(headerDecorator._dragRect._targetCol._renderedElem).add('right');
                } else {
                    elementClass(headerDecorator._dragRect._targetCol._renderedElem).remove('right');
                }


            });

            headerDecorator._unbindDragEnd = grid.eventLoop.bind('grid-drag-end', function (e) {
                var targetCol = headerDecorator._dragRect._targetCol.left;

                grid.colModel.move(grid.viewPort.toVirtualCol(col), grid.viewPort.toVirtualCol(targetCol));
                grid.decorators.remove([headerDecorator._dragRect._targetCol, headerDecorator._dragRect]);
                headerDecorator._unbindDrag();
                headerDecorator._unbindDragEnd();
            });
        };

        headerDecorator.postRender = function (div) {
            div.setAttribute('class', 'grid-col-reorder');
            grid.eventLoop.bind('grid-drag-start', div, headerDecorator._onDragStart);
        };

        return headerDecorator;
    }

    require('@grid/header-decorators')(grid, api);

    return api;
};
},{"@grid/header-decorators":16,"@grid/util":26,"element-class":31}],9:[function(require,module,exports){
module.exports = function (_grid) {
    var grid = _grid;


    var api = {annotateDecorator: annotateDecorator};

    function annotateDecorator(headerDecorator) {
        var col = headerDecorator.left;
        headerDecorator._dragLine = grid.decorators.create(0, undefined, Infinity, 1, 'px', 'real');

        headerDecorator._dragLine.postRender = function (div) {
            div.setAttribute('class', 'grid-drag-line');
        };

        headerDecorator._onDragStart = function (e) {

            grid.decorators.add(headerDecorator._dragLine);

            headerDecorator._unbindDrag = grid.eventLoop.bind('grid-drag', function (e) {
                var minX = headerDecorator.getDecoratorLeft() + 10;
                headerDecorator._dragLine.left = Math.max(e.gridX, minX);
            });

            headerDecorator._unbindDragEnd = grid.eventLoop.bind('grid-drag-end', function (e) {
                grid.colModel.get(grid.viewPort.toVirtualCol(col)).width = headerDecorator._dragLine.left - headerDecorator.getDecoratorLeft();
                grid.decorators.remove(headerDecorator._dragLine);
                headerDecorator._unbindDrag();
                headerDecorator._unbindDragEnd();
            });
        };

        headerDecorator.postRender = function (div) {
            div.style.transform = 'translateX(50%)';
            div.style.webkitTransform = 'translateX(50%)';

            div.style.removeProperty('left');
            div.setAttribute('class', 'col-resize');

            grid.eventLoop.bind('grid-drag-start', div, headerDecorator._onDragStart);
        };
    }

    require('@grid/header-decorators')(grid, api);

    return api;
};
},{"@grid/header-decorators":16}],10:[function(require,module,exports){
var elementClass = require('element-class');
var dirtyClean = require('@grid/dirty-clean');

module.exports = function () {

    var grid = {};

    //the order here matters because some of these depend on each other
    grid.eventLoop = require('@grid/event-loop')(grid);
    grid.decorators = require('@grid/decorators')(grid);
    grid.cellClasses = require('@grid/cell-classes')(grid);
    grid.rowModel = require('@grid/row-model')(grid);
    grid.colModel = require('@grid/col-model')(grid);
    grid.dataModel = require('@grid/simple-data-model')(grid);
    grid.virtualPixelCellModel = require('@grid/virtual-pixel-cell-model')(grid);
    grid.cellScrollModel = require('@grid/cell-scroll-model')(grid);
    grid.cellMouseModel = require('@grid/cell-mouse-model')(grid);

    grid.viewPort = require('@grid/view-port')(grid);
    grid.viewLayer = require('@grid/view-layer')(grid);

    //things with logic that also register decorators (slightly less core than the other models)
    grid.navigationModel = require('@grid/navigation-model')(grid);
    grid.pixelScrollModel = require('@grid/pixel-scroll-model')(grid);
    grid.colResize = require('@grid/col-resize')(grid);
    grid.colReorder = require('@grid/col-reorder')(grid);

    //sort functionality has no api, it just sets up an event listener
    //for now disable header click sort cause we're gonna use the click for selection instead
    //require('@grid/col-sort')(grid);


    var drawRequested = false;
    grid.requestDraw = function () {
        if (!grid.eventLoop.isRunning) {
            grid.viewLayer.draw();
        } else {
            drawRequested = true;
        }
    };

    grid.eventLoop.bind('grid-draw', function () {
        drawRequested = false;
    });

    grid.eventLoop.addExitListener(function () {
        if (drawRequested) {
            grid.viewLayer.draw();
        }
    });

    function createFocusTextArea(container) {
        var textarea = document.createElement('textarea');
        textarea.style.position = 'fixed';
        textarea.style.left = '-100000px';
        textarea.addEventListener('focus', function () {
            if (container) {
                elementClass(container).add('focus');
            }
        });

        textarea.addEventListener('blur', function () {
            if (container) {
                elementClass(container).remove('focus');
            }
        });

        container.appendChild(textarea);
        if (!container.getAttribute('tabIndex')) {
            container.tabIndex = 0;
        }
        container.addEventListener('focus', function () {
            if (textarea) {
                textarea.focus();
            }
        });

        return textarea;
    }

    grid.build = function (container) {
        createFocusTextArea(container);
        grid.viewPort.sizeToContainer(container);
        grid.viewLayer.build(container);
        grid.eventLoop.setContainer(container);
    };

    grid.makeDirtyClean = function () {
        return dirtyClean(grid);
    };

    return grid;
};
},{"@grid/cell-classes":4,"@grid/cell-mouse-model":5,"@grid/cell-scroll-model":6,"@grid/col-model":7,"@grid/col-reorder":8,"@grid/col-resize":9,"@grid/decorators":13,"@grid/dirty-clean":14,"@grid/event-loop":15,"@grid/navigation-model":19,"@grid/pixel-scroll-model":21,"@grid/row-model":24,"@grid/simple-data-model":25,"@grid/view-layer":27,"@grid/view-port":28,"@grid/virtual-pixel-cell-model":29,"element-class":31}],11:[function(require,module,exports){
module.exports = function (name, bubbles, cancelable, detail) {
    var event = document.createEvent('CustomEvent');  // MUST be 'CustomEvent'
    event.initCustomEvent(name, bubbles, cancelable, detail);
    return event;
};
},{}],12:[function(require,module,exports){
module.exports = function (fn, delay) {
    var f = function debounced() {
        if (f.timeout) {
            clearTimeout(f.timeout);
            f.timeout = undefined;
        }
        f.timeout = setTimeout(fn, delay);
    };
    return f;
};
},{}],13:[function(require,module,exports){
var util = require('@grid/util');
var makeDirtyClean = require('@grid/dirty-clean');
var positionRange = require('@grid/position-range');

module.exports = function (_grid) {
    var grid = _grid;

    var dirtyClean = makeDirtyClean(grid);

    var aliveDecorators = [];
    var deadDecorators = [];

    var decorators = {
        add: function (decorator) {
            aliveDecorators.push(decorator);
            dirtyClean.setDirty();
        },
        remove: function (decorators) {
            if (!util.isArray(decorators)) {
                decorators = [decorators];
            }
            decorators.forEach(function (decorator) {
                var index = aliveDecorators.indexOf(decorator);
                if (index !== -1) {
                    aliveDecorators.splice(index, 1);
                    deadDecorators.push(decorator);
                    dirtyClean.setDirty();
                }
            });
        },
        getAlive: function () {
            return aliveDecorators.slice(0);
        },
        popAllDead: function () {
            var oldDead = deadDecorators;
            deadDecorators = [];
            return oldDead;
        },
        isDirty: dirtyClean.isDirty,
        create: function (t, l, h, w, u, s) {
            var decorator = {};
            var thisDirtyClean = makeDirtyClean(grid);

            //mixin the position range functionality
            positionRange(decorator, thisDirtyClean, dirtyClean);
            decorator.top = t;
            decorator.left = l;
            decorator.height = h;
            decorator.width = w;
            decorator.units = u || decorator.units;
            decorator.space = s || decorator.space;

            //they can override but we should have an empty default to prevent npes
            decorator.render = function () {
                var div = document.createElement('div');
                div.style.position = 'absolute';
                div.style.top = '0px';
                div.style.left = '0px';
                div.style.bottom = '0px';
                div.style.right = '0px';
                if (decorator.postRender) {
                    decorator.postRender(div);
                }
                return div;
            };
            return decorator;

        }

    };


    return decorators;
};
},{"@grid/dirty-clean":14,"@grid/position-range":22,"@grid/util":26}],14:[function(require,module,exports){
module.exports = function (_grid) {
    var grid = _grid;
    var dirty = true;

    grid.eventLoop.bind('grid-draw', function () {
        api.setClean();
    });


    var api = {
        isDirty: function () {
            return dirty;
        },
        isClean: function () {
            return !dirty;
        },
        setDirty: function () {
            dirty = true;
            //when things are initalizing sometimes this doesn't exist yet
            //we have to hope that at the end of initialization the grid will call request draw itself
            if (grid.requestDraw) {
                grid.requestDraw();
            }
        },
        setClean: function () {
            dirty = false;
        }
    };
    return api;
};
},{}],15:[function(require,module,exports){
var mousewheel = require('@grid/mousewheel');
var util = require('@grid/util');
var listeners = require('@grid/listeners');

var EVENTS = ['click', 'mousedown', 'mouseup', 'mousemove', 'dblclick', 'keydown', 'keypress', 'keyup'];

var GRID_EVENTS = ['grid-drag-start', 'grid-drag', 'grid-cell-drag', 'grid-drag-end'];

var eventLoop = function (_grid) {
    var grid = _grid;
    var eloop = {
        isRunning: false
    };

    var handlersByName = {};
    var domUnbindFns = [];

    var unbindAll;

    eloop.setContainer = function (container) {
        var unbindMouseWheelFn = mousewheel.bind(container, mainLoop);

        EVENTS.forEach(function (name) {
            bindToDomElement(container, name, mainLoop);
        });

        GRID_EVENTS.forEach(function (name) {
            bindToDomElement(window, name, mainLoop);
        });

        unbindAll = function () {
            unbindMouseWheelFn();

            //have to copy the array since the unbind will actually remove itself from the array which modifies it mid iteration
            domUnbindFns.slice(0).forEach(function (unbind) {
                unbind();
            });
        };
    };

    function getHandlers(name) {
        var handlers = handlersByName[name];
        if (!handlers) {
            handlers = handlersByName[name] = [];
        }
        return handlers;
    }

    function bindToDomElement(elem, name, listener) {
        elem.addEventListener(name, listener);
        var unbindFn = function () {
            elem.removeEventListener(name, listener);
            domUnbindFns.splice(domUnbindFns.indexOf(unbindFn), 1);
        };
        domUnbindFns.push(unbindFn);
        return unbindFn;
    }

    eloop.bind = function () {
        var args = Array.prototype.slice.call(arguments, 0);
        var name = args.filter(function (arg) {
            return typeof arg === 'string';
        })[0];

        var handler = args.filter(function (arg) {
            return typeof arg === 'function';
        })[0];

        if (!handler || !name) {
            throw 'cannot bind without at least name and function';
        }


        var elem = args.filter(function (arg) {
            return util.isElement(arg) || arg === window || arg === document;
        })[0];

        if (!elem) {
            getHandlers(name).push(handler);
            return function () {
                var handlers = getHandlers(name);
                handlers.splice(handlers.indexOf(handler), 1);
            };
        } else {
            var listener = loopWith(handler);
            //make sure the elem can receive events
            if (elem.style) {
                elem.style.pointerEvents = 'all';
            }
            return bindToDomElement(elem, name, listener);
        }
    };

    eloop.fire = function (event) {
        event = typeof event === 'string' ? {type: event} : event;
        mainLoop(event);
    };

    var interceptors = listeners();
    var exitListeners = listeners();

    eloop.addInterceptor = interceptors.addListener;
    eloop.addExitListener = exitListeners.addListener;

    function loopWith(fn) {
        return function (e) {
            loop(e, fn);
        };
    }

    var mainLoop = loopWith(function (e) {
        //have to copy the array because handlers can unbind themselves which modifies the array
        //we use some so that we can break out of the loop if need be
        getHandlers(e.type).slice(0).some(function (handler) {
            handler(e);
            if (e.gridStopBubbling) {
                return true;
            }
        });
    });

    function loop(e, bodyFn) {
        var isOuterLoopRunning = eloop.isRunning;
        eloop.isRunning = true;
        interceptors.notify(e);
        if (!e.gridStopBubbling) {
            bodyFn(e);
        }

        if (!isOuterLoopRunning) {
            eloop.isRunning = false;
            exitListeners.notify(e);
        }
    }

    eloop.bind('grid-destroy', function () {
        unbindAll();
        eloop.destroyed = true;
    });

    eloop.stopBubbling = function (e) {
        e.gridStopBubbling = true;
        return e;
    };

    return eloop;
};


eventLoop.EVENTS = EVENTS;
eventLoop.GRID_EVENTS = GRID_EVENTS;
module.exports = eventLoop;
},{"@grid/listeners":17,"@grid/mousewheel":18,"@grid/util":26}],16:[function(require,module,exports){
module.exports = function (_grid, model) {
    var grid = _grid;

    var api = model || {};
    api._decorators = {};

    function makeDecorator(col) {
        var decorator = grid.decorators.create(0, col, 1, 1, 'cell', 'real');


        decorator.getDecoratorLeft = function () {
            var firstRect = decorator.boundingBox && decorator.boundingBox.getClientRects() && decorator.boundingBox.getClientRects()[0] || {};
            return grid.viewPort.toGridX(firstRect.left) || 0;
        };

        if (api.annotateDecorator) {
            api.annotateDecorator(decorator);
        }


        return decorator;
    }

    function ensureDecoratorPerCol() {
        for (var c = 0; c < grid.viewPort.cols; c++) {
            if (!api._decorators[c]) {
                var decorator = makeDecorator(c);
                api._decorators[c] = decorator;
                grid.decorators.add(decorator);
            }
        }
    }

    grid.eventLoop.bind('grid-viewport-change', function () {
        ensureDecoratorPerCol();
    });
    ensureDecoratorPerCol();

    return api;
};
},{}],17:[function(require,module,exports){
/*
 A simple package for creating a list of listeners that can be added to and notified
 */

module.exports = function () {
    var listeners = [];
    return {
        //returns a removal function to unbind the listener
        addListener: function (fn) {
            listeners.push(fn);
            return function () {
                listeners.splice(listeners.indexOf(fn), 1);
            };
        },
        notify: function (e) {
            listeners.forEach(function (listener) {
                listener(e);
            });
        }
    };
};
},{}],18:[function(require,module,exports){
var EVENT_NAMES = ['mousewheel', 'wheel', 'DOMMouseScroll'];

var api = {
    getDelta: function (event, xaxis) {
        if (event.wheelDelta) { //for everything but firefox
            var delta = event.wheelDeltaY;
            if (xaxis) {
                delta = event.wheelDeltaX;
            }
            return delta;

        } else if (event.detail) { //for firefox pre version 17
            if (event.axis && ((event.axis === 1 && xaxis) || (event.axis === 2 && !xaxis))) {
                return -1 * event.detail * 12;
            }
        } else if (event.deltaX || event.deltaY) {
            if (xaxis) {
                return -1 * event.deltaX;
            } else {
                return -1 * event.deltaY;
            }
        }
        return 0;
    },

    //binds a cross browser normalized mousewheel event, and returns a function that will unbind the listener;
    bind: function (elem, listener) {
        var normalizedListener = function (e) {
            listener(normalizeWheelEvent(e));
        };

        EVENT_NAMES.forEach(function (name) {
            elem.addEventListener(name, normalizedListener);
        });

        return function () {
            EVENT_NAMES.forEach(function (name) {
                elem.removeEventListener(name, normalizedListener);
            });
        };

    },
    normalize: normalizeWheelEvent
};

function normalizeWheelEvent(e) {
    var deltaX = api.getDelta(e, true);
    var deltaY = api.getDelta(e);
    var newEvent = Object.create(e,
        {
            deltaY: {value: deltaY},
            deltaX: {value: deltaX},
            type: {value: 'mousewheel'}
        });

    newEvent.preventDefault = function () {
        newEvent.defaultPrevented = true;
        if (e && e.preventDefault) {
            e.preventDefault();
        }
    };
    return newEvent;
}

module.exports = api;
},{}],19:[function(require,module,exports){
var key = require('key');
var util = require('@grid/util');
var rangeUtil = require('@grid/range-util');

module.exports = function (_grid) {
    var grid = _grid;

    var model = {
        focus: {
            row: 0,
            col: 0
        }
    };

    var focusClass = grid.cellClasses.create(0, 0, 'focus');
    grid.cellClasses.add(focusClass);

    model.focusDecorator = grid.decorators.create(0, 0, 1, 1);
    model.focusDecorator.render = function () {
        var div = defaultRender();
        div.setAttribute('class', 'grid-focus-decorator');
        return div;
    };
    grid.decorators.add(model.focusDecorator);


    function clampRowToMinMax(row) {
        return util.clamp(row, 0, grid.rowModel.length() - 1);
    }

    function clampColToMinMax(col) {
        return util.clamp(col, 0, grid.colModel.length() - 1);
    }

    model.setFocus = function setFocus(row, col, optionalEvent) {
        row = clampRowToMinMax(row);
        col = clampColToMinMax(col);
        model.focus.row = row;
        model.focus.col = col;
        focusClass.top = row;
        focusClass.left = col;
        model.focusDecorator.top = row;
        model.focusDecorator.left = col;
        grid.cellScrollModel.scrollIntoView(row, col);
        //focus changes always clear the selection
        clearSelection();
    };

    grid.eventLoop.bind('keydown', function (e) {
        var arrow = key.code.arrow;
        if (!key.is(arrow, e.which)) {
            return;
        }
        //focus logic

        if (!e.shiftKey) {
            //if nothing changes great we'll stay where we are
            var navToRow = model.focus.row;
            var navToCol = model.focus.col;


            switch (e.which) {
                case arrow.down.code:
                    navToRow++;
                    break;
                case arrow.up.code:
                    navToRow--;
                    break;
                case arrow.right.code:
                    navToCol++;
                    break;
                case arrow.left.code:
                    navToCol--;
                    break;
            }
            model.setFocus(navToRow, navToCol, e);
        } else {
            //selection logic
            var newSelection;
            //stand in for if it's cleared
            if (model.selection.top === -1) {
                newSelection = {top: model.focus.row, left: model.focus.col, height: 1, width: 1};
            } else {
                newSelection = {
                    top: model.selection.top,
                    left: model.selection.left,
                    height: model.selection.height,
                    width: model.selection.width
                };
            }

            switch (e.which) {
                case arrow.down.code:
                    if (model.focus.row === newSelection.top) {
                        newSelection.height++;
                    } else {
                        newSelection.top++;
                        newSelection.height--;
                    }
                    break;
                case arrow.up.code:
                    if (model.focus.row === newSelection.top + newSelection.height - 1) {
                        newSelection.top--;
                        newSelection.height++;
                    } else {
                        newSelection.height--;

                    }
                    break;
                case arrow.right.code:
                    if (model.focus.col === newSelection.left) {
                        newSelection.width++;
                    } else {
                        newSelection.left++;
                        newSelection.width--;
                    }
                    break;
                case arrow.left.code:
                    if (model.focus.col === newSelection.left + newSelection.width - 1) {
                        newSelection.left--;
                        newSelection.width++;
                    } else {
                        newSelection.width--;
                    }
                    break;
            }
            if (newSelection.height === 1 && newSelection.width === 1) {
                clearSelection();
            } else {
                model.setSelection(newSelection);
            }

        }
    });

    function outsideMinMax(row, col) {
        return row < 0 || row > grid.rowModel.length() || col < 0 || col > grid.colModel.length();
    }

    grid.eventLoop.bind('mousedown', function (e) {
        //assume the event has been annotated by the cell mouse model interceptor
        var row = e.row;
        var col = e.col;
        if (row < 0 && col >= 0) {
            grid.colModel.toggleSelect(col);
        }
        if (col < 0 && row >= 0) {
            grid.rowModel.toggleSelect(row);
        }

        if (row < 0 && col < 0) {
            return;
        }

        if (!e.shiftKey) {
            model.setFocus(row, col, e);
        } else {
            setSelectionFromPoints(model.focus.row, model.focus.col, row, col);
        }

    });

    model._rowSelectionDecorators = [];
    model._colSelectionDecorators = [];
    //row col selection
    function handleRowColSelectionChange(rowOrCol) {
        var decoratorsField = ('_' + rowOrCol + 'SelectionDecorators');
        model[decoratorsField].forEach(function (selectionDecorator) {
            grid.decorators.remove(selectionDecorator);
        });
        model[decoratorsField] = [];

        grid[rowOrCol + 'Model'].getSelected().forEach(function (index) {
            var virtualIndex = grid[rowOrCol + 'Model'].toVirtual(index);
            var top = rowOrCol === 'row' ? virtualIndex : 0;
            var left = rowOrCol === 'col' ? virtualIndex : 0;
            var decorator = grid.decorators.create(top, left, 1, 1, 'cell', 'virtual');
            decorator.postRender = function (elem) {
                elem.setAttribute('class', 'grid-header-selected');
            };
            grid.decorators.add(decorator);
            model[decoratorsField].push(decorator);
        });
    }

    grid.eventLoop.bind('grid-row-selection-change', function () {
        handleRowColSelectionChange('row');
    });

    grid.eventLoop.bind('grid-col-selection-change', function () {
        handleRowColSelectionChange('col');
    });

    var selection = grid.decorators.create();

    var defaultRender = selection.render;
    selection.render = function () {
        var div = defaultRender();
        div.setAttribute('class', 'grid-selection');
        return div;
    };

    grid.decorators.add(selection);

    model.setSelection = function setSelection(newSelection) {
        selection.top = newSelection.top;
        selection.left = newSelection.left;
        selection.height = newSelection.height;
        selection.width = newSelection.width;
    };

    function clearSelection() {
        model.setSelection({top: -1, left: -1, height: -1, width: -1});
    }

    function setSelectionFromPoints(fromRow, fromCol, toRow, toCol) {
        var newSelection = rangeUtil.createFromPoints(fromRow, fromCol, clampRowToMinMax(toRow), clampColToMinMax(toCol));
        model.setSelection(newSelection);
    }

    selection._onDragStart = function (e) {
        if (outsideMinMax(e.row, e.col)) {
            return;
        }
        var fromRow = model.focus.row;
        var fromCol = model.focus.col;
        var unbindDrag = grid.eventLoop.bind('grid-cell-drag', function (e) {
            setSelectionFromPoints(fromRow, fromCol, e.row, e.col);
        });

        var unbindDragEnd = grid.eventLoop.bind('grid-drag-end', function () {
            unbindDrag();
            unbindDragEnd();
        });
    };

    grid.eventLoop.bind('grid-drag-start', selection._onDragStart);
    clearSelection();

    model.selection = selection;

    return model;
};
},{"@grid/range-util":23,"@grid/util":26,"key":37}],20:[function(require,module,exports){
module.exports = function () {
    //a noop function to use
};
},{}],21:[function(require,module,exports){
var util = require('@grid/util');
var debounce = require('@grid/debounce');
var capitalize = require('capitalize');

module.exports = function (_grid) {
    var grid = _grid;
    var model = {top: 0, left: 0};
    var scrollBarWidth = 10;

    grid.eventLoop.bind('grid-virtual-pixel-cell-change', function () {
        var scrollHeight = grid.virtualPixelCellModel.totalHeight() - grid.virtualPixelCellModel.fixedHeight();
        var scrollWidth = grid.virtualPixelCellModel.totalWidth() - grid.virtualPixelCellModel.fixedWidth();
        model.setScrollSize(scrollHeight, scrollWidth);
        sizeScrollBars();
    });


    grid.eventLoop.bind('grid-viewport-change', sizeScrollBars);
    //assumes a standardized wheel event that we create through the mousewheel package
    grid.eventLoop.bind('mousewheel', function handleMouseWheel(e) {
        var deltaY = e.deltaY;
        var deltaX = e.deltaX;
        model.scrollTo(model.top - deltaY, model.left - deltaX, true);
        debouncedNotify();
        e.preventDefault();
    });

    model.setScrollSize = function (h, w) {
        model.height = h;
        model.width = w;
    };

    function notifyListeners() {
        //TODO: possibly keep track of delta since last update and send it along. for now, no
        grid.eventLoop.fire('grid-pixel-scroll');

        //update the cell scroll
        var scrollTop = model.top;
        var row = grid.virtualPixelCellModel.getRow(scrollTop);

        var scrollLeft = model.left;
        var col = grid.virtualPixelCellModel.getCol(scrollLeft);

        grid.cellScrollModel.scrollTo(row, col, true);
    }

    var debouncedNotify = debounce(notifyListeners, 1);

    model.scrollTo = function (top, left, dontNotify) {
        model.top = util.clamp(top, 0, model.height - getScrollableViewHeight());
        model.left = util.clamp(left, 0, model.width - getScrollableViewWidth());

        positionScrollBars();

        if (!dontNotify) {
            notifyListeners();
        }


    };


    /* SCROLL BAR LOGIC */
    function getScrollPositionFromReal(scrollBarRealClickCoord, heightWidth, vertHorz) {
        var scrollBarTopClick = scrollBarRealClickCoord - grid.virtualPixelCellModel['fixed' + capitalize(heightWidth)]();
        var scrollRatio = scrollBarTopClick / getMaxScrollBarCoord(heightWidth, vertHorz);
        var scrollCoord = scrollRatio * getMaxScroll(heightWidth);
        return scrollCoord;
    }

    function makeScrollBarDecorator(isHorz) {
        var decorator = grid.decorators.create();
        var xOrY = isHorz ? 'X' : 'Y';
        var heightWidth = isHorz ? 'width' : 'height';
        var vertHorz = isHorz ? 'horz' : 'vert';
        var gridCoordField = 'grid' + xOrY;
        var layerCoordField = 'layer' + xOrY;
        var viewPortClampFn = grid.viewPort['clamp' + xOrY];

        decorator.render = function () {
            var scrollBarElem = document.createElement('div');
            scrollBarElem.setAttribute('class', 'grid-scroll-bar');
            decorator._onDragStart = function (e) {
                if (e.target !== scrollBarElem) {
                    return;
                }
                var scrollBarOffset = e[layerCoordField];

                decorator._unbindDrag = grid.eventLoop.bind('grid-drag', function (e) {
                    var gridCoord = viewPortClampFn(e[gridCoordField]);
                    var scrollBarRealClickCoord = gridCoord - scrollBarOffset;
                    var scrollCoord = getScrollPositionFromReal(scrollBarRealClickCoord, heightWidth, vertHorz);
                    if (isHorz) {
                        model.scrollTo(model.top, scrollCoord);
                    } else {
                        model.scrollTo(scrollCoord, model.left);
                    }
                });

                decorator._unbindDragEnd = grid.eventLoop.bind('grid-drag-end', function (e) {
                    decorator._unbindDrag();
                    decorator._unbindDragEnd();
                });

                e.stopPropagation();
            };

            grid.eventLoop.bind('grid-drag-start', scrollBarElem, decorator._onDragStart);
            grid.eventLoop.bind('mousedown', scrollBarElem, function (e) {
                grid.eventLoop.stopBubbling(e);
            });

            return scrollBarElem;
        };

        decorator.units = 'px';
        decorator.space = 'real';

        return decorator;
    }

    model.vertScrollBar = makeScrollBarDecorator();
    model.horzScrollBar = makeScrollBarDecorator(true);
    model.vertScrollBar.width = scrollBarWidth;
    model.horzScrollBar.height = scrollBarWidth;

    function getMaxScroll(heightWidth) {
        return model[heightWidth] - getViewScrollHeightOrWidth(heightWidth);
    }

    function getScrollRatioFromVirtualScrollCoords(scroll, heightWidth) {
        var maxScroll = getMaxScroll(heightWidth);
        var scrollRatio = scroll / maxScroll;
        return scrollRatio;
    }

    function getMaxScrollBarCoord(heightWidth, vertHorz) {
        return getViewScrollHeightOrWidth(heightWidth) - model[vertHorz + 'ScrollBar'][heightWidth];
    }

    function getRealScrollBarPosition(scroll, heightWidth, vertHorz) {
        var scrollRatio = getScrollRatioFromVirtualScrollCoords(scroll, heightWidth);
        var maxScrollBarScroll = getMaxScrollBarCoord(heightWidth, vertHorz);
        //in scroll bar coords
        var scrollBarCoord = scrollRatio * maxScrollBarScroll;
        //add the fixed height to translate back into real coords
        return scrollBarCoord + grid.virtualPixelCellModel['fixed' + capitalize(heightWidth)]();
    }

    model._getRealScrollBarPosition = getRealScrollBarPosition;
    model._getScrollPositionFromReal = getScrollPositionFromReal;

    function calcScrollBarRealTop() {
        return getRealScrollBarPosition(model.top, 'height', 'vert');
    }

    function calcScrollBarRealLeft() {
        return getRealScrollBarPosition(model.left, 'width', 'horz');
    }

    function positionScrollBars() {
        model.vertScrollBar.top = calcScrollBarRealTop();
        model.horzScrollBar.left = calcScrollBarRealLeft();
    }

    function getViewScrollHeightOrWidth(heightWidth) {
        return grid.viewPort[heightWidth] - grid.virtualPixelCellModel['fixed' + capitalize(heightWidth)]();
    }

    function getScrollableViewWidth() {
        return getViewScrollHeightOrWidth('width');
    }

    function getScrollableViewHeight() {
        return getViewScrollHeightOrWidth('height');
    }

    function sizeScrollBars() {
        model.vertScrollBar.left = grid.viewPort.width - scrollBarWidth;
        model.horzScrollBar.top = grid.viewPort.height - scrollBarWidth;
        var scrollableViewHeight = getScrollableViewHeight();
        var scrollableViewWidth = getScrollableViewWidth();
        model.vertScrollBar.height = Math.max(scrollableViewHeight / grid.virtualPixelCellModel.totalHeight() * scrollableViewHeight, 20);
        model.horzScrollBar.width = Math.max(scrollableViewWidth / grid.virtualPixelCellModel.totalWidth() * scrollableViewWidth, 20);
        positionScrollBars();
    }

    grid.decorators.add(model.vertScrollBar);
    grid.decorators.add(model.horzScrollBar);
    /* END SCROLL BAR LOGIC */

    return model;
};
},{"@grid/debounce":12,"@grid/util":26,"capitalize":30}],22:[function(require,module,exports){
var addDirtyProps = require('@grid/add-dirty-props');
module.exports = function (range, dirtyClean, parentDirtyClean) {
    range = range || {}; //allow mixin functionality
    range.isDirty = dirtyClean.isDirty;

    var watchedProperties = ['top', 'left', 'height', 'width', 'units', 'space'];
    var dirtyCleans = [dirtyClean];
    if (parentDirtyClean) {
        dirtyCleans.push(parentDirtyClean);
    }

    addDirtyProps(range, watchedProperties, dirtyCleans);
    //defaults
    range.units = 'cell';
    range.space = 'data';

    return range;
};
},{"@grid/add-dirty-props":3}],23:[function(require,module,exports){
module.exports = {
    //takes a point and a length as the ranges in array form
    intersect: function (range1, range2) {
        var range2Start = range2[0];
        var range1Start = range1[0];
        var range1End = range1Start + range1[1] - 1;
        var range2End = range2Start + range2[1] - 1;
        if (range2Start > range1End || range2End < range1Start) {
            return null;
        }
        var resultStart = (range1Start > range2Start ? range1Start : range2Start);
        var resultEnd = (range1End < range2End ? range1End : range2End);
        return [
            resultStart,
            resultEnd - resultStart + 1
        ];
    },
    //takes a point and a length as the ranges in array form
    union: function (range1, range2) {
        if (!range1) {
            return range2;
        }
        if (!range2) {
            return range1;
        }
        var range2Start = range2[0];
        var range2End = range2Start + range2[1] - 1;
        var range1Start = range1[0];
        var range1End = range1Start + range1[1] - 1;
        var resultStart = (range1Start < range2Start ? range1Start : range2Start);
        return [
            resultStart,
            (range1End > range2End ? range1End : range2End) - resultStart + 1
        ];
    },

    //takes two row, col points and creates a normal position range
    createFromPoints: function (r1, c1, r2, c2) {
        var range = {};
        if (r1 < r2) {
            range.top = r1;
            range.height = r2 - r1 + 1;
        } else {
            range.top = r2;
            range.height = r1 - r2 + 1;
        }

        if (c1 < c2) {
            range.left = c1;
            range.width = c2 - c1 + 1;
        } else {
            range.left = c2;
            range.width = c1 - c2 + 1;
        }
        return range;
    }
};


},{}],24:[function(require,module,exports){
module.exports = function (_grid) {
    var grid = _grid;

    var api = require('@grid/abstract-row-col-model')(grid, 'row', 'height', 30);

    return api;
};
},{"@grid/abstract-row-col-model":2}],25:[function(require,module,exports){
module.exports = function (_grid) {
    var grid = _grid;

    var cellData = [];
    var headerData = [];
    var sortedCol;
    var ascending;
    var dirtyClean = require('@grid/dirty-clean')(grid);
    var internalSet = function (data, r, c, datum) {
        if (!data[r]) {
            data[r] = [];
        }
        data[r][c] = datum;
        dirtyClean.setDirty();
    };

    var api = {
        isDirty: dirtyClean.isDirty,
        set: function (r, c, datum) {
            internalSet(cellData, r, c, datum);
        },
        setHeader: function (r, c, datum) {
            internalSet(headerData, r, c, datum);
        },
        get: function (r, c) {
            var dataRow = cellData[grid.rowModel.row(r).dataRow];
            var datum = dataRow && dataRow[grid.colModel.col(c).dataCol];
            var value = datum && datum.value;
            return {
                value: value,
                formatted: value && 'r' + value[0] + ' c' + value[1] || ''
            };
        },
        getHeader: function (r, c) {
            var dataRow = headerData[grid.rowModel.get(r).dataRow];

            var datum = dataRow && dataRow[grid.colModel.get(c).dataCol];
            var value = datum && datum.value;
            return {
                value: value,
                formatted: value && 'hr' + value[0] + ' hc' + value[1] || ''
            };
        },

        toggleSort: function (c) {
            var retVal = -1;
            var compareMethod = function (val1, val2) {
                return val1 < (val2) ? retVal : -1 * retVal;
            };
            if (c === sortedCol) {
                if (ascending) {
                    retVal = 1;
                }
                ascending = !ascending;
            } else {
                sortedCol = c;
                ascending = true;
            }
            cellData.sort(function (dataRow1, dataRow2) {
                if (!dataRow1 || !dataRow1[c]) {
                    return retVal;
                }
                if (!dataRow2 || !dataRow2[c]) {
                    return retVal * -1;
                }
                return compareMethod(dataRow1[c].value, dataRow2[c].value);
            });
            dirtyClean.setDirty();
        }
    };

    return api;
};
},{"@grid/dirty-clean":14}],26:[function(require,module,exports){
module.exports = {
    clamp: function (num, min, max, returnNaN) {
        if (num > max) {
            return returnNaN ? NaN : max;
        }
        if (num < min) {
            return returnNaN ? NaN : min;
        }
        return num;

    },
    isNumber: function (number) {
        return typeof number === 'number' && !isNaN(number);
    },
    isElement: function (node) {
        return !!(node &&
        (node.nodeName || // we are a direct element
        (node.prop && node.attr && node.find)));  // we have an on and find method part of jQuery API
    },
    isArray: function (value) {
        return Object.prototype.toString.call(value) === '[object Array]';
    },
    position: function (elem, t, l, b, r) {
        elem.style.top = t + 'px';
        elem.style.left = l + 'px';
        elem.style.bottom = b + 'px';
        elem.style.right = r + 'px';
        elem.style.position = 'absolute';
    }
};
},{}],27:[function(require,module,exports){
var customEvent = require('@grid/custom-event');
var debounce = require('@grid/debounce');
var util = require('@grid/util');


module.exports = function (_grid) {
    var viewLayer = {};


    var grid = _grid;
    var container;
    var root;
    var cellContainer;
    var decoratorContainer;
    var borderWidth;

    var GRID_CELL_CONTAINER_BASE_CLASS = 'grid-cells';
    var GRID_VIEW_ROOT_CLASS = 'js-grid-view-root';
    var CELL_CLASS = 'grid-cell';

    var cells; //matrix of rendered cell elements;
    var rows; //array of all rendered rows
    var builtCols; //map from col index to an array of built elements for the column to update on scroll
    var builtRows; //map from row index to an array of built elements for the row to update on scroll

    //add the cell classes through the standard method
    grid.cellClasses.add(grid.cellClasses.create(0, 0, CELL_CLASS, Infinity, Infinity, 'virtual'));

    var rowHeaderClasses = grid.cellClasses.create(0, 0, 'grid-header grid-row-header', Infinity, 0, 'virtual');
    var colHeaderClasses = grid.cellClasses.create(0, 0, 'grid-header grid-col-header', 0, Infinity, 'virtual');
    var fixedColClasses = grid.cellClasses.create(0, -1, 'grid-last-fixed-col', Infinity, 1, 'virtual');
    var fixedRowClasses = grid.cellClasses.create(-1, 0, 'grid-last-fixed-row', 1, Infinity, 'virtual');

    grid.cellClasses.add(rowHeaderClasses);
    grid.cellClasses.add(colHeaderClasses);
    grid.cellClasses.add(fixedRowClasses);
    grid.cellClasses.add(fixedColClasses);


    grid.eventLoop.bind('grid-col-change', function () {
        fixedColClasses.left = grid.colModel.numFixed() - 1;
        rowHeaderClasses.width = grid.colModel.numHeaders();
    });

    grid.eventLoop.bind('grid-row-change', function () {
        fixedRowClasses.top = grid.rowModel.numFixed() - 1;
        colHeaderClasses.height = grid.rowModel.numHeaders();
    });


    viewLayer.build = function (elem) {
        cleanup();

        container = elem;

        cellContainer = document.createElement('div');
        cellContainer.setAttribute('dts', 'grid-cells');
        cellContainer.setAttribute('class', GRID_CELL_CONTAINER_BASE_CLASS);
        util.position(cellContainer, 0, 0, 0, 0);
        cellContainer.style.zIndex = 0;

        decoratorContainer = document.createElement('div');
        decoratorContainer.setAttribute('dts', 'grid-decorators');
        util.position(decoratorContainer, 0, 0, 0, 0);
        decoratorContainer.style.zIndex = 0;
        decoratorContainer.style.pointerEvents = 'none';

        root = document.createElement('div');
        root.setAttribute('class', GRID_VIEW_ROOT_CLASS);

        root.appendChild(cellContainer);
        root.appendChild(decoratorContainer);

        container.appendChild(root);

    };


    function measureBorderWidth() {
        //read the border width, for the rare case of larger than 1px borders, otherwise the draw will default to 1
        if (borderWidth) {
            return;
        }
        var jsGridCell = cells[0] && cells[0][0];
        if (jsGridCell) {
            var oldClass = jsGridCell.className;
            jsGridCell.className = CELL_CLASS;
            var computedStyle = getComputedStyle(jsGridCell);
            var borderWidthProp = computedStyle.getPropertyValue('border-left-width');
            borderWidth = parseInt(borderWidthProp);
            jsGridCell.className = oldClass;
        }
        borderWidth = isNaN(borderWidth) || !borderWidth ? undefined : borderWidth;
        return borderWidth;
    }

    //only draw once per js turn, may need to create a synchronous version
    viewLayer.draw = debounce(function () {
        viewLayer._draw();
    }, 1);

    viewLayer._draw = function () {
        //return if we haven't built yet
        if (!container) {
            return;
        }

        var rebuilt = grid.viewPort.isDirty();
        if (rebuilt) {
            viewLayer._buildCells(cellContainer);
        }

        var builtColsDirty = grid.colModel.areBuildersDirty();
        if (rebuilt || builtColsDirty) {
            viewLayer._buildCols();
        }

        var builtRowsDirty = grid.rowModel.areBuildersDirty();
        if (rebuilt || builtRowsDirty) {
            viewLayer._buildRows();
        }

        var cellsPositionOrSizeChanged = grid.colModel.isDirty() || grid.rowModel.isDirty() || grid.cellScrollModel.isDirty();

        if (grid.cellClasses.isDirty() || rebuilt || cellsPositionOrSizeChanged) {
            viewLayer._drawCellClasses();
        }

        if (rebuilt || cellsPositionOrSizeChanged || builtColsDirty || builtRowsDirty || grid.dataModel.isDirty()) {
            viewLayer._drawCells();
        }

        if (grid.decorators.isDirty() || rebuilt || cellsPositionOrSizeChanged) {
            viewLayer._drawDecorators(cellsPositionOrSizeChanged);
        }

        grid.eventLoop.fire('grid-draw');
    };

    /* CELL LOGIC */
    function getBorderWidth() {
        return borderWidth || 1;
    }

    viewLayer._drawCells = function () {
        measureBorderWidth();
        var bWidth = getBorderWidth();
        var headerRows = grid.rowModel.numHeaders();
        var headerCols = grid.colModel.numHeaders();
        grid.viewPort.iterateCells(function drawCell(r, c) {
            var cell = cells[r][c];
            var width = grid.viewPort.getColWidth(c);
            cell.style.width = width + bWidth + 'px';

            var left = grid.viewPort.getColLeft(c);
            cell.style.left = left + 'px';

            while (cell.firstChild) {
                cell.removeChild(cell.firstChild);
            }
            var virtualRow = grid.viewPort.toVirtualRow(r);
            var virtualCol = grid.viewPort.toVirtualCol(c);
            var data;
            if (r < headerRows || c < headerCols) {
                data = grid.dataModel.getHeader(virtualRow, virtualCol);
            } else {
                data = grid.dataModel.get(grid.rowModel.toData(virtualRow), grid.colModel.toData(virtualCol));
            }
            //artificially only get builders for row headers for now
            var builder = virtualRow < headerRows && grid.rowModel.get(virtualRow).builder || undefined;
            var hasRowBuilder = true;
            if (!builder) {
                hasRowBuilder = false;
                builder = grid.colModel.get(virtualCol).builder;
            }

            var cellChild;
            if (builder) {
                var builtElem;
                if (hasRowBuilder) {
                    builtElem = builtRows[virtualRow][c];
                } else {
                    builtElem = builtCols[virtualCol][r];
                }
                cellChild = builder.update(builtElem, {
                    virtualCol: virtualCol,
                    virtualRow: virtualRow,
                    data: data
                });
            }
            //if we didn't get a child from the builder use a regular text node
            if (!cellChild) {
                cellChild = document.createTextNode(data.formatted);
            }
            cell.appendChild(cellChild);
        }, function drawRow(r) {
            var height = grid.viewPort.getRowHeight(r);
            var row = rows[r];
            row.style.height = height + bWidth + 'px';
            var top = grid.viewPort.getRowTop(r);
            row.style.top = top + 'px';
        });

        if (grid.cellScrollModel.row % 2) {
            cellContainer.className = GRID_CELL_CONTAINER_BASE_CLASS + ' odds';
        } else {
            cellContainer.className = GRID_CELL_CONTAINER_BASE_CLASS;
        }
    };


    viewLayer._buildCells = function buildCells(cellContainer) {
        while (cellContainer.firstChild) {
            cellContainer.removeChild(cellContainer.firstChild);
        }


        cells = [];
        rows = [];
        var row;
        grid.viewPort.iterateCells(function (r, c) {
            var cell = buildDivCell();
            cells[r][c] = cell;
            row.appendChild(cell);
        }, function (r) {
            cells[r] = [];
            row = document.createElement('div');
            row.setAttribute('class', 'grid-row');
            row.setAttribute('dts', 'grid-row');
            row.style.position = 'absolute';
            row.style.left = 0;
            row.style.right = 0;
            rows[r] = row;
            cellContainer.appendChild(row);
        });
    };

    function buildDivCell() {
        var cell = document.createElement('div');
        cell.setAttribute('dts', 'grid-cell');
        var style = cell.style;
        style.position = 'absolute';
        style.boxSizing = 'border-box';
        style.top = '0px';
        style.bottom = '0px';
        return cell;
    }

    /* END CELL LOGIC */

    /* COL BUILDER LOGIC */
    viewLayer._buildCols = function () {
        builtCols = {};
        for (var c = 0; c < grid.colModel.length(true); c++) {
            var builder = grid.colModel.get(c).builder;
            if (builder) {
                builtCols[c] = [];
                for (var realRow = 0; realRow < grid.viewPort.rows; realRow++) {
                    builtCols[c][realRow] = builder.render();
                }
            }
        }
    };
    /* END COL BUILDER LOGIC */

    /* ROW BUILDER LOGIC 
     *  for now we only build headers
     * */

    viewLayer._buildRows = function () {
        builtRows = {};
        for (var r = 0; r < grid.rowModel.numHeaders(); r++) {
            var builder = grid.rowModel.get(r).builder;
            if (builder) {
                builtRows[r] = [];
                for (var realCol = 0; realCol < grid.viewPort.cols; realCol++) {
                    builtRows[r][realCol] = builder.render();
                }
            }
        }
    };
    /* END ROW BUILDER LOGIC*/

    /* DECORATOR LOGIC */
    function setPosition(boundingBox, top, left, height, width) {
        var style = boundingBox.style;
        style.top = top + 'px';
        style.left = left + 'px';
        style.height = height + 'px';
        style.width = width + 'px';
        style.position = 'absolute';
    }

    function positionDecorator(bounding, t, l, h, w) {
        setPosition(bounding, t, l, util.clamp(h, 0, grid.viewPort.height), util.clamp(w, 0, grid.viewPort.width));
    }

    function positionCellDecoratorFromViewCellRange(realCellRange, boundingBox) {
        var realPxRange = grid.viewPort.toPx(realCellRange);
        positionDecorator(boundingBox, realPxRange.top, realPxRange.left, realPxRange.height + getBorderWidth(), realPxRange.width + getBorderWidth());
    }

    function createRangeForDescriptor(descriptor) {
        var range = {
            top: descriptor.top,
            left: descriptor.left,
            height: descriptor.height,
            width: descriptor.width
        };
        if (descriptor.space === 'data' && descriptor.units === 'cell') {
            range.top += grid.rowModel.numHeaders();
            range.left += grid.colModel.numHeaders();
        }
        return range;
    }

    viewLayer._drawDecorators = function (cellsPositionOrSizeChanged) {
        var aliveDecorators = grid.decorators.getAlive();
        aliveDecorators.forEach(function (decorator) {

            var boundingBox = decorator.boundingBox;
            if (!boundingBox) {
                boundingBox = document.createElement('div');
                boundingBox.style.pointerEvents = 'none';
                decorator.boundingBox = boundingBox;
                var decElement = decorator.render();
                if (decElement) {
                    boundingBox.appendChild(decElement);
                    decoratorContainer.appendChild(boundingBox);
                }
            }

            if (decorator.isDirty() || cellsPositionOrSizeChanged) {
                if (decorator.space === 'real') {
                    switch (decorator.units) {
                        case 'px':
                            positionDecorator(boundingBox, decorator.top, decorator.left, decorator.height, decorator.width);
                            break;
                        case 'cell':
                            positionCellDecoratorFromViewCellRange(decorator, boundingBox);
                            break;
                    }
                }
                else if (decorator.space === 'virtual' || decorator.space === 'data') {
                    switch (decorator.units) {
                        case 'px':
                            break;
                        case 'cell':
                        /* jshint -W086 */
                        default:
                            var range = createRangeForDescriptor(decorator);
                            var realCellRange = grid.viewPort.intersect(range);
                            if (realCellRange) {
                                positionCellDecoratorFromViewCellRange(realCellRange, boundingBox);
                            } else {
                                positionDecorator(boundingBox, -1, -1, -1, -1);
                            }
                            break;
                        /* jshint +W086 */
                    }

                }
            }
        });

        removeDecorators(grid.decorators.popAllDead());
    };

    function removeDecorators(decorators) {
        decorators.forEach(function (decorator) {
            var boundingBox = decorator.boundingBox;
            if (boundingBox) {
                //if they rendered an element previously we attached it to the bounding box as the only child
                var renderedElement = boundingBox.firstChild;
                if (renderedElement) {
                    //create a destroy dom event that bubbles
                    var destroyEvent = customEvent('decorator-destroy', true);
                    renderedElement.dispatchEvent(destroyEvent);
                }
                decoratorContainer.removeChild(boundingBox);
                decorator.boundingBox = undefined;
            }
        });
    }

    /* END DECORATOR LOGIC */

    /* CELL CLASSES LOGIC */
    viewLayer._drawCellClasses = function () {
        grid.viewPort.iterateCells(function (r, c) {
            cells[r][c].className = '';
        });
        grid.cellClasses.getAll().forEach(function (descriptor) {
            var range = createRangeForDescriptor(descriptor);
            var intersection = grid.viewPort.intersect(range);
            if (intersection) {
                rowLoop:
                    for (var r = 0; r < intersection.height; r++) {
                        for (var c = 0; c < intersection.width; c++) {
                            var row = intersection.top + r;
                            var col = intersection.left + c;

                            var cellRow = cells[row];
                            if (!cellRow) {
                                continue rowLoop;
                            }
                            var cell = cellRow[col];
                            if (!cell) {
                                continue;
                            }
                            cell.className = (cell.className ? cell.className + ' ' : '') + descriptor.class;
                        }
                    }
            }
        });
    };

    /* END CELL CLASSES LOGIC*/

    viewLayer.destroy = cleanup;

    function cleanup() {
        removeDecorators(grid.decorators.getAlive().concat(grid.decorators.popAllDead()));
        if (!container) {
            return;
        }
        var querySelectorAll = container.querySelectorAll('.' + GRID_VIEW_ROOT_CLASS);
        for (var i = 0; i < querySelectorAll.length; ++i) {
            var root = querySelectorAll[i];
            container.removeChild(root);
        }
    }

    grid.eventLoop.bind('grid-destroy', function () {
        viewLayer.destroy();
        clearTimeout(viewLayer.draw.timeout);
    });

    return viewLayer;
};
},{"@grid/custom-event":11,"@grid/debounce":12,"@grid/util":26}],28:[function(require,module,exports){
var util = require('@grid/util');
var rangeUtil = require('@grid/range-util');
var capitalize = require('capitalize');
var addDirtyProps = require('@grid/add-dirty-props');
var debounce = require('@grid/debounce');

module.exports = function (_grid) {
    var grid = _grid;
    var dirtyClean = require('@grid/dirty-clean')(grid);
    var container;

    var viewPort = addDirtyProps({}, ['rows', 'cols', 'width', 'height'], [dirtyClean]);
    viewPort.rows = 0;
    viewPort.cols = 0;
    viewPort.isDirty = dirtyClean.isDirty;

    //these probably trigger reflow so we may need to think about caching the value and updating it at on draws or something
    function getFirstClientRect() {
        return container && container.getClientRects && container.getClientRects() && container.getClientRects()[0] || {};
    }

    Object.defineProperty(viewPort, 'top', {
        enumerable: true,
        get: function () {
            return getFirstClientRect().top || 0;
        }
    });

    Object.defineProperty(viewPort, 'left', {
        enumerable: true,
        get: function () {
            return getFirstClientRect().left || 0;
        }
    });

    viewPort.toGridX = function (clientX) {
        return clientX - viewPort.left;
    };

    viewPort.toGridY = function (clientY) {
        return clientY - viewPort.top;
    };


    var fixed = {rows: 0, cols: 0};

    function getFixed(rowOrCol) {
        return fixed[rowOrCol + 's'];
    }

    viewPort.sizeToContainer = function (elem) {
        container = elem;
        viewPort.width = elem.offsetWidth;
        viewPort.height = elem.offsetHeight;
        viewPort.rows = calculateMaxLengths(viewPort.height, grid.rowModel);
        viewPort.cols = calculateMaxLengths(viewPort.width, grid.colModel);
        grid.eventLoop.fire('grid-viewport-change');
    };

    viewPort._onResize = debounce(function () {
        viewPort._resize();
    }, 200);

    grid.eventLoop.bind('grid-destroy', function () {
        clearTimeout(viewPort._onResize.timeout);
        clearTimeout(shortDebouncedResize.timeout);
    });

    viewPort._resize = function () {
        if (container) {
            viewPort.sizeToContainer(container);
        }
    };

    var shortDebouncedResize = debounce(function () {
        viewPort._resize();
    }, 1);


    grid.eventLoop.bind('resize', window, function () {
        //we don't bind the handler directly so that tests can mock it out
        viewPort._onResize();
    });

    grid.eventLoop.bind('grid-row-change', function () {
        fixed.rows = grid.rowModel.numFixed();
        shortDebouncedResize();
    });

    grid.eventLoop.bind('grid-col-change', function () {
        fixed.cols = grid.colModel.numFixed();
        shortDebouncedResize();
    });

    function convertRealToVirtual(coord, rowOrCol, coordIsVirtual) {
        //could cache this on changes i.e. row-change or col-change events
        var numFixed = getFixed(rowOrCol);
        if (coord < numFixed) {
            return coord;
        }
        return coord + (coordIsVirtual ? -1 : 1) * grid.cellScrollModel[rowOrCol];
    }

// converts a viewport row or column to a real row or column 
// clamps it if the column would be outside the range
    function getVirtualRowColUnsafe(realCoord, rowOrCol) {
        return convertRealToVirtual(realCoord, rowOrCol);
    }

    function getVirtualRowColClamped(viewCoord, rowOrCol) {
        var virtualRowCol = getVirtualRowColUnsafe(viewCoord, rowOrCol);
        return grid.virtualPixelCellModel['clamp' + capitalize(rowOrCol)](virtualRowCol);
    }

    viewPort.toVirtualRow = function (r) {
        return getVirtualRowColClamped(r, 'row');
    };

    viewPort.toVirtualCol = function (c) {
        return getVirtualRowColClamped(c, 'col');
    };

    function getRealRowColClamped(virtualCoord, rowOrCol) {
        var numFixed = getFixed(rowOrCol);
        if (virtualCoord < numFixed) {
            return virtualCoord;
        }
        var maxViewPortIndex = viewPort[rowOrCol + 's'] - 1;
        return util.clamp(virtualCoord - grid.cellScrollModel[rowOrCol], numFixed, maxViewPortIndex, true);
    }

    viewPort.rowIsInView = function (virtualRow) {
        var realRow = viewPort.toRealRow(virtualRow);
        return !isNaN(realRow) && getLengthBetweenViewCoords(0, realRow, 'row', 'height', true) < viewPort.height;
    };

    viewPort.colIsInView = function (virtualCol) {
        var realCol = viewPort.toRealCol(virtualCol);
        return !isNaN(realCol) && getLengthBetweenViewCoords(0, realCol, 'col', 'width', true) < viewPort.width;
    };


//default unclamped cause that seems to be the more likely use case converting this direction
    viewPort.toRealRow = function (virtualRow) {
        return getRealRowColClamped(virtualRow, 'row');
    };

    viewPort.toRealCol = function (virtualCol) {
        return getRealRowColClamped(virtualCol, 'col');
    };

    viewPort.clampRow = function (r) {
        return util.clamp(r, 0, viewPort.rows - 1);
    };

    viewPort.clampCol = function (c) {
        return util.clamp(c, 0, viewPort.cols - 1);
    };

    viewPort.clampY = function (y) {
        return util.clamp(y, 0, viewPort.height);
    };

    viewPort.clampX = function (x) {
        return util.clamp(x, 0, viewPort.width);
    };

    function getLengthBetweenViewCoords(startCoord, endCoord, rowOrCol, heightOrWidth, inclusive) {
        var rowOrColCap = capitalize(rowOrCol);
        var toVirtual = viewPort['toVirtual' + rowOrColCap];
        var lengthFn = grid.virtualPixelCellModel[heightOrWidth];
        var clampFn = viewPort['clamp' + rowOrColCap];
        var pos = 0;
        var numFixed = getFixed(rowOrCol);
        var isInNonfixedArea = endCoord >= numFixed;
        var isInFixedArea = startCoord < numFixed;
        var exclusiveOffset = (inclusive ? 0 : 1);
        if (isInFixedArea) {
            var fixedEndCoord = (isInNonfixedArea ? numFixed - 1 : endCoord - exclusiveOffset);
            pos += lengthFn(startCoord, fixedEndCoord);
        }
        if (isInNonfixedArea) {
            pos += lengthFn((isInFixedArea ? toVirtual(numFixed) : toVirtual(startCoord)), toVirtual(clampFn(endCoord)) - exclusiveOffset);
        }
        return pos;
    }

    function getTopOrLeft(endCoord, rowOrCol, heightOrWidth) {
        return getLengthBetweenViewCoords(0, endCoord, rowOrCol, heightOrWidth);
    }

    viewPort.getRowTop = function (viewPortCoord) {
        return getTopOrLeft(viewPortCoord, 'row', 'height');
    };

    viewPort.getColLeft = function (viewPortCol) {
        return getTopOrLeft(viewPortCol, 'col', 'width');
    };

    viewPort.toPx = function (realCellRange) {
        return {
            top: viewPort.getRowTop(realCellRange.top),
            left: viewPort.getColLeft(realCellRange.left),
            height: getLengthBetweenViewCoords(realCellRange.top, realCellRange.top + realCellRange.height - 1, 'row', 'height', true),
            width: getLengthBetweenViewCoords(realCellRange.left, realCellRange.left + realCellRange.width - 1, 'col', 'width', true)
        };
    };

    function getRowOrColFromPosition(pos, rowOrCol, heightOrWidth, returnVirtual) {
        //we could do this slighly faster with binary search to get log(n) instead of n, but will only do it if we actually need to optimize this
        var rowOrColCap = capitalize(rowOrCol);
        var viewMax = viewPort[rowOrCol + 's'];
        var toVirtual = viewPort['toVirtual' + rowOrColCap];
        var lengthFn = grid.virtualPixelCellModel[heightOrWidth];
        var summedLength = 0;
        for (var i = 0; i < viewMax; i++) {
            var virtual = toVirtual(i);
            var length = lengthFn(virtual);
            var newSum = summedLength + length;
            if (newSum > pos) {
                return returnVirtual ? virtual : i;
            }
            summedLength = newSum;
        }
        return NaN;
    }

    viewPort.getVirtualRowByTop = function (top) {
        return getRowOrColFromPosition(top, 'row', 'height', true);
    };

    viewPort.getVirtualColByLeft = function (left) {
        return getRowOrColFromPosition(left, 'col', 'width', true);
    };

    viewPort.getRowByTop = function (top) {
        return getRowOrColFromPosition(top, 'row', 'height');
    };

    viewPort.getColByLeft = function (left) {
        return getRowOrColFromPosition(left, 'col', 'width');
    };

    viewPort.getRowHeight = function (viewPortRow) {
        return grid.virtualPixelCellModel.height(viewPort.toVirtualRow(viewPort.clampRow(viewPortRow)));
    };

    viewPort.getColWidth = function (viewPortCol) {
        return grid.virtualPixelCellModel.width(viewPort.toVirtualCol(viewPort.clampCol(viewPortCol)));
    };

    function intersectRowsOrCols(intersection, range, topOrLeft, rowOrCol, heightOrWidth) {
        var numFixed = fixed[rowOrCol + 's'];
        var fixedRange = [0, numFixed];

        var virtualRange = [range[topOrLeft], range[heightOrWidth]];
        var fixedIntersection = rangeUtil.intersect(fixedRange, virtualRange);
        var scrollRange = [numFixed, viewPort[rowOrCol + 's'] - numFixed];
        virtualRange[0] -= grid.cellScrollModel[rowOrCol];
        var scrollIntersection = rangeUtil.intersect(scrollRange, virtualRange);
        var resultRange = rangeUtil.union(fixedIntersection, scrollIntersection);
        if (!resultRange) {
            return null;
        }

        intersection[topOrLeft] = resultRange[0];
        intersection[heightOrWidth] = resultRange[1];
        return intersection;
    }

    viewPort.intersect = function (range) {
        //assume virtual cells for now
        var intersection = intersectRowsOrCols({}, range, 'top', 'row', 'height');
        if (!intersection) {
            return null;
        }
        return intersectRowsOrCols(intersection, range, 'left', 'col', 'width');
    };


    function calculateMaxLengths(totalLength, lengthModel) {
        var lengthMethod = lengthModel.width && grid.virtualPixelCellModel.width || grid.virtualPixelCellModel.height;
        var numFixed = lengthModel.numFixed();
        var windowLength = 0;
        var maxSize = 0;
        var fixedLength = 0;
        var windowStartIndex = numFixed;

        for (var fixed = 0; fixed < numFixed; fixed++) {
            fixedLength += lengthMethod(fixed);
        }

        //it might be safer to actually sum the lengths in the virtualPixelCellModel but for now here is ok
        for (var index = numFixed; index < lengthModel.length(true); index++) {
            windowLength += lengthMethod(index);
            while (windowLength + fixedLength > totalLength && windowStartIndex < index) {
                windowLength -= lengthMethod(index);
                windowStartIndex++;
            }
            var windowSize = index - windowStartIndex + 1; // add the one because we want the last index that didn't fit
            if (windowSize > maxSize) {
                maxSize = windowSize;
            }

        }
        return maxSize + numFixed + 1;
    }


    viewPort.iterateCells = function (cellFn, optionalRowFn, optionalMaxRow, optionalMaxCol) {
        optionalMaxRow = optionalMaxRow || Infinity;
        optionalMaxCol = optionalMaxCol || Infinity;
        for (var r = 0; r < Math.min(viewPort.rows, optionalMaxRow); r++) {
            if (optionalRowFn) {
                optionalRowFn(r);
            }
            if (cellFn) {
                for (var c = 0; c < Math.min(viewPort.cols, optionalMaxCol); c++) {
                    cellFn(r, c);

                }
            }
        }
    };

    return viewPort;
}
},{"@grid/add-dirty-props":3,"@grid/debounce":12,"@grid/dirty-clean":14,"@grid/range-util":23,"@grid/util":26,"capitalize":30}],29:[function(require,module,exports){
var util = require('@grid/util');

module.exports = function (_grid) {
    var grid = _grid;
    var model = {};

    //all pixels are assumed to be in the virtual world, no real world pixels are dealt with here :)
    model.getRow = function (topPx) {
        if (topPx < 0) {
            return NaN;
        }
        var sumLength = 0;
        for (var r = 0; r < grid.rowModel.length(true); r++) {
            sumLength += grid.rowModel.height(r);
            if (topPx < sumLength) {
                return r;
            }
        }
        return NaN;
    };

    //yes these are very similar but there will be differences
    model.getCol = function (leftPx) {
        if (leftPx < 0) {
            return NaN;
        }
        var sumLength = 0;
        for (var c = 0; c < grid.colModel.length(true); c++) {
            sumLength += grid.colModel.width(c);
            if (leftPx < sumLength) {
                return c;
            }
        }
        return NaN;
    };


    function clampRowOrCol(virtualRowCol, rowOrCol) {
        var maxRowCol = grid[rowOrCol + 'Model'].length(true) - 1;
        return util.clamp(virtualRowCol, 0, maxRowCol);
    }

    model.clampRow = function (virtualRow) {
        return clampRowOrCol(virtualRow, 'row');
    };

    model.clampCol = function (virtualCol) {
        return clampRowOrCol(virtualCol, 'col');
    };

    //for now these just call through to the row and column model, but very likely it will need to include some other calculations
    model.height = function (virtualRowStart, virtualRowEnd) {
        return heightOrWidth(virtualRowStart, virtualRowEnd, 'row');
    };

    model.width = function (virtualColStart, virtualColEnd) {
        return heightOrWidth(virtualColStart, virtualColEnd, 'col');
    };

    function heightOrWidth(start, end, rowOrCol) {
        var length = 0;
        if (end < start) {
            return 0;
        }
        end = util.isNumber(end) ? end : start;
        end = clampRowOrCol(end, rowOrCol);
        start = clampRowOrCol(start, rowOrCol);
        var lengthModel = grid[rowOrCol + 'Model'];
        var lengthFn = lengthModel.width || lengthModel.height;
        for (var i = start; i <= end; i++) {
            length += lengthFn(i);
        }
        return length;
    }

    model.totalHeight = function () {
        return model.height(0, grid.rowModel.length(true) - 1);
    };

    model.totalWidth = function () {
        return model.width(0, grid.colModel.length(true) - 1);
    };

    model.fixedHeight = function () {
        return model.height(0, grid.rowModel.numFixed() - 1);
    };

    model.fixedWidth = function () {
        return model.width(0, grid.colModel.numFixed() - 1);
    };

    function sizeChangeListener() {
        //for now we don't cache anything about this so we just notify
        grid.eventLoop.fire('grid-virtual-pixel-cell-change');
    }

    grid.eventLoop.bind('grid-col-change', sizeChangeListener);
    grid.eventLoop.bind('grid-row-change', sizeChangeListener);

    return model;
};
},{"@grid/util":26}],30:[function(require,module,exports){
module.exports = function (string) {
  return string.charAt(0).toUpperCase() + string.substring(1);
}

module.exports.words = function (string) {
  return string.replace(/(^|\W)(\w)/g, function (m) {
    return m.toUpperCase()
  })
}

},{}],31:[function(require,module,exports){
module.exports = function(opts) {
  return new ElementClass(opts)
}

function ElementClass(opts) {
  if (!(this instanceof ElementClass)) return new ElementClass(opts)
  var self = this
  if (!opts) opts = {}

  // similar doing instanceof HTMLElement but works in IE8
  if (opts.nodeType) opts = {el: opts}

  this.opts = opts
  this.el = opts.el || document.body
  if (typeof this.el !== 'object') this.el = document.querySelector(this.el)
}

ElementClass.prototype.add = function(className) {
  var el = this.el
  if (!el) return
  if (el.className === "") return el.className = className
  var classes = el.className.split(' ')
  if (classes.indexOf(className) > -1) return classes
  classes.push(className)
  el.className = classes.join(' ')
  return classes
}

ElementClass.prototype.remove = function(className) {
  var el = this.el
  if (!el) return
  if (el.className === "") return
  var classes = el.className.split(' ')
  var idx = classes.indexOf(className)
  if (idx > -1) classes.splice(idx, 1)
  el.className = classes.join(' ')
  return classes
}

ElementClass.prototype.has = function(className) {
  var el = this.el
  if (!el) return
  var classes = el.className.split(' ')
  return classes.indexOf(className) > -1
}

},{}],32:[function(require,module,exports){
// Generated by CoffeeScript 1.3.3
(function() {
  'use strict';

  var alnum, ref;

  ref = require('../ref').ref;

  alnum = {
    '0': ref('0', 48),
    '1': ref('1', 49),
    '2': ref('2', 50),
    '3': ref('3', 51),
    '4': ref('4', 52),
    '5': ref('5', 53),
    '6': ref('6', 54),
    '7': ref('7', 55),
    '8': ref('8', 56),
    '9': ref('9', 57),
    a: ref('A', 65),
    b: ref('B', 66),
    c: ref('C', 67),
    d: ref('D', 68),
    e: ref('E', 69),
    f: ref('F', 70),
    g: ref('G', 71),
    h: ref('H', 72),
    i: ref('I', 73),
    j: ref('J', 74),
    k: ref('K', 75),
    l: ref('L', 76),
    m: ref('M', 77),
    n: ref('N', 78),
    o: ref('O', 79),
    p: ref('P', 80),
    q: ref('Q', 81),
    r: ref('R', 82),
    s: ref('S', 83),
    t: ref('T', 84),
    u: ref('U', 85),
    v: ref('V', 86),
    w: ref('W', 87),
    x: ref('X', 88),
    y: ref('Y', 89),
    z: ref('Z', 90)
  };

  module.exports = alnum;

}).call(this);

},{"../ref":38}],33:[function(require,module,exports){
// Generated by CoffeeScript 1.3.3
(function() {
  'use strict';

  var arrow, ref;

  ref = require('../ref').ref;

  arrow = {
    left: ref('Left', 37),
    up: ref('Up', 38),
    right: ref('Right', 39),
    down: ref('Down', 40)
  };

  module.exports = arrow;

}).call(this);

},{"../ref":38}],34:[function(require,module,exports){
// Generated by CoffeeScript 1.3.3
(function() {
  'use strict';

  var brand, ref;

  ref = require('../ref').ref;

  brand = {
    apple: ref('Apple &#8984;', 224),
    windows: {
      start: ref('Windows start', [91, 92]),
      menu: ref('Windows menu', 93)
    }
  };

  module.exports = brand;

}).call(this);

},{"../ref":38}],35:[function(require,module,exports){
// Generated by CoffeeScript 1.3.3
(function() {
  'use strict';

  var punctuation, ref;

  ref = require('../ref').ref;

  punctuation = {
    colon: ref('Colon/Semicolon', [59, 186]),
    equal: ref('Equal/Plus', [61, 187]),
    comma: ref('Comma/Less Than', [44, 188]),
    hyphen: ref('Hyphen/Underscore', [45, 109, 189]),
    period: ref('Period/Greater Than', [46, 190]),
    tilde: ref('Tilde/Back Tick', [96, 192]),
    apostrophe: ref('Apostrophe/Quote', [39, 222]),
    slash: {
      forward: ref('Forward Slash/Question Mark', [47, 191]),
      backward: ref('Backward Slash/Pipe', 220)
    },
    brace: {
      square: {
        open: ref('Open Square/Curly Brace', 219),
        close: ref('Close Square/Curly Brace', 221)
      }
    }
  };

  punctuation.semicolon = punctuation.colon;

  punctuation.plus = punctuation.equal;

  punctuation.lessthan = punctuation.comma;

  punctuation.underscore = punctuation.hyphen;

  punctuation.greaterthan = punctuation.period;

  punctuation.question = punctuation.slash.forward;

  punctuation.backtick = punctuation.tilde;

  punctuation.pipe = punctuation.slash.backward;

  punctuation.quote = punctuation.apostrophe;

  punctuation.brace.curly = punctuation.brace.square;

  module.exports = punctuation;

}).call(this);

},{"../ref":38}],36:[function(require,module,exports){
// Generated by CoffeeScript 1.3.3
(function() {
  'use strict';

  var ref, special;

  ref = require('../ref').ref;

  special = {
    backspace: ref('Backspace', 8),
    tab: ref('Tab', 9),
    enter: ref('Enter', 13),
    shift: ref('Shift', 16),
    ctrl: ref('Ctrl', 17),
    alt: ref('Alt', 18),
    caps: ref('Caps Lock', 20),
    esc: ref('Escape', 27),
    space: ref('Space', 32),
    num: ref('Num Lock', 144)
  };

  module.exports = special;

}).call(this);

},{"../ref":38}],37:[function(require,module,exports){
// Generated by CoffeeScript 1.3.3
(function() {
  'use strict';

  var isRef, iterator, key,
    _this = this,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __hasProp = {}.hasOwnProperty;

  isRef = require('./ref').isRef;

  key = {};

  key.code = {
    special: require('./code/special'),
    arrow: require('./code/arrow'),
    punctuation: require('./code/punctuation'),
    alnum: require('./code/alnum'),
    brand: require('./code/brand')
  };

  key.get = function(pressed) {
    return iterator(key.code, pressed);
  };

  key.is = function(ref, pressed) {
    if (!isRef(ref)) {
      ref = iterator(ref, pressed);
    }
    if (isRef(ref)) {
      if (isRef(pressed)) {
        return pressed === ref;
      } else {
        return pressed === ref.code || __indexOf.call(ref.code, pressed) >= 0;
      }
    } else {
      return pressed === ref;
    }
  };

  iterator = function(context, pressed) {
    var i, out, ref;
    for (i in context) {
      if (!__hasProp.call(context, i)) continue;
      ref = context[i];
      if (isRef(ref)) {
        if (key.is(ref, pressed)) {
          return ref;
        }
      } else {
        out = iterator(ref, pressed);
        if (isRef(out)) {
          return out;
        }
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.key = key;
  }

  module.exports = key;

}).call(this);

},{"./code/alnum":32,"./code/arrow":33,"./code/brand":34,"./code/punctuation":35,"./code/special":36,"./ref":38}],38:[function(require,module,exports){
// Generated by CoffeeScript 1.3.3
(function() {
  'use strict';

  var Reference, assertRef, isRef, ref;

  Reference = (function() {

    function Reference(name, code) {
      this.name = name;
      this.code = code;
    }

    return Reference;

  })();

  ref = function(name, code) {
    return new Reference(name, code);
  };

  isRef = function(ref) {
    return ref instanceof Reference;
  };

  assertRef = function(ref) {
    if (!isRef(ref)) {
      throw new Error('Invalid reference');
    }
    return ref;
  };

  module.exports = {
    ref: ref,
    isRef: isRef,
    assertRef: assertRef
  };

}).call(this);

},{}]},{},[1])
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbW9kdWxlcy9yaXEtZ3JpZC1lbnRyeS5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC9hYnN0cmFjdC1yb3ctY29sLW1vZGVsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0BncmlkL2FkZC1kaXJ0eS1wcm9wcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC9jZWxsLWNsYXNzZXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQGdyaWQvY2VsbC1tb3VzZS1tb2RlbC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC9jZWxsLXNjcm9sbC1tb2RlbC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC9jb2wtbW9kZWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQGdyaWQvY29sLXJlb3JkZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQGdyaWQvY29sLXJlc2l6ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC9jb3JlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0BncmlkL2N1c3RvbS1ldmVudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC9kZWJvdW5jZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC9kZWNvcmF0b3JzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0BncmlkL2RpcnR5LWNsZWFuL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0BncmlkL2V2ZW50LWxvb3AvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQGdyaWQvaGVhZGVyLWRlY29yYXRvcnMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQGdyaWQvbGlzdGVuZXJzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0BncmlkL21vdXNld2hlZWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQGdyaWQvbmF2aWdhdGlvbi1tb2RlbC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC9uby1vcC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC9waXhlbC1zY3JvbGwtbW9kZWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQGdyaWQvcG9zaXRpb24tcmFuZ2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQGdyaWQvcmFuZ2UtdXRpbC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC9yb3ctbW9kZWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQGdyaWQvc2ltcGxlLWRhdGEtbW9kZWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQGdyaWQvdXRpbC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC92aWV3LWxheWVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0BncmlkL3ZpZXctcG9ydC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AZ3JpZC92aXJ0dWFsLXBpeGVsLWNlbGwtbW9kZWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY2FwaXRhbGl6ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lbGVtZW50LWNsYXNzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2tleS9saWIvY29kZS9hbG51bS5qcyIsIm5vZGVfbW9kdWxlcy9rZXkvbGliL2NvZGUvYXJyb3cuanMiLCJub2RlX21vZHVsZXMva2V5L2xpYi9jb2RlL2JyYW5kLmpzIiwibm9kZV9tb2R1bGVzL2tleS9saWIvY29kZS9wdW5jdHVhdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9rZXkvbGliL2NvZGUvc3BlY2lhbC5qcyIsIm5vZGVfbW9kdWxlcy9rZXkvbGliL2tleS5qcyIsIm5vZGVfbW9kdWxlcy9rZXkvbGliL3JlZi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbE1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbFBBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5hbmd1bGFyLm1vZHVsZSgncmlxLWdyaWQnLCBbXSkuXG4gICAgZmFjdG9yeSgncmlxR3JpZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHJlcXVpcmUoJ0BncmlkL2NvcmUnKTtcbiAgICB9KVxuO1xuXG4iLCJ2YXIgYWRkRGlydHlQcm9wcyA9IHJlcXVpcmUoJ0BncmlkL2FkZC1kaXJ0eS1wcm9wcycpO1xudmFyIHV0aWwgPSByZXF1aXJlKCdAZ3JpZC91dGlsJyk7XG52YXIgbm9vcCA9IHJlcXVpcmUoJ0BncmlkL25vLW9wJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKF9ncmlkLCBuYW1lLCBsZW5ndGhOYW1lLCBkZWZhdWx0TGVuZ3RoKSB7XG4gICAgdmFyIGdyaWQgPSBfZ3JpZDtcblxuICAgIHZhciBERUZBVUxUX0xFTkdUSCA9IGRlZmF1bHRMZW5ndGg7XG4gICAgdmFyIGRlc2NyaXB0b3JzID0gW107XG4gICAgdmFyIG51bUZpeGVkID0gMDtcbiAgICB2YXIgbnVtSGVhZGVycyA9IDA7XG4gICAgdmFyIG1ha2VEaXJ0eUNsZWFuID0gcmVxdWlyZSgnQGdyaWQvZGlydHktY2xlYW4nKTtcbiAgICB2YXIgZGlydHlDbGVhbiA9IG1ha2VEaXJ0eUNsZWFuKGdyaWQpO1xuICAgIHZhciBidWlsZGVyRGlydHlDbGVhbiA9IG1ha2VEaXJ0eUNsZWFuKGdyaWQpO1xuICAgIHZhciBzZWxlY3RlZCA9IFtdO1xuXG4gICAgZnVuY3Rpb24gc2V0RGVzY3JpcHRvcnNEaXJ0eSgpIHtcbiAgICAgICAgZ3JpZC5ldmVudExvb3AuZmlyZSgnZ3JpZC0nICsgbmFtZSArICctY2hhbmdlJyk7XG4gICAgICAgIGRpcnR5Q2xlYW4uc2V0RGlydHkoKTtcbiAgICAgICAgYnVpbGRlckRpcnR5Q2xlYW4uc2V0RGlydHkoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaXJlU2VsZWN0aW9uQ2hhbmdlKCkge1xuICAgICAgICBncmlkLmV2ZW50TG9vcC5maXJlKCdncmlkLScgKyBuYW1lICsgJy1zZWxlY3Rpb24tY2hhbmdlJyk7XG4gICAgfVxuXG4gICAgdmFyIGFwaSA9IHtcbiAgICAgICAgYXJlQnVpbGRlcnNEaXJ0eTogYnVpbGRlckRpcnR5Q2xlYW4uaXNEaXJ0eSxcbiAgICAgICAgaXNEaXJ0eTogZGlydHlDbGVhbi5pc0RpcnR5LFxuICAgICAgICBhZGQ6IGZ1bmN0aW9uICh0b0FkZCkge1xuICAgICAgICAgICAgaWYgKCF1dGlsLmlzQXJyYXkodG9BZGQpKSB7XG4gICAgICAgICAgICAgICAgdG9BZGQgPSBbdG9BZGRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG9BZGQuZm9yRWFjaChmdW5jdGlvbiAoZGVzY3JpcHRvcikge1xuICAgICAgICAgICAgICAgIGlmIChkZXNjcmlwdG9yLmhlYWRlcikge1xuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdG9ycy5zcGxpY2UobnVtSGVhZGVycywgMCwgZGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgICAgIG51bUZpeGVkKys7XG4gICAgICAgICAgICAgICAgICAgIG51bUhlYWRlcnMrKztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9pZiB0aGUgY29sdW1uIGlzIGZpeGVkIGFuZCB0aGUgbGFzdCBvbmUgYWRkZWQgaXMgZml4ZWQgKHdlIG9ubHkgYWxsb3cgZml4ZWQgYXQgdGhlIGJlZ2lubmluZyBmb3Igbm93KVxuICAgICAgICAgICAgICAgICAgICBpZiAoZGVzY3JpcHRvci5maXhlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFkZXNjcmlwdG9ycy5sZW5ndGggfHwgZGVzY3JpcHRvcnNbZGVzY3JpcHRvcnMubGVuZ3RoIC0gMV0uZml4ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1GaXhlZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyAnQ2Fubm90IGFkZCBhIGZpeGVkIGNvbHVtbiBhZnRlciBhbiB1bmZpeGVkIG9uZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcnMucHVzaChkZXNjcmlwdG9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc2V0RGVzY3JpcHRvcnNEaXJ0eSgpO1xuICAgICAgICB9LFxuICAgICAgICBhZGRIZWFkZXJzOiBmdW5jdGlvbiAodG9BZGQpIHtcbiAgICAgICAgICAgIGlmICghdXRpbC5pc0FycmF5KHRvQWRkKSkge1xuICAgICAgICAgICAgICAgIHRvQWRkID0gW3RvQWRkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRvQWRkLmZvckVhY2goZnVuY3Rpb24gKGhlYWRlcikge1xuICAgICAgICAgICAgICAgIGhlYWRlci5oZWFkZXIgPSB0cnVlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBhcGkuYWRkKHRvQWRkKTtcbiAgICAgICAgfSxcbiAgICAgICAgaGVhZGVyOiBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBkZXNjcmlwdG9yc1tpbmRleF07XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gZGVzY3JpcHRvcnNbaW5kZXhdO1xuICAgICAgICB9LFxuICAgICAgICBsZW5ndGg6IGZ1bmN0aW9uIChpbmNsdWRlSGVhZGVycykge1xuICAgICAgICAgICAgdmFyIHN1YnRyYWN0ID0gaW5jbHVkZUhlYWRlcnMgPyAwIDogbnVtSGVhZGVycztcbiAgICAgICAgICAgIHJldHVybiBkZXNjcmlwdG9ycy5sZW5ndGggLSBzdWJ0cmFjdDtcbiAgICAgICAgfSxcbiAgICAgICAgcmVtb3ZlOiBmdW5jdGlvbiAoZGVzY3JpcHRvcikge1xuICAgICAgICAgICAgdmFyIGluZGV4ID0gZGVzY3JpcHRvcnMuaW5kZXhPZihkZXNjcmlwdG9yKTtcbiAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9ycy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIGlmIChkZXNjcmlwdG9yLmhlYWRlcikge1xuICAgICAgICAgICAgICAgICAgICBudW1GaXhlZC0tO1xuICAgICAgICAgICAgICAgICAgICBudW1IZWFkZXJzLS07XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkZXNjcmlwdG9yLmZpeGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIG51bUZpeGVkLS07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBjbGVhcjogZnVuY3Rpb24gKGluY2x1ZGVIZWFkZXJzKSB7XG4gICAgICAgICAgICBkZXNjcmlwdG9ycy5zbGljZSgwKS5mb3JFYWNoKGZ1bmN0aW9uIChkZXNjcmlwdG9yKSB7XG4gICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVIZWFkZXJzIHx8ICFkZXNjcmlwdG9yLmhlYWRlcikge1xuICAgICAgICAgICAgICAgICAgICBhcGkucmVtb3ZlKGRlc2NyaXB0b3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBtb3ZlOiBmdW5jdGlvbiAoc3RhcnQsIHRhcmdldCkge1xuICAgICAgICAgICAgZGVzY3JpcHRvcnMuc3BsaWNlKHRhcmdldCwgMCwgZGVzY3JpcHRvcnMuc3BsaWNlKHN0YXJ0LCAxKVswXSk7XG4gICAgICAgICAgICBzZXREZXNjcmlwdG9yc0RpcnR5KCk7XG4gICAgICAgIH0sXG4gICAgICAgIG51bUhlYWRlcnM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBudW1IZWFkZXJzO1xuICAgICAgICB9LFxuICAgICAgICBudW1GaXhlZDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bUZpeGVkO1xuICAgICAgICB9LFxuICAgICAgICB0b1ZpcnR1YWw6IGZ1bmN0aW9uIChkYXRhSW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBkYXRhSW5kZXggKyBhcGkubnVtSGVhZGVycygpO1xuICAgICAgICB9LFxuICAgICAgICB0b0RhdGE6IGZ1bmN0aW9uICh2aXJ0dWFsSW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiB2aXJ0dWFsSW5kZXggLSBhcGkubnVtSGVhZGVycygpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNlbGVjdDogZnVuY3Rpb24gKGluZGV4KSB7XG5cbiAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yID0gYXBpW25hbWVdKGluZGV4KTtcbiAgICAgICAgICAgIGlmICghZGVzY3JpcHRvci5zZWxlY3RlZCkge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3Iuc2VsZWN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNlbGVjdGVkLnB1c2goaW5kZXgpO1xuICAgICAgICAgICAgICAgIGZpcmVTZWxlY3Rpb25DaGFuZ2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZGVzZWxlY3Q6IGZ1bmN0aW9uIChpbmRleCwgZG9udE5vdGlmeSkge1xuICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3IgPSBhcGlbbmFtZV0oaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGRlc2NyaXB0b3Iuc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9yLnNlbGVjdGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc2VsZWN0ZWQuc3BsaWNlKHNlbGVjdGVkLmluZGV4T2YoaW5kZXgpLCAxKTtcbiAgICAgICAgICAgICAgICBpZiAoIWRvbnROb3RpZnkpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlyZVNlbGVjdGlvbkNoYW5nZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgdG9nZ2xlU2VsZWN0OiBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yID0gYXBpW25hbWVdKGluZGV4KTtcbiAgICAgICAgICAgIGlmIChkZXNjcmlwdG9yLnNlbGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgYXBpLmRlc2VsZWN0KGluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXBpLnNlbGVjdChpbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGNsZWFyU2VsZWN0ZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBsZW5ndGggPSBzZWxlY3RlZC5sZW5ndGg7XG4gICAgICAgICAgICBzZWxlY3RlZC5zbGljZSgwKS5mb3JFYWNoKGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICAgICAgICAgIGFwaS5kZXNlbGVjdChpbmRleCwgdHJ1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBmaXJlU2VsZWN0aW9uQ2hhbmdlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGdldFNlbGVjdGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZWN0ZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZTogZnVuY3Rpb24gKGJ1aWxkZXIpIHtcbiAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yID0ge307XG4gICAgICAgICAgICB2YXIgZml4ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShkZXNjcmlwdG9yLCAnZml4ZWQnLCB7XG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRlc2NyaXB0b3IuaGVhZGVyIHx8IGZpeGVkO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoX2ZpeGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpeGVkID0gX2ZpeGVkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBhZGREaXJ0eVByb3BzKGRlc2NyaXB0b3IsIFsnYnVpbGRlciddLCBbYnVpbGRlckRpcnR5Q2xlYW5dKTtcbiAgICAgICAgICAgIGRlc2NyaXB0b3IuYnVpbGRlciA9IGJ1aWxkZXI7XG5cbiAgICAgICAgICAgIHJldHVybiBhZGREaXJ0eVByb3BzKGRlc2NyaXB0b3IsIFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGxlbmd0aE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIG9uRGlydHk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyaWQuZXZlbnRMb29wLmZpcmUoJ2dyaWQtJyArIG5hbWUgKyAnLWNoYW5nZScpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXSwgW2RpcnR5Q2xlYW5dKTtcbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlQnVpbGRlcjogZnVuY3Rpb24gKHJlbmRlciwgdXBkYXRlKSB7XG4gICAgICAgICAgICByZXR1cm4ge3JlbmRlcjogcmVuZGVyIHx8IG5vb3AsIHVwZGF0ZTogdXBkYXRlIHx8IG5vb3B9O1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vYmFzaWNhbGx5IGhlaWdodCBvciB3aWR0aFxuICAgIGFwaVtsZW5ndGhOYW1lXSA9IGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICBpZiAoIWRlc2NyaXB0b3JzW2luZGV4XSkge1xuICAgICAgICAgICAgcmV0dXJuIE5hTjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZXNjcmlwdG9yc1tpbmRleF0gJiYgZGVzY3JpcHRvcnNbaW5kZXhdW2xlbmd0aE5hbWVdIHx8IERFRkFVTFRfTEVOR1RIO1xuICAgIH07XG5cbiAgICAvL3JvdyBvciBjb2wgZ2V0XG4gICAgYXBpW25hbWVdID0gZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgICAgIHJldHVybiBkZXNjcmlwdG9yc1tpbmRleCArIG51bUhlYWRlcnNdO1xuICAgIH07XG5cbiAgICByZXR1cm4gYXBpO1xufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmosIHByb3BzLCBkaXJ0eUNsZWFucykge1xuICAgIHByb3BzLmZvckVhY2goZnVuY3Rpb24gKHByb3ApIHtcbiAgICAgICAgdmFyIHZhbDtcbiAgICAgICAgdmFyIG5hbWUgPSBwcm9wLm5hbWUgfHwgcHJvcDtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWw7XG4gICAgICAgICAgICB9LCBzZXQ6IGZ1bmN0aW9uIChfdmFsKSB7XG4gICAgICAgICAgICAgICAgaWYgKF92YWwgIT09IHZhbCkge1xuICAgICAgICAgICAgICAgICAgICBkaXJ0eUNsZWFucy5mb3JFYWNoKGZ1bmN0aW9uIChkaXJ0eUNsZWFuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXJ0eUNsZWFuLnNldERpcnR5KCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcC5vbkRpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wLm9uRGlydHkoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YWwgPSBfdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gb2JqO1xufTsiLCJ2YXIgcG9zaXRpb25SYW5nZSA9IHJlcXVpcmUoJ0BncmlkL3Bvc2l0aW9uLXJhbmdlJyk7XG52YXIgbWFrZURpcnR5Q2xlYW4gPSByZXF1aXJlKCdAZ3JpZC9kaXJ0eS1jbGVhbicpO1xudmFyIGFkZERpcnR5UHJvcHMgPSByZXF1aXJlKCdAZ3JpZC9hZGQtZGlydHktcHJvcHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2dyaWQpIHtcbiAgICB2YXIgZ3JpZCA9IF9ncmlkO1xuXG4gICAgdmFyIGRpcnR5Q2xlYW4gPSBtYWtlRGlydHlDbGVhbihncmlkKTtcbiAgICB2YXIgZGVzY3JpcHRvcnMgPSBbXTtcblxuICAgIHZhciBhcGkgPSB7XG4gICAgICAgIGFkZDogZnVuY3Rpb24gKGRlc2NyaXB0b3IpIHtcbiAgICAgICAgICAgIGRlc2NyaXB0b3JzLnB1c2goZGVzY3JpcHRvcik7XG4gICAgICAgICAgICBkaXJ0eUNsZWFuLnNldERpcnR5KCk7XG4gICAgICAgIH0sXG4gICAgICAgIHJlbW92ZTogZnVuY3Rpb24gKGRlc2NyaXB0b3IpIHtcbiAgICAgICAgICAgIGRlc2NyaXB0b3JzLnNwbGljZShkZXNjcmlwdG9ycy5pbmRleE9mKGRlc2NyaXB0b3IpLCAxKTtcbiAgICAgICAgICAgIGRpcnR5Q2xlYW4uc2V0RGlydHkoKTtcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0QWxsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVzY3JpcHRvcnMuc2xpY2UoMCk7XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZTogZnVuY3Rpb24gKHRvcCwgbGVmdCwgY2xhc3NOYW1lLCBoZWlnaHQsIHdpZHRoLCBzcGFjZSkge1xuICAgICAgICAgICAgdmFyIHRoaXNEaXJ0eUNsZWFuID0gbWFrZURpcnR5Q2xlYW4oZ3JpZCk7XG4gICAgICAgICAgICB2YXIgZGVzY3JpcHRvciA9IHt9O1xuICAgICAgICAgICAgLy9taXhpbnNcbiAgICAgICAgICAgIHBvc2l0aW9uUmFuZ2UoZGVzY3JpcHRvciwgdGhpc0RpcnR5Q2xlYW4sIGRpcnR5Q2xlYW4pO1xuICAgICAgICAgICAgYWRkRGlydHlQcm9wcyhkZXNjcmlwdG9yLCBbJ2NsYXNzJ10sIFt0aGlzRGlydHlDbGVhbiwgZGlydHlDbGVhbl0pO1xuXG4gICAgICAgICAgICAvL2FsbCBvZiB0aGVzZSBhcmUgb3B0aW9uYWxcbiAgICAgICAgICAgIGRlc2NyaXB0b3IudG9wID0gdG9wO1xuICAgICAgICAgICAgZGVzY3JpcHRvci5sZWZ0ID0gbGVmdDtcbiAgICAgICAgICAgIC8vZGVmYXVsdCB0byBzaW5nbGUgY2VsbCByYW5nZXNcbiAgICAgICAgICAgIGRlc2NyaXB0b3IuaGVpZ2h0ID0gaGVpZ2h0IHx8IDE7XG4gICAgICAgICAgICBkZXNjcmlwdG9yLndpZHRoID0gd2lkdGggfHwgMTtcbiAgICAgICAgICAgIGRlc2NyaXB0b3IuY2xhc3MgPSBjbGFzc05hbWU7XG4gICAgICAgICAgICBkZXNjcmlwdG9yLnNwYWNlID0gc3BhY2UgfHwgZGVzY3JpcHRvci5zcGFjZTtcbiAgICAgICAgICAgIHJldHVybiBkZXNjcmlwdG9yO1xuICAgICAgICB9LFxuICAgICAgICBpc0RpcnR5OiBkaXJ0eUNsZWFuLmlzRGlydHlcbiAgICB9O1xuXG5cbiAgICByZXR1cm4gYXBpO1xufTsiLCJ2YXIgY3VzdG9tRXZlbnQgPSByZXF1aXJlKCdAZ3JpZC9jdXN0b20tZXZlbnQnKTtcblxudmFyIFBST1BTX1RPX0NPUFlfRlJPTV9NT1VTRV9FVkVOVFMgPSBbJ2NsaWVudFgnLCAnY2xpZW50WScsICdncmlkWCcsICdncmlkWScsICdsYXllclgnLCAnbGF5ZXJZJywgJ3JvdycsICdjb2wnLCAncmVhbFJvdycsICdyZWFsQ29sJ107XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2dyaWQpIHtcbiAgICB2YXIgZ3JpZCA9IF9ncmlkO1xuXG4gICAgdmFyIG1vZGVsID0ge307XG5cbiAgICB2YXIgd2FzRHJhZ2dlZCA9IGZhbHNlO1xuXG4gICAgbW9kZWwuX2Fubm90YXRlRXZlbnQgPSBmdW5jdGlvbiBhbm5vdGF0ZUV2ZW50KGUpIHtcbiAgICAgICAgc3dpdGNoIChlLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2NsaWNrJzpcbiAgICAgICAgICAgICAgICBlLndhc0RyYWdnZWQgPSB3YXNEcmFnZ2VkO1xuICAgICAgICAgICAgLyoganNoaW50IC1XMDg2ICovXG4gICAgICAgICAgICBjYXNlICdtb3VzZWRvd24nOlxuICAgICAgICAgICAgLyoganNoaW50ICtXMDg2ICovXG4gICAgICAgICAgICBjYXNlICdtb3VzZW1vdmUnOlxuICAgICAgICAgICAgY2FzZSAnbW91c2V1cCc6XG4gICAgICAgICAgICAgICAgbW9kZWwuX2Fubm90YXRlRXZlbnRJbnRlcm5hbChlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICB9XG4gICAgfTtcblxuICAgIG1vZGVsLl9hbm5vdGF0ZUV2ZW50SW50ZXJuYWwgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICB2YXIgeSA9IGdyaWQudmlld1BvcnQudG9HcmlkWShlLmNsaWVudFkpO1xuICAgICAgICB2YXIgeCA9IGdyaWQudmlld1BvcnQudG9HcmlkWChlLmNsaWVudFgpO1xuICAgICAgICBlLnJlYWxSb3cgPSBncmlkLnZpZXdQb3J0LmdldFJvd0J5VG9wKHkpO1xuICAgICAgICBlLnJlYWxDb2wgPSBncmlkLnZpZXdQb3J0LmdldENvbEJ5TGVmdCh4KTtcbiAgICAgICAgZS52aXJ0dWFsUm93ID0gZ3JpZC52aWV3UG9ydC50b1ZpcnR1YWxSb3coZS5yZWFsUm93KTtcbiAgICAgICAgZS52aXJ0dWFsQ29sID0gZ3JpZC52aWV3UG9ydC50b1ZpcnR1YWxDb2woZS5yZWFsQ29sKTtcbiAgICAgICAgZS5yb3cgPSBlLnZpcnR1YWxSb3cgLSBncmlkLnJvd01vZGVsLm51bUhlYWRlcnMoKTtcbiAgICAgICAgZS5jb2wgPSBlLnZpcnR1YWxDb2wgLSBncmlkLmNvbE1vZGVsLm51bUhlYWRlcnMoKTtcbiAgICAgICAgZS5ncmlkWCA9IHg7XG4gICAgICAgIGUuZ3JpZFkgPSB5O1xuICAgIH07XG5cbiAgICBncmlkLmV2ZW50TG9vcC5hZGRJbnRlcmNlcHRvcihmdW5jdGlvbiAoZSkge1xuICAgICAgICBtb2RlbC5fYW5ub3RhdGVFdmVudChlKTtcblxuICAgICAgICBpZiAoZS50eXBlID09PSAnbW91c2Vkb3duJykge1xuICAgICAgICAgICAgc2V0dXBEcmFnRXZlbnRGb3JNb3VzZURvd24oZSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIHNldHVwRHJhZ0V2ZW50Rm9yTW91c2VEb3duKGRvd25FdmVudCkge1xuICAgICAgICB3YXNEcmFnZ2VkID0gZmFsc2U7XG4gICAgICAgIHZhciBsYXN0RHJhZ1JvdyA9IGRvd25FdmVudC5yb3c7XG4gICAgICAgIHZhciBsYXN0RHJhZ0NvbCA9IGRvd25FdmVudC5jb2w7XG4gICAgICAgIHZhciBkcmFnU3RhcnRlZCA9IGZhbHNlO1xuICAgICAgICB2YXIgdW5iaW5kTW92ZSA9IGdyaWQuZXZlbnRMb29wLmJpbmQoJ21vdXNlbW92ZScsIHdpbmRvdywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGlmIChkcmFnU3RhcnRlZCAmJiAhZS53aGljaCkge1xuICAgICAgICAgICAgICAgIC8vZ290IGEgbW92ZSBldmVudCB3aXRob3V0IG1vdXNlIGRvd24gd2hpY2ggbWVhbnMgd2Ugc29tZWhvdyBtaXNzZWQgdGhlIG1vdXNldXBcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnbW91c2Vtb3ZlIHVuYmluZCwgaG93IG9uIGVhcnRoIGRvIHRoZXNlIGhhcHBlbj8nKTtcbiAgICAgICAgICAgICAgICBoYW5kbGVNb3VzZVVwKGUpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFkcmFnU3RhcnRlZCkge1xuICAgICAgICAgICAgICAgIHdhc0RyYWdnZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNyZWF0ZUFuZEZpcmVEcmFnRXZlbnQoJ2dyaWQtZHJhZy1zdGFydCcsIGRvd25FdmVudCk7XG4gICAgICAgICAgICAgICAgZHJhZ1N0YXJ0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjcmVhdGVBbmRGaXJlRHJhZ0V2ZW50KCdncmlkLWRyYWcnLCBlKTtcblxuICAgICAgICAgICAgaWYgKGUucm93ICE9PSBsYXN0RHJhZ1JvdyB8fCBlLmNvbCAhPT0gbGFzdERyYWdDb2wpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVBbmRGaXJlRHJhZ0V2ZW50KCdncmlkLWNlbGwtZHJhZycsIGUpO1xuXG4gICAgICAgICAgICAgICAgbGFzdERyYWdSb3cgPSBlLnJvdztcbiAgICAgICAgICAgICAgICBsYXN0RHJhZ0NvbCA9IGUuY29sO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciB1bmJpbmRVcCA9IGdyaWQuZXZlbnRMb29wLmJpbmQoJ21vdXNldXAnLCB3aW5kb3csIGhhbmRsZU1vdXNlVXApO1xuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZU1vdXNlVXAoZSkge1xuICAgICAgICAgICAgdW5iaW5kTW92ZSgpO1xuICAgICAgICAgICAgdW5iaW5kVXAoKTtcblxuICAgICAgICAgICAgdmFyIGRyYWdFbmQgPSBjcmVhdGVEcmFnRXZlbnRGcm9tTW91c2VFdmVudCgnZ3JpZC1kcmFnLWVuZCcsIGUpO1xuXG4gICAgICAgICAgICAvL3JvdywgY29sLCB4LCBhbmQgeSBzaG91bGQgaW5oZXJpdFxuICAgICAgICAgICAgZ3JpZC5ldmVudExvb3AuZmlyZShkcmFnRW5kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZURyYWdFdmVudEZyb21Nb3VzZUV2ZW50KHR5cGUsIGUpIHtcbiAgICAgICAgdmFyIGV2ZW50ID0gY3VzdG9tRXZlbnQodHlwZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIFBST1BTX1RPX0NPUFlfRlJPTV9NT1VTRV9FVkVOVFMuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkge1xuICAgICAgICAgICAgZXZlbnRbcHJvcF0gPSBlW3Byb3BdO1xuICAgICAgICB9KTtcbiAgICAgICAgZXZlbnQub3JpZ2luYWxFdmVudCA9IGU7XG4gICAgICAgIHJldHVybiBldmVudDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVBbmRGaXJlRHJhZ0V2ZW50KHR5cGUsIGUpIHtcbiAgICAgICAgdmFyIGRyYWcgPSBjcmVhdGVEcmFnRXZlbnRGcm9tTW91c2VFdmVudCh0eXBlLCBlKTtcbiAgICAgICAgaWYgKGUudGFyZ2V0KSB7XG4gICAgICAgICAgICBlLnRhcmdldC5kaXNwYXRjaEV2ZW50KGRyYWcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZ3JpZC5ldmVudExvb3AuZmlyZShkcmFnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZHJhZztcbiAgICB9XG5cbiAgICByZXR1cm4gbW9kZWw7XG59OyIsInZhciB1dGlsID0gcmVxdWlyZSgnQGdyaWQvdXRpbCcpO1xudmFyIGNhcGl0YWxpemUgPSByZXF1aXJlKCdjYXBpdGFsaXplJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKF9ncmlkKSB7XG4gICAgdmFyIGdyaWQgPSBfZ3JpZDtcbiAgICB2YXIgZGlydHlDbGVhbiA9IHJlcXVpcmUoJ0BncmlkL2RpcnR5LWNsZWFuJykoZ3JpZCk7XG5cblxuICAgIHZhciByb3c7XG4gICAgdmFyIG1vZGVsID0ge2NvbDogMH07XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsLCAncm93Jywge1xuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiByb3c7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgIGlmIChyIDwgMCB8fCBpc05hTihyKSkge1xuICAgICAgICAgICAgICAgIGRlYnVnZ2VyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcm93ID0gcjtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIG1vZGVsLnJvdyA9IDA7XG5cbiAgICBtb2RlbC5pc0RpcnR5ID0gZGlydHlDbGVhbi5pc0RpcnR5O1xuXG4gICAgbW9kZWwuc2Nyb2xsVG8gPSBmdW5jdGlvbiAociwgYywgZG9udEZpcmUpIHtcbiAgICAgICAgaWYgKGlzTmFOKHIpIHx8IGlzTmFOKGMpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG1heFJvdyA9IChncmlkLnJvd01vZGVsLmxlbmd0aCgpIHx8IDEpIC0gMTtcbiAgICAgICAgdmFyIG1heENvbCA9IChncmlkLmNvbE1vZGVsLmxlbmd0aCgpIHx8IDEpIC0gMTtcbiAgICAgICAgdmFyIGxhc3RSb3cgPSBtb2RlbC5yb3c7XG4gICAgICAgIHZhciBsYXN0Q29sID0gbW9kZWwuY29sO1xuICAgICAgICBtb2RlbC5yb3cgPSB1dGlsLmNsYW1wKHIsIDAsIG1heFJvdyk7XG4gICAgICAgIG1vZGVsLmNvbCA9IHV0aWwuY2xhbXAoYywgMCwgbWF4Q29sKTtcbiAgICAgICAgaWYgKGxhc3RSb3cgIT09IG1vZGVsLnJvdyB8fCBsYXN0Q29sICE9PSBtb2RlbC5jb2wpIHtcbiAgICAgICAgICAgIGRpcnR5Q2xlYW4uc2V0RGlydHkoKTtcbiAgICAgICAgICAgIGlmICghZG9udEZpcmUpIHtcbiAgICAgICAgICAgICAgICB2YXIgdG9wID0gZ3JpZC52aXJ0dWFsUGl4ZWxDZWxsTW9kZWwuaGVpZ2h0KDAsIG1vZGVsLnJvdyAtIDEpO1xuICAgICAgICAgICAgICAgIHZhciBsZWZ0ID0gZ3JpZC52aXJ0dWFsUGl4ZWxDZWxsTW9kZWwud2lkdGgoMCwgbW9kZWwuY29sIC0gMSk7XG4gICAgICAgICAgICAgICAgZ3JpZC5waXhlbFNjcm9sbE1vZGVsLnNjcm9sbFRvKHRvcCwgbGVmdCwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY29udmVydFZpcnR1YWxUb1Njcm9sbCh2aXJ0dWFsQ29vcmQsIHJvd09yQ29sKSB7XG4gICAgICAgIHJldHVybiB2aXJ0dWFsQ29vcmQgLSBncmlkW3Jvd09yQ29sICsgJ01vZGVsJ10ubnVtRml4ZWQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTY3JvbGxUb1Jvd09yQ29sKHZpcnR1YWxDb29yZCwgcm93T3JDb2wsIGhlaWdodFdpZHRoKSB7XG4gICAgICAgIHZhciBjdXJyZW50U2Nyb2xsID0gbW9kZWxbcm93T3JDb2xdO1xuICAgICAgICB2YXIgc2Nyb2xsVG8gPSBjdXJyZW50U2Nyb2xsO1xuICAgICAgICBpZiAoZ3JpZC52aWV3UG9ydFtyb3dPckNvbCArICdJc0luVmlldyddKHZpcnR1YWxDb29yZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBzY3JvbGxUbztcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB0YXJnZXRTY3JvbGwgPSBjb252ZXJ0VmlydHVhbFRvU2Nyb2xsKHZpcnR1YWxDb29yZCwgcm93T3JDb2wpO1xuICAgICAgICBpZiAodGFyZ2V0U2Nyb2xsIDwgY3VycmVudFNjcm9sbCkge1xuICAgICAgICAgICAgc2Nyb2xsVG8gPSB0YXJnZXRTY3JvbGw7XG4gICAgICAgIH0gZWxzZSBpZiAodGFyZ2V0U2Nyb2xsID4gY3VycmVudFNjcm9sbCkge1xuXG4gICAgICAgICAgICB2YXIgbGVuZ3RoVG9DZWxsID0gZ3JpZC52aXJ0dWFsUGl4ZWxDZWxsTW9kZWxbaGVpZ2h0V2lkdGhdKDAsIHZpcnR1YWxDb29yZCk7XG4gICAgICAgICAgICB2YXIgbnVtRml4ZWQgPSBncmlkW3Jvd09yQ29sICsgJ01vZGVsJ10ubnVtRml4ZWQoKTtcbiAgICAgICAgICAgIHNjcm9sbFRvID0gMDtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSBudW1GaXhlZDsgaSA8IHZpcnR1YWxDb29yZDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGVuZ3RoVG9DZWxsIC09IGdyaWQudmlydHVhbFBpeGVsQ2VsbE1vZGVsW2hlaWdodFdpZHRoXShpKTtcbiAgICAgICAgICAgICAgICBzY3JvbGxUbyA9IGkgLSAobnVtRml4ZWQgLSAxKTtcbiAgICAgICAgICAgICAgICBpZiAobGVuZ3RoVG9DZWxsIDw9IGdyaWQudmlld1BvcnRbaGVpZ2h0V2lkdGhdKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzY3JvbGxUbztcbiAgICB9XG5cbiAgICBtb2RlbC5zY3JvbGxJbnRvVmlldyA9IGZ1bmN0aW9uICh2ciwgdmMpIHtcbiAgICAgICAgdnIgPSBncmlkLnZpcnR1YWxQaXhlbENlbGxNb2RlbC5jbGFtcFJvdyh2cik7XG4gICAgICAgIHZjID0gZ3JpZC52aXJ0dWFsUGl4ZWxDZWxsTW9kZWwuY2xhbXBDb2wodmMpO1xuICAgICAgICB2YXIgbmV3Um93ID0gZ2V0U2Nyb2xsVG9Sb3dPckNvbCh2ciwgJ3JvdycsICdoZWlnaHQnKTtcbiAgICAgICAgdmFyIG5ld0NvbCA9IGdldFNjcm9sbFRvUm93T3JDb2wodmMsICdjb2wnLCAnd2lkdGgnKTtcbiAgICAgICAgbW9kZWwuc2Nyb2xsVG8obmV3Um93LCBuZXdDb2wpO1xuICAgIH07XG5cblxuICAgIHJldHVybiBtb2RlbDtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2dyaWQpIHtcbiAgICB2YXIgZ3JpZCA9IF9ncmlkO1xuXG4gICAgdmFyIGFwaSA9IHJlcXVpcmUoJ0BncmlkL2Fic3RyYWN0LXJvdy1jb2wtbW9kZWwnKShncmlkLCAnY29sJywgJ3dpZHRoJywgMTAwKTtcblxuICAgIHJldHVybiBhcGk7XG59OyIsInZhciBlbGVtZW50Q2xhc3MgPSByZXF1aXJlKCdlbGVtZW50LWNsYXNzJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJ0BncmlkL3V0aWwnKTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfZ3JpZCkge1xuICAgIHZhciBncmlkID0gX2dyaWQ7XG5cbiAgICB2YXIgYXBpID0ge2Fubm90YXRlRGVjb3JhdG9yOiBtYWtlUmVvcmRlckRlY29yYXRvcn07XG5cbiAgICBmdW5jdGlvbiBtYWtlUmVvcmRlckRlY29yYXRvcihoZWFkZXJEZWNvcmF0b3IpIHtcbiAgICAgICAgdmFyIGNvbCA9IGhlYWRlckRlY29yYXRvci5sZWZ0O1xuICAgICAgICBoZWFkZXJEZWNvcmF0b3IuX2RyYWdSZWN0ID0gZ3JpZC5kZWNvcmF0b3JzLmNyZWF0ZSgwLCB1bmRlZmluZWQsIEluZmluaXR5LCB1bmRlZmluZWQsICdweCcsICdyZWFsJyk7XG5cbiAgICAgICAgaGVhZGVyRGVjb3JhdG9yLl9kcmFnUmVjdC5wb3N0UmVuZGVyID0gZnVuY3Rpb24gKGRpdikge1xuICAgICAgICAgICAgZGl2LnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAnZ3JpZC1kcmFnLXJlY3QnKTtcbiAgICAgICAgfTtcblxuICAgICAgICBoZWFkZXJEZWNvcmF0b3IuX29uRHJhZ1N0YXJ0ID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGlmIChlLnJlYWxDb2wgPCBncmlkLmNvbE1vZGVsLm51bUZpeGVkKCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgZ3JpZC5kZWNvcmF0b3JzLmFkZChoZWFkZXJEZWNvcmF0b3IuX2RyYWdSZWN0KTtcblxuICAgICAgICAgICAgaGVhZGVyRGVjb3JhdG9yLl9kcmFnUmVjdC53aWR0aCA9IGdyaWQudmlld1BvcnQuZ2V0Q29sV2lkdGgoY29sKTtcbiAgICAgICAgICAgIHZhciBjb2xPZmZzZXQgPSBlLmdyaWRYIC0gaGVhZGVyRGVjb3JhdG9yLmdldERlY29yYXRvckxlZnQoKTtcblxuICAgICAgICAgICAgaGVhZGVyRGVjb3JhdG9yLl9kcmFnUmVjdC5fdGFyZ2V0Q29sID0gZ3JpZC5kZWNvcmF0b3JzLmNyZWF0ZSgwLCB1bmRlZmluZWQsIEluZmluaXR5LCAxLCAnY2VsbCcsICdyZWFsJyk7XG4gICAgICAgICAgICBoZWFkZXJEZWNvcmF0b3IuX2RyYWdSZWN0Ll90YXJnZXRDb2wucG9zdFJlbmRlciA9IGZ1bmN0aW9uIChkaXYpIHtcbiAgICAgICAgICAgICAgICBkaXYuc2V0QXR0cmlidXRlKCdjbGFzcycsICdncmlkLXJlb3JkZXItdGFyZ2V0Jyk7XG4gICAgICAgICAgICAgICAgaGVhZGVyRGVjb3JhdG9yLl9kcmFnUmVjdC5fdGFyZ2V0Q29sLl9yZW5kZXJlZEVsZW0gPSBkaXY7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZ3JpZC5kZWNvcmF0b3JzLmFkZChoZWFkZXJEZWNvcmF0b3IuX2RyYWdSZWN0Ll90YXJnZXRDb2wpO1xuXG4gICAgICAgICAgICBoZWFkZXJEZWNvcmF0b3IuX3VuYmluZERyYWcgPSBncmlkLmV2ZW50TG9vcC5iaW5kKCdncmlkLWRyYWcnLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgIGhlYWRlckRlY29yYXRvci5fZHJhZ1JlY3QubGVmdCA9IHV0aWwuY2xhbXAoZS5ncmlkWCAtIGNvbE9mZnNldCwgZ3JpZC52aWV3UG9ydC5nZXRDb2xMZWZ0KGdyaWQuY29sTW9kZWwubnVtRml4ZWQoKSksIEluZmluaXR5KTtcbiAgICAgICAgICAgICAgICBoZWFkZXJEZWNvcmF0b3IuX2RyYWdSZWN0Ll90YXJnZXRDb2wubGVmdCA9IHV0aWwuY2xhbXAoZS5yZWFsQ29sLCBncmlkLmNvbE1vZGVsLm51bUZpeGVkKCksIEluZmluaXR5KTtcbiAgICAgICAgICAgICAgICBpZiAoZS5yZWFsQ29sID4gY29sKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnRDbGFzcyhoZWFkZXJEZWNvcmF0b3IuX2RyYWdSZWN0Ll90YXJnZXRDb2wuX3JlbmRlcmVkRWxlbSkuYWRkKCdyaWdodCcpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnRDbGFzcyhoZWFkZXJEZWNvcmF0b3IuX2RyYWdSZWN0Ll90YXJnZXRDb2wuX3JlbmRlcmVkRWxlbSkucmVtb3ZlKCdyaWdodCcpO1xuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaGVhZGVyRGVjb3JhdG9yLl91bmJpbmREcmFnRW5kID0gZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC1kcmFnLWVuZCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldENvbCA9IGhlYWRlckRlY29yYXRvci5fZHJhZ1JlY3QuX3RhcmdldENvbC5sZWZ0O1xuXG4gICAgICAgICAgICAgICAgZ3JpZC5jb2xNb2RlbC5tb3ZlKGdyaWQudmlld1BvcnQudG9WaXJ0dWFsQ29sKGNvbCksIGdyaWQudmlld1BvcnQudG9WaXJ0dWFsQ29sKHRhcmdldENvbCkpO1xuICAgICAgICAgICAgICAgIGdyaWQuZGVjb3JhdG9ycy5yZW1vdmUoW2hlYWRlckRlY29yYXRvci5fZHJhZ1JlY3QuX3RhcmdldENvbCwgaGVhZGVyRGVjb3JhdG9yLl9kcmFnUmVjdF0pO1xuICAgICAgICAgICAgICAgIGhlYWRlckRlY29yYXRvci5fdW5iaW5kRHJhZygpO1xuICAgICAgICAgICAgICAgIGhlYWRlckRlY29yYXRvci5fdW5iaW5kRHJhZ0VuZCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgaGVhZGVyRGVjb3JhdG9yLnBvc3RSZW5kZXIgPSBmdW5jdGlvbiAoZGl2KSB7XG4gICAgICAgICAgICBkaXYuc2V0QXR0cmlidXRlKCdjbGFzcycsICdncmlkLWNvbC1yZW9yZGVyJyk7XG4gICAgICAgICAgICBncmlkLmV2ZW50TG9vcC5iaW5kKCdncmlkLWRyYWctc3RhcnQnLCBkaXYsIGhlYWRlckRlY29yYXRvci5fb25EcmFnU3RhcnQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBoZWFkZXJEZWNvcmF0b3I7XG4gICAgfVxuXG4gICAgcmVxdWlyZSgnQGdyaWQvaGVhZGVyLWRlY29yYXRvcnMnKShncmlkLCBhcGkpO1xuXG4gICAgcmV0dXJuIGFwaTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2dyaWQpIHtcbiAgICB2YXIgZ3JpZCA9IF9ncmlkO1xuXG5cbiAgICB2YXIgYXBpID0ge2Fubm90YXRlRGVjb3JhdG9yOiBhbm5vdGF0ZURlY29yYXRvcn07XG5cbiAgICBmdW5jdGlvbiBhbm5vdGF0ZURlY29yYXRvcihoZWFkZXJEZWNvcmF0b3IpIHtcbiAgICAgICAgdmFyIGNvbCA9IGhlYWRlckRlY29yYXRvci5sZWZ0O1xuICAgICAgICBoZWFkZXJEZWNvcmF0b3IuX2RyYWdMaW5lID0gZ3JpZC5kZWNvcmF0b3JzLmNyZWF0ZSgwLCB1bmRlZmluZWQsIEluZmluaXR5LCAxLCAncHgnLCAncmVhbCcpO1xuXG4gICAgICAgIGhlYWRlckRlY29yYXRvci5fZHJhZ0xpbmUucG9zdFJlbmRlciA9IGZ1bmN0aW9uIChkaXYpIHtcbiAgICAgICAgICAgIGRpdi5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgJ2dyaWQtZHJhZy1saW5lJyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgaGVhZGVyRGVjb3JhdG9yLl9vbkRyYWdTdGFydCA9IGZ1bmN0aW9uIChlKSB7XG5cbiAgICAgICAgICAgIGdyaWQuZGVjb3JhdG9ycy5hZGQoaGVhZGVyRGVjb3JhdG9yLl9kcmFnTGluZSk7XG5cbiAgICAgICAgICAgIGhlYWRlckRlY29yYXRvci5fdW5iaW5kRHJhZyA9IGdyaWQuZXZlbnRMb29wLmJpbmQoJ2dyaWQtZHJhZycsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1pblggPSBoZWFkZXJEZWNvcmF0b3IuZ2V0RGVjb3JhdG9yTGVmdCgpICsgMTA7XG4gICAgICAgICAgICAgICAgaGVhZGVyRGVjb3JhdG9yLl9kcmFnTGluZS5sZWZ0ID0gTWF0aC5tYXgoZS5ncmlkWCwgbWluWCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaGVhZGVyRGVjb3JhdG9yLl91bmJpbmREcmFnRW5kID0gZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC1kcmFnLWVuZCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgZ3JpZC5jb2xNb2RlbC5nZXQoZ3JpZC52aWV3UG9ydC50b1ZpcnR1YWxDb2woY29sKSkud2lkdGggPSBoZWFkZXJEZWNvcmF0b3IuX2RyYWdMaW5lLmxlZnQgLSBoZWFkZXJEZWNvcmF0b3IuZ2V0RGVjb3JhdG9yTGVmdCgpO1xuICAgICAgICAgICAgICAgIGdyaWQuZGVjb3JhdG9ycy5yZW1vdmUoaGVhZGVyRGVjb3JhdG9yLl9kcmFnTGluZSk7XG4gICAgICAgICAgICAgICAgaGVhZGVyRGVjb3JhdG9yLl91bmJpbmREcmFnKCk7XG4gICAgICAgICAgICAgICAgaGVhZGVyRGVjb3JhdG9yLl91bmJpbmREcmFnRW5kKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBoZWFkZXJEZWNvcmF0b3IucG9zdFJlbmRlciA9IGZ1bmN0aW9uIChkaXYpIHtcbiAgICAgICAgICAgIGRpdi5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlWCg1MCUpJztcbiAgICAgICAgICAgIGRpdi5zdHlsZS53ZWJraXRUcmFuc2Zvcm0gPSAndHJhbnNsYXRlWCg1MCUpJztcblxuICAgICAgICAgICAgZGl2LnN0eWxlLnJlbW92ZVByb3BlcnR5KCdsZWZ0Jyk7XG4gICAgICAgICAgICBkaXYuc2V0QXR0cmlidXRlKCdjbGFzcycsICdjb2wtcmVzaXplJyk7XG5cbiAgICAgICAgICAgIGdyaWQuZXZlbnRMb29wLmJpbmQoJ2dyaWQtZHJhZy1zdGFydCcsIGRpdiwgaGVhZGVyRGVjb3JhdG9yLl9vbkRyYWdTdGFydCk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmVxdWlyZSgnQGdyaWQvaGVhZGVyLWRlY29yYXRvcnMnKShncmlkLCBhcGkpO1xuXG4gICAgcmV0dXJuIGFwaTtcbn07IiwidmFyIGVsZW1lbnRDbGFzcyA9IHJlcXVpcmUoJ2VsZW1lbnQtY2xhc3MnKTtcbnZhciBkaXJ0eUNsZWFuID0gcmVxdWlyZSgnQGdyaWQvZGlydHktY2xlYW4nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgZ3JpZCA9IHt9O1xuXG4gICAgLy90aGUgb3JkZXIgaGVyZSBtYXR0ZXJzIGJlY2F1c2Ugc29tZSBvZiB0aGVzZSBkZXBlbmQgb24gZWFjaCBvdGhlclxuICAgIGdyaWQuZXZlbnRMb29wID0gcmVxdWlyZSgnQGdyaWQvZXZlbnQtbG9vcCcpKGdyaWQpO1xuICAgIGdyaWQuZGVjb3JhdG9ycyA9IHJlcXVpcmUoJ0BncmlkL2RlY29yYXRvcnMnKShncmlkKTtcbiAgICBncmlkLmNlbGxDbGFzc2VzID0gcmVxdWlyZSgnQGdyaWQvY2VsbC1jbGFzc2VzJykoZ3JpZCk7XG4gICAgZ3JpZC5yb3dNb2RlbCA9IHJlcXVpcmUoJ0BncmlkL3Jvdy1tb2RlbCcpKGdyaWQpO1xuICAgIGdyaWQuY29sTW9kZWwgPSByZXF1aXJlKCdAZ3JpZC9jb2wtbW9kZWwnKShncmlkKTtcbiAgICBncmlkLmRhdGFNb2RlbCA9IHJlcXVpcmUoJ0BncmlkL3NpbXBsZS1kYXRhLW1vZGVsJykoZ3JpZCk7XG4gICAgZ3JpZC52aXJ0dWFsUGl4ZWxDZWxsTW9kZWwgPSByZXF1aXJlKCdAZ3JpZC92aXJ0dWFsLXBpeGVsLWNlbGwtbW9kZWwnKShncmlkKTtcbiAgICBncmlkLmNlbGxTY3JvbGxNb2RlbCA9IHJlcXVpcmUoJ0BncmlkL2NlbGwtc2Nyb2xsLW1vZGVsJykoZ3JpZCk7XG4gICAgZ3JpZC5jZWxsTW91c2VNb2RlbCA9IHJlcXVpcmUoJ0BncmlkL2NlbGwtbW91c2UtbW9kZWwnKShncmlkKTtcblxuICAgIGdyaWQudmlld1BvcnQgPSByZXF1aXJlKCdAZ3JpZC92aWV3LXBvcnQnKShncmlkKTtcbiAgICBncmlkLnZpZXdMYXllciA9IHJlcXVpcmUoJ0BncmlkL3ZpZXctbGF5ZXInKShncmlkKTtcblxuICAgIC8vdGhpbmdzIHdpdGggbG9naWMgdGhhdCBhbHNvIHJlZ2lzdGVyIGRlY29yYXRvcnMgKHNsaWdodGx5IGxlc3MgY29yZSB0aGFuIHRoZSBvdGhlciBtb2RlbHMpXG4gICAgZ3JpZC5uYXZpZ2F0aW9uTW9kZWwgPSByZXF1aXJlKCdAZ3JpZC9uYXZpZ2F0aW9uLW1vZGVsJykoZ3JpZCk7XG4gICAgZ3JpZC5waXhlbFNjcm9sbE1vZGVsID0gcmVxdWlyZSgnQGdyaWQvcGl4ZWwtc2Nyb2xsLW1vZGVsJykoZ3JpZCk7XG4gICAgZ3JpZC5jb2xSZXNpemUgPSByZXF1aXJlKCdAZ3JpZC9jb2wtcmVzaXplJykoZ3JpZCk7XG4gICAgZ3JpZC5jb2xSZW9yZGVyID0gcmVxdWlyZSgnQGdyaWQvY29sLXJlb3JkZXInKShncmlkKTtcblxuICAgIC8vc29ydCBmdW5jdGlvbmFsaXR5IGhhcyBubyBhcGksIGl0IGp1c3Qgc2V0cyB1cCBhbiBldmVudCBsaXN0ZW5lclxuICAgIC8vZm9yIG5vdyBkaXNhYmxlIGhlYWRlciBjbGljayBzb3J0IGNhdXNlIHdlJ3JlIGdvbm5hIHVzZSB0aGUgY2xpY2sgZm9yIHNlbGVjdGlvbiBpbnN0ZWFkXG4gICAgLy9yZXF1aXJlKCdAZ3JpZC9jb2wtc29ydCcpKGdyaWQpO1xuXG5cbiAgICB2YXIgZHJhd1JlcXVlc3RlZCA9IGZhbHNlO1xuICAgIGdyaWQucmVxdWVzdERyYXcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghZ3JpZC5ldmVudExvb3AuaXNSdW5uaW5nKSB7XG4gICAgICAgICAgICBncmlkLnZpZXdMYXllci5kcmF3KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkcmF3UmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBncmlkLmV2ZW50TG9vcC5iaW5kKCdncmlkLWRyYXcnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRyYXdSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIGdyaWQuZXZlbnRMb29wLmFkZEV4aXRMaXN0ZW5lcihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChkcmF3UmVxdWVzdGVkKSB7XG4gICAgICAgICAgICBncmlkLnZpZXdMYXllci5kcmF3KCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGNyZWF0ZUZvY3VzVGV4dEFyZWEoY29udGFpbmVyKSB7XG4gICAgICAgIHZhciB0ZXh0YXJlYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RleHRhcmVhJyk7XG4gICAgICAgIHRleHRhcmVhLnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcbiAgICAgICAgdGV4dGFyZWEuc3R5bGUubGVmdCA9ICctMTAwMDAwcHgnO1xuICAgICAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdmb2N1cycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChjb250YWluZXIpIHtcbiAgICAgICAgICAgICAgICBlbGVtZW50Q2xhc3MoY29udGFpbmVyKS5hZGQoJ2ZvY3VzJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2JsdXInLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoY29udGFpbmVyKSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudENsYXNzKGNvbnRhaW5lcikucmVtb3ZlKCdmb2N1cycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQodGV4dGFyZWEpO1xuICAgICAgICBpZiAoIWNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ3RhYkluZGV4JykpIHtcbiAgICAgICAgICAgIGNvbnRhaW5lci50YWJJbmRleCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRleHRhcmVhKSB7XG4gICAgICAgICAgICAgICAgdGV4dGFyZWEuZm9jdXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRleHRhcmVhO1xuICAgIH1cblxuICAgIGdyaWQuYnVpbGQgPSBmdW5jdGlvbiAoY29udGFpbmVyKSB7XG4gICAgICAgIGNyZWF0ZUZvY3VzVGV4dEFyZWEoY29udGFpbmVyKTtcbiAgICAgICAgZ3JpZC52aWV3UG9ydC5zaXplVG9Db250YWluZXIoY29udGFpbmVyKTtcbiAgICAgICAgZ3JpZC52aWV3TGF5ZXIuYnVpbGQoY29udGFpbmVyKTtcbiAgICAgICAgZ3JpZC5ldmVudExvb3Auc2V0Q29udGFpbmVyKGNvbnRhaW5lcik7XG4gICAgfTtcblxuICAgIGdyaWQubWFrZURpcnR5Q2xlYW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBkaXJ0eUNsZWFuKGdyaWQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gZ3JpZDtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAobmFtZSwgYnViYmxlcywgY2FuY2VsYWJsZSwgZGV0YWlsKSB7XG4gICAgdmFyIGV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0N1c3RvbUV2ZW50Jyk7ICAvLyBNVVNUIGJlICdDdXN0b21FdmVudCdcbiAgICBldmVudC5pbml0Q3VzdG9tRXZlbnQobmFtZSwgYnViYmxlcywgY2FuY2VsYWJsZSwgZGV0YWlsKTtcbiAgICByZXR1cm4gZXZlbnQ7XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuLCBkZWxheSkge1xuICAgIHZhciBmID0gZnVuY3Rpb24gZGVib3VuY2VkKCkge1xuICAgICAgICBpZiAoZi50aW1lb3V0KSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoZi50aW1lb3V0KTtcbiAgICAgICAgICAgIGYudGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBmLnRpbWVvdXQgPSBzZXRUaW1lb3V0KGZuLCBkZWxheSk7XG4gICAgfTtcbiAgICByZXR1cm4gZjtcbn07IiwidmFyIHV0aWwgPSByZXF1aXJlKCdAZ3JpZC91dGlsJyk7XG52YXIgbWFrZURpcnR5Q2xlYW4gPSByZXF1aXJlKCdAZ3JpZC9kaXJ0eS1jbGVhbicpO1xudmFyIHBvc2l0aW9uUmFuZ2UgPSByZXF1aXJlKCdAZ3JpZC9wb3NpdGlvbi1yYW5nZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfZ3JpZCkge1xuICAgIHZhciBncmlkID0gX2dyaWQ7XG5cbiAgICB2YXIgZGlydHlDbGVhbiA9IG1ha2VEaXJ0eUNsZWFuKGdyaWQpO1xuXG4gICAgdmFyIGFsaXZlRGVjb3JhdG9ycyA9IFtdO1xuICAgIHZhciBkZWFkRGVjb3JhdG9ycyA9IFtdO1xuXG4gICAgdmFyIGRlY29yYXRvcnMgPSB7XG4gICAgICAgIGFkZDogZnVuY3Rpb24gKGRlY29yYXRvcikge1xuICAgICAgICAgICAgYWxpdmVEZWNvcmF0b3JzLnB1c2goZGVjb3JhdG9yKTtcbiAgICAgICAgICAgIGRpcnR5Q2xlYW4uc2V0RGlydHkoKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmVtb3ZlOiBmdW5jdGlvbiAoZGVjb3JhdG9ycykge1xuICAgICAgICAgICAgaWYgKCF1dGlsLmlzQXJyYXkoZGVjb3JhdG9ycykpIHtcbiAgICAgICAgICAgICAgICBkZWNvcmF0b3JzID0gW2RlY29yYXRvcnNdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVjb3JhdG9ycy5mb3JFYWNoKGZ1bmN0aW9uIChkZWNvcmF0b3IpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBhbGl2ZURlY29yYXRvcnMuaW5kZXhPZihkZWNvcmF0b3IpO1xuICAgICAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgYWxpdmVEZWNvcmF0b3JzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgICAgIGRlYWREZWNvcmF0b3JzLnB1c2goZGVjb3JhdG9yKTtcbiAgICAgICAgICAgICAgICAgICAgZGlydHlDbGVhbi5zZXREaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBnZXRBbGl2ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGFsaXZlRGVjb3JhdG9ycy5zbGljZSgwKTtcbiAgICAgICAgfSxcbiAgICAgICAgcG9wQWxsRGVhZDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG9sZERlYWQgPSBkZWFkRGVjb3JhdG9ycztcbiAgICAgICAgICAgIGRlYWREZWNvcmF0b3JzID0gW107XG4gICAgICAgICAgICByZXR1cm4gb2xkRGVhZDtcbiAgICAgICAgfSxcbiAgICAgICAgaXNEaXJ0eTogZGlydHlDbGVhbi5pc0RpcnR5LFxuICAgICAgICBjcmVhdGU6IGZ1bmN0aW9uICh0LCBsLCBoLCB3LCB1LCBzKSB7XG4gICAgICAgICAgICB2YXIgZGVjb3JhdG9yID0ge307XG4gICAgICAgICAgICB2YXIgdGhpc0RpcnR5Q2xlYW4gPSBtYWtlRGlydHlDbGVhbihncmlkKTtcblxuICAgICAgICAgICAgLy9taXhpbiB0aGUgcG9zaXRpb24gcmFuZ2UgZnVuY3Rpb25hbGl0eVxuICAgICAgICAgICAgcG9zaXRpb25SYW5nZShkZWNvcmF0b3IsIHRoaXNEaXJ0eUNsZWFuLCBkaXJ0eUNsZWFuKTtcbiAgICAgICAgICAgIGRlY29yYXRvci50b3AgPSB0O1xuICAgICAgICAgICAgZGVjb3JhdG9yLmxlZnQgPSBsO1xuICAgICAgICAgICAgZGVjb3JhdG9yLmhlaWdodCA9IGg7XG4gICAgICAgICAgICBkZWNvcmF0b3Iud2lkdGggPSB3O1xuICAgICAgICAgICAgZGVjb3JhdG9yLnVuaXRzID0gdSB8fCBkZWNvcmF0b3IudW5pdHM7XG4gICAgICAgICAgICBkZWNvcmF0b3Iuc3BhY2UgPSBzIHx8IGRlY29yYXRvci5zcGFjZTtcblxuICAgICAgICAgICAgLy90aGV5IGNhbiBvdmVycmlkZSBidXQgd2Ugc2hvdWxkIGhhdmUgYW4gZW1wdHkgZGVmYXVsdCB0byBwcmV2ZW50IG5wZXNcbiAgICAgICAgICAgIGRlY29yYXRvci5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgIGRpdi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgICAgICAgICAgZGl2LnN0eWxlLnRvcCA9ICcwcHgnO1xuICAgICAgICAgICAgICAgIGRpdi5zdHlsZS5sZWZ0ID0gJzBweCc7XG4gICAgICAgICAgICAgICAgZGl2LnN0eWxlLmJvdHRvbSA9ICcwcHgnO1xuICAgICAgICAgICAgICAgIGRpdi5zdHlsZS5yaWdodCA9ICcwcHgnO1xuICAgICAgICAgICAgICAgIGlmIChkZWNvcmF0b3IucG9zdFJlbmRlcikge1xuICAgICAgICAgICAgICAgICAgICBkZWNvcmF0b3IucG9zdFJlbmRlcihkaXYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZGl2O1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBkZWNvcmF0b3I7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4gICAgcmV0dXJuIGRlY29yYXRvcnM7XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKF9ncmlkKSB7XG4gICAgdmFyIGdyaWQgPSBfZ3JpZDtcbiAgICB2YXIgZGlydHkgPSB0cnVlO1xuXG4gICAgZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC1kcmF3JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBhcGkuc2V0Q2xlYW4oKTtcbiAgICB9KTtcblxuXG4gICAgdmFyIGFwaSA9IHtcbiAgICAgICAgaXNEaXJ0eTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGRpcnR5O1xuICAgICAgICB9LFxuICAgICAgICBpc0NsZWFuOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gIWRpcnR5O1xuICAgICAgICB9LFxuICAgICAgICBzZXREaXJ0eTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgLy93aGVuIHRoaW5ncyBhcmUgaW5pdGFsaXppbmcgc29tZXRpbWVzIHRoaXMgZG9lc24ndCBleGlzdCB5ZXRcbiAgICAgICAgICAgIC8vd2UgaGF2ZSB0byBob3BlIHRoYXQgYXQgdGhlIGVuZCBvZiBpbml0aWFsaXphdGlvbiB0aGUgZ3JpZCB3aWxsIGNhbGwgcmVxdWVzdCBkcmF3IGl0c2VsZlxuICAgICAgICAgICAgaWYgKGdyaWQucmVxdWVzdERyYXcpIHtcbiAgICAgICAgICAgICAgICBncmlkLnJlcXVlc3REcmF3KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHNldENsZWFuOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBkaXJ0eSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4gYXBpO1xufTsiLCJ2YXIgbW91c2V3aGVlbCA9IHJlcXVpcmUoJ0BncmlkL21vdXNld2hlZWwnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgnQGdyaWQvdXRpbCcpO1xudmFyIGxpc3RlbmVycyA9IHJlcXVpcmUoJ0BncmlkL2xpc3RlbmVycycpO1xuXG52YXIgRVZFTlRTID0gWydjbGljaycsICdtb3VzZWRvd24nLCAnbW91c2V1cCcsICdtb3VzZW1vdmUnLCAnZGJsY2xpY2snLCAna2V5ZG93bicsICdrZXlwcmVzcycsICdrZXl1cCddO1xuXG52YXIgR1JJRF9FVkVOVFMgPSBbJ2dyaWQtZHJhZy1zdGFydCcsICdncmlkLWRyYWcnLCAnZ3JpZC1jZWxsLWRyYWcnLCAnZ3JpZC1kcmFnLWVuZCddO1xuXG52YXIgZXZlbnRMb29wID0gZnVuY3Rpb24gKF9ncmlkKSB7XG4gICAgdmFyIGdyaWQgPSBfZ3JpZDtcbiAgICB2YXIgZWxvb3AgPSB7XG4gICAgICAgIGlzUnVubmluZzogZmFsc2VcbiAgICB9O1xuXG4gICAgdmFyIGhhbmRsZXJzQnlOYW1lID0ge307XG4gICAgdmFyIGRvbVVuYmluZEZucyA9IFtdO1xuXG4gICAgdmFyIHVuYmluZEFsbDtcblxuICAgIGVsb29wLnNldENvbnRhaW5lciA9IGZ1bmN0aW9uIChjb250YWluZXIpIHtcbiAgICAgICAgdmFyIHVuYmluZE1vdXNlV2hlZWxGbiA9IG1vdXNld2hlZWwuYmluZChjb250YWluZXIsIG1haW5Mb29wKTtcblxuICAgICAgICBFVkVOVFMuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgYmluZFRvRG9tRWxlbWVudChjb250YWluZXIsIG5hbWUsIG1haW5Mb29wKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgR1JJRF9FVkVOVFMuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgYmluZFRvRG9tRWxlbWVudCh3aW5kb3csIG5hbWUsIG1haW5Mb29wKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdW5iaW5kQWxsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdW5iaW5kTW91c2VXaGVlbEZuKCk7XG5cbiAgICAgICAgICAgIC8vaGF2ZSB0byBjb3B5IHRoZSBhcnJheSBzaW5jZSB0aGUgdW5iaW5kIHdpbGwgYWN0dWFsbHkgcmVtb3ZlIGl0c2VsZiBmcm9tIHRoZSBhcnJheSB3aGljaCBtb2RpZmllcyBpdCBtaWQgaXRlcmF0aW9uXG4gICAgICAgICAgICBkb21VbmJpbmRGbnMuc2xpY2UoMCkuZm9yRWFjaChmdW5jdGlvbiAodW5iaW5kKSB7XG4gICAgICAgICAgICAgICAgdW5iaW5kKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZ2V0SGFuZGxlcnMobmFtZSkge1xuICAgICAgICB2YXIgaGFuZGxlcnMgPSBoYW5kbGVyc0J5TmFtZVtuYW1lXTtcbiAgICAgICAgaWYgKCFoYW5kbGVycykge1xuICAgICAgICAgICAgaGFuZGxlcnMgPSBoYW5kbGVyc0J5TmFtZVtuYW1lXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBoYW5kbGVycztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBiaW5kVG9Eb21FbGVtZW50KGVsZW0sIG5hbWUsIGxpc3RlbmVyKSB7XG4gICAgICAgIGVsZW0uYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcik7XG4gICAgICAgIHZhciB1bmJpbmRGbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGVsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICBkb21VbmJpbmRGbnMuc3BsaWNlKGRvbVVuYmluZEZucy5pbmRleE9mKHVuYmluZEZuKSwgMSk7XG4gICAgICAgIH07XG4gICAgICAgIGRvbVVuYmluZEZucy5wdXNoKHVuYmluZEZuKTtcbiAgICAgICAgcmV0dXJuIHVuYmluZEZuO1xuICAgIH1cblxuICAgIGVsb29wLmJpbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKTtcbiAgICAgICAgdmFyIG5hbWUgPSBhcmdzLmZpbHRlcihmdW5jdGlvbiAoYXJnKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG4gICAgICAgIH0pWzBdO1xuXG4gICAgICAgIHZhciBoYW5kbGVyID0gYXJncy5maWx0ZXIoZnVuY3Rpb24gKGFyZykge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG4gICAgICAgIH0pWzBdO1xuXG4gICAgICAgIGlmICghaGFuZGxlciB8fCAhbmFtZSkge1xuICAgICAgICAgICAgdGhyb3cgJ2Nhbm5vdCBiaW5kIHdpdGhvdXQgYXQgbGVhc3QgbmFtZSBhbmQgZnVuY3Rpb24nO1xuICAgICAgICB9XG5cblxuICAgICAgICB2YXIgZWxlbSA9IGFyZ3MuZmlsdGVyKGZ1bmN0aW9uIChhcmcpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLmlzRWxlbWVudChhcmcpIHx8IGFyZyA9PT0gd2luZG93IHx8IGFyZyA9PT0gZG9jdW1lbnQ7XG4gICAgICAgIH0pWzBdO1xuXG4gICAgICAgIGlmICghZWxlbSkge1xuICAgICAgICAgICAgZ2V0SGFuZGxlcnMobmFtZSkucHVzaChoYW5kbGVyKTtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhhbmRsZXJzID0gZ2V0SGFuZGxlcnMobmFtZSk7XG4gICAgICAgICAgICAgICAgaGFuZGxlcnMuc3BsaWNlKGhhbmRsZXJzLmluZGV4T2YoaGFuZGxlciksIDEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGxvb3BXaXRoKGhhbmRsZXIpO1xuICAgICAgICAgICAgLy9tYWtlIHN1cmUgdGhlIGVsZW0gY2FuIHJlY2VpdmUgZXZlbnRzXG4gICAgICAgICAgICBpZiAoZWxlbS5zdHlsZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uc3R5bGUucG9pbnRlckV2ZW50cyA9ICdhbGwnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGJpbmRUb0RvbUVsZW1lbnQoZWxlbSwgbmFtZSwgbGlzdGVuZXIpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGVsb29wLmZpcmUgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgZXZlbnQgPSB0eXBlb2YgZXZlbnQgPT09ICdzdHJpbmcnID8ge3R5cGU6IGV2ZW50fSA6IGV2ZW50O1xuICAgICAgICBtYWluTG9vcChldmVudCk7XG4gICAgfTtcblxuICAgIHZhciBpbnRlcmNlcHRvcnMgPSBsaXN0ZW5lcnMoKTtcbiAgICB2YXIgZXhpdExpc3RlbmVycyA9IGxpc3RlbmVycygpO1xuXG4gICAgZWxvb3AuYWRkSW50ZXJjZXB0b3IgPSBpbnRlcmNlcHRvcnMuYWRkTGlzdGVuZXI7XG4gICAgZWxvb3AuYWRkRXhpdExpc3RlbmVyID0gZXhpdExpc3RlbmVycy5hZGRMaXN0ZW5lcjtcblxuICAgIGZ1bmN0aW9uIGxvb3BXaXRoKGZuKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgbG9vcChlLCBmbik7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIG1haW5Mb29wID0gbG9vcFdpdGgoZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgLy9oYXZlIHRvIGNvcHkgdGhlIGFycmF5IGJlY2F1c2UgaGFuZGxlcnMgY2FuIHVuYmluZCB0aGVtc2VsdmVzIHdoaWNoIG1vZGlmaWVzIHRoZSBhcnJheVxuICAgICAgICAvL3dlIHVzZSBzb21lIHNvIHRoYXQgd2UgY2FuIGJyZWFrIG91dCBvZiB0aGUgbG9vcCBpZiBuZWVkIGJlXG4gICAgICAgIGdldEhhbmRsZXJzKGUudHlwZSkuc2xpY2UoMCkuc29tZShmdW5jdGlvbiAoaGFuZGxlcikge1xuICAgICAgICAgICAgaGFuZGxlcihlKTtcbiAgICAgICAgICAgIGlmIChlLmdyaWRTdG9wQnViYmxpbmcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBsb29wKGUsIGJvZHlGbikge1xuICAgICAgICB2YXIgaXNPdXRlckxvb3BSdW5uaW5nID0gZWxvb3AuaXNSdW5uaW5nO1xuICAgICAgICBlbG9vcC5pc1J1bm5pbmcgPSB0cnVlO1xuICAgICAgICBpbnRlcmNlcHRvcnMubm90aWZ5KGUpO1xuICAgICAgICBpZiAoIWUuZ3JpZFN0b3BCdWJibGluZykge1xuICAgICAgICAgICAgYm9keUZuKGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc091dGVyTG9vcFJ1bm5pbmcpIHtcbiAgICAgICAgICAgIGVsb29wLmlzUnVubmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgZXhpdExpc3RlbmVycy5ub3RpZnkoZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBlbG9vcC5iaW5kKCdncmlkLWRlc3Ryb3knLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHVuYmluZEFsbCgpO1xuICAgICAgICBlbG9vcC5kZXN0cm95ZWQgPSB0cnVlO1xuICAgIH0pO1xuXG4gICAgZWxvb3Auc3RvcEJ1YmJsaW5nID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgZS5ncmlkU3RvcEJ1YmJsaW5nID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGU7XG4gICAgfTtcblxuICAgIHJldHVybiBlbG9vcDtcbn07XG5cblxuZXZlbnRMb29wLkVWRU5UUyA9IEVWRU5UUztcbmV2ZW50TG9vcC5HUklEX0VWRU5UUyA9IEdSSURfRVZFTlRTO1xubW9kdWxlLmV4cG9ydHMgPSBldmVudExvb3A7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2dyaWQsIG1vZGVsKSB7XG4gICAgdmFyIGdyaWQgPSBfZ3JpZDtcblxuICAgIHZhciBhcGkgPSBtb2RlbCB8fCB7fTtcbiAgICBhcGkuX2RlY29yYXRvcnMgPSB7fTtcblxuICAgIGZ1bmN0aW9uIG1ha2VEZWNvcmF0b3IoY29sKSB7XG4gICAgICAgIHZhciBkZWNvcmF0b3IgPSBncmlkLmRlY29yYXRvcnMuY3JlYXRlKDAsIGNvbCwgMSwgMSwgJ2NlbGwnLCAncmVhbCcpO1xuXG5cbiAgICAgICAgZGVjb3JhdG9yLmdldERlY29yYXRvckxlZnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZmlyc3RSZWN0ID0gZGVjb3JhdG9yLmJvdW5kaW5nQm94ICYmIGRlY29yYXRvci5ib3VuZGluZ0JveC5nZXRDbGllbnRSZWN0cygpICYmIGRlY29yYXRvci5ib3VuZGluZ0JveC5nZXRDbGllbnRSZWN0cygpWzBdIHx8IHt9O1xuICAgICAgICAgICAgcmV0dXJuIGdyaWQudmlld1BvcnQudG9HcmlkWChmaXJzdFJlY3QubGVmdCkgfHwgMDtcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoYXBpLmFubm90YXRlRGVjb3JhdG9yKSB7XG4gICAgICAgICAgICBhcGkuYW5ub3RhdGVEZWNvcmF0b3IoZGVjb3JhdG9yKTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgcmV0dXJuIGRlY29yYXRvcjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlbnN1cmVEZWNvcmF0b3JQZXJDb2woKSB7XG4gICAgICAgIGZvciAodmFyIGMgPSAwOyBjIDwgZ3JpZC52aWV3UG9ydC5jb2xzOyBjKyspIHtcbiAgICAgICAgICAgIGlmICghYXBpLl9kZWNvcmF0b3JzW2NdKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlY29yYXRvciA9IG1ha2VEZWNvcmF0b3IoYyk7XG4gICAgICAgICAgICAgICAgYXBpLl9kZWNvcmF0b3JzW2NdID0gZGVjb3JhdG9yO1xuICAgICAgICAgICAgICAgIGdyaWQuZGVjb3JhdG9ycy5hZGQoZGVjb3JhdG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdyaWQuZXZlbnRMb29wLmJpbmQoJ2dyaWQtdmlld3BvcnQtY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBlbnN1cmVEZWNvcmF0b3JQZXJDb2woKTtcbiAgICB9KTtcbiAgICBlbnN1cmVEZWNvcmF0b3JQZXJDb2woKTtcblxuICAgIHJldHVybiBhcGk7XG59OyIsIi8qXG4gQSBzaW1wbGUgcGFja2FnZSBmb3IgY3JlYXRpbmcgYSBsaXN0IG9mIGxpc3RlbmVycyB0aGF0IGNhbiBiZSBhZGRlZCB0byBhbmQgbm90aWZpZWRcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbGlzdGVuZXJzID0gW107XG4gICAgcmV0dXJuIHtcbiAgICAgICAgLy9yZXR1cm5zIGEgcmVtb3ZhbCBmdW5jdGlvbiB0byB1bmJpbmQgdGhlIGxpc3RlbmVyXG4gICAgICAgIGFkZExpc3RlbmVyOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgIGxpc3RlbmVycy5wdXNoKGZuKTtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzLnNwbGljZShsaXN0ZW5lcnMuaW5kZXhPZihmbiksIDEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgbm90aWZ5OiBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgbGlzdGVuZXJzLmZvckVhY2goZnVuY3Rpb24gKGxpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXIoZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59OyIsInZhciBFVkVOVF9OQU1FUyA9IFsnbW91c2V3aGVlbCcsICd3aGVlbCcsICdET01Nb3VzZVNjcm9sbCddO1xuXG52YXIgYXBpID0ge1xuICAgIGdldERlbHRhOiBmdW5jdGlvbiAoZXZlbnQsIHhheGlzKSB7XG4gICAgICAgIGlmIChldmVudC53aGVlbERlbHRhKSB7IC8vZm9yIGV2ZXJ5dGhpbmcgYnV0IGZpcmVmb3hcbiAgICAgICAgICAgIHZhciBkZWx0YSA9IGV2ZW50LndoZWVsRGVsdGFZO1xuICAgICAgICAgICAgaWYgKHhheGlzKSB7XG4gICAgICAgICAgICAgICAgZGVsdGEgPSBldmVudC53aGVlbERlbHRhWDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkZWx0YTtcblxuICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmRldGFpbCkgeyAvL2ZvciBmaXJlZm94IHByZSB2ZXJzaW9uIDE3XG4gICAgICAgICAgICBpZiAoZXZlbnQuYXhpcyAmJiAoKGV2ZW50LmF4aXMgPT09IDEgJiYgeGF4aXMpIHx8IChldmVudC5heGlzID09PSAyICYmICF4YXhpcykpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC0xICogZXZlbnQuZGV0YWlsICogMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZXZlbnQuZGVsdGFYIHx8IGV2ZW50LmRlbHRhWSkge1xuICAgICAgICAgICAgaWYgKHhheGlzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC0xICogZXZlbnQuZGVsdGFYO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gLTEgKiBldmVudC5kZWx0YVk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfSxcblxuICAgIC8vYmluZHMgYSBjcm9zcyBicm93c2VyIG5vcm1hbGl6ZWQgbW91c2V3aGVlbCBldmVudCwgYW5kIHJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgdW5iaW5kIHRoZSBsaXN0ZW5lcjtcbiAgICBiaW5kOiBmdW5jdGlvbiAoZWxlbSwgbGlzdGVuZXIpIHtcbiAgICAgICAgdmFyIG5vcm1hbGl6ZWRMaXN0ZW5lciA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcihub3JtYWxpemVXaGVlbEV2ZW50KGUpKTtcbiAgICAgICAgfTtcblxuICAgICAgICBFVkVOVF9OQU1FUy5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgbm9ybWFsaXplZExpc3RlbmVyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIEVWRU5UX05BTUVTLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgbm9ybWFsaXplZExpc3RlbmVyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgfSxcbiAgICBub3JtYWxpemU6IG5vcm1hbGl6ZVdoZWVsRXZlbnRcbn07XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVdoZWVsRXZlbnQoZSkge1xuICAgIHZhciBkZWx0YVggPSBhcGkuZ2V0RGVsdGEoZSwgdHJ1ZSk7XG4gICAgdmFyIGRlbHRhWSA9IGFwaS5nZXREZWx0YShlKTtcbiAgICB2YXIgbmV3RXZlbnQgPSBPYmplY3QuY3JlYXRlKGUsXG4gICAgICAgIHtcbiAgICAgICAgICAgIGRlbHRhWToge3ZhbHVlOiBkZWx0YVl9LFxuICAgICAgICAgICAgZGVsdGFYOiB7dmFsdWU6IGRlbHRhWH0sXG4gICAgICAgICAgICB0eXBlOiB7dmFsdWU6ICdtb3VzZXdoZWVsJ31cbiAgICAgICAgfSk7XG5cbiAgICBuZXdFdmVudC5wcmV2ZW50RGVmYXVsdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbmV3RXZlbnQuZGVmYXVsdFByZXZlbnRlZCA9IHRydWU7XG4gICAgICAgIGlmIChlICYmIGUucHJldmVudERlZmF1bHQpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIG5ld0V2ZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFwaTsiLCJ2YXIga2V5ID0gcmVxdWlyZSgna2V5Jyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJ0BncmlkL3V0aWwnKTtcbnZhciByYW5nZVV0aWwgPSByZXF1aXJlKCdAZ3JpZC9yYW5nZS11dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKF9ncmlkKSB7XG4gICAgdmFyIGdyaWQgPSBfZ3JpZDtcblxuICAgIHZhciBtb2RlbCA9IHtcbiAgICAgICAgZm9jdXM6IHtcbiAgICAgICAgICAgIHJvdzogMCxcbiAgICAgICAgICAgIGNvbDogMFxuICAgICAgICB9XG4gICAgfTtcblxuICAgIHZhciBmb2N1c0NsYXNzID0gZ3JpZC5jZWxsQ2xhc3Nlcy5jcmVhdGUoMCwgMCwgJ2ZvY3VzJyk7XG4gICAgZ3JpZC5jZWxsQ2xhc3Nlcy5hZGQoZm9jdXNDbGFzcyk7XG5cbiAgICBtb2RlbC5mb2N1c0RlY29yYXRvciA9IGdyaWQuZGVjb3JhdG9ycy5jcmVhdGUoMCwgMCwgMSwgMSk7XG4gICAgbW9kZWwuZm9jdXNEZWNvcmF0b3IucmVuZGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZGl2ID0gZGVmYXVsdFJlbmRlcigpO1xuICAgICAgICBkaXYuc2V0QXR0cmlidXRlKCdjbGFzcycsICdncmlkLWZvY3VzLWRlY29yYXRvcicpO1xuICAgICAgICByZXR1cm4gZGl2O1xuICAgIH07XG4gICAgZ3JpZC5kZWNvcmF0b3JzLmFkZChtb2RlbC5mb2N1c0RlY29yYXRvcik7XG5cblxuICAgIGZ1bmN0aW9uIGNsYW1wUm93VG9NaW5NYXgocm93KSB7XG4gICAgICAgIHJldHVybiB1dGlsLmNsYW1wKHJvdywgMCwgZ3JpZC5yb3dNb2RlbC5sZW5ndGgoKSAtIDEpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNsYW1wQ29sVG9NaW5NYXgoY29sKSB7XG4gICAgICAgIHJldHVybiB1dGlsLmNsYW1wKGNvbCwgMCwgZ3JpZC5jb2xNb2RlbC5sZW5ndGgoKSAtIDEpO1xuICAgIH1cblxuICAgIG1vZGVsLnNldEZvY3VzID0gZnVuY3Rpb24gc2V0Rm9jdXMocm93LCBjb2wsIG9wdGlvbmFsRXZlbnQpIHtcbiAgICAgICAgcm93ID0gY2xhbXBSb3dUb01pbk1heChyb3cpO1xuICAgICAgICBjb2wgPSBjbGFtcENvbFRvTWluTWF4KGNvbCk7XG4gICAgICAgIG1vZGVsLmZvY3VzLnJvdyA9IHJvdztcbiAgICAgICAgbW9kZWwuZm9jdXMuY29sID0gY29sO1xuICAgICAgICBmb2N1c0NsYXNzLnRvcCA9IHJvdztcbiAgICAgICAgZm9jdXNDbGFzcy5sZWZ0ID0gY29sO1xuICAgICAgICBtb2RlbC5mb2N1c0RlY29yYXRvci50b3AgPSByb3c7XG4gICAgICAgIG1vZGVsLmZvY3VzRGVjb3JhdG9yLmxlZnQgPSBjb2w7XG4gICAgICAgIGdyaWQuY2VsbFNjcm9sbE1vZGVsLnNjcm9sbEludG9WaWV3KHJvdywgY29sKTtcbiAgICAgICAgLy9mb2N1cyBjaGFuZ2VzIGFsd2F5cyBjbGVhciB0aGUgc2VsZWN0aW9uXG4gICAgICAgIGNsZWFyU2VsZWN0aW9uKCk7XG4gICAgfTtcblxuICAgIGdyaWQuZXZlbnRMb29wLmJpbmQoJ2tleWRvd24nLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICB2YXIgYXJyb3cgPSBrZXkuY29kZS5hcnJvdztcbiAgICAgICAgaWYgKCFrZXkuaXMoYXJyb3csIGUud2hpY2gpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy9mb2N1cyBsb2dpY1xuXG4gICAgICAgIGlmICghZS5zaGlmdEtleSkge1xuICAgICAgICAgICAgLy9pZiBub3RoaW5nIGNoYW5nZXMgZ3JlYXQgd2UnbGwgc3RheSB3aGVyZSB3ZSBhcmVcbiAgICAgICAgICAgIHZhciBuYXZUb1JvdyA9IG1vZGVsLmZvY3VzLnJvdztcbiAgICAgICAgICAgIHZhciBuYXZUb0NvbCA9IG1vZGVsLmZvY3VzLmNvbDtcblxuXG4gICAgICAgICAgICBzd2l0Y2ggKGUud2hpY2gpIHtcbiAgICAgICAgICAgICAgICBjYXNlIGFycm93LmRvd24uY29kZTpcbiAgICAgICAgICAgICAgICAgICAgbmF2VG9Sb3crKztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBhcnJvdy51cC5jb2RlOlxuICAgICAgICAgICAgICAgICAgICBuYXZUb1Jvdy0tO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIGFycm93LnJpZ2h0LmNvZGU6XG4gICAgICAgICAgICAgICAgICAgIG5hdlRvQ29sKys7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgYXJyb3cubGVmdC5jb2RlOlxuICAgICAgICAgICAgICAgICAgICBuYXZUb0NvbC0tO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1vZGVsLnNldEZvY3VzKG5hdlRvUm93LCBuYXZUb0NvbCwgZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL3NlbGVjdGlvbiBsb2dpY1xuICAgICAgICAgICAgdmFyIG5ld1NlbGVjdGlvbjtcbiAgICAgICAgICAgIC8vc3RhbmQgaW4gZm9yIGlmIGl0J3MgY2xlYXJlZFxuICAgICAgICAgICAgaWYgKG1vZGVsLnNlbGVjdGlvbi50b3AgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgbmV3U2VsZWN0aW9uID0ge3RvcDogbW9kZWwuZm9jdXMucm93LCBsZWZ0OiBtb2RlbC5mb2N1cy5jb2wsIGhlaWdodDogMSwgd2lkdGg6IDF9O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXdTZWxlY3Rpb24gPSB7XG4gICAgICAgICAgICAgICAgICAgIHRvcDogbW9kZWwuc2VsZWN0aW9uLnRvcCxcbiAgICAgICAgICAgICAgICAgICAgbGVmdDogbW9kZWwuc2VsZWN0aW9uLmxlZnQsXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodDogbW9kZWwuc2VsZWN0aW9uLmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IG1vZGVsLnNlbGVjdGlvbi53aWR0aFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHN3aXRjaCAoZS53aGljaCkge1xuICAgICAgICAgICAgICAgIGNhc2UgYXJyb3cuZG93bi5jb2RlOlxuICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWwuZm9jdXMucm93ID09PSBuZXdTZWxlY3Rpb24udG9wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdTZWxlY3Rpb24uaGVpZ2h0Kys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdTZWxlY3Rpb24udG9wKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdTZWxlY3Rpb24uaGVpZ2h0LS07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBhcnJvdy51cC5jb2RlOlxuICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWwuZm9jdXMucm93ID09PSBuZXdTZWxlY3Rpb24udG9wICsgbmV3U2VsZWN0aW9uLmhlaWdodCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1NlbGVjdGlvbi50b3AtLTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1NlbGVjdGlvbi5oZWlnaHQrKztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1NlbGVjdGlvbi5oZWlnaHQtLTtcblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgYXJyb3cucmlnaHQuY29kZTpcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsLmZvY3VzLmNvbCA9PT0gbmV3U2VsZWN0aW9uLmxlZnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1NlbGVjdGlvbi53aWR0aCsrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3U2VsZWN0aW9uLmxlZnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1NlbGVjdGlvbi53aWR0aC0tO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgYXJyb3cubGVmdC5jb2RlOlxuICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWwuZm9jdXMuY29sID09PSBuZXdTZWxlY3Rpb24ubGVmdCArIG5ld1NlbGVjdGlvbi53aWR0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1NlbGVjdGlvbi5sZWZ0LS07XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdTZWxlY3Rpb24ud2lkdGgrKztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1NlbGVjdGlvbi53aWR0aC0tO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5ld1NlbGVjdGlvbi5oZWlnaHQgPT09IDEgJiYgbmV3U2VsZWN0aW9uLndpZHRoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJTZWxlY3Rpb24oKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbW9kZWwuc2V0U2VsZWN0aW9uKG5ld1NlbGVjdGlvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gb3V0c2lkZU1pbk1heChyb3csIGNvbCkge1xuICAgICAgICByZXR1cm4gcm93IDwgMCB8fCByb3cgPiBncmlkLnJvd01vZGVsLmxlbmd0aCgpIHx8IGNvbCA8IDAgfHwgY29sID4gZ3JpZC5jb2xNb2RlbC5sZW5ndGgoKTtcbiAgICB9XG5cbiAgICBncmlkLmV2ZW50TG9vcC5iaW5kKCdtb3VzZWRvd24nLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAvL2Fzc3VtZSB0aGUgZXZlbnQgaGFzIGJlZW4gYW5ub3RhdGVkIGJ5IHRoZSBjZWxsIG1vdXNlIG1vZGVsIGludGVyY2VwdG9yXG4gICAgICAgIHZhciByb3cgPSBlLnJvdztcbiAgICAgICAgdmFyIGNvbCA9IGUuY29sO1xuICAgICAgICBpZiAocm93IDwgMCAmJiBjb2wgPj0gMCkge1xuICAgICAgICAgICAgZ3JpZC5jb2xNb2RlbC50b2dnbGVTZWxlY3QoY29sKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29sIDwgMCAmJiByb3cgPj0gMCkge1xuICAgICAgICAgICAgZ3JpZC5yb3dNb2RlbC50b2dnbGVTZWxlY3Qocm93KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyb3cgPCAwICYmIGNvbCA8IDApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZS5zaGlmdEtleSkge1xuICAgICAgICAgICAgbW9kZWwuc2V0Rm9jdXMocm93LCBjb2wsIGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2V0U2VsZWN0aW9uRnJvbVBvaW50cyhtb2RlbC5mb2N1cy5yb3csIG1vZGVsLmZvY3VzLmNvbCwgcm93LCBjb2wpO1xuICAgICAgICB9XG5cbiAgICB9KTtcblxuICAgIG1vZGVsLl9yb3dTZWxlY3Rpb25EZWNvcmF0b3JzID0gW107XG4gICAgbW9kZWwuX2NvbFNlbGVjdGlvbkRlY29yYXRvcnMgPSBbXTtcbiAgICAvL3JvdyBjb2wgc2VsZWN0aW9uXG4gICAgZnVuY3Rpb24gaGFuZGxlUm93Q29sU2VsZWN0aW9uQ2hhbmdlKHJvd09yQ29sKSB7XG4gICAgICAgIHZhciBkZWNvcmF0b3JzRmllbGQgPSAoJ18nICsgcm93T3JDb2wgKyAnU2VsZWN0aW9uRGVjb3JhdG9ycycpO1xuICAgICAgICBtb2RlbFtkZWNvcmF0b3JzRmllbGRdLmZvckVhY2goZnVuY3Rpb24gKHNlbGVjdGlvbkRlY29yYXRvcikge1xuICAgICAgICAgICAgZ3JpZC5kZWNvcmF0b3JzLnJlbW92ZShzZWxlY3Rpb25EZWNvcmF0b3IpO1xuICAgICAgICB9KTtcbiAgICAgICAgbW9kZWxbZGVjb3JhdG9yc0ZpZWxkXSA9IFtdO1xuXG4gICAgICAgIGdyaWRbcm93T3JDb2wgKyAnTW9kZWwnXS5nZXRTZWxlY3RlZCgpLmZvckVhY2goZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgICAgICAgICB2YXIgdmlydHVhbEluZGV4ID0gZ3JpZFtyb3dPckNvbCArICdNb2RlbCddLnRvVmlydHVhbChpbmRleCk7XG4gICAgICAgICAgICB2YXIgdG9wID0gcm93T3JDb2wgPT09ICdyb3cnID8gdmlydHVhbEluZGV4IDogMDtcbiAgICAgICAgICAgIHZhciBsZWZ0ID0gcm93T3JDb2wgPT09ICdjb2wnID8gdmlydHVhbEluZGV4IDogMDtcbiAgICAgICAgICAgIHZhciBkZWNvcmF0b3IgPSBncmlkLmRlY29yYXRvcnMuY3JlYXRlKHRvcCwgbGVmdCwgMSwgMSwgJ2NlbGwnLCAndmlydHVhbCcpO1xuICAgICAgICAgICAgZGVjb3JhdG9yLnBvc3RSZW5kZXIgPSBmdW5jdGlvbiAoZWxlbSkge1xuICAgICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKCdjbGFzcycsICdncmlkLWhlYWRlci1zZWxlY3RlZCcpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGdyaWQuZGVjb3JhdG9ycy5hZGQoZGVjb3JhdG9yKTtcbiAgICAgICAgICAgIG1vZGVsW2RlY29yYXRvcnNGaWVsZF0ucHVzaChkZWNvcmF0b3IpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBncmlkLmV2ZW50TG9vcC5iaW5kKCdncmlkLXJvdy1zZWxlY3Rpb24tY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBoYW5kbGVSb3dDb2xTZWxlY3Rpb25DaGFuZ2UoJ3JvdycpO1xuICAgIH0pO1xuXG4gICAgZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC1jb2wtc2VsZWN0aW9uLWNoYW5nZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaGFuZGxlUm93Q29sU2VsZWN0aW9uQ2hhbmdlKCdjb2wnKTtcbiAgICB9KTtcblxuICAgIHZhciBzZWxlY3Rpb24gPSBncmlkLmRlY29yYXRvcnMuY3JlYXRlKCk7XG5cbiAgICB2YXIgZGVmYXVsdFJlbmRlciA9IHNlbGVjdGlvbi5yZW5kZXI7XG4gICAgc2VsZWN0aW9uLnJlbmRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGRpdiA9IGRlZmF1bHRSZW5kZXIoKTtcbiAgICAgICAgZGl2LnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAnZ3JpZC1zZWxlY3Rpb24nKTtcbiAgICAgICAgcmV0dXJuIGRpdjtcbiAgICB9O1xuXG4gICAgZ3JpZC5kZWNvcmF0b3JzLmFkZChzZWxlY3Rpb24pO1xuXG4gICAgbW9kZWwuc2V0U2VsZWN0aW9uID0gZnVuY3Rpb24gc2V0U2VsZWN0aW9uKG5ld1NlbGVjdGlvbikge1xuICAgICAgICBzZWxlY3Rpb24udG9wID0gbmV3U2VsZWN0aW9uLnRvcDtcbiAgICAgICAgc2VsZWN0aW9uLmxlZnQgPSBuZXdTZWxlY3Rpb24ubGVmdDtcbiAgICAgICAgc2VsZWN0aW9uLmhlaWdodCA9IG5ld1NlbGVjdGlvbi5oZWlnaHQ7XG4gICAgICAgIHNlbGVjdGlvbi53aWR0aCA9IG5ld1NlbGVjdGlvbi53aWR0aDtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY2xlYXJTZWxlY3Rpb24oKSB7XG4gICAgICAgIG1vZGVsLnNldFNlbGVjdGlvbih7dG9wOiAtMSwgbGVmdDogLTEsIGhlaWdodDogLTEsIHdpZHRoOiAtMX0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldFNlbGVjdGlvbkZyb21Qb2ludHMoZnJvbVJvdywgZnJvbUNvbCwgdG9Sb3csIHRvQ29sKSB7XG4gICAgICAgIHZhciBuZXdTZWxlY3Rpb24gPSByYW5nZVV0aWwuY3JlYXRlRnJvbVBvaW50cyhmcm9tUm93LCBmcm9tQ29sLCBjbGFtcFJvd1RvTWluTWF4KHRvUm93KSwgY2xhbXBDb2xUb01pbk1heCh0b0NvbCkpO1xuICAgICAgICBtb2RlbC5zZXRTZWxlY3Rpb24obmV3U2VsZWN0aW9uKTtcbiAgICB9XG5cbiAgICBzZWxlY3Rpb24uX29uRHJhZ1N0YXJ0ID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgaWYgKG91dHNpZGVNaW5NYXgoZS5yb3csIGUuY29sKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBmcm9tUm93ID0gbW9kZWwuZm9jdXMucm93O1xuICAgICAgICB2YXIgZnJvbUNvbCA9IG1vZGVsLmZvY3VzLmNvbDtcbiAgICAgICAgdmFyIHVuYmluZERyYWcgPSBncmlkLmV2ZW50TG9vcC5iaW5kKCdncmlkLWNlbGwtZHJhZycsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBzZXRTZWxlY3Rpb25Gcm9tUG9pbnRzKGZyb21Sb3csIGZyb21Db2wsIGUucm93LCBlLmNvbCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciB1bmJpbmREcmFnRW5kID0gZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC1kcmFnLWVuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHVuYmluZERyYWcoKTtcbiAgICAgICAgICAgIHVuYmluZERyYWdFbmQoKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIGdyaWQuZXZlbnRMb29wLmJpbmQoJ2dyaWQtZHJhZy1zdGFydCcsIHNlbGVjdGlvbi5fb25EcmFnU3RhcnQpO1xuICAgIGNsZWFyU2VsZWN0aW9uKCk7XG5cbiAgICBtb2RlbC5zZWxlY3Rpb24gPSBzZWxlY3Rpb247XG5cbiAgICByZXR1cm4gbW9kZWw7XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIC8vYSBub29wIGZ1bmN0aW9uIHRvIHVzZVxufTsiLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJ0BncmlkL3V0aWwnKTtcbnZhciBkZWJvdW5jZSA9IHJlcXVpcmUoJ0BncmlkL2RlYm91bmNlJyk7XG52YXIgY2FwaXRhbGl6ZSA9IHJlcXVpcmUoJ2NhcGl0YWxpemUnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2dyaWQpIHtcbiAgICB2YXIgZ3JpZCA9IF9ncmlkO1xuICAgIHZhciBtb2RlbCA9IHt0b3A6IDAsIGxlZnQ6IDB9O1xuICAgIHZhciBzY3JvbGxCYXJXaWR0aCA9IDEwO1xuXG4gICAgZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC12aXJ0dWFsLXBpeGVsLWNlbGwtY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2Nyb2xsSGVpZ2h0ID0gZ3JpZC52aXJ0dWFsUGl4ZWxDZWxsTW9kZWwudG90YWxIZWlnaHQoKSAtIGdyaWQudmlydHVhbFBpeGVsQ2VsbE1vZGVsLmZpeGVkSGVpZ2h0KCk7XG4gICAgICAgIHZhciBzY3JvbGxXaWR0aCA9IGdyaWQudmlydHVhbFBpeGVsQ2VsbE1vZGVsLnRvdGFsV2lkdGgoKSAtIGdyaWQudmlydHVhbFBpeGVsQ2VsbE1vZGVsLmZpeGVkV2lkdGgoKTtcbiAgICAgICAgbW9kZWwuc2V0U2Nyb2xsU2l6ZShzY3JvbGxIZWlnaHQsIHNjcm9sbFdpZHRoKTtcbiAgICAgICAgc2l6ZVNjcm9sbEJhcnMoKTtcbiAgICB9KTtcblxuXG4gICAgZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC12aWV3cG9ydC1jaGFuZ2UnLCBzaXplU2Nyb2xsQmFycyk7XG4gICAgLy9hc3N1bWVzIGEgc3RhbmRhcmRpemVkIHdoZWVsIGV2ZW50IHRoYXQgd2UgY3JlYXRlIHRocm91Z2ggdGhlIG1vdXNld2hlZWwgcGFja2FnZVxuICAgIGdyaWQuZXZlbnRMb29wLmJpbmQoJ21vdXNld2hlZWwnLCBmdW5jdGlvbiBoYW5kbGVNb3VzZVdoZWVsKGUpIHtcbiAgICAgICAgdmFyIGRlbHRhWSA9IGUuZGVsdGFZO1xuICAgICAgICB2YXIgZGVsdGFYID0gZS5kZWx0YVg7XG4gICAgICAgIG1vZGVsLnNjcm9sbFRvKG1vZGVsLnRvcCAtIGRlbHRhWSwgbW9kZWwubGVmdCAtIGRlbHRhWCwgdHJ1ZSk7XG4gICAgICAgIGRlYm91bmNlZE5vdGlmeSgpO1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfSk7XG5cbiAgICBtb2RlbC5zZXRTY3JvbGxTaXplID0gZnVuY3Rpb24gKGgsIHcpIHtcbiAgICAgICAgbW9kZWwuaGVpZ2h0ID0gaDtcbiAgICAgICAgbW9kZWwud2lkdGggPSB3O1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBub3RpZnlMaXN0ZW5lcnMoKSB7XG4gICAgICAgIC8vVE9ETzogcG9zc2libHkga2VlcCB0cmFjayBvZiBkZWx0YSBzaW5jZSBsYXN0IHVwZGF0ZSBhbmQgc2VuZCBpdCBhbG9uZy4gZm9yIG5vdywgbm9cbiAgICAgICAgZ3JpZC5ldmVudExvb3AuZmlyZSgnZ3JpZC1waXhlbC1zY3JvbGwnKTtcblxuICAgICAgICAvL3VwZGF0ZSB0aGUgY2VsbCBzY3JvbGxcbiAgICAgICAgdmFyIHNjcm9sbFRvcCA9IG1vZGVsLnRvcDtcbiAgICAgICAgdmFyIHJvdyA9IGdyaWQudmlydHVhbFBpeGVsQ2VsbE1vZGVsLmdldFJvdyhzY3JvbGxUb3ApO1xuXG4gICAgICAgIHZhciBzY3JvbGxMZWZ0ID0gbW9kZWwubGVmdDtcbiAgICAgICAgdmFyIGNvbCA9IGdyaWQudmlydHVhbFBpeGVsQ2VsbE1vZGVsLmdldENvbChzY3JvbGxMZWZ0KTtcblxuICAgICAgICBncmlkLmNlbGxTY3JvbGxNb2RlbC5zY3JvbGxUbyhyb3csIGNvbCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgdmFyIGRlYm91bmNlZE5vdGlmeSA9IGRlYm91bmNlKG5vdGlmeUxpc3RlbmVycywgMSk7XG5cbiAgICBtb2RlbC5zY3JvbGxUbyA9IGZ1bmN0aW9uICh0b3AsIGxlZnQsIGRvbnROb3RpZnkpIHtcbiAgICAgICAgbW9kZWwudG9wID0gdXRpbC5jbGFtcCh0b3AsIDAsIG1vZGVsLmhlaWdodCAtIGdldFNjcm9sbGFibGVWaWV3SGVpZ2h0KCkpO1xuICAgICAgICBtb2RlbC5sZWZ0ID0gdXRpbC5jbGFtcChsZWZ0LCAwLCBtb2RlbC53aWR0aCAtIGdldFNjcm9sbGFibGVWaWV3V2lkdGgoKSk7XG5cbiAgICAgICAgcG9zaXRpb25TY3JvbGxCYXJzKCk7XG5cbiAgICAgICAgaWYgKCFkb250Tm90aWZ5KSB7XG4gICAgICAgICAgICBub3RpZnlMaXN0ZW5lcnMoKTtcbiAgICAgICAgfVxuXG5cbiAgICB9O1xuXG5cbiAgICAvKiBTQ1JPTEwgQkFSIExPR0lDICovXG4gICAgZnVuY3Rpb24gZ2V0U2Nyb2xsUG9zaXRpb25Gcm9tUmVhbChzY3JvbGxCYXJSZWFsQ2xpY2tDb29yZCwgaGVpZ2h0V2lkdGgsIHZlcnRIb3J6KSB7XG4gICAgICAgIHZhciBzY3JvbGxCYXJUb3BDbGljayA9IHNjcm9sbEJhclJlYWxDbGlja0Nvb3JkIC0gZ3JpZC52aXJ0dWFsUGl4ZWxDZWxsTW9kZWxbJ2ZpeGVkJyArIGNhcGl0YWxpemUoaGVpZ2h0V2lkdGgpXSgpO1xuICAgICAgICB2YXIgc2Nyb2xsUmF0aW8gPSBzY3JvbGxCYXJUb3BDbGljayAvIGdldE1heFNjcm9sbEJhckNvb3JkKGhlaWdodFdpZHRoLCB2ZXJ0SG9yeik7XG4gICAgICAgIHZhciBzY3JvbGxDb29yZCA9IHNjcm9sbFJhdGlvICogZ2V0TWF4U2Nyb2xsKGhlaWdodFdpZHRoKTtcbiAgICAgICAgcmV0dXJuIHNjcm9sbENvb3JkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1ha2VTY3JvbGxCYXJEZWNvcmF0b3IoaXNIb3J6KSB7XG4gICAgICAgIHZhciBkZWNvcmF0b3IgPSBncmlkLmRlY29yYXRvcnMuY3JlYXRlKCk7XG4gICAgICAgIHZhciB4T3JZID0gaXNIb3J6ID8gJ1gnIDogJ1knO1xuICAgICAgICB2YXIgaGVpZ2h0V2lkdGggPSBpc0hvcnogPyAnd2lkdGgnIDogJ2hlaWdodCc7XG4gICAgICAgIHZhciB2ZXJ0SG9yeiA9IGlzSG9yeiA/ICdob3J6JyA6ICd2ZXJ0JztcbiAgICAgICAgdmFyIGdyaWRDb29yZEZpZWxkID0gJ2dyaWQnICsgeE9yWTtcbiAgICAgICAgdmFyIGxheWVyQ29vcmRGaWVsZCA9ICdsYXllcicgKyB4T3JZO1xuICAgICAgICB2YXIgdmlld1BvcnRDbGFtcEZuID0gZ3JpZC52aWV3UG9ydFsnY2xhbXAnICsgeE9yWV07XG5cbiAgICAgICAgZGVjb3JhdG9yLnJlbmRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBzY3JvbGxCYXJFbGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICBzY3JvbGxCYXJFbGVtLnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAnZ3JpZC1zY3JvbGwtYmFyJyk7XG4gICAgICAgICAgICBkZWNvcmF0b3IuX29uRHJhZ1N0YXJ0ID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS50YXJnZXQgIT09IHNjcm9sbEJhckVsZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgc2Nyb2xsQmFyT2Zmc2V0ID0gZVtsYXllckNvb3JkRmllbGRdO1xuXG4gICAgICAgICAgICAgICAgZGVjb3JhdG9yLl91bmJpbmREcmFnID0gZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC1kcmFnJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGdyaWRDb29yZCA9IHZpZXdQb3J0Q2xhbXBGbihlW2dyaWRDb29yZEZpZWxkXSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzY3JvbGxCYXJSZWFsQ2xpY2tDb29yZCA9IGdyaWRDb29yZCAtIHNjcm9sbEJhck9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNjcm9sbENvb3JkID0gZ2V0U2Nyb2xsUG9zaXRpb25Gcm9tUmVhbChzY3JvbGxCYXJSZWFsQ2xpY2tDb29yZCwgaGVpZ2h0V2lkdGgsIHZlcnRIb3J6KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzSG9yeikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWwuc2Nyb2xsVG8obW9kZWwudG9wLCBzY3JvbGxDb29yZCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbC5zY3JvbGxUbyhzY3JvbGxDb29yZCwgbW9kZWwubGVmdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGRlY29yYXRvci5fdW5iaW5kRHJhZ0VuZCA9IGdyaWQuZXZlbnRMb29wLmJpbmQoJ2dyaWQtZHJhZy1lbmQnLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgICAgICBkZWNvcmF0b3IuX3VuYmluZERyYWcoKTtcbiAgICAgICAgICAgICAgICAgICAgZGVjb3JhdG9yLl91bmJpbmREcmFnRW5kKCk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC1kcmFnLXN0YXJ0Jywgc2Nyb2xsQmFyRWxlbSwgZGVjb3JhdG9yLl9vbkRyYWdTdGFydCk7XG4gICAgICAgICAgICBncmlkLmV2ZW50TG9vcC5iaW5kKCdtb3VzZWRvd24nLCBzY3JvbGxCYXJFbGVtLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgIGdyaWQuZXZlbnRMb29wLnN0b3BCdWJibGluZyhlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gc2Nyb2xsQmFyRWxlbTtcbiAgICAgICAgfTtcblxuICAgICAgICBkZWNvcmF0b3IudW5pdHMgPSAncHgnO1xuICAgICAgICBkZWNvcmF0b3Iuc3BhY2UgPSAncmVhbCc7XG5cbiAgICAgICAgcmV0dXJuIGRlY29yYXRvcjtcbiAgICB9XG5cbiAgICBtb2RlbC52ZXJ0U2Nyb2xsQmFyID0gbWFrZVNjcm9sbEJhckRlY29yYXRvcigpO1xuICAgIG1vZGVsLmhvcnpTY3JvbGxCYXIgPSBtYWtlU2Nyb2xsQmFyRGVjb3JhdG9yKHRydWUpO1xuICAgIG1vZGVsLnZlcnRTY3JvbGxCYXIud2lkdGggPSBzY3JvbGxCYXJXaWR0aDtcbiAgICBtb2RlbC5ob3J6U2Nyb2xsQmFyLmhlaWdodCA9IHNjcm9sbEJhcldpZHRoO1xuXG4gICAgZnVuY3Rpb24gZ2V0TWF4U2Nyb2xsKGhlaWdodFdpZHRoKSB7XG4gICAgICAgIHJldHVybiBtb2RlbFtoZWlnaHRXaWR0aF0gLSBnZXRWaWV3U2Nyb2xsSGVpZ2h0T3JXaWR0aChoZWlnaHRXaWR0aCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0U2Nyb2xsUmF0aW9Gcm9tVmlydHVhbFNjcm9sbENvb3JkcyhzY3JvbGwsIGhlaWdodFdpZHRoKSB7XG4gICAgICAgIHZhciBtYXhTY3JvbGwgPSBnZXRNYXhTY3JvbGwoaGVpZ2h0V2lkdGgpO1xuICAgICAgICB2YXIgc2Nyb2xsUmF0aW8gPSBzY3JvbGwgLyBtYXhTY3JvbGw7XG4gICAgICAgIHJldHVybiBzY3JvbGxSYXRpbztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRNYXhTY3JvbGxCYXJDb29yZChoZWlnaHRXaWR0aCwgdmVydEhvcnopIHtcbiAgICAgICAgcmV0dXJuIGdldFZpZXdTY3JvbGxIZWlnaHRPcldpZHRoKGhlaWdodFdpZHRoKSAtIG1vZGVsW3ZlcnRIb3J6ICsgJ1Njcm9sbEJhciddW2hlaWdodFdpZHRoXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRSZWFsU2Nyb2xsQmFyUG9zaXRpb24oc2Nyb2xsLCBoZWlnaHRXaWR0aCwgdmVydEhvcnopIHtcbiAgICAgICAgdmFyIHNjcm9sbFJhdGlvID0gZ2V0U2Nyb2xsUmF0aW9Gcm9tVmlydHVhbFNjcm9sbENvb3JkcyhzY3JvbGwsIGhlaWdodFdpZHRoKTtcbiAgICAgICAgdmFyIG1heFNjcm9sbEJhclNjcm9sbCA9IGdldE1heFNjcm9sbEJhckNvb3JkKGhlaWdodFdpZHRoLCB2ZXJ0SG9yeik7XG4gICAgICAgIC8vaW4gc2Nyb2xsIGJhciBjb29yZHNcbiAgICAgICAgdmFyIHNjcm9sbEJhckNvb3JkID0gc2Nyb2xsUmF0aW8gKiBtYXhTY3JvbGxCYXJTY3JvbGw7XG4gICAgICAgIC8vYWRkIHRoZSBmaXhlZCBoZWlnaHQgdG8gdHJhbnNsYXRlIGJhY2sgaW50byByZWFsIGNvb3Jkc1xuICAgICAgICByZXR1cm4gc2Nyb2xsQmFyQ29vcmQgKyBncmlkLnZpcnR1YWxQaXhlbENlbGxNb2RlbFsnZml4ZWQnICsgY2FwaXRhbGl6ZShoZWlnaHRXaWR0aCldKCk7XG4gICAgfVxuXG4gICAgbW9kZWwuX2dldFJlYWxTY3JvbGxCYXJQb3NpdGlvbiA9IGdldFJlYWxTY3JvbGxCYXJQb3NpdGlvbjtcbiAgICBtb2RlbC5fZ2V0U2Nyb2xsUG9zaXRpb25Gcm9tUmVhbCA9IGdldFNjcm9sbFBvc2l0aW9uRnJvbVJlYWw7XG5cbiAgICBmdW5jdGlvbiBjYWxjU2Nyb2xsQmFyUmVhbFRvcCgpIHtcbiAgICAgICAgcmV0dXJuIGdldFJlYWxTY3JvbGxCYXJQb3NpdGlvbihtb2RlbC50b3AsICdoZWlnaHQnLCAndmVydCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhbGNTY3JvbGxCYXJSZWFsTGVmdCgpIHtcbiAgICAgICAgcmV0dXJuIGdldFJlYWxTY3JvbGxCYXJQb3NpdGlvbihtb2RlbC5sZWZ0LCAnd2lkdGgnLCAnaG9yeicpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBvc2l0aW9uU2Nyb2xsQmFycygpIHtcbiAgICAgICAgbW9kZWwudmVydFNjcm9sbEJhci50b3AgPSBjYWxjU2Nyb2xsQmFyUmVhbFRvcCgpO1xuICAgICAgICBtb2RlbC5ob3J6U2Nyb2xsQmFyLmxlZnQgPSBjYWxjU2Nyb2xsQmFyUmVhbExlZnQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRWaWV3U2Nyb2xsSGVpZ2h0T3JXaWR0aChoZWlnaHRXaWR0aCkge1xuICAgICAgICByZXR1cm4gZ3JpZC52aWV3UG9ydFtoZWlnaHRXaWR0aF0gLSBncmlkLnZpcnR1YWxQaXhlbENlbGxNb2RlbFsnZml4ZWQnICsgY2FwaXRhbGl6ZShoZWlnaHRXaWR0aCldKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0U2Nyb2xsYWJsZVZpZXdXaWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIGdldFZpZXdTY3JvbGxIZWlnaHRPcldpZHRoKCd3aWR0aCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNjcm9sbGFibGVWaWV3SGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gZ2V0Vmlld1Njcm9sbEhlaWdodE9yV2lkdGgoJ2hlaWdodCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNpemVTY3JvbGxCYXJzKCkge1xuICAgICAgICBtb2RlbC52ZXJ0U2Nyb2xsQmFyLmxlZnQgPSBncmlkLnZpZXdQb3J0LndpZHRoIC0gc2Nyb2xsQmFyV2lkdGg7XG4gICAgICAgIG1vZGVsLmhvcnpTY3JvbGxCYXIudG9wID0gZ3JpZC52aWV3UG9ydC5oZWlnaHQgLSBzY3JvbGxCYXJXaWR0aDtcbiAgICAgICAgdmFyIHNjcm9sbGFibGVWaWV3SGVpZ2h0ID0gZ2V0U2Nyb2xsYWJsZVZpZXdIZWlnaHQoKTtcbiAgICAgICAgdmFyIHNjcm9sbGFibGVWaWV3V2lkdGggPSBnZXRTY3JvbGxhYmxlVmlld1dpZHRoKCk7XG4gICAgICAgIG1vZGVsLnZlcnRTY3JvbGxCYXIuaGVpZ2h0ID0gTWF0aC5tYXgoc2Nyb2xsYWJsZVZpZXdIZWlnaHQgLyBncmlkLnZpcnR1YWxQaXhlbENlbGxNb2RlbC50b3RhbEhlaWdodCgpICogc2Nyb2xsYWJsZVZpZXdIZWlnaHQsIDIwKTtcbiAgICAgICAgbW9kZWwuaG9yelNjcm9sbEJhci53aWR0aCA9IE1hdGgubWF4KHNjcm9sbGFibGVWaWV3V2lkdGggLyBncmlkLnZpcnR1YWxQaXhlbENlbGxNb2RlbC50b3RhbFdpZHRoKCkgKiBzY3JvbGxhYmxlVmlld1dpZHRoLCAyMCk7XG4gICAgICAgIHBvc2l0aW9uU2Nyb2xsQmFycygpO1xuICAgIH1cblxuICAgIGdyaWQuZGVjb3JhdG9ycy5hZGQobW9kZWwudmVydFNjcm9sbEJhcik7XG4gICAgZ3JpZC5kZWNvcmF0b3JzLmFkZChtb2RlbC5ob3J6U2Nyb2xsQmFyKTtcbiAgICAvKiBFTkQgU0NST0xMIEJBUiBMT0dJQyAqL1xuXG4gICAgcmV0dXJuIG1vZGVsO1xufTsiLCJ2YXIgYWRkRGlydHlQcm9wcyA9IHJlcXVpcmUoJ0BncmlkL2FkZC1kaXJ0eS1wcm9wcycpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAocmFuZ2UsIGRpcnR5Q2xlYW4sIHBhcmVudERpcnR5Q2xlYW4pIHtcbiAgICByYW5nZSA9IHJhbmdlIHx8IHt9OyAvL2FsbG93IG1peGluIGZ1bmN0aW9uYWxpdHlcbiAgICByYW5nZS5pc0RpcnR5ID0gZGlydHlDbGVhbi5pc0RpcnR5O1xuXG4gICAgdmFyIHdhdGNoZWRQcm9wZXJ0aWVzID0gWyd0b3AnLCAnbGVmdCcsICdoZWlnaHQnLCAnd2lkdGgnLCAndW5pdHMnLCAnc3BhY2UnXTtcbiAgICB2YXIgZGlydHlDbGVhbnMgPSBbZGlydHlDbGVhbl07XG4gICAgaWYgKHBhcmVudERpcnR5Q2xlYW4pIHtcbiAgICAgICAgZGlydHlDbGVhbnMucHVzaChwYXJlbnREaXJ0eUNsZWFuKTtcbiAgICB9XG5cbiAgICBhZGREaXJ0eVByb3BzKHJhbmdlLCB3YXRjaGVkUHJvcGVydGllcywgZGlydHlDbGVhbnMpO1xuICAgIC8vZGVmYXVsdHNcbiAgICByYW5nZS51bml0cyA9ICdjZWxsJztcbiAgICByYW5nZS5zcGFjZSA9ICdkYXRhJztcblxuICAgIHJldHVybiByYW5nZTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgLy90YWtlcyBhIHBvaW50IGFuZCBhIGxlbmd0aCBhcyB0aGUgcmFuZ2VzIGluIGFycmF5IGZvcm1cbiAgICBpbnRlcnNlY3Q6IGZ1bmN0aW9uIChyYW5nZTEsIHJhbmdlMikge1xuICAgICAgICB2YXIgcmFuZ2UyU3RhcnQgPSByYW5nZTJbMF07XG4gICAgICAgIHZhciByYW5nZTFTdGFydCA9IHJhbmdlMVswXTtcbiAgICAgICAgdmFyIHJhbmdlMUVuZCA9IHJhbmdlMVN0YXJ0ICsgcmFuZ2UxWzFdIC0gMTtcbiAgICAgICAgdmFyIHJhbmdlMkVuZCA9IHJhbmdlMlN0YXJ0ICsgcmFuZ2UyWzFdIC0gMTtcbiAgICAgICAgaWYgKHJhbmdlMlN0YXJ0ID4gcmFuZ2UxRW5kIHx8IHJhbmdlMkVuZCA8IHJhbmdlMVN0YXJ0KSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVzdWx0U3RhcnQgPSAocmFuZ2UxU3RhcnQgPiByYW5nZTJTdGFydCA/IHJhbmdlMVN0YXJ0IDogcmFuZ2UyU3RhcnQpO1xuICAgICAgICB2YXIgcmVzdWx0RW5kID0gKHJhbmdlMUVuZCA8IHJhbmdlMkVuZCA/IHJhbmdlMUVuZCA6IHJhbmdlMkVuZCk7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICByZXN1bHRTdGFydCxcbiAgICAgICAgICAgIHJlc3VsdEVuZCAtIHJlc3VsdFN0YXJ0ICsgMVxuICAgICAgICBdO1xuICAgIH0sXG4gICAgLy90YWtlcyBhIHBvaW50IGFuZCBhIGxlbmd0aCBhcyB0aGUgcmFuZ2VzIGluIGFycmF5IGZvcm1cbiAgICB1bmlvbjogZnVuY3Rpb24gKHJhbmdlMSwgcmFuZ2UyKSB7XG4gICAgICAgIGlmICghcmFuZ2UxKSB7XG4gICAgICAgICAgICByZXR1cm4gcmFuZ2UyO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcmFuZ2UyKSB7XG4gICAgICAgICAgICByZXR1cm4gcmFuZ2UxO1xuICAgICAgICB9XG4gICAgICAgIHZhciByYW5nZTJTdGFydCA9IHJhbmdlMlswXTtcbiAgICAgICAgdmFyIHJhbmdlMkVuZCA9IHJhbmdlMlN0YXJ0ICsgcmFuZ2UyWzFdIC0gMTtcbiAgICAgICAgdmFyIHJhbmdlMVN0YXJ0ID0gcmFuZ2UxWzBdO1xuICAgICAgICB2YXIgcmFuZ2UxRW5kID0gcmFuZ2UxU3RhcnQgKyByYW5nZTFbMV0gLSAxO1xuICAgICAgICB2YXIgcmVzdWx0U3RhcnQgPSAocmFuZ2UxU3RhcnQgPCByYW5nZTJTdGFydCA/IHJhbmdlMVN0YXJ0IDogcmFuZ2UyU3RhcnQpO1xuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgcmVzdWx0U3RhcnQsXG4gICAgICAgICAgICAocmFuZ2UxRW5kID4gcmFuZ2UyRW5kID8gcmFuZ2UxRW5kIDogcmFuZ2UyRW5kKSAtIHJlc3VsdFN0YXJ0ICsgMVxuICAgICAgICBdO1xuICAgIH0sXG5cbiAgICAvL3Rha2VzIHR3byByb3csIGNvbCBwb2ludHMgYW5kIGNyZWF0ZXMgYSBub3JtYWwgcG9zaXRpb24gcmFuZ2VcbiAgICBjcmVhdGVGcm9tUG9pbnRzOiBmdW5jdGlvbiAocjEsIGMxLCByMiwgYzIpIHtcbiAgICAgICAgdmFyIHJhbmdlID0ge307XG4gICAgICAgIGlmIChyMSA8IHIyKSB7XG4gICAgICAgICAgICByYW5nZS50b3AgPSByMTtcbiAgICAgICAgICAgIHJhbmdlLmhlaWdodCA9IHIyIC0gcjEgKyAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmFuZ2UudG9wID0gcjI7XG4gICAgICAgICAgICByYW5nZS5oZWlnaHQgPSByMSAtIHIyICsgMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjMSA8IGMyKSB7XG4gICAgICAgICAgICByYW5nZS5sZWZ0ID0gYzE7XG4gICAgICAgICAgICByYW5nZS53aWR0aCA9IGMyIC0gYzEgKyAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmFuZ2UubGVmdCA9IGMyO1xuICAgICAgICAgICAgcmFuZ2Uud2lkdGggPSBjMSAtIGMyICsgMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmFuZ2U7XG4gICAgfVxufTtcblxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2dyaWQpIHtcbiAgICB2YXIgZ3JpZCA9IF9ncmlkO1xuXG4gICAgdmFyIGFwaSA9IHJlcXVpcmUoJ0BncmlkL2Fic3RyYWN0LXJvdy1jb2wtbW9kZWwnKShncmlkLCAncm93JywgJ2hlaWdodCcsIDMwKTtcblxuICAgIHJldHVybiBhcGk7XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKF9ncmlkKSB7XG4gICAgdmFyIGdyaWQgPSBfZ3JpZDtcblxuICAgIHZhciBjZWxsRGF0YSA9IFtdO1xuICAgIHZhciBoZWFkZXJEYXRhID0gW107XG4gICAgdmFyIHNvcnRlZENvbDtcbiAgICB2YXIgYXNjZW5kaW5nO1xuICAgIHZhciBkaXJ0eUNsZWFuID0gcmVxdWlyZSgnQGdyaWQvZGlydHktY2xlYW4nKShncmlkKTtcbiAgICB2YXIgaW50ZXJuYWxTZXQgPSBmdW5jdGlvbiAoZGF0YSwgciwgYywgZGF0dW0pIHtcbiAgICAgICAgaWYgKCFkYXRhW3JdKSB7XG4gICAgICAgICAgICBkYXRhW3JdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgZGF0YVtyXVtjXSA9IGRhdHVtO1xuICAgICAgICBkaXJ0eUNsZWFuLnNldERpcnR5KCk7XG4gICAgfTtcblxuICAgIHZhciBhcGkgPSB7XG4gICAgICAgIGlzRGlydHk6IGRpcnR5Q2xlYW4uaXNEaXJ0eSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAociwgYywgZGF0dW0pIHtcbiAgICAgICAgICAgIGludGVybmFsU2V0KGNlbGxEYXRhLCByLCBjLCBkYXR1bSk7XG4gICAgICAgIH0sXG4gICAgICAgIHNldEhlYWRlcjogZnVuY3Rpb24gKHIsIGMsIGRhdHVtKSB7XG4gICAgICAgICAgICBpbnRlcm5hbFNldChoZWFkZXJEYXRhLCByLCBjLCBkYXR1bSk7XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKHIsIGMpIHtcbiAgICAgICAgICAgIHZhciBkYXRhUm93ID0gY2VsbERhdGFbZ3JpZC5yb3dNb2RlbC5yb3cocikuZGF0YVJvd107XG4gICAgICAgICAgICB2YXIgZGF0dW0gPSBkYXRhUm93ICYmIGRhdGFSb3dbZ3JpZC5jb2xNb2RlbC5jb2woYykuZGF0YUNvbF07XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBkYXR1bSAmJiBkYXR1bS52YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgICAgIGZvcm1hdHRlZDogdmFsdWUgJiYgJ3InICsgdmFsdWVbMF0gKyAnIGMnICsgdmFsdWVbMV0gfHwgJydcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIGdldEhlYWRlcjogZnVuY3Rpb24gKHIsIGMpIHtcbiAgICAgICAgICAgIHZhciBkYXRhUm93ID0gaGVhZGVyRGF0YVtncmlkLnJvd01vZGVsLmdldChyKS5kYXRhUm93XTtcblxuICAgICAgICAgICAgdmFyIGRhdHVtID0gZGF0YVJvdyAmJiBkYXRhUm93W2dyaWQuY29sTW9kZWwuZ2V0KGMpLmRhdGFDb2xdO1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gZGF0dW0gJiYgZGF0dW0udmFsdWU7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgICAgICBmb3JtYXR0ZWQ6IHZhbHVlICYmICdocicgKyB2YWx1ZVswXSArICcgaGMnICsgdmFsdWVbMV0gfHwgJydcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICAgICAgdG9nZ2xlU29ydDogZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIHZhciByZXRWYWwgPSAtMTtcbiAgICAgICAgICAgIHZhciBjb21wYXJlTWV0aG9kID0gZnVuY3Rpb24gKHZhbDEsIHZhbDIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsMSA8ICh2YWwyKSA/IHJldFZhbCA6IC0xICogcmV0VmFsO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChjID09PSBzb3J0ZWRDb2wpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXNjZW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldFZhbCA9IDE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFzY2VuZGluZyA9ICFhc2NlbmRpbmc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNvcnRlZENvbCA9IGM7XG4gICAgICAgICAgICAgICAgYXNjZW5kaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNlbGxEYXRhLnNvcnQoZnVuY3Rpb24gKGRhdGFSb3cxLCBkYXRhUm93Mikge1xuICAgICAgICAgICAgICAgIGlmICghZGF0YVJvdzEgfHwgIWRhdGFSb3cxW2NdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXRWYWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghZGF0YVJvdzIgfHwgIWRhdGFSb3cyW2NdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXRWYWwgKiAtMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbXBhcmVNZXRob2QoZGF0YVJvdzFbY10udmFsdWUsIGRhdGFSb3cyW2NdLnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZGlydHlDbGVhbi5zZXREaXJ0eSgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBhcGk7XG59OyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGNsYW1wOiBmdW5jdGlvbiAobnVtLCBtaW4sIG1heCwgcmV0dXJuTmFOKSB7XG4gICAgICAgIGlmIChudW0gPiBtYXgpIHtcbiAgICAgICAgICAgIHJldHVybiByZXR1cm5OYU4gPyBOYU4gOiBtYXg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG51bSA8IG1pbikge1xuICAgICAgICAgICAgcmV0dXJuIHJldHVybk5hTiA/IE5hTiA6IG1pbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVtO1xuXG4gICAgfSxcbiAgICBpc051bWJlcjogZnVuY3Rpb24gKG51bWJlcikge1xuICAgICAgICByZXR1cm4gdHlwZW9mIG51bWJlciA9PT0gJ251bWJlcicgJiYgIWlzTmFOKG51bWJlcik7XG4gICAgfSxcbiAgICBpc0VsZW1lbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgIHJldHVybiAhIShub2RlICYmXG4gICAgICAgIChub2RlLm5vZGVOYW1lIHx8IC8vIHdlIGFyZSBhIGRpcmVjdCBlbGVtZW50XG4gICAgICAgIChub2RlLnByb3AgJiYgbm9kZS5hdHRyICYmIG5vZGUuZmluZCkpKTsgIC8vIHdlIGhhdmUgYW4gb24gYW5kIGZpbmQgbWV0aG9kIHBhcnQgb2YgalF1ZXJ5IEFQSVxuICAgIH0sXG4gICAgaXNBcnJheTogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgIH0sXG4gICAgcG9zaXRpb246IGZ1bmN0aW9uIChlbGVtLCB0LCBsLCBiLCByKSB7XG4gICAgICAgIGVsZW0uc3R5bGUudG9wID0gdCArICdweCc7XG4gICAgICAgIGVsZW0uc3R5bGUubGVmdCA9IGwgKyAncHgnO1xuICAgICAgICBlbGVtLnN0eWxlLmJvdHRvbSA9IGIgKyAncHgnO1xuICAgICAgICBlbGVtLnN0eWxlLnJpZ2h0ID0gciArICdweCc7XG4gICAgICAgIGVsZW0uc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIH1cbn07IiwidmFyIGN1c3RvbUV2ZW50ID0gcmVxdWlyZSgnQGdyaWQvY3VzdG9tLWV2ZW50Jyk7XG52YXIgZGVib3VuY2UgPSByZXF1aXJlKCdAZ3JpZC9kZWJvdW5jZScpO1xudmFyIHV0aWwgPSByZXF1aXJlKCdAZ3JpZC91dGlsJyk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2dyaWQpIHtcbiAgICB2YXIgdmlld0xheWVyID0ge307XG5cblxuICAgIHZhciBncmlkID0gX2dyaWQ7XG4gICAgdmFyIGNvbnRhaW5lcjtcbiAgICB2YXIgcm9vdDtcbiAgICB2YXIgY2VsbENvbnRhaW5lcjtcbiAgICB2YXIgZGVjb3JhdG9yQ29udGFpbmVyO1xuICAgIHZhciBib3JkZXJXaWR0aDtcblxuICAgIHZhciBHUklEX0NFTExfQ09OVEFJTkVSX0JBU0VfQ0xBU1MgPSAnZ3JpZC1jZWxscyc7XG4gICAgdmFyIEdSSURfVklFV19ST09UX0NMQVNTID0gJ2pzLWdyaWQtdmlldy1yb290JztcbiAgICB2YXIgQ0VMTF9DTEFTUyA9ICdncmlkLWNlbGwnO1xuXG4gICAgdmFyIGNlbGxzOyAvL21hdHJpeCBvZiByZW5kZXJlZCBjZWxsIGVsZW1lbnRzO1xuICAgIHZhciByb3dzOyAvL2FycmF5IG9mIGFsbCByZW5kZXJlZCByb3dzXG4gICAgdmFyIGJ1aWx0Q29sczsgLy9tYXAgZnJvbSBjb2wgaW5kZXggdG8gYW4gYXJyYXkgb2YgYnVpbHQgZWxlbWVudHMgZm9yIHRoZSBjb2x1bW4gdG8gdXBkYXRlIG9uIHNjcm9sbFxuICAgIHZhciBidWlsdFJvd3M7IC8vbWFwIGZyb20gcm93IGluZGV4IHRvIGFuIGFycmF5IG9mIGJ1aWx0IGVsZW1lbnRzIGZvciB0aGUgcm93IHRvIHVwZGF0ZSBvbiBzY3JvbGxcblxuICAgIC8vYWRkIHRoZSBjZWxsIGNsYXNzZXMgdGhyb3VnaCB0aGUgc3RhbmRhcmQgbWV0aG9kXG4gICAgZ3JpZC5jZWxsQ2xhc3Nlcy5hZGQoZ3JpZC5jZWxsQ2xhc3Nlcy5jcmVhdGUoMCwgMCwgQ0VMTF9DTEFTUywgSW5maW5pdHksIEluZmluaXR5LCAndmlydHVhbCcpKTtcblxuICAgIHZhciByb3dIZWFkZXJDbGFzc2VzID0gZ3JpZC5jZWxsQ2xhc3Nlcy5jcmVhdGUoMCwgMCwgJ2dyaWQtaGVhZGVyIGdyaWQtcm93LWhlYWRlcicsIEluZmluaXR5LCAwLCAndmlydHVhbCcpO1xuICAgIHZhciBjb2xIZWFkZXJDbGFzc2VzID0gZ3JpZC5jZWxsQ2xhc3Nlcy5jcmVhdGUoMCwgMCwgJ2dyaWQtaGVhZGVyIGdyaWQtY29sLWhlYWRlcicsIDAsIEluZmluaXR5LCAndmlydHVhbCcpO1xuICAgIHZhciBmaXhlZENvbENsYXNzZXMgPSBncmlkLmNlbGxDbGFzc2VzLmNyZWF0ZSgwLCAtMSwgJ2dyaWQtbGFzdC1maXhlZC1jb2wnLCBJbmZpbml0eSwgMSwgJ3ZpcnR1YWwnKTtcbiAgICB2YXIgZml4ZWRSb3dDbGFzc2VzID0gZ3JpZC5jZWxsQ2xhc3Nlcy5jcmVhdGUoLTEsIDAsICdncmlkLWxhc3QtZml4ZWQtcm93JywgMSwgSW5maW5pdHksICd2aXJ0dWFsJyk7XG5cbiAgICBncmlkLmNlbGxDbGFzc2VzLmFkZChyb3dIZWFkZXJDbGFzc2VzKTtcbiAgICBncmlkLmNlbGxDbGFzc2VzLmFkZChjb2xIZWFkZXJDbGFzc2VzKTtcbiAgICBncmlkLmNlbGxDbGFzc2VzLmFkZChmaXhlZFJvd0NsYXNzZXMpO1xuICAgIGdyaWQuY2VsbENsYXNzZXMuYWRkKGZpeGVkQ29sQ2xhc3Nlcyk7XG5cblxuICAgIGdyaWQuZXZlbnRMb29wLmJpbmQoJ2dyaWQtY29sLWNoYW5nZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZml4ZWRDb2xDbGFzc2VzLmxlZnQgPSBncmlkLmNvbE1vZGVsLm51bUZpeGVkKCkgLSAxO1xuICAgICAgICByb3dIZWFkZXJDbGFzc2VzLndpZHRoID0gZ3JpZC5jb2xNb2RlbC5udW1IZWFkZXJzKCk7XG4gICAgfSk7XG5cbiAgICBncmlkLmV2ZW50TG9vcC5iaW5kKCdncmlkLXJvdy1jaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZpeGVkUm93Q2xhc3Nlcy50b3AgPSBncmlkLnJvd01vZGVsLm51bUZpeGVkKCkgLSAxO1xuICAgICAgICBjb2xIZWFkZXJDbGFzc2VzLmhlaWdodCA9IGdyaWQucm93TW9kZWwubnVtSGVhZGVycygpO1xuICAgIH0pO1xuXG5cbiAgICB2aWV3TGF5ZXIuYnVpbGQgPSBmdW5jdGlvbiAoZWxlbSkge1xuICAgICAgICBjbGVhbnVwKCk7XG5cbiAgICAgICAgY29udGFpbmVyID0gZWxlbTtcblxuICAgICAgICBjZWxsQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGNlbGxDb250YWluZXIuc2V0QXR0cmlidXRlKCdkdHMnLCAnZ3JpZC1jZWxscycpO1xuICAgICAgICBjZWxsQ29udGFpbmVyLnNldEF0dHJpYnV0ZSgnY2xhc3MnLCBHUklEX0NFTExfQ09OVEFJTkVSX0JBU0VfQ0xBU1MpO1xuICAgICAgICB1dGlsLnBvc2l0aW9uKGNlbGxDb250YWluZXIsIDAsIDAsIDAsIDApO1xuICAgICAgICBjZWxsQ29udGFpbmVyLnN0eWxlLnpJbmRleCA9IDA7XG5cbiAgICAgICAgZGVjb3JhdG9yQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGRlY29yYXRvckNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2R0cycsICdncmlkLWRlY29yYXRvcnMnKTtcbiAgICAgICAgdXRpbC5wb3NpdGlvbihkZWNvcmF0b3JDb250YWluZXIsIDAsIDAsIDAsIDApO1xuICAgICAgICBkZWNvcmF0b3JDb250YWluZXIuc3R5bGUuekluZGV4ID0gMDtcbiAgICAgICAgZGVjb3JhdG9yQ29udGFpbmVyLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cbiAgICAgICAgcm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICByb290LnNldEF0dHJpYnV0ZSgnY2xhc3MnLCBHUklEX1ZJRVdfUk9PVF9DTEFTUyk7XG5cbiAgICAgICAgcm9vdC5hcHBlbmRDaGlsZChjZWxsQ29udGFpbmVyKTtcbiAgICAgICAgcm9vdC5hcHBlbmRDaGlsZChkZWNvcmF0b3JDb250YWluZXIpO1xuXG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChyb290KTtcblxuICAgIH07XG5cblxuICAgIGZ1bmN0aW9uIG1lYXN1cmVCb3JkZXJXaWR0aCgpIHtcbiAgICAgICAgLy9yZWFkIHRoZSBib3JkZXIgd2lkdGgsIGZvciB0aGUgcmFyZSBjYXNlIG9mIGxhcmdlciB0aGFuIDFweCBib3JkZXJzLCBvdGhlcndpc2UgdGhlIGRyYXcgd2lsbCBkZWZhdWx0IHRvIDFcbiAgICAgICAgaWYgKGJvcmRlcldpZHRoKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGpzR3JpZENlbGwgPSBjZWxsc1swXSAmJiBjZWxsc1swXVswXTtcbiAgICAgICAgaWYgKGpzR3JpZENlbGwpIHtcbiAgICAgICAgICAgIHZhciBvbGRDbGFzcyA9IGpzR3JpZENlbGwuY2xhc3NOYW1lO1xuICAgICAgICAgICAganNHcmlkQ2VsbC5jbGFzc05hbWUgPSBDRUxMX0NMQVNTO1xuICAgICAgICAgICAgdmFyIGNvbXB1dGVkU3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKGpzR3JpZENlbGwpO1xuICAgICAgICAgICAgdmFyIGJvcmRlcldpZHRoUHJvcCA9IGNvbXB1dGVkU3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnYm9yZGVyLWxlZnQtd2lkdGgnKTtcbiAgICAgICAgICAgIGJvcmRlcldpZHRoID0gcGFyc2VJbnQoYm9yZGVyV2lkdGhQcm9wKTtcbiAgICAgICAgICAgIGpzR3JpZENlbGwuY2xhc3NOYW1lID0gb2xkQ2xhc3M7XG4gICAgICAgIH1cbiAgICAgICAgYm9yZGVyV2lkdGggPSBpc05hTihib3JkZXJXaWR0aCkgfHwgIWJvcmRlcldpZHRoID8gdW5kZWZpbmVkIDogYm9yZGVyV2lkdGg7XG4gICAgICAgIHJldHVybiBib3JkZXJXaWR0aDtcbiAgICB9XG5cbiAgICAvL29ubHkgZHJhdyBvbmNlIHBlciBqcyB0dXJuLCBtYXkgbmVlZCB0byBjcmVhdGUgYSBzeW5jaHJvbm91cyB2ZXJzaW9uXG4gICAgdmlld0xheWVyLmRyYXcgPSBkZWJvdW5jZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZpZXdMYXllci5fZHJhdygpO1xuICAgIH0sIDEpO1xuXG4gICAgdmlld0xheWVyLl9kcmF3ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvL3JldHVybiBpZiB3ZSBoYXZlbid0IGJ1aWx0IHlldFxuICAgICAgICBpZiAoIWNvbnRhaW5lcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHJlYnVpbHQgPSBncmlkLnZpZXdQb3J0LmlzRGlydHkoKTtcbiAgICAgICAgaWYgKHJlYnVpbHQpIHtcbiAgICAgICAgICAgIHZpZXdMYXllci5fYnVpbGRDZWxscyhjZWxsQ29udGFpbmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBidWlsdENvbHNEaXJ0eSA9IGdyaWQuY29sTW9kZWwuYXJlQnVpbGRlcnNEaXJ0eSgpO1xuICAgICAgICBpZiAocmVidWlsdCB8fCBidWlsdENvbHNEaXJ0eSkge1xuICAgICAgICAgICAgdmlld0xheWVyLl9idWlsZENvbHMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBidWlsdFJvd3NEaXJ0eSA9IGdyaWQucm93TW9kZWwuYXJlQnVpbGRlcnNEaXJ0eSgpO1xuICAgICAgICBpZiAocmVidWlsdCB8fCBidWlsdFJvd3NEaXJ0eSkge1xuICAgICAgICAgICAgdmlld0xheWVyLl9idWlsZFJvd3MoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjZWxsc1Bvc2l0aW9uT3JTaXplQ2hhbmdlZCA9IGdyaWQuY29sTW9kZWwuaXNEaXJ0eSgpIHx8IGdyaWQucm93TW9kZWwuaXNEaXJ0eSgpIHx8IGdyaWQuY2VsbFNjcm9sbE1vZGVsLmlzRGlydHkoKTtcblxuICAgICAgICBpZiAoZ3JpZC5jZWxsQ2xhc3Nlcy5pc0RpcnR5KCkgfHwgcmVidWlsdCB8fCBjZWxsc1Bvc2l0aW9uT3JTaXplQ2hhbmdlZCkge1xuICAgICAgICAgICAgdmlld0xheWVyLl9kcmF3Q2VsbENsYXNzZXMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZWJ1aWx0IHx8IGNlbGxzUG9zaXRpb25PclNpemVDaGFuZ2VkIHx8IGJ1aWx0Q29sc0RpcnR5IHx8IGJ1aWx0Um93c0RpcnR5IHx8IGdyaWQuZGF0YU1vZGVsLmlzRGlydHkoKSkge1xuICAgICAgICAgICAgdmlld0xheWVyLl9kcmF3Q2VsbHMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChncmlkLmRlY29yYXRvcnMuaXNEaXJ0eSgpIHx8IHJlYnVpbHQgfHwgY2VsbHNQb3NpdGlvbk9yU2l6ZUNoYW5nZWQpIHtcbiAgICAgICAgICAgIHZpZXdMYXllci5fZHJhd0RlY29yYXRvcnMoY2VsbHNQb3NpdGlvbk9yU2l6ZUNoYW5nZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgZ3JpZC5ldmVudExvb3AuZmlyZSgnZ3JpZC1kcmF3Jyk7XG4gICAgfTtcblxuICAgIC8qIENFTEwgTE9HSUMgKi9cbiAgICBmdW5jdGlvbiBnZXRCb3JkZXJXaWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIGJvcmRlcldpZHRoIHx8IDE7XG4gICAgfVxuXG4gICAgdmlld0xheWVyLl9kcmF3Q2VsbHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIG1lYXN1cmVCb3JkZXJXaWR0aCgpO1xuICAgICAgICB2YXIgYldpZHRoID0gZ2V0Qm9yZGVyV2lkdGgoKTtcbiAgICAgICAgdmFyIGhlYWRlclJvd3MgPSBncmlkLnJvd01vZGVsLm51bUhlYWRlcnMoKTtcbiAgICAgICAgdmFyIGhlYWRlckNvbHMgPSBncmlkLmNvbE1vZGVsLm51bUhlYWRlcnMoKTtcbiAgICAgICAgZ3JpZC52aWV3UG9ydC5pdGVyYXRlQ2VsbHMoZnVuY3Rpb24gZHJhd0NlbGwociwgYykge1xuICAgICAgICAgICAgdmFyIGNlbGwgPSBjZWxsc1tyXVtjXTtcbiAgICAgICAgICAgIHZhciB3aWR0aCA9IGdyaWQudmlld1BvcnQuZ2V0Q29sV2lkdGgoYyk7XG4gICAgICAgICAgICBjZWxsLnN0eWxlLndpZHRoID0gd2lkdGggKyBiV2lkdGggKyAncHgnO1xuXG4gICAgICAgICAgICB2YXIgbGVmdCA9IGdyaWQudmlld1BvcnQuZ2V0Q29sTGVmdChjKTtcbiAgICAgICAgICAgIGNlbGwuc3R5bGUubGVmdCA9IGxlZnQgKyAncHgnO1xuXG4gICAgICAgICAgICB3aGlsZSAoY2VsbC5maXJzdENoaWxkKSB7XG4gICAgICAgICAgICAgICAgY2VsbC5yZW1vdmVDaGlsZChjZWxsLmZpcnN0Q2hpbGQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHZpcnR1YWxSb3cgPSBncmlkLnZpZXdQb3J0LnRvVmlydHVhbFJvdyhyKTtcbiAgICAgICAgICAgIHZhciB2aXJ0dWFsQ29sID0gZ3JpZC52aWV3UG9ydC50b1ZpcnR1YWxDb2woYyk7XG4gICAgICAgICAgICB2YXIgZGF0YTtcbiAgICAgICAgICAgIGlmIChyIDwgaGVhZGVyUm93cyB8fCBjIDwgaGVhZGVyQ29scykge1xuICAgICAgICAgICAgICAgIGRhdGEgPSBncmlkLmRhdGFNb2RlbC5nZXRIZWFkZXIodmlydHVhbFJvdywgdmlydHVhbENvbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRhdGEgPSBncmlkLmRhdGFNb2RlbC5nZXQoZ3JpZC5yb3dNb2RlbC50b0RhdGEodmlydHVhbFJvdyksIGdyaWQuY29sTW9kZWwudG9EYXRhKHZpcnR1YWxDb2wpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vYXJ0aWZpY2lhbGx5IG9ubHkgZ2V0IGJ1aWxkZXJzIGZvciByb3cgaGVhZGVycyBmb3Igbm93XG4gICAgICAgICAgICB2YXIgYnVpbGRlciA9IHZpcnR1YWxSb3cgPCBoZWFkZXJSb3dzICYmIGdyaWQucm93TW9kZWwuZ2V0KHZpcnR1YWxSb3cpLmJ1aWxkZXIgfHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgdmFyIGhhc1Jvd0J1aWxkZXIgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKCFidWlsZGVyKSB7XG4gICAgICAgICAgICAgICAgaGFzUm93QnVpbGRlciA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGJ1aWxkZXIgPSBncmlkLmNvbE1vZGVsLmdldCh2aXJ0dWFsQ29sKS5idWlsZGVyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY2VsbENoaWxkO1xuICAgICAgICAgICAgaWYgKGJ1aWxkZXIpIHtcbiAgICAgICAgICAgICAgICB2YXIgYnVpbHRFbGVtO1xuICAgICAgICAgICAgICAgIGlmIChoYXNSb3dCdWlsZGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1aWx0RWxlbSA9IGJ1aWx0Um93c1t2aXJ0dWFsUm93XVtjXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBidWlsdEVsZW0gPSBidWlsdENvbHNbdmlydHVhbENvbF1bcl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNlbGxDaGlsZCA9IGJ1aWxkZXIudXBkYXRlKGJ1aWx0RWxlbSwge1xuICAgICAgICAgICAgICAgICAgICB2aXJ0dWFsQ29sOiB2aXJ0dWFsQ29sLFxuICAgICAgICAgICAgICAgICAgICB2aXJ0dWFsUm93OiB2aXJ0dWFsUm93LFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL2lmIHdlIGRpZG4ndCBnZXQgYSBjaGlsZCBmcm9tIHRoZSBidWlsZGVyIHVzZSBhIHJlZ3VsYXIgdGV4dCBub2RlXG4gICAgICAgICAgICBpZiAoIWNlbGxDaGlsZCkge1xuICAgICAgICAgICAgICAgIGNlbGxDaGlsZCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGRhdGEuZm9ybWF0dGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNlbGwuYXBwZW5kQ2hpbGQoY2VsbENoaWxkKTtcbiAgICAgICAgfSwgZnVuY3Rpb24gZHJhd1JvdyhyKSB7XG4gICAgICAgICAgICB2YXIgaGVpZ2h0ID0gZ3JpZC52aWV3UG9ydC5nZXRSb3dIZWlnaHQocik7XG4gICAgICAgICAgICB2YXIgcm93ID0gcm93c1tyXTtcbiAgICAgICAgICAgIHJvdy5zdHlsZS5oZWlnaHQgPSBoZWlnaHQgKyBiV2lkdGggKyAncHgnO1xuICAgICAgICAgICAgdmFyIHRvcCA9IGdyaWQudmlld1BvcnQuZ2V0Um93VG9wKHIpO1xuICAgICAgICAgICAgcm93LnN0eWxlLnRvcCA9IHRvcCArICdweCc7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChncmlkLmNlbGxTY3JvbGxNb2RlbC5yb3cgJSAyKSB7XG4gICAgICAgICAgICBjZWxsQ29udGFpbmVyLmNsYXNzTmFtZSA9IEdSSURfQ0VMTF9DT05UQUlORVJfQkFTRV9DTEFTUyArICcgb2Rkcyc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjZWxsQ29udGFpbmVyLmNsYXNzTmFtZSA9IEdSSURfQ0VMTF9DT05UQUlORVJfQkFTRV9DTEFTUztcbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgIHZpZXdMYXllci5fYnVpbGRDZWxscyA9IGZ1bmN0aW9uIGJ1aWxkQ2VsbHMoY2VsbENvbnRhaW5lcikge1xuICAgICAgICB3aGlsZSAoY2VsbENvbnRhaW5lci5maXJzdENoaWxkKSB7XG4gICAgICAgICAgICBjZWxsQ29udGFpbmVyLnJlbW92ZUNoaWxkKGNlbGxDb250YWluZXIuZmlyc3RDaGlsZCk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGNlbGxzID0gW107XG4gICAgICAgIHJvd3MgPSBbXTtcbiAgICAgICAgdmFyIHJvdztcbiAgICAgICAgZ3JpZC52aWV3UG9ydC5pdGVyYXRlQ2VsbHMoZnVuY3Rpb24gKHIsIGMpIHtcbiAgICAgICAgICAgIHZhciBjZWxsID0gYnVpbGREaXZDZWxsKCk7XG4gICAgICAgICAgICBjZWxsc1tyXVtjXSA9IGNlbGw7XG4gICAgICAgICAgICByb3cuYXBwZW5kQ2hpbGQoY2VsbCk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICBjZWxsc1tyXSA9IFtdO1xuICAgICAgICAgICAgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICByb3cuc2V0QXR0cmlidXRlKCdjbGFzcycsICdncmlkLXJvdycpO1xuICAgICAgICAgICAgcm93LnNldEF0dHJpYnV0ZSgnZHRzJywgJ2dyaWQtcm93Jyk7XG4gICAgICAgICAgICByb3cuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICAgICAgcm93LnN0eWxlLmxlZnQgPSAwO1xuICAgICAgICAgICAgcm93LnN0eWxlLnJpZ2h0ID0gMDtcbiAgICAgICAgICAgIHJvd3Nbcl0gPSByb3c7XG4gICAgICAgICAgICBjZWxsQ29udGFpbmVyLmFwcGVuZENoaWxkKHJvdyk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBidWlsZERpdkNlbGwoKSB7XG4gICAgICAgIHZhciBjZWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGNlbGwuc2V0QXR0cmlidXRlKCdkdHMnLCAnZ3JpZC1jZWxsJyk7XG4gICAgICAgIHZhciBzdHlsZSA9IGNlbGwuc3R5bGU7XG4gICAgICAgIHN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgc3R5bGUuYm94U2l6aW5nID0gJ2JvcmRlci1ib3gnO1xuICAgICAgICBzdHlsZS50b3AgPSAnMHB4JztcbiAgICAgICAgc3R5bGUuYm90dG9tID0gJzBweCc7XG4gICAgICAgIHJldHVybiBjZWxsO1xuICAgIH1cblxuICAgIC8qIEVORCBDRUxMIExPR0lDICovXG5cbiAgICAvKiBDT0wgQlVJTERFUiBMT0dJQyAqL1xuICAgIHZpZXdMYXllci5fYnVpbGRDb2xzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBidWlsdENvbHMgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgYyA9IDA7IGMgPCBncmlkLmNvbE1vZGVsLmxlbmd0aCh0cnVlKTsgYysrKSB7XG4gICAgICAgICAgICB2YXIgYnVpbGRlciA9IGdyaWQuY29sTW9kZWwuZ2V0KGMpLmJ1aWxkZXI7XG4gICAgICAgICAgICBpZiAoYnVpbGRlcikge1xuICAgICAgICAgICAgICAgIGJ1aWx0Q29sc1tjXSA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIHJlYWxSb3cgPSAwOyByZWFsUm93IDwgZ3JpZC52aWV3UG9ydC5yb3dzOyByZWFsUm93KyspIHtcbiAgICAgICAgICAgICAgICAgICAgYnVpbHRDb2xzW2NdW3JlYWxSb3ddID0gYnVpbGRlci5yZW5kZXIoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qIEVORCBDT0wgQlVJTERFUiBMT0dJQyAqL1xuXG4gICAgLyogUk9XIEJVSUxERVIgTE9HSUMgXG4gICAgICogIGZvciBub3cgd2Ugb25seSBidWlsZCBoZWFkZXJzXG4gICAgICogKi9cblxuICAgIHZpZXdMYXllci5fYnVpbGRSb3dzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBidWlsdFJvd3MgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgciA9IDA7IHIgPCBncmlkLnJvd01vZGVsLm51bUhlYWRlcnMoKTsgcisrKSB7XG4gICAgICAgICAgICB2YXIgYnVpbGRlciA9IGdyaWQucm93TW9kZWwuZ2V0KHIpLmJ1aWxkZXI7XG4gICAgICAgICAgICBpZiAoYnVpbGRlcikge1xuICAgICAgICAgICAgICAgIGJ1aWx0Um93c1tyXSA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIHJlYWxDb2wgPSAwOyByZWFsQ29sIDwgZ3JpZC52aWV3UG9ydC5jb2xzOyByZWFsQ29sKyspIHtcbiAgICAgICAgICAgICAgICAgICAgYnVpbHRSb3dzW3JdW3JlYWxDb2xdID0gYnVpbGRlci5yZW5kZXIoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qIEVORCBST1cgQlVJTERFUiBMT0dJQyovXG5cbiAgICAvKiBERUNPUkFUT1IgTE9HSUMgKi9cbiAgICBmdW5jdGlvbiBzZXRQb3NpdGlvbihib3VuZGluZ0JveCwgdG9wLCBsZWZ0LCBoZWlnaHQsIHdpZHRoKSB7XG4gICAgICAgIHZhciBzdHlsZSA9IGJvdW5kaW5nQm94LnN0eWxlO1xuICAgICAgICBzdHlsZS50b3AgPSB0b3AgKyAncHgnO1xuICAgICAgICBzdHlsZS5sZWZ0ID0gbGVmdCArICdweCc7XG4gICAgICAgIHN0eWxlLmhlaWdodCA9IGhlaWdodCArICdweCc7XG4gICAgICAgIHN0eWxlLndpZHRoID0gd2lkdGggKyAncHgnO1xuICAgICAgICBzdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcG9zaXRpb25EZWNvcmF0b3IoYm91bmRpbmcsIHQsIGwsIGgsIHcpIHtcbiAgICAgICAgc2V0UG9zaXRpb24oYm91bmRpbmcsIHQsIGwsIHV0aWwuY2xhbXAoaCwgMCwgZ3JpZC52aWV3UG9ydC5oZWlnaHQpLCB1dGlsLmNsYW1wKHcsIDAsIGdyaWQudmlld1BvcnQud2lkdGgpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwb3NpdGlvbkNlbGxEZWNvcmF0b3JGcm9tVmlld0NlbGxSYW5nZShyZWFsQ2VsbFJhbmdlLCBib3VuZGluZ0JveCkge1xuICAgICAgICB2YXIgcmVhbFB4UmFuZ2UgPSBncmlkLnZpZXdQb3J0LnRvUHgocmVhbENlbGxSYW5nZSk7XG4gICAgICAgIHBvc2l0aW9uRGVjb3JhdG9yKGJvdW5kaW5nQm94LCByZWFsUHhSYW5nZS50b3AsIHJlYWxQeFJhbmdlLmxlZnQsIHJlYWxQeFJhbmdlLmhlaWdodCArIGdldEJvcmRlcldpZHRoKCksIHJlYWxQeFJhbmdlLndpZHRoICsgZ2V0Qm9yZGVyV2lkdGgoKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlUmFuZ2VGb3JEZXNjcmlwdG9yKGRlc2NyaXB0b3IpIHtcbiAgICAgICAgdmFyIHJhbmdlID0ge1xuICAgICAgICAgICAgdG9wOiBkZXNjcmlwdG9yLnRvcCxcbiAgICAgICAgICAgIGxlZnQ6IGRlc2NyaXB0b3IubGVmdCxcbiAgICAgICAgICAgIGhlaWdodDogZGVzY3JpcHRvci5oZWlnaHQsXG4gICAgICAgICAgICB3aWR0aDogZGVzY3JpcHRvci53aWR0aFxuICAgICAgICB9O1xuICAgICAgICBpZiAoZGVzY3JpcHRvci5zcGFjZSA9PT0gJ2RhdGEnICYmIGRlc2NyaXB0b3IudW5pdHMgPT09ICdjZWxsJykge1xuICAgICAgICAgICAgcmFuZ2UudG9wICs9IGdyaWQucm93TW9kZWwubnVtSGVhZGVycygpO1xuICAgICAgICAgICAgcmFuZ2UubGVmdCArPSBncmlkLmNvbE1vZGVsLm51bUhlYWRlcnMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmFuZ2U7XG4gICAgfVxuXG4gICAgdmlld0xheWVyLl9kcmF3RGVjb3JhdG9ycyA9IGZ1bmN0aW9uIChjZWxsc1Bvc2l0aW9uT3JTaXplQ2hhbmdlZCkge1xuICAgICAgICB2YXIgYWxpdmVEZWNvcmF0b3JzID0gZ3JpZC5kZWNvcmF0b3JzLmdldEFsaXZlKCk7XG4gICAgICAgIGFsaXZlRGVjb3JhdG9ycy5mb3JFYWNoKGZ1bmN0aW9uIChkZWNvcmF0b3IpIHtcblxuICAgICAgICAgICAgdmFyIGJvdW5kaW5nQm94ID0gZGVjb3JhdG9yLmJvdW5kaW5nQm94O1xuICAgICAgICAgICAgaWYgKCFib3VuZGluZ0JveCkge1xuICAgICAgICAgICAgICAgIGJvdW5kaW5nQm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICAgICAgYm91bmRpbmdCb3guc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgICAgICAgICAgICAgICBkZWNvcmF0b3IuYm91bmRpbmdCb3ggPSBib3VuZGluZ0JveDtcbiAgICAgICAgICAgICAgICB2YXIgZGVjRWxlbWVudCA9IGRlY29yYXRvci5yZW5kZXIoKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVjRWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICBib3VuZGluZ0JveC5hcHBlbmRDaGlsZChkZWNFbGVtZW50KTtcbiAgICAgICAgICAgICAgICAgICAgZGVjb3JhdG9yQ29udGFpbmVyLmFwcGVuZENoaWxkKGJvdW5kaW5nQm94KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkZWNvcmF0b3IuaXNEaXJ0eSgpIHx8IGNlbGxzUG9zaXRpb25PclNpemVDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGRlY29yYXRvci5zcGFjZSA9PT0gJ3JlYWwnKSB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoZGVjb3JhdG9yLnVuaXRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdweCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25EZWNvcmF0b3IoYm91bmRpbmdCb3gsIGRlY29yYXRvci50b3AsIGRlY29yYXRvci5sZWZ0LCBkZWNvcmF0b3IuaGVpZ2h0LCBkZWNvcmF0b3Iud2lkdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnY2VsbCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25DZWxsRGVjb3JhdG9yRnJvbVZpZXdDZWxsUmFuZ2UoZGVjb3JhdG9yLCBib3VuZGluZ0JveCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZGVjb3JhdG9yLnNwYWNlID09PSAndmlydHVhbCcgfHwgZGVjb3JhdG9yLnNwYWNlID09PSAnZGF0YScpIHtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChkZWNvcmF0b3IudW5pdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3B4JzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2NlbGwnOlxuICAgICAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IC1XMDg2ICovXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByYW5nZSA9IGNyZWF0ZVJhbmdlRm9yRGVzY3JpcHRvcihkZWNvcmF0b3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWFsQ2VsbFJhbmdlID0gZ3JpZC52aWV3UG9ydC5pbnRlcnNlY3QocmFuZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWFsQ2VsbFJhbmdlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uQ2VsbERlY29yYXRvckZyb21WaWV3Q2VsbFJhbmdlKHJlYWxDZWxsUmFuZ2UsIGJvdW5kaW5nQm94KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbkRlY29yYXRvcihib3VuZGluZ0JveCwgLTEsIC0xLCAtMSwgLTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIGpzaGludCArVzA4NiAqL1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJlbW92ZURlY29yYXRvcnMoZ3JpZC5kZWNvcmF0b3JzLnBvcEFsbERlYWQoKSk7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHJlbW92ZURlY29yYXRvcnMoZGVjb3JhdG9ycykge1xuICAgICAgICBkZWNvcmF0b3JzLmZvckVhY2goZnVuY3Rpb24gKGRlY29yYXRvcikge1xuICAgICAgICAgICAgdmFyIGJvdW5kaW5nQm94ID0gZGVjb3JhdG9yLmJvdW5kaW5nQm94O1xuICAgICAgICAgICAgaWYgKGJvdW5kaW5nQm94KSB7XG4gICAgICAgICAgICAgICAgLy9pZiB0aGV5IHJlbmRlcmVkIGFuIGVsZW1lbnQgcHJldmlvdXNseSB3ZSBhdHRhY2hlZCBpdCB0byB0aGUgYm91bmRpbmcgYm94IGFzIHRoZSBvbmx5IGNoaWxkXG4gICAgICAgICAgICAgICAgdmFyIHJlbmRlcmVkRWxlbWVudCA9IGJvdW5kaW5nQm94LmZpcnN0Q2hpbGQ7XG4gICAgICAgICAgICAgICAgaWYgKHJlbmRlcmVkRWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICAvL2NyZWF0ZSBhIGRlc3Ryb3kgZG9tIGV2ZW50IHRoYXQgYnViYmxlc1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGVzdHJveUV2ZW50ID0gY3VzdG9tRXZlbnQoJ2RlY29yYXRvci1kZXN0cm95JywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlcmVkRWxlbWVudC5kaXNwYXRjaEV2ZW50KGRlc3Ryb3lFdmVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRlY29yYXRvckNvbnRhaW5lci5yZW1vdmVDaGlsZChib3VuZGluZ0JveCk7XG4gICAgICAgICAgICAgICAgZGVjb3JhdG9yLmJvdW5kaW5nQm94ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKiBFTkQgREVDT1JBVE9SIExPR0lDICovXG5cbiAgICAvKiBDRUxMIENMQVNTRVMgTE9HSUMgKi9cbiAgICB2aWV3TGF5ZXIuX2RyYXdDZWxsQ2xhc3NlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZ3JpZC52aWV3UG9ydC5pdGVyYXRlQ2VsbHMoZnVuY3Rpb24gKHIsIGMpIHtcbiAgICAgICAgICAgIGNlbGxzW3JdW2NdLmNsYXNzTmFtZSA9ICcnO1xuICAgICAgICB9KTtcbiAgICAgICAgZ3JpZC5jZWxsQ2xhc3Nlcy5nZXRBbGwoKS5mb3JFYWNoKGZ1bmN0aW9uIChkZXNjcmlwdG9yKSB7XG4gICAgICAgICAgICB2YXIgcmFuZ2UgPSBjcmVhdGVSYW5nZUZvckRlc2NyaXB0b3IoZGVzY3JpcHRvcik7XG4gICAgICAgICAgICB2YXIgaW50ZXJzZWN0aW9uID0gZ3JpZC52aWV3UG9ydC5pbnRlcnNlY3QocmFuZ2UpO1xuICAgICAgICAgICAgaWYgKGludGVyc2VjdGlvbikge1xuICAgICAgICAgICAgICAgIHJvd0xvb3A6XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgaW50ZXJzZWN0aW9uLmhlaWdodDsgcisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBjID0gMDsgYyA8IGludGVyc2VjdGlvbi53aWR0aDsgYysrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJvdyA9IGludGVyc2VjdGlvbi50b3AgKyByO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2wgPSBpbnRlcnNlY3Rpb24ubGVmdCArIGM7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2VsbFJvdyA9IGNlbGxzW3Jvd107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjZWxsUm93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlIHJvd0xvb3A7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjZWxsID0gY2VsbFJvd1tjb2xdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2VsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2VsbC5jbGFzc05hbWUgPSAoY2VsbC5jbGFzc05hbWUgPyBjZWxsLmNsYXNzTmFtZSArICcgJyA6ICcnKSArIGRlc2NyaXB0b3IuY2xhc3M7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qIEVORCBDRUxMIENMQVNTRVMgTE9HSUMqL1xuXG4gICAgdmlld0xheWVyLmRlc3Ryb3kgPSBjbGVhbnVwO1xuXG4gICAgZnVuY3Rpb24gY2xlYW51cCgpIHtcbiAgICAgICAgcmVtb3ZlRGVjb3JhdG9ycyhncmlkLmRlY29yYXRvcnMuZ2V0QWxpdmUoKS5jb25jYXQoZ3JpZC5kZWNvcmF0b3JzLnBvcEFsbERlYWQoKSkpO1xuICAgICAgICBpZiAoIWNvbnRhaW5lcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBxdWVyeVNlbGVjdG9yQWxsID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy4nICsgR1JJRF9WSUVXX1JPT1RfQ0xBU1MpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHF1ZXJ5U2VsZWN0b3JBbGwubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHZhciByb290ID0gcXVlcnlTZWxlY3RvckFsbFtpXTtcbiAgICAgICAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZChyb290KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdyaWQuZXZlbnRMb29wLmJpbmQoJ2dyaWQtZGVzdHJveScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmlld0xheWVyLmRlc3Ryb3koKTtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHZpZXdMYXllci5kcmF3LnRpbWVvdXQpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHZpZXdMYXllcjtcbn07IiwidmFyIHV0aWwgPSByZXF1aXJlKCdAZ3JpZC91dGlsJyk7XG52YXIgcmFuZ2VVdGlsID0gcmVxdWlyZSgnQGdyaWQvcmFuZ2UtdXRpbCcpO1xudmFyIGNhcGl0YWxpemUgPSByZXF1aXJlKCdjYXBpdGFsaXplJyk7XG52YXIgYWRkRGlydHlQcm9wcyA9IHJlcXVpcmUoJ0BncmlkL2FkZC1kaXJ0eS1wcm9wcycpO1xudmFyIGRlYm91bmNlID0gcmVxdWlyZSgnQGdyaWQvZGVib3VuY2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2dyaWQpIHtcbiAgICB2YXIgZ3JpZCA9IF9ncmlkO1xuICAgIHZhciBkaXJ0eUNsZWFuID0gcmVxdWlyZSgnQGdyaWQvZGlydHktY2xlYW4nKShncmlkKTtcbiAgICB2YXIgY29udGFpbmVyO1xuXG4gICAgdmFyIHZpZXdQb3J0ID0gYWRkRGlydHlQcm9wcyh7fSwgWydyb3dzJywgJ2NvbHMnLCAnd2lkdGgnLCAnaGVpZ2h0J10sIFtkaXJ0eUNsZWFuXSk7XG4gICAgdmlld1BvcnQucm93cyA9IDA7XG4gICAgdmlld1BvcnQuY29scyA9IDA7XG4gICAgdmlld1BvcnQuaXNEaXJ0eSA9IGRpcnR5Q2xlYW4uaXNEaXJ0eTtcblxuICAgIC8vdGhlc2UgcHJvYmFibHkgdHJpZ2dlciByZWZsb3cgc28gd2UgbWF5IG5lZWQgdG8gdGhpbmsgYWJvdXQgY2FjaGluZyB0aGUgdmFsdWUgYW5kIHVwZGF0aW5nIGl0IGF0IG9uIGRyYXdzIG9yIHNvbWV0aGluZ1xuICAgIGZ1bmN0aW9uIGdldEZpcnN0Q2xpZW50UmVjdCgpIHtcbiAgICAgICAgcmV0dXJuIGNvbnRhaW5lciAmJiBjb250YWluZXIuZ2V0Q2xpZW50UmVjdHMgJiYgY29udGFpbmVyLmdldENsaWVudFJlY3RzKCkgJiYgY29udGFpbmVyLmdldENsaWVudFJlY3RzKClbMF0gfHwge307XG4gICAgfVxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHZpZXdQb3J0LCAndG9wJywge1xuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRGaXJzdENsaWVudFJlY3QoKS50b3AgfHwgMDtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHZpZXdQb3J0LCAnbGVmdCcsIHtcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0Rmlyc3RDbGllbnRSZWN0KCkubGVmdCB8fCAwO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB2aWV3UG9ydC50b0dyaWRYID0gZnVuY3Rpb24gKGNsaWVudFgpIHtcbiAgICAgICAgcmV0dXJuIGNsaWVudFggLSB2aWV3UG9ydC5sZWZ0O1xuICAgIH07XG5cbiAgICB2aWV3UG9ydC50b0dyaWRZID0gZnVuY3Rpb24gKGNsaWVudFkpIHtcbiAgICAgICAgcmV0dXJuIGNsaWVudFkgLSB2aWV3UG9ydC50b3A7XG4gICAgfTtcblxuXG4gICAgdmFyIGZpeGVkID0ge3Jvd3M6IDAsIGNvbHM6IDB9O1xuXG4gICAgZnVuY3Rpb24gZ2V0Rml4ZWQocm93T3JDb2wpIHtcbiAgICAgICAgcmV0dXJuIGZpeGVkW3Jvd09yQ29sICsgJ3MnXTtcbiAgICB9XG5cbiAgICB2aWV3UG9ydC5zaXplVG9Db250YWluZXIgPSBmdW5jdGlvbiAoZWxlbSkge1xuICAgICAgICBjb250YWluZXIgPSBlbGVtO1xuICAgICAgICB2aWV3UG9ydC53aWR0aCA9IGVsZW0ub2Zmc2V0V2lkdGg7XG4gICAgICAgIHZpZXdQb3J0LmhlaWdodCA9IGVsZW0ub2Zmc2V0SGVpZ2h0O1xuICAgICAgICB2aWV3UG9ydC5yb3dzID0gY2FsY3VsYXRlTWF4TGVuZ3Rocyh2aWV3UG9ydC5oZWlnaHQsIGdyaWQucm93TW9kZWwpO1xuICAgICAgICB2aWV3UG9ydC5jb2xzID0gY2FsY3VsYXRlTWF4TGVuZ3Rocyh2aWV3UG9ydC53aWR0aCwgZ3JpZC5jb2xNb2RlbCk7XG4gICAgICAgIGdyaWQuZXZlbnRMb29wLmZpcmUoJ2dyaWQtdmlld3BvcnQtY2hhbmdlJyk7XG4gICAgfTtcblxuICAgIHZpZXdQb3J0Ll9vblJlc2l6ZSA9IGRlYm91bmNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmlld1BvcnQuX3Jlc2l6ZSgpO1xuICAgIH0sIDIwMCk7XG5cbiAgICBncmlkLmV2ZW50TG9vcC5iaW5kKCdncmlkLWRlc3Ryb3knLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh2aWV3UG9ydC5fb25SZXNpemUudGltZW91dCk7XG4gICAgICAgIGNsZWFyVGltZW91dChzaG9ydERlYm91bmNlZFJlc2l6ZS50aW1lb3V0KTtcbiAgICB9KTtcblxuICAgIHZpZXdQb3J0Ll9yZXNpemUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChjb250YWluZXIpIHtcbiAgICAgICAgICAgIHZpZXdQb3J0LnNpemVUb0NvbnRhaW5lcihjb250YWluZXIpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHZhciBzaG9ydERlYm91bmNlZFJlc2l6ZSA9IGRlYm91bmNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmlld1BvcnQuX3Jlc2l6ZSgpO1xuICAgIH0sIDEpO1xuXG5cbiAgICBncmlkLmV2ZW50TG9vcC5iaW5kKCdyZXNpemUnLCB3aW5kb3csIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy93ZSBkb24ndCBiaW5kIHRoZSBoYW5kbGVyIGRpcmVjdGx5IHNvIHRoYXQgdGVzdHMgY2FuIG1vY2sgaXQgb3V0XG4gICAgICAgIHZpZXdQb3J0Ll9vblJlc2l6ZSgpO1xuICAgIH0pO1xuXG4gICAgZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC1yb3ctY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBmaXhlZC5yb3dzID0gZ3JpZC5yb3dNb2RlbC5udW1GaXhlZCgpO1xuICAgICAgICBzaG9ydERlYm91bmNlZFJlc2l6ZSgpO1xuICAgIH0pO1xuXG4gICAgZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC1jb2wtY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBmaXhlZC5jb2xzID0gZ3JpZC5jb2xNb2RlbC5udW1GaXhlZCgpO1xuICAgICAgICBzaG9ydERlYm91bmNlZFJlc2l6ZSgpO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gY29udmVydFJlYWxUb1ZpcnR1YWwoY29vcmQsIHJvd09yQ29sLCBjb29yZElzVmlydHVhbCkge1xuICAgICAgICAvL2NvdWxkIGNhY2hlIHRoaXMgb24gY2hhbmdlcyBpLmUuIHJvdy1jaGFuZ2Ugb3IgY29sLWNoYW5nZSBldmVudHNcbiAgICAgICAgdmFyIG51bUZpeGVkID0gZ2V0Rml4ZWQocm93T3JDb2wpO1xuICAgICAgICBpZiAoY29vcmQgPCBudW1GaXhlZCkge1xuICAgICAgICAgICAgcmV0dXJuIGNvb3JkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb29yZCArIChjb29yZElzVmlydHVhbCA/IC0xIDogMSkgKiBncmlkLmNlbGxTY3JvbGxNb2RlbFtyb3dPckNvbF07XG4gICAgfVxuXG4vLyBjb252ZXJ0cyBhIHZpZXdwb3J0IHJvdyBvciBjb2x1bW4gdG8gYSByZWFsIHJvdyBvciBjb2x1bW4gXG4vLyBjbGFtcHMgaXQgaWYgdGhlIGNvbHVtbiB3b3VsZCBiZSBvdXRzaWRlIHRoZSByYW5nZVxuICAgIGZ1bmN0aW9uIGdldFZpcnR1YWxSb3dDb2xVbnNhZmUocmVhbENvb3JkLCByb3dPckNvbCkge1xuICAgICAgICByZXR1cm4gY29udmVydFJlYWxUb1ZpcnR1YWwocmVhbENvb3JkLCByb3dPckNvbCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0VmlydHVhbFJvd0NvbENsYW1wZWQodmlld0Nvb3JkLCByb3dPckNvbCkge1xuICAgICAgICB2YXIgdmlydHVhbFJvd0NvbCA9IGdldFZpcnR1YWxSb3dDb2xVbnNhZmUodmlld0Nvb3JkLCByb3dPckNvbCk7XG4gICAgICAgIHJldHVybiBncmlkLnZpcnR1YWxQaXhlbENlbGxNb2RlbFsnY2xhbXAnICsgY2FwaXRhbGl6ZShyb3dPckNvbCldKHZpcnR1YWxSb3dDb2wpO1xuICAgIH1cblxuICAgIHZpZXdQb3J0LnRvVmlydHVhbFJvdyA9IGZ1bmN0aW9uIChyKSB7XG4gICAgICAgIHJldHVybiBnZXRWaXJ0dWFsUm93Q29sQ2xhbXBlZChyLCAncm93Jyk7XG4gICAgfTtcblxuICAgIHZpZXdQb3J0LnRvVmlydHVhbENvbCA9IGZ1bmN0aW9uIChjKSB7XG4gICAgICAgIHJldHVybiBnZXRWaXJ0dWFsUm93Q29sQ2xhbXBlZChjLCAnY29sJyk7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGdldFJlYWxSb3dDb2xDbGFtcGVkKHZpcnR1YWxDb29yZCwgcm93T3JDb2wpIHtcbiAgICAgICAgdmFyIG51bUZpeGVkID0gZ2V0Rml4ZWQocm93T3JDb2wpO1xuICAgICAgICBpZiAodmlydHVhbENvb3JkIDwgbnVtRml4ZWQpIHtcbiAgICAgICAgICAgIHJldHVybiB2aXJ0dWFsQ29vcmQ7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG1heFZpZXdQb3J0SW5kZXggPSB2aWV3UG9ydFtyb3dPckNvbCArICdzJ10gLSAxO1xuICAgICAgICByZXR1cm4gdXRpbC5jbGFtcCh2aXJ0dWFsQ29vcmQgLSBncmlkLmNlbGxTY3JvbGxNb2RlbFtyb3dPckNvbF0sIG51bUZpeGVkLCBtYXhWaWV3UG9ydEluZGV4LCB0cnVlKTtcbiAgICB9XG5cbiAgICB2aWV3UG9ydC5yb3dJc0luVmlldyA9IGZ1bmN0aW9uICh2aXJ0dWFsUm93KSB7XG4gICAgICAgIHZhciByZWFsUm93ID0gdmlld1BvcnQudG9SZWFsUm93KHZpcnR1YWxSb3cpO1xuICAgICAgICByZXR1cm4gIWlzTmFOKHJlYWxSb3cpICYmIGdldExlbmd0aEJldHdlZW5WaWV3Q29vcmRzKDAsIHJlYWxSb3csICdyb3cnLCAnaGVpZ2h0JywgdHJ1ZSkgPCB2aWV3UG9ydC5oZWlnaHQ7XG4gICAgfTtcblxuICAgIHZpZXdQb3J0LmNvbElzSW5WaWV3ID0gZnVuY3Rpb24gKHZpcnR1YWxDb2wpIHtcbiAgICAgICAgdmFyIHJlYWxDb2wgPSB2aWV3UG9ydC50b1JlYWxDb2wodmlydHVhbENvbCk7XG4gICAgICAgIHJldHVybiAhaXNOYU4ocmVhbENvbCkgJiYgZ2V0TGVuZ3RoQmV0d2VlblZpZXdDb29yZHMoMCwgcmVhbENvbCwgJ2NvbCcsICd3aWR0aCcsIHRydWUpIDwgdmlld1BvcnQud2lkdGg7XG4gICAgfTtcblxuXG4vL2RlZmF1bHQgdW5jbGFtcGVkIGNhdXNlIHRoYXQgc2VlbXMgdG8gYmUgdGhlIG1vcmUgbGlrZWx5IHVzZSBjYXNlIGNvbnZlcnRpbmcgdGhpcyBkaXJlY3Rpb25cbiAgICB2aWV3UG9ydC50b1JlYWxSb3cgPSBmdW5jdGlvbiAodmlydHVhbFJvdykge1xuICAgICAgICByZXR1cm4gZ2V0UmVhbFJvd0NvbENsYW1wZWQodmlydHVhbFJvdywgJ3JvdycpO1xuICAgIH07XG5cbiAgICB2aWV3UG9ydC50b1JlYWxDb2wgPSBmdW5jdGlvbiAodmlydHVhbENvbCkge1xuICAgICAgICByZXR1cm4gZ2V0UmVhbFJvd0NvbENsYW1wZWQodmlydHVhbENvbCwgJ2NvbCcpO1xuICAgIH07XG5cbiAgICB2aWV3UG9ydC5jbGFtcFJvdyA9IGZ1bmN0aW9uIChyKSB7XG4gICAgICAgIHJldHVybiB1dGlsLmNsYW1wKHIsIDAsIHZpZXdQb3J0LnJvd3MgLSAxKTtcbiAgICB9O1xuXG4gICAgdmlld1BvcnQuY2xhbXBDb2wgPSBmdW5jdGlvbiAoYykge1xuICAgICAgICByZXR1cm4gdXRpbC5jbGFtcChjLCAwLCB2aWV3UG9ydC5jb2xzIC0gMSk7XG4gICAgfTtcblxuICAgIHZpZXdQb3J0LmNsYW1wWSA9IGZ1bmN0aW9uICh5KSB7XG4gICAgICAgIHJldHVybiB1dGlsLmNsYW1wKHksIDAsIHZpZXdQb3J0LmhlaWdodCk7XG4gICAgfTtcblxuICAgIHZpZXdQb3J0LmNsYW1wWCA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIHJldHVybiB1dGlsLmNsYW1wKHgsIDAsIHZpZXdQb3J0LndpZHRoKTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZ2V0TGVuZ3RoQmV0d2VlblZpZXdDb29yZHMoc3RhcnRDb29yZCwgZW5kQ29vcmQsIHJvd09yQ29sLCBoZWlnaHRPcldpZHRoLCBpbmNsdXNpdmUpIHtcbiAgICAgICAgdmFyIHJvd09yQ29sQ2FwID0gY2FwaXRhbGl6ZShyb3dPckNvbCk7XG4gICAgICAgIHZhciB0b1ZpcnR1YWwgPSB2aWV3UG9ydFsndG9WaXJ0dWFsJyArIHJvd09yQ29sQ2FwXTtcbiAgICAgICAgdmFyIGxlbmd0aEZuID0gZ3JpZC52aXJ0dWFsUGl4ZWxDZWxsTW9kZWxbaGVpZ2h0T3JXaWR0aF07XG4gICAgICAgIHZhciBjbGFtcEZuID0gdmlld1BvcnRbJ2NsYW1wJyArIHJvd09yQ29sQ2FwXTtcbiAgICAgICAgdmFyIHBvcyA9IDA7XG4gICAgICAgIHZhciBudW1GaXhlZCA9IGdldEZpeGVkKHJvd09yQ29sKTtcbiAgICAgICAgdmFyIGlzSW5Ob25maXhlZEFyZWEgPSBlbmRDb29yZCA+PSBudW1GaXhlZDtcbiAgICAgICAgdmFyIGlzSW5GaXhlZEFyZWEgPSBzdGFydENvb3JkIDwgbnVtRml4ZWQ7XG4gICAgICAgIHZhciBleGNsdXNpdmVPZmZzZXQgPSAoaW5jbHVzaXZlID8gMCA6IDEpO1xuICAgICAgICBpZiAoaXNJbkZpeGVkQXJlYSkge1xuICAgICAgICAgICAgdmFyIGZpeGVkRW5kQ29vcmQgPSAoaXNJbk5vbmZpeGVkQXJlYSA/IG51bUZpeGVkIC0gMSA6IGVuZENvb3JkIC0gZXhjbHVzaXZlT2Zmc2V0KTtcbiAgICAgICAgICAgIHBvcyArPSBsZW5ndGhGbihzdGFydENvb3JkLCBmaXhlZEVuZENvb3JkKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNJbk5vbmZpeGVkQXJlYSkge1xuICAgICAgICAgICAgcG9zICs9IGxlbmd0aEZuKChpc0luRml4ZWRBcmVhID8gdG9WaXJ0dWFsKG51bUZpeGVkKSA6IHRvVmlydHVhbChzdGFydENvb3JkKSksIHRvVmlydHVhbChjbGFtcEZuKGVuZENvb3JkKSkgLSBleGNsdXNpdmVPZmZzZXQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3M7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0VG9wT3JMZWZ0KGVuZENvb3JkLCByb3dPckNvbCwgaGVpZ2h0T3JXaWR0aCkge1xuICAgICAgICByZXR1cm4gZ2V0TGVuZ3RoQmV0d2VlblZpZXdDb29yZHMoMCwgZW5kQ29vcmQsIHJvd09yQ29sLCBoZWlnaHRPcldpZHRoKTtcbiAgICB9XG5cbiAgICB2aWV3UG9ydC5nZXRSb3dUb3AgPSBmdW5jdGlvbiAodmlld1BvcnRDb29yZCkge1xuICAgICAgICByZXR1cm4gZ2V0VG9wT3JMZWZ0KHZpZXdQb3J0Q29vcmQsICdyb3cnLCAnaGVpZ2h0Jyk7XG4gICAgfTtcblxuICAgIHZpZXdQb3J0LmdldENvbExlZnQgPSBmdW5jdGlvbiAodmlld1BvcnRDb2wpIHtcbiAgICAgICAgcmV0dXJuIGdldFRvcE9yTGVmdCh2aWV3UG9ydENvbCwgJ2NvbCcsICd3aWR0aCcpO1xuICAgIH07XG5cbiAgICB2aWV3UG9ydC50b1B4ID0gZnVuY3Rpb24gKHJlYWxDZWxsUmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHRvcDogdmlld1BvcnQuZ2V0Um93VG9wKHJlYWxDZWxsUmFuZ2UudG9wKSxcbiAgICAgICAgICAgIGxlZnQ6IHZpZXdQb3J0LmdldENvbExlZnQocmVhbENlbGxSYW5nZS5sZWZ0KSxcbiAgICAgICAgICAgIGhlaWdodDogZ2V0TGVuZ3RoQmV0d2VlblZpZXdDb29yZHMocmVhbENlbGxSYW5nZS50b3AsIHJlYWxDZWxsUmFuZ2UudG9wICsgcmVhbENlbGxSYW5nZS5oZWlnaHQgLSAxLCAncm93JywgJ2hlaWdodCcsIHRydWUpLFxuICAgICAgICAgICAgd2lkdGg6IGdldExlbmd0aEJldHdlZW5WaWV3Q29vcmRzKHJlYWxDZWxsUmFuZ2UubGVmdCwgcmVhbENlbGxSYW5nZS5sZWZ0ICsgcmVhbENlbGxSYW5nZS53aWR0aCAtIDEsICdjb2wnLCAnd2lkdGgnLCB0cnVlKVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBnZXRSb3dPckNvbEZyb21Qb3NpdGlvbihwb3MsIHJvd09yQ29sLCBoZWlnaHRPcldpZHRoLCByZXR1cm5WaXJ0dWFsKSB7XG4gICAgICAgIC8vd2UgY291bGQgZG8gdGhpcyBzbGlnaGx5IGZhc3RlciB3aXRoIGJpbmFyeSBzZWFyY2ggdG8gZ2V0IGxvZyhuKSBpbnN0ZWFkIG9mIG4sIGJ1dCB3aWxsIG9ubHkgZG8gaXQgaWYgd2UgYWN0dWFsbHkgbmVlZCB0byBvcHRpbWl6ZSB0aGlzXG4gICAgICAgIHZhciByb3dPckNvbENhcCA9IGNhcGl0YWxpemUocm93T3JDb2wpO1xuICAgICAgICB2YXIgdmlld01heCA9IHZpZXdQb3J0W3Jvd09yQ29sICsgJ3MnXTtcbiAgICAgICAgdmFyIHRvVmlydHVhbCA9IHZpZXdQb3J0Wyd0b1ZpcnR1YWwnICsgcm93T3JDb2xDYXBdO1xuICAgICAgICB2YXIgbGVuZ3RoRm4gPSBncmlkLnZpcnR1YWxQaXhlbENlbGxNb2RlbFtoZWlnaHRPcldpZHRoXTtcbiAgICAgICAgdmFyIHN1bW1lZExlbmd0aCA9IDA7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmlld01heDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgdmlydHVhbCA9IHRvVmlydHVhbChpKTtcbiAgICAgICAgICAgIHZhciBsZW5ndGggPSBsZW5ndGhGbih2aXJ0dWFsKTtcbiAgICAgICAgICAgIHZhciBuZXdTdW0gPSBzdW1tZWRMZW5ndGggKyBsZW5ndGg7XG4gICAgICAgICAgICBpZiAobmV3U3VtID4gcG9zKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJldHVyblZpcnR1YWwgPyB2aXJ0dWFsIDogaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN1bW1lZExlbmd0aCA9IG5ld1N1bTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gTmFOO1xuICAgIH1cblxuICAgIHZpZXdQb3J0LmdldFZpcnR1YWxSb3dCeVRvcCA9IGZ1bmN0aW9uICh0b3ApIHtcbiAgICAgICAgcmV0dXJuIGdldFJvd09yQ29sRnJvbVBvc2l0aW9uKHRvcCwgJ3JvdycsICdoZWlnaHQnLCB0cnVlKTtcbiAgICB9O1xuXG4gICAgdmlld1BvcnQuZ2V0VmlydHVhbENvbEJ5TGVmdCA9IGZ1bmN0aW9uIChsZWZ0KSB7XG4gICAgICAgIHJldHVybiBnZXRSb3dPckNvbEZyb21Qb3NpdGlvbihsZWZ0LCAnY29sJywgJ3dpZHRoJywgdHJ1ZSk7XG4gICAgfTtcblxuICAgIHZpZXdQb3J0LmdldFJvd0J5VG9wID0gZnVuY3Rpb24gKHRvcCkge1xuICAgICAgICByZXR1cm4gZ2V0Um93T3JDb2xGcm9tUG9zaXRpb24odG9wLCAncm93JywgJ2hlaWdodCcpO1xuICAgIH07XG5cbiAgICB2aWV3UG9ydC5nZXRDb2xCeUxlZnQgPSBmdW5jdGlvbiAobGVmdCkge1xuICAgICAgICByZXR1cm4gZ2V0Um93T3JDb2xGcm9tUG9zaXRpb24obGVmdCwgJ2NvbCcsICd3aWR0aCcpO1xuICAgIH07XG5cbiAgICB2aWV3UG9ydC5nZXRSb3dIZWlnaHQgPSBmdW5jdGlvbiAodmlld1BvcnRSb3cpIHtcbiAgICAgICAgcmV0dXJuIGdyaWQudmlydHVhbFBpeGVsQ2VsbE1vZGVsLmhlaWdodCh2aWV3UG9ydC50b1ZpcnR1YWxSb3codmlld1BvcnQuY2xhbXBSb3codmlld1BvcnRSb3cpKSk7XG4gICAgfTtcblxuICAgIHZpZXdQb3J0LmdldENvbFdpZHRoID0gZnVuY3Rpb24gKHZpZXdQb3J0Q29sKSB7XG4gICAgICAgIHJldHVybiBncmlkLnZpcnR1YWxQaXhlbENlbGxNb2RlbC53aWR0aCh2aWV3UG9ydC50b1ZpcnR1YWxDb2wodmlld1BvcnQuY2xhbXBDb2wodmlld1BvcnRDb2wpKSk7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGludGVyc2VjdFJvd3NPckNvbHMoaW50ZXJzZWN0aW9uLCByYW5nZSwgdG9wT3JMZWZ0LCByb3dPckNvbCwgaGVpZ2h0T3JXaWR0aCkge1xuICAgICAgICB2YXIgbnVtRml4ZWQgPSBmaXhlZFtyb3dPckNvbCArICdzJ107XG4gICAgICAgIHZhciBmaXhlZFJhbmdlID0gWzAsIG51bUZpeGVkXTtcblxuICAgICAgICB2YXIgdmlydHVhbFJhbmdlID0gW3JhbmdlW3RvcE9yTGVmdF0sIHJhbmdlW2hlaWdodE9yV2lkdGhdXTtcbiAgICAgICAgdmFyIGZpeGVkSW50ZXJzZWN0aW9uID0gcmFuZ2VVdGlsLmludGVyc2VjdChmaXhlZFJhbmdlLCB2aXJ0dWFsUmFuZ2UpO1xuICAgICAgICB2YXIgc2Nyb2xsUmFuZ2UgPSBbbnVtRml4ZWQsIHZpZXdQb3J0W3Jvd09yQ29sICsgJ3MnXSAtIG51bUZpeGVkXTtcbiAgICAgICAgdmlydHVhbFJhbmdlWzBdIC09IGdyaWQuY2VsbFNjcm9sbE1vZGVsW3Jvd09yQ29sXTtcbiAgICAgICAgdmFyIHNjcm9sbEludGVyc2VjdGlvbiA9IHJhbmdlVXRpbC5pbnRlcnNlY3Qoc2Nyb2xsUmFuZ2UsIHZpcnR1YWxSYW5nZSk7XG4gICAgICAgIHZhciByZXN1bHRSYW5nZSA9IHJhbmdlVXRpbC51bmlvbihmaXhlZEludGVyc2VjdGlvbiwgc2Nyb2xsSW50ZXJzZWN0aW9uKTtcbiAgICAgICAgaWYgKCFyZXN1bHRSYW5nZSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpbnRlcnNlY3Rpb25bdG9wT3JMZWZ0XSA9IHJlc3VsdFJhbmdlWzBdO1xuICAgICAgICBpbnRlcnNlY3Rpb25baGVpZ2h0T3JXaWR0aF0gPSByZXN1bHRSYW5nZVsxXTtcbiAgICAgICAgcmV0dXJuIGludGVyc2VjdGlvbjtcbiAgICB9XG5cbiAgICB2aWV3UG9ydC5pbnRlcnNlY3QgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgICAgICAgLy9hc3N1bWUgdmlydHVhbCBjZWxscyBmb3Igbm93XG4gICAgICAgIHZhciBpbnRlcnNlY3Rpb24gPSBpbnRlcnNlY3RSb3dzT3JDb2xzKHt9LCByYW5nZSwgJ3RvcCcsICdyb3cnLCAnaGVpZ2h0Jyk7XG4gICAgICAgIGlmICghaW50ZXJzZWN0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW50ZXJzZWN0Um93c09yQ29scyhpbnRlcnNlY3Rpb24sIHJhbmdlLCAnbGVmdCcsICdjb2wnLCAnd2lkdGgnKTtcbiAgICB9O1xuXG5cbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVNYXhMZW5ndGhzKHRvdGFsTGVuZ3RoLCBsZW5ndGhNb2RlbCkge1xuICAgICAgICB2YXIgbGVuZ3RoTWV0aG9kID0gbGVuZ3RoTW9kZWwud2lkdGggJiYgZ3JpZC52aXJ0dWFsUGl4ZWxDZWxsTW9kZWwud2lkdGggfHwgZ3JpZC52aXJ0dWFsUGl4ZWxDZWxsTW9kZWwuaGVpZ2h0O1xuICAgICAgICB2YXIgbnVtRml4ZWQgPSBsZW5ndGhNb2RlbC5udW1GaXhlZCgpO1xuICAgICAgICB2YXIgd2luZG93TGVuZ3RoID0gMDtcbiAgICAgICAgdmFyIG1heFNpemUgPSAwO1xuICAgICAgICB2YXIgZml4ZWRMZW5ndGggPSAwO1xuICAgICAgICB2YXIgd2luZG93U3RhcnRJbmRleCA9IG51bUZpeGVkO1xuXG4gICAgICAgIGZvciAodmFyIGZpeGVkID0gMDsgZml4ZWQgPCBudW1GaXhlZDsgZml4ZWQrKykge1xuICAgICAgICAgICAgZml4ZWRMZW5ndGggKz0gbGVuZ3RoTWV0aG9kKGZpeGVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vaXQgbWlnaHQgYmUgc2FmZXIgdG8gYWN0dWFsbHkgc3VtIHRoZSBsZW5ndGhzIGluIHRoZSB2aXJ0dWFsUGl4ZWxDZWxsTW9kZWwgYnV0IGZvciBub3cgaGVyZSBpcyBva1xuICAgICAgICBmb3IgKHZhciBpbmRleCA9IG51bUZpeGVkOyBpbmRleCA8IGxlbmd0aE1vZGVsLmxlbmd0aCh0cnVlKTsgaW5kZXgrKykge1xuICAgICAgICAgICAgd2luZG93TGVuZ3RoICs9IGxlbmd0aE1ldGhvZChpbmRleCk7XG4gICAgICAgICAgICB3aGlsZSAod2luZG93TGVuZ3RoICsgZml4ZWRMZW5ndGggPiB0b3RhbExlbmd0aCAmJiB3aW5kb3dTdGFydEluZGV4IDwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICB3aW5kb3dMZW5ndGggLT0gbGVuZ3RoTWV0aG9kKGluZGV4KTtcbiAgICAgICAgICAgICAgICB3aW5kb3dTdGFydEluZGV4Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgd2luZG93U2l6ZSA9IGluZGV4IC0gd2luZG93U3RhcnRJbmRleCArIDE7IC8vIGFkZCB0aGUgb25lIGJlY2F1c2Ugd2Ugd2FudCB0aGUgbGFzdCBpbmRleCB0aGF0IGRpZG4ndCBmaXRcbiAgICAgICAgICAgIGlmICh3aW5kb3dTaXplID4gbWF4U2l6ZSkge1xuICAgICAgICAgICAgICAgIG1heFNpemUgPSB3aW5kb3dTaXplO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1heFNpemUgKyBudW1GaXhlZCArIDE7XG4gICAgfVxuXG5cbiAgICB2aWV3UG9ydC5pdGVyYXRlQ2VsbHMgPSBmdW5jdGlvbiAoY2VsbEZuLCBvcHRpb25hbFJvd0ZuLCBvcHRpb25hbE1heFJvdywgb3B0aW9uYWxNYXhDb2wpIHtcbiAgICAgICAgb3B0aW9uYWxNYXhSb3cgPSBvcHRpb25hbE1heFJvdyB8fCBJbmZpbml0eTtcbiAgICAgICAgb3B0aW9uYWxNYXhDb2wgPSBvcHRpb25hbE1heENvbCB8fCBJbmZpbml0eTtcbiAgICAgICAgZm9yICh2YXIgciA9IDA7IHIgPCBNYXRoLm1pbih2aWV3UG9ydC5yb3dzLCBvcHRpb25hbE1heFJvdyk7IHIrKykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbmFsUm93Rm4pIHtcbiAgICAgICAgICAgICAgICBvcHRpb25hbFJvd0ZuKHIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNlbGxGbikge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGMgPSAwOyBjIDwgTWF0aC5taW4odmlld1BvcnQuY29scywgb3B0aW9uYWxNYXhDb2wpOyBjKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY2VsbEZuKHIsIGMpO1xuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiB2aWV3UG9ydDtcbn0iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJ0BncmlkL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2dyaWQpIHtcbiAgICB2YXIgZ3JpZCA9IF9ncmlkO1xuICAgIHZhciBtb2RlbCA9IHt9O1xuXG4gICAgLy9hbGwgcGl4ZWxzIGFyZSBhc3N1bWVkIHRvIGJlIGluIHRoZSB2aXJ0dWFsIHdvcmxkLCBubyByZWFsIHdvcmxkIHBpeGVscyBhcmUgZGVhbHQgd2l0aCBoZXJlIDopXG4gICAgbW9kZWwuZ2V0Um93ID0gZnVuY3Rpb24gKHRvcFB4KSB7XG4gICAgICAgIGlmICh0b3BQeCA8IDApIHtcbiAgICAgICAgICAgIHJldHVybiBOYU47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHN1bUxlbmd0aCA9IDA7XG4gICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgZ3JpZC5yb3dNb2RlbC5sZW5ndGgodHJ1ZSk7IHIrKykge1xuICAgICAgICAgICAgc3VtTGVuZ3RoICs9IGdyaWQucm93TW9kZWwuaGVpZ2h0KHIpO1xuICAgICAgICAgICAgaWYgKHRvcFB4IDwgc3VtTGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE5hTjtcbiAgICB9O1xuXG4gICAgLy95ZXMgdGhlc2UgYXJlIHZlcnkgc2ltaWxhciBidXQgdGhlcmUgd2lsbCBiZSBkaWZmZXJlbmNlc1xuICAgIG1vZGVsLmdldENvbCA9IGZ1bmN0aW9uIChsZWZ0UHgpIHtcbiAgICAgICAgaWYgKGxlZnRQeCA8IDApIHtcbiAgICAgICAgICAgIHJldHVybiBOYU47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHN1bUxlbmd0aCA9IDA7XG4gICAgICAgIGZvciAodmFyIGMgPSAwOyBjIDwgZ3JpZC5jb2xNb2RlbC5sZW5ndGgodHJ1ZSk7IGMrKykge1xuICAgICAgICAgICAgc3VtTGVuZ3RoICs9IGdyaWQuY29sTW9kZWwud2lkdGgoYyk7XG4gICAgICAgICAgICBpZiAobGVmdFB4IDwgc3VtTGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE5hTjtcbiAgICB9O1xuXG5cbiAgICBmdW5jdGlvbiBjbGFtcFJvd09yQ29sKHZpcnR1YWxSb3dDb2wsIHJvd09yQ29sKSB7XG4gICAgICAgIHZhciBtYXhSb3dDb2wgPSBncmlkW3Jvd09yQ29sICsgJ01vZGVsJ10ubGVuZ3RoKHRydWUpIC0gMTtcbiAgICAgICAgcmV0dXJuIHV0aWwuY2xhbXAodmlydHVhbFJvd0NvbCwgMCwgbWF4Um93Q29sKTtcbiAgICB9XG5cbiAgICBtb2RlbC5jbGFtcFJvdyA9IGZ1bmN0aW9uICh2aXJ0dWFsUm93KSB7XG4gICAgICAgIHJldHVybiBjbGFtcFJvd09yQ29sKHZpcnR1YWxSb3csICdyb3cnKTtcbiAgICB9O1xuXG4gICAgbW9kZWwuY2xhbXBDb2wgPSBmdW5jdGlvbiAodmlydHVhbENvbCkge1xuICAgICAgICByZXR1cm4gY2xhbXBSb3dPckNvbCh2aXJ0dWFsQ29sLCAnY29sJyk7XG4gICAgfTtcblxuICAgIC8vZm9yIG5vdyB0aGVzZSBqdXN0IGNhbGwgdGhyb3VnaCB0byB0aGUgcm93IGFuZCBjb2x1bW4gbW9kZWwsIGJ1dCB2ZXJ5IGxpa2VseSBpdCB3aWxsIG5lZWQgdG8gaW5jbHVkZSBzb21lIG90aGVyIGNhbGN1bGF0aW9uc1xuICAgIG1vZGVsLmhlaWdodCA9IGZ1bmN0aW9uICh2aXJ0dWFsUm93U3RhcnQsIHZpcnR1YWxSb3dFbmQpIHtcbiAgICAgICAgcmV0dXJuIGhlaWdodE9yV2lkdGgodmlydHVhbFJvd1N0YXJ0LCB2aXJ0dWFsUm93RW5kLCAncm93Jyk7XG4gICAgfTtcblxuICAgIG1vZGVsLndpZHRoID0gZnVuY3Rpb24gKHZpcnR1YWxDb2xTdGFydCwgdmlydHVhbENvbEVuZCkge1xuICAgICAgICByZXR1cm4gaGVpZ2h0T3JXaWR0aCh2aXJ0dWFsQ29sU3RhcnQsIHZpcnR1YWxDb2xFbmQsICdjb2wnKTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gaGVpZ2h0T3JXaWR0aChzdGFydCwgZW5kLCByb3dPckNvbCkge1xuICAgICAgICB2YXIgbGVuZ3RoID0gMDtcbiAgICAgICAgaWYgKGVuZCA8IHN0YXJ0KSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBlbmQgPSB1dGlsLmlzTnVtYmVyKGVuZCkgPyBlbmQgOiBzdGFydDtcbiAgICAgICAgZW5kID0gY2xhbXBSb3dPckNvbChlbmQsIHJvd09yQ29sKTtcbiAgICAgICAgc3RhcnQgPSBjbGFtcFJvd09yQ29sKHN0YXJ0LCByb3dPckNvbCk7XG4gICAgICAgIHZhciBsZW5ndGhNb2RlbCA9IGdyaWRbcm93T3JDb2wgKyAnTW9kZWwnXTtcbiAgICAgICAgdmFyIGxlbmd0aEZuID0gbGVuZ3RoTW9kZWwud2lkdGggfHwgbGVuZ3RoTW9kZWwuaGVpZ2h0O1xuICAgICAgICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPD0gZW5kOyBpKyspIHtcbiAgICAgICAgICAgIGxlbmd0aCArPSBsZW5ndGhGbihpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGVuZ3RoO1xuICAgIH1cblxuICAgIG1vZGVsLnRvdGFsSGVpZ2h0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbW9kZWwuaGVpZ2h0KDAsIGdyaWQucm93TW9kZWwubGVuZ3RoKHRydWUpIC0gMSk7XG4gICAgfTtcblxuICAgIG1vZGVsLnRvdGFsV2lkdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBtb2RlbC53aWR0aCgwLCBncmlkLmNvbE1vZGVsLmxlbmd0aCh0cnVlKSAtIDEpO1xuICAgIH07XG5cbiAgICBtb2RlbC5maXhlZEhlaWdodCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIG1vZGVsLmhlaWdodCgwLCBncmlkLnJvd01vZGVsLm51bUZpeGVkKCkgLSAxKTtcbiAgICB9O1xuXG4gICAgbW9kZWwuZml4ZWRXaWR0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIG1vZGVsLndpZHRoKDAsIGdyaWQuY29sTW9kZWwubnVtRml4ZWQoKSAtIDEpO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBzaXplQ2hhbmdlTGlzdGVuZXIoKSB7XG4gICAgICAgIC8vZm9yIG5vdyB3ZSBkb24ndCBjYWNoZSBhbnl0aGluZyBhYm91dCB0aGlzIHNvIHdlIGp1c3Qgbm90aWZ5XG4gICAgICAgIGdyaWQuZXZlbnRMb29wLmZpcmUoJ2dyaWQtdmlydHVhbC1waXhlbC1jZWxsLWNoYW5nZScpO1xuICAgIH1cblxuICAgIGdyaWQuZXZlbnRMb29wLmJpbmQoJ2dyaWQtY29sLWNoYW5nZScsIHNpemVDaGFuZ2VMaXN0ZW5lcik7XG4gICAgZ3JpZC5ldmVudExvb3AuYmluZCgnZ3JpZC1yb3ctY2hhbmdlJywgc2l6ZUNoYW5nZUxpc3RlbmVyKTtcblxuICAgIHJldHVybiBtb2RlbDtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gIHJldHVybiBzdHJpbmcuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHJpbmcuc3Vic3RyaW5nKDEpO1xufVxuXG5tb2R1bGUuZXhwb3J0cy53b3JkcyA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC8oXnxcXFcpKFxcdykvZywgZnVuY3Rpb24gKG0pIHtcbiAgICByZXR1cm4gbS50b1VwcGVyQ2FzZSgpXG4gIH0pXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdHMpIHtcbiAgcmV0dXJuIG5ldyBFbGVtZW50Q2xhc3Mob3B0cylcbn1cblxuZnVuY3Rpb24gRWxlbWVudENsYXNzKG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEVsZW1lbnRDbGFzcykpIHJldHVybiBuZXcgRWxlbWVudENsYXNzKG9wdHMpXG4gIHZhciBzZWxmID0gdGhpc1xuICBpZiAoIW9wdHMpIG9wdHMgPSB7fVxuXG4gIC8vIHNpbWlsYXIgZG9pbmcgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCBidXQgd29ya3MgaW4gSUU4XG4gIGlmIChvcHRzLm5vZGVUeXBlKSBvcHRzID0ge2VsOiBvcHRzfVxuXG4gIHRoaXMub3B0cyA9IG9wdHNcbiAgdGhpcy5lbCA9IG9wdHMuZWwgfHwgZG9jdW1lbnQuYm9keVxuICBpZiAodHlwZW9mIHRoaXMuZWwgIT09ICdvYmplY3QnKSB0aGlzLmVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLmVsKVxufVxuXG5FbGVtZW50Q2xhc3MucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGNsYXNzTmFtZSkge1xuICB2YXIgZWwgPSB0aGlzLmVsXG4gIGlmICghZWwpIHJldHVyblxuICBpZiAoZWwuY2xhc3NOYW1lID09PSBcIlwiKSByZXR1cm4gZWwuY2xhc3NOYW1lID0gY2xhc3NOYW1lXG4gIHZhciBjbGFzc2VzID0gZWwuY2xhc3NOYW1lLnNwbGl0KCcgJylcbiAgaWYgKGNsYXNzZXMuaW5kZXhPZihjbGFzc05hbWUpID4gLTEpIHJldHVybiBjbGFzc2VzXG4gIGNsYXNzZXMucHVzaChjbGFzc05hbWUpXG4gIGVsLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpXG4gIHJldHVybiBjbGFzc2VzXG59XG5cbkVsZW1lbnRDbGFzcy5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24oY2xhc3NOYW1lKSB7XG4gIHZhciBlbCA9IHRoaXMuZWxcbiAgaWYgKCFlbCkgcmV0dXJuXG4gIGlmIChlbC5jbGFzc05hbWUgPT09IFwiXCIpIHJldHVyblxuICB2YXIgY2xhc3NlcyA9IGVsLmNsYXNzTmFtZS5zcGxpdCgnICcpXG4gIHZhciBpZHggPSBjbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKVxuICBpZiAoaWR4ID4gLTEpIGNsYXNzZXMuc3BsaWNlKGlkeCwgMSlcbiAgZWwuY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJylcbiAgcmV0dXJuIGNsYXNzZXNcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgdmFyIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoJyAnKVxuICByZXR1cm4gY2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSkgPiAtMVxufVxuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjMuM1xuKGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIGFsbnVtLCByZWY7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi4vcmVmJykucmVmO1xuXG4gIGFsbnVtID0ge1xuICAgICcwJzogcmVmKCcwJywgNDgpLFxuICAgICcxJzogcmVmKCcxJywgNDkpLFxuICAgICcyJzogcmVmKCcyJywgNTApLFxuICAgICczJzogcmVmKCczJywgNTEpLFxuICAgICc0JzogcmVmKCc0JywgNTIpLFxuICAgICc1JzogcmVmKCc1JywgNTMpLFxuICAgICc2JzogcmVmKCc2JywgNTQpLFxuICAgICc3JzogcmVmKCc3JywgNTUpLFxuICAgICc4JzogcmVmKCc4JywgNTYpLFxuICAgICc5JzogcmVmKCc5JywgNTcpLFxuICAgIGE6IHJlZignQScsIDY1KSxcbiAgICBiOiByZWYoJ0InLCA2NiksXG4gICAgYzogcmVmKCdDJywgNjcpLFxuICAgIGQ6IHJlZignRCcsIDY4KSxcbiAgICBlOiByZWYoJ0UnLCA2OSksXG4gICAgZjogcmVmKCdGJywgNzApLFxuICAgIGc6IHJlZignRycsIDcxKSxcbiAgICBoOiByZWYoJ0gnLCA3MiksXG4gICAgaTogcmVmKCdJJywgNzMpLFxuICAgIGo6IHJlZignSicsIDc0KSxcbiAgICBrOiByZWYoJ0snLCA3NSksXG4gICAgbDogcmVmKCdMJywgNzYpLFxuICAgIG06IHJlZignTScsIDc3KSxcbiAgICBuOiByZWYoJ04nLCA3OCksXG4gICAgbzogcmVmKCdPJywgNzkpLFxuICAgIHA6IHJlZignUCcsIDgwKSxcbiAgICBxOiByZWYoJ1EnLCA4MSksXG4gICAgcjogcmVmKCdSJywgODIpLFxuICAgIHM6IHJlZignUycsIDgzKSxcbiAgICB0OiByZWYoJ1QnLCA4NCksXG4gICAgdTogcmVmKCdVJywgODUpLFxuICAgIHY6IHJlZignVicsIDg2KSxcbiAgICB3OiByZWYoJ1cnLCA4NyksXG4gICAgeDogcmVmKCdYJywgODgpLFxuICAgIHk6IHJlZignWScsIDg5KSxcbiAgICB6OiByZWYoJ1onLCA5MClcbiAgfTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IGFsbnVtO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjMuM1xuKGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIGFycm93LCByZWY7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi4vcmVmJykucmVmO1xuXG4gIGFycm93ID0ge1xuICAgIGxlZnQ6IHJlZignTGVmdCcsIDM3KSxcbiAgICB1cDogcmVmKCdVcCcsIDM4KSxcbiAgICByaWdodDogcmVmKCdSaWdodCcsIDM5KSxcbiAgICBkb3duOiByZWYoJ0Rvd24nLCA0MClcbiAgfTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IGFycm93O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjMuM1xuKGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIGJyYW5kLCByZWY7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi4vcmVmJykucmVmO1xuXG4gIGJyYW5kID0ge1xuICAgIGFwcGxlOiByZWYoJ0FwcGxlICYjODk4NDsnLCAyMjQpLFxuICAgIHdpbmRvd3M6IHtcbiAgICAgIHN0YXJ0OiByZWYoJ1dpbmRvd3Mgc3RhcnQnLCBbOTEsIDkyXSksXG4gICAgICBtZW51OiByZWYoJ1dpbmRvd3MgbWVudScsIDkzKVxuICAgIH1cbiAgfTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IGJyYW5kO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjMuM1xuKGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIHB1bmN0dWF0aW9uLCByZWY7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi4vcmVmJykucmVmO1xuXG4gIHB1bmN0dWF0aW9uID0ge1xuICAgIGNvbG9uOiByZWYoJ0NvbG9uL1NlbWljb2xvbicsIFs1OSwgMTg2XSksXG4gICAgZXF1YWw6IHJlZignRXF1YWwvUGx1cycsIFs2MSwgMTg3XSksXG4gICAgY29tbWE6IHJlZignQ29tbWEvTGVzcyBUaGFuJywgWzQ0LCAxODhdKSxcbiAgICBoeXBoZW46IHJlZignSHlwaGVuL1VuZGVyc2NvcmUnLCBbNDUsIDEwOSwgMTg5XSksXG4gICAgcGVyaW9kOiByZWYoJ1BlcmlvZC9HcmVhdGVyIFRoYW4nLCBbNDYsIDE5MF0pLFxuICAgIHRpbGRlOiByZWYoJ1RpbGRlL0JhY2sgVGljaycsIFs5NiwgMTkyXSksXG4gICAgYXBvc3Ryb3BoZTogcmVmKCdBcG9zdHJvcGhlL1F1b3RlJywgWzM5LCAyMjJdKSxcbiAgICBzbGFzaDoge1xuICAgICAgZm9yd2FyZDogcmVmKCdGb3J3YXJkIFNsYXNoL1F1ZXN0aW9uIE1hcmsnLCBbNDcsIDE5MV0pLFxuICAgICAgYmFja3dhcmQ6IHJlZignQmFja3dhcmQgU2xhc2gvUGlwZScsIDIyMClcbiAgICB9LFxuICAgIGJyYWNlOiB7XG4gICAgICBzcXVhcmU6IHtcbiAgICAgICAgb3BlbjogcmVmKCdPcGVuIFNxdWFyZS9DdXJseSBCcmFjZScsIDIxOSksXG4gICAgICAgIGNsb3NlOiByZWYoJ0Nsb3NlIFNxdWFyZS9DdXJseSBCcmFjZScsIDIyMSlcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgcHVuY3R1YXRpb24uc2VtaWNvbG9uID0gcHVuY3R1YXRpb24uY29sb247XG5cbiAgcHVuY3R1YXRpb24ucGx1cyA9IHB1bmN0dWF0aW9uLmVxdWFsO1xuXG4gIHB1bmN0dWF0aW9uLmxlc3N0aGFuID0gcHVuY3R1YXRpb24uY29tbWE7XG5cbiAgcHVuY3R1YXRpb24udW5kZXJzY29yZSA9IHB1bmN0dWF0aW9uLmh5cGhlbjtcblxuICBwdW5jdHVhdGlvbi5ncmVhdGVydGhhbiA9IHB1bmN0dWF0aW9uLnBlcmlvZDtcblxuICBwdW5jdHVhdGlvbi5xdWVzdGlvbiA9IHB1bmN0dWF0aW9uLnNsYXNoLmZvcndhcmQ7XG5cbiAgcHVuY3R1YXRpb24uYmFja3RpY2sgPSBwdW5jdHVhdGlvbi50aWxkZTtcblxuICBwdW5jdHVhdGlvbi5waXBlID0gcHVuY3R1YXRpb24uc2xhc2guYmFja3dhcmQ7XG5cbiAgcHVuY3R1YXRpb24ucXVvdGUgPSBwdW5jdHVhdGlvbi5hcG9zdHJvcGhlO1xuXG4gIHB1bmN0dWF0aW9uLmJyYWNlLmN1cmx5ID0gcHVuY3R1YXRpb24uYnJhY2Uuc3F1YXJlO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gcHVuY3R1YXRpb247XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuMy4zXG4oZnVuY3Rpb24oKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXIgcmVmLCBzcGVjaWFsO1xuXG4gIHJlZiA9IHJlcXVpcmUoJy4uL3JlZicpLnJlZjtcblxuICBzcGVjaWFsID0ge1xuICAgIGJhY2tzcGFjZTogcmVmKCdCYWNrc3BhY2UnLCA4KSxcbiAgICB0YWI6IHJlZignVGFiJywgOSksXG4gICAgZW50ZXI6IHJlZignRW50ZXInLCAxMyksXG4gICAgc2hpZnQ6IHJlZignU2hpZnQnLCAxNiksXG4gICAgY3RybDogcmVmKCdDdHJsJywgMTcpLFxuICAgIGFsdDogcmVmKCdBbHQnLCAxOCksXG4gICAgY2FwczogcmVmKCdDYXBzIExvY2snLCAyMCksXG4gICAgZXNjOiByZWYoJ0VzY2FwZScsIDI3KSxcbiAgICBzcGFjZTogcmVmKCdTcGFjZScsIDMyKSxcbiAgICBudW06IHJlZignTnVtIExvY2snLCAxNDQpXG4gIH07XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBzcGVjaWFsO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjMuM1xuKGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIGlzUmVmLCBpdGVyYXRvciwga2V5LFxuICAgIF90aGlzID0gdGhpcyxcbiAgICBfX2luZGV4T2YgPSBbXS5pbmRleE9mIHx8IGZ1bmN0aW9uKGl0ZW0pIHsgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmxlbmd0aDsgaSA8IGw7IGkrKykgeyBpZiAoaSBpbiB0aGlzICYmIHRoaXNbaV0gPT09IGl0ZW0pIHJldHVybiBpOyB9IHJldHVybiAtMTsgfSxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBpc1JlZiA9IHJlcXVpcmUoJy4vcmVmJykuaXNSZWY7XG5cbiAga2V5ID0ge307XG5cbiAga2V5LmNvZGUgPSB7XG4gICAgc3BlY2lhbDogcmVxdWlyZSgnLi9jb2RlL3NwZWNpYWwnKSxcbiAgICBhcnJvdzogcmVxdWlyZSgnLi9jb2RlL2Fycm93JyksXG4gICAgcHVuY3R1YXRpb246IHJlcXVpcmUoJy4vY29kZS9wdW5jdHVhdGlvbicpLFxuICAgIGFsbnVtOiByZXF1aXJlKCcuL2NvZGUvYWxudW0nKSxcbiAgICBicmFuZDogcmVxdWlyZSgnLi9jb2RlL2JyYW5kJylcbiAgfTtcblxuICBrZXkuZ2V0ID0gZnVuY3Rpb24ocHJlc3NlZCkge1xuICAgIHJldHVybiBpdGVyYXRvcihrZXkuY29kZSwgcHJlc3NlZCk7XG4gIH07XG5cbiAga2V5LmlzID0gZnVuY3Rpb24ocmVmLCBwcmVzc2VkKSB7XG4gICAgaWYgKCFpc1JlZihyZWYpKSB7XG4gICAgICByZWYgPSBpdGVyYXRvcihyZWYsIHByZXNzZWQpO1xuICAgIH1cbiAgICBpZiAoaXNSZWYocmVmKSkge1xuICAgICAgaWYgKGlzUmVmKHByZXNzZWQpKSB7XG4gICAgICAgIHJldHVybiBwcmVzc2VkID09PSByZWY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcHJlc3NlZCA9PT0gcmVmLmNvZGUgfHwgX19pbmRleE9mLmNhbGwocmVmLmNvZGUsIHByZXNzZWQpID49IDA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwcmVzc2VkID09PSByZWY7XG4gICAgfVxuICB9O1xuXG4gIGl0ZXJhdG9yID0gZnVuY3Rpb24oY29udGV4dCwgcHJlc3NlZCkge1xuICAgIHZhciBpLCBvdXQsIHJlZjtcbiAgICBmb3IgKGkgaW4gY29udGV4dCkge1xuICAgICAgaWYgKCFfX2hhc1Byb3AuY2FsbChjb250ZXh0LCBpKSkgY29udGludWU7XG4gICAgICByZWYgPSBjb250ZXh0W2ldO1xuICAgICAgaWYgKGlzUmVmKHJlZikpIHtcbiAgICAgICAgaWYgKGtleS5pcyhyZWYsIHByZXNzZWQpKSB7XG4gICAgICAgICAgcmV0dXJuIHJlZjtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0ID0gaXRlcmF0b3IocmVmLCBwcmVzc2VkKTtcbiAgICAgICAgaWYgKGlzUmVmKG91dCkpIHtcbiAgICAgICAgICByZXR1cm4gb3V0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHdpbmRvdy5rZXkgPSBrZXk7XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IGtleTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS4zLjNcbihmdW5jdGlvbigpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciBSZWZlcmVuY2UsIGFzc2VydFJlZiwgaXNSZWYsIHJlZjtcblxuICBSZWZlcmVuY2UgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICBmdW5jdGlvbiBSZWZlcmVuY2UobmFtZSwgY29kZSkge1xuICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgIHRoaXMuY29kZSA9IGNvZGU7XG4gICAgfVxuXG4gICAgcmV0dXJuIFJlZmVyZW5jZTtcblxuICB9KSgpO1xuXG4gIHJlZiA9IGZ1bmN0aW9uKG5hbWUsIGNvZGUpIHtcbiAgICByZXR1cm4gbmV3IFJlZmVyZW5jZShuYW1lLCBjb2RlKTtcbiAgfTtcblxuICBpc1JlZiA9IGZ1bmN0aW9uKHJlZikge1xuICAgIHJldHVybiByZWYgaW5zdGFuY2VvZiBSZWZlcmVuY2U7XG4gIH07XG5cbiAgYXNzZXJ0UmVmID0gZnVuY3Rpb24ocmVmKSB7XG4gICAgaWYgKCFpc1JlZihyZWYpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcmVmZXJlbmNlJyk7XG4gICAgfVxuICAgIHJldHVybiByZWY7XG4gIH07XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgcmVmOiByZWYsXG4gICAgaXNSZWY6IGlzUmVmLFxuICAgIGFzc2VydFJlZjogYXNzZXJ0UmVmXG4gIH07XG5cbn0pLmNhbGwodGhpcyk7XG4iXX0=