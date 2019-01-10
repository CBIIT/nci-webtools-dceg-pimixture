appMixture.HomeView = Backbone.View.extend({
    el: '#home-page',
    initialize: function() {
        this.template = _.template(appMixture.templates.get('home'), {
            'variable': 'data'
        });
    },
    render: function() {
        this.$el.html(this.template())
    }
});