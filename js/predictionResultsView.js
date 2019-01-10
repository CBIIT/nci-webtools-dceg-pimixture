appMixture.PredictionResultView = Backbone.View.extend({
    tagName: 'div',
    id: 'results',
    className: 'col-lg-8',
    events: {
        'input #pageSize': 'changePageSize',
        'click .sortByColumn': 'sort',
        'click .pageNav': 'changePage'
    },
    initialize: function() {
        this.template = _.template(appMixture.templates.get('predictionResults'), {
            'variable': 'data'
        });
        this.model.on({
            'change:results change:end change:start change:errors': this.render
        }, this);
    },
    changePageSize: function(e) {
        var pageSize = parseInt(e.target.value);
        var resultLength = 0;
        if (this.model.get('results') && this.model.get('results').prediction) {
            resultLength = this.model.get('results').prediction.length;
        }
        var pages = Math.ceil(resultLength / pageSize);
        var pageNum = Math.floor(this.model.get('start') / pageSize) + 1;
        this.model.set('pageSize', pageSize, {silent: true});
        this.model.set('pages', pages, {silent: true});
        this.model.set('pageNum', pageNum, {silent: true});
        this.calculatePageBoundaries();
    },
    changePage: function(e) {
        e.preventDefault();
        var pageNum = parseInt(e.target.dataset.pageNum);
        if (pageNum && pageNum >= 1 && pageNum <= this.model.get('pages')) {
            this.model.set('pageNum', pageNum, {silent: true});
            this.calculatePageBoundaries();
        }
    },
    calculatePageBoundaries: function() {
        var pageNum = this.model.get('pageNum');
        var pageSize = this.model.get('pageSize');
        var resultLength = 0;
        if (this.model.get('results') && this.model.get('results').prediction) {
            resultLength = this.model.get('results').prediction.length;
        }
        var start = (pageNum -1) * pageSize;
        var end = pageNum * pageSize;
        var end = end > resultLength ? resultLength : end;
        this.model.set('start', start, {silent: true});
        this.model.set('end', end, {silent: true});
        this.model.trigger('change:end', this.model);
    },
    calculateNeighborPages: function() {
        var currentPage = this.model.get('pageNum');
        var start = currentPage - Math.floor(appMixture.MAX_PAGES / 2);
        if (start < 1) {
            start = 1;
        }
        var end = start + appMixture.MAX_PAGES -1;
        if (end > this.model.get('pages')) {
            var emptySpace = end - this.model.get('pages');
            end = this.model.get('pages');
            start -= emptySpace;
            if (start < 1) {
                start = 1;
            }
        }
        var pages = [];
        for (var i = start; i <= end; ++i) {
            pages.push(i);
        }
        this.model.set('neighborPages', pages, {silent: true});
    },
    sort: function(e){
        var column = e.currentTarget.dataset['column'];
        var order = 'asc';
        if (column === this.model.get('column')) {
            if (this.model.get('order') === 'asc') {
                order = 'desc';
            } else {
                order = 'asc';
            }
        }

        this.model.set('column', column);
        this.model.set('order', order);
        this.model.get('results').prediction.sort(function(a, b) {
            if (a[column] < b[column]) {
                return order === 'asc' ? -1 : 1;
            } else if (a[column] > b[column]) {
                return order === 'asc' ? 1 : -1;
            } else {
                return 0;
            }
        });
        this.render();
    },
    render: function() {
        this.calculateNeighborPages();
        this.$el.html(this.template(this.model.attributes));
        if (this.model.get('column')) {
            var selecter = '[data-column="' + this.model.get('column') + '"] .fas';
            var icon = this.model.get('order') === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
            this.$(selecter).removeClass('fa-sort').addClass(icon);
            this.$(selecter).css('color', 'blue');
        }
        return this;
    }
});