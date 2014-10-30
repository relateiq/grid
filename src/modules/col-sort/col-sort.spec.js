(function () {
    var mockEvent = require('@grid/custom-event');
    describe('col-sort', function () {


        var helper = require('@grid/grid-spec-helper')();
        var grid;
        beforeEach(function () {
            grid = helper.buildSimpleGrid();
        });

        it('should call data model toggle sort on click without drag', function () {
            var spy = spyOn(grid.dataModel, 'toggleSort');
            var click = mockEvent('click');
            click.clientY = 1;
            grid.eventLoop.fire(click);
            expect(spy).toHaveBeenCalled();
        });

        it('should not call sort for clicks outside the header area', function () {
            var spy = spyOn(grid.dataModel, 'toggleSort');
            var click = mockEvent('click');
            click.clientY = 100;
            grid.eventLoop.fire(click);
            expect(spy).not.toHaveBeenCalled();
        });

    });
})();