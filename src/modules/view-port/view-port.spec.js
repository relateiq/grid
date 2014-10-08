describe('view port', function () {

    var helper = require('@grid/grid-spec-helper')();
    var viewPort;
    var grid;

    var beforeEachFunction = function (varyHeights, varyWidths, frows, fcols) {
        grid = helper.buildSimpleGrid(100, 10, varyHeights, varyWidths, frows, fcols);
        viewPort = grid.viewLayer.viewPort;
        viewPort.sizeToContainer(helper.container);
    };
    beforeEach(beforeEachFunction);

    it('should accurately calculate the width and height of the container', function () {
        expect(viewPort.width).toEqual(helper.CONTAINER_WIDTH);
        expect(viewPort.height).toEqual(helper.CONTAINER_HEIGHT);
    });

    it('should fire an event when sized', function () {
        var spy = jasmine.createSpy();
        grid.eventLoop.bind('grid-viewport-change', spy);
        viewPort.sizeToContainer(helper.container);
        expect(spy).toHaveBeenCalled();
    });

    it('should calculate the max number of cells that could fit in the screen', function () {
        //basic test for default heights and widths

        var cols = Math.floor(helper.CONTAINER_WIDTH / 100) + 1;
        var rows = Math.floor(helper.CONTAINER_HEIGHT / 30) + 1;

        expect(viewPort.cols).toEqual(cols);
        expect(viewPort.rows).toEqual(rows);
    });

    it('should let you iterate the cells', function () {
        var spyFn = jasmine.createSpy();
        viewPort.iterateCells(spyFn);
        expect(spyFn).toHaveBeenCalledWith(0, 0);
        expect(spyFn).toHaveBeenCalledWith(5, 6);
        expect(spyFn).toHaveBeenCalledWith(viewPort.rows - 1, viewPort.cols - 1);
        expect(spyFn.callCount).toEqual(viewPort.cols * viewPort.rows);
    });

    it('should let you iterate the rows', function () {
        var spyFn = jasmine.createSpy();
        viewPort.iterateCells(undefined, spyFn);
        expect(spyFn).toHaveBeenCalledWith(0);
        expect(spyFn).toHaveBeenCalledWith(5);
        expect(spyFn).toHaveBeenCalledWith(viewPort.rows - 1);
        expect(spyFn.callCount).toEqual(viewPort.rows);
    });

    it('should let you iterate the rows to a max', function () {
        var spyFn = jasmine.createSpy();
        viewPort.iterateCells(undefined, spyFn, 3);
        expect(spyFn).toHaveBeenCalledWith(0);
        expect(spyFn).toHaveBeenCalledWith(2);
        expect(spyFn).not.toHaveBeenCalledWith(viewPort.rows - 1);
        expect(spyFn.callCount).toEqual(3);
    });

    it('should let you iterate the cols to a max', function () {
        var spyFn = jasmine.createSpy();
        viewPort.iterateCells(spyFn, undefined, undefined, 3);
        expect(spyFn).toHaveBeenCalledWith(0, 0);
        expect(spyFn).toHaveBeenCalledWith(5, 2);
        expect(spyFn).not.toHaveBeenCalledWith(viewPort.rows - 1, viewPort.cols - 1);
        expect(spyFn.callCount).toEqual(3 * viewPort.rows);
    });

    describe('cell coordinate conversion', function () {
        it('should do nothing when not scrolled', function () {
            expect(viewPort.toVirtualRow(5)).toEqual(5);
            expect(viewPort.toVirtualCol(6)).toEqual(6);
        });

        it('should offset result by the scroll amount', function () {
            grid.cellScrollModel.scrollTo(5, 6);
            expect(viewPort.toVirtualRow(3)).toEqual(8);
            expect(viewPort.toVirtualCol(2)).toEqual(8);
        });
    });

    it('should clamp pixels to the viewport', function () {
        expect(viewPort.clampY(-1)).toBe(0);
        expect(viewPort.clampY(100000000)).toBe(helper.CONTAINER_HEIGHT);
        expect(viewPort.clampX(-1)).toBe(0);
        expect(viewPort.clampX(100000000)).toBe(helper.CONTAINER_WIDTH);
    });


    it('should calculate the top left value of a viewport cell', function () {
        expect(viewPort.getRowTop(2)).toEqual(30 * 2);
        expect(viewPort.getColLeft(3)).toEqual(100 * 3);
    });

    it('should calculate the top left value of a viewport cell when shifted by one', function () {
        grid.cellScrollModel.scrollTo(0, 1);
        expect(viewPort.getRowTop(2)).toEqual(30 * 2);
        expect(viewPort.getColLeft(0)).toEqual(0);
    });

    it('should calculate the width and height value of a viewport cell', function () {
        beforeEachFunction([20, 30], [99, 100]);
        expect(viewPort.getRowHeight(0)).toEqual(20);
        expect(viewPort.getColWidth(0)).toEqual(99);
    });

    it('should calculate the width and height value of a viewport cell when shifted by one', function () {
        beforeEachFunction([20, 30], [99, 100]);
        grid.cellScrollModel.scrollTo(1, 1);
        expect(viewPort.getRowHeight(0)).toEqual(30);
        expect(viewPort.getColWidth(0)).toEqual(100);
    });

    describe('fixed rows and cols', function () {

        it('should affect conversion to virtual', function () {
            beforeEachFunction(false, false, 1, 2);
            grid.cellScrollModel.scrollTo(2, 1);
            expect(viewPort.toVirtualRow(0)).toBe(0);
            expect(viewPort.toVirtualCol(0)).toBe(0);

            expect(viewPort.toVirtualRow(1)).toBe(3);
            expect(viewPort.toVirtualCol(2)).toBe(3);
        });


        it('should affect height and width', function () {
            beforeEachFunction([5, 10, 15], [10, 20, 30], 1, 1);
            grid.cellScrollModel.scrollTo(1, 1);
            expect(viewPort.getColWidth(0)).toBe(10);
            expect(viewPort.getColWidth(1)).toBe(30);
            expect(viewPort.getRowHeight(0)).toBe(5);
            expect(viewPort.getRowHeight(1)).toBe(15);
        });

        it('should affect top and left', function () {
            beforeEachFunction([5, 10, 15], [10, 20, 30], 1, 1);
            grid.cellScrollModel.scrollTo(1, 1);
            expect(viewPort.getColLeft(0)).toBe(0);
            expect(viewPort.getColLeft(1)).toBe(10);
            //skip the scrolled width
            expect(viewPort.getColLeft(2)).toBe(10 + 30);

            expect(viewPort.getRowTop(0)).toBe(0);
            expect(viewPort.getRowTop(1)).toBe(5);
            //skip the scrolled width
            expect(viewPort.getRowTop(2)).toBe(5 + 15);
        });
    });

    it('should let me get a real row or col from a virtual one', function () {
        grid.cellScrollModel.scrollTo(1, 1);
        expect(viewPort.toRealRow(1)).toBe(0);
        expect(viewPort.toRealCol(1)).toBe(0);
    });

    it('should return NaN for rows and cols that arent in the view', function () {
        beforeEachFunction([5, 10, 15], [10, 20, 30], 1, 1);
        var rowScroll = 1;
        var colScroll = 1;
        grid.cellScrollModel.scrollTo(rowScroll, colScroll);
        expect(viewPort.toRealRow(1)).toBeNaN();
        expect(viewPort.toRealCol(1)).toBeNaN();
        expect(viewPort.toRealRow(viewPort.rows + rowScroll)).toBeNaN();
        expect(viewPort.toRealCol(viewPort.cols + colScroll)).toBeNaN();
    });

    describe('intersect', function () {

        function expectRangeToHave(intersection, t, l, h, w) {
            expect(intersection).topToBe(t);
            expect(intersection).leftToBe(l);
            expect(intersection).heightToBe(h);
            expect(intersection).widthToBe(w);
        }

        it('should return the same range for ranges totally in the view', function () {
            var range = helper.makeFakeRange(0, 0, 2, 3);
            expectRangeToHave(viewPort.intersect(range), 0, 0, 2, 3);
        });

        it('should return null for ranges whos top is too high', function () {
            var range = helper.makeFakeRange(10000, 0, 2, 3);
            expect(viewPort.intersect(range)).toBe(null);
        });

        it('should return null for ranges whos top plus height is below the minimum', function () {
            var range = helper.makeFakeRange(0, 0, 2, 3);
            grid.cellScrollModel.scrollTo(5, 0);
            expect(viewPort.intersect(range)).toBe(null);
        });

        it('should return null for ranges whos left is too high', function () {
            var range = helper.makeFakeRange(0, 10000, 2, 3);
            expect(viewPort.intersect(range)).toBe(null);
        });

        it('should return null for ranges whos left plus width is below the minimum', function () {
            var range = helper.makeFakeRange(0, 0, 2, 3);
            grid.cellScrollModel.scrollTo(0, 5);
            expect(viewPort.intersect(range)).toBe(null);
        });

        it('should be able to intersect single cell ranges', function () {
            var range = helper.makeFakeRange(0, 0, 1, 1);
            expectRangeToHave(viewPort.intersect(range), 0, 0, 1, 1);
        });

        it('should return just the intersected piece for ranges that do intersect', function () {
            var range = helper.makeFakeRange(5, 5, 10000, 10000);
            expectRangeToHave(viewPort.intersect(range), 5, 5, viewPort.rows - 5, viewPort.cols - 5);

            range = helper.makeFakeRange(5, 5, Infinity, Infinity);
            expectRangeToHave(viewPort.intersect(range), 5, 5, viewPort.rows - 5, viewPort.cols - 5);

            range = helper.makeFakeRange(0, 0, 5, 6);
            grid.cellScrollModel.scrollTo(3, 3);
            expectRangeToHave(viewPort.intersect(range), 0, 0, 2, 3);

        });

        it('should be able to return ranges that cross the fixed boundary when scrolled', function () {
            beforeEachFunction(false, false, 1, 2);
            var range = helper.makeFakeRange(0, 0, 5, 5);
            grid.cellScrollModel.scrollTo(2, 3);
            expectRangeToHave(viewPort.intersect(range), 0, 0, 3, 2);
        });

        it('should be able to return ranges that only intersect the fixed area', function () {
            beforeEachFunction(false, false, 3, 3);
            var range = helper.makeFakeRange(0, 0, 1, 1);
            grid.cellScrollModel.scrollTo(2, 3);
            expectRangeToHave(viewPort.intersect(range), 0, 0, 1, 1);
        });

        it('should be able to intersect single cell ranges just past the fixed area', function () {
            beforeEachFunction(false, false, 1, 1);
            var range = helper.makeFakeRange(1, 1, 1, 1);
            expectRangeToHave(viewPort.intersect(range), 1, 1, 1, 1);
        });

        it('should return null for ranges that should be scrolled out of view that would otherwise lie in the fixed area', function () {
            beforeEachFunction(false, false, 1, 3);
            grid.cellScrollModel.scrollTo(1, 0);
            var range = helper.makeFakeRange(1, 1, 1, 1);
            expect(viewPort.intersect(range)).toBe(null);
        });

        it('should be able to return ranges that intersect exactly the fixed area', function () {
            beforeEachFunction(false, false, 3, 3);
            var range = helper.makeFakeRange(0, 0, 3, 3);
            grid.cellScrollModel.scrollTo(2, 3);
            expectRangeToHave(viewPort.intersect(range), 0, 0, 3, 3);
        });

        it('should be able to return ranges that only intersect the scrollable area', function () {
            beforeEachFunction(false, false, 1, 2);
            var range = helper.makeFakeRange(5, 5, 10000, 10000);
            grid.cellScrollModel.scrollTo(1, 1);
            expectRangeToHave(viewPort.intersect(range), 4, 4, viewPort.rows - 4, viewPort.cols - 4);
        });

        it('should be able to return a range for the entire virtual space', function () {
            beforeEachFunction(false, false, 1, 1);
            var range = helper.makeFakeRange(0, 0, Infinity, Infinity);
            expectRangeToHave(viewPort.intersect(range), 0, 0, viewPort.rows, viewPort.cols);
        });
    });

});