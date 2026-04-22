appMixture.ResultsView = Backbone.View.extend({
    tagName: 'div',
    className: 'col-lg-8',
    id: 'output',
    events: {
        'click #runPredictionBtn': 'navigateToPrediction'
    },
    navigateToPrediction: function(e) {
        e.preventDefault();
        appMixture.models.prediction.clear().set(appMixture.models.prediction.defaults);
        appMixture.models.prediction.set('serverFile', this.model.get('Rfile'));
        appMixture.models.prediction.set('jobName', this.model.get('jobName'));
        appMixture.models.prediction.set('maxTimePoint', this.model.get('maxTimePoint'));
        var covariatesSelection = appMixture.models.form.get('covariatesSelection');
        appMixture.models.prediction.set('interceptOnly', covariatesSelection === "");

        if (appMixture.models.predictionResultModel) {
            appMixture.models.predictionResultModel.clear().set(appMixture.models.predictionResultModel.defaults);
        }
        appMixture.router.navigate('#prediction', true);
    },
    initialize: function () {
        this.model.on({
            'change': this.render
        }, this);
        this.template = _.template(appMixture.templates.get('results'), {
            'variable': 'data'
        });
    },
    render: function () {
        this.$el.html(this.template(this.model.attributes));
        return this;
    }
});