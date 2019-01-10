
appMixture.BaseView = Backbone.View.extend({
    el: '#main-tool',
    render: function() {
        appMixture.views.form = new appMixture.FormView({
            model: this.model.get('form')
        });
        appMixture.views.results = new appMixture.ResultsView({
            model: this.model.get('results')
        });
        this.$el.append(appMixture.views.form.render().el);
        this.$el.append(appMixture.views.results.render().el);
        return this;
    }
});