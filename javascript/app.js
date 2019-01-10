var appMixture = {
    events: {
        updateModel: function (e) {
            var e = $(e.target);
            if (e.attr('type') == 'checkbox') {
                this.model.set(e.attr('name') || e.attr('id'), e.prop('checked'));
            } else {
                this.model.set(e.attr('name') || e.attr('id'), !e.hasClass('selectized') ? e.val() : e.val().length > 0 ? e.val().split(',') : []);
            }
        }
    },
    models: {},
    views: {},
    variables: [
        'outcomeC',
        'outcomeL',
        'outcomeR',
        'strata',
        'weight'
    ],
    MAX_PAGES: 5,
    currentView: null,
    showView: function(view) {
        if (this.currentView !== null && this.currentView.cid !== view.cid) {
            this.currentView.$el.html("");
        }
        this.currentView = view;
        return view.render();
    }
};

const MAX_UNIQUE_VALUES = 20;
const QUEUE_DATA_THRESHOLD = 8000;
const QUEUE_COVARIATES_THRESHOLD = 20;